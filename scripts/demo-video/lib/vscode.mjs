// A real VS Code for the demo video: fresh profile, the packaged extension
// installed like a user would have it, started offscreen (Chromium's Ozone
// headless platform: no window on the screen, no X server needed) with a
// DevTools port the recorder drives and films.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { Cdp } from './cdp.mjs';

const require = createRequire(import.meta.url);

/**
 * Environment for the VS Code processes: without the variables the VS Code
 * integrated terminal exports. ELECTRON_RUN_AS_NODE would start VS Code as
 * plain Node; VSCODE_IPC_HOOK_CLI & co. would send the CLI's commands
 * (--install-extension) to the VS Code the recorder was started from.
 */
export function cleanEnv() {
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
        if (key.startsWith('VSCODE_') || key === 'ELECTRON_RUN_AS_NODE' || key === 'ELECTRON_NO_ATTACH_CONSOLE') {
            delete env[key];
        }
    }
    return env;
}

/** Download (or reuse from .vscode-test/) VS Code `version`; returns { executable, cli }. */
export async function ensureVSCode(repo, version) {
    const testElectron = require(path.join(repo, 'node_modules', '@vscode/test-electron'));
    const executable = await testElectron.downloadAndUnzipVSCode({
        version,
        cachePath: path.join(repo, '.vscode-test'),
    });
    return { executable, cli: testElectron.resolveCliPathFromVSCodeExecutablePath(executable) };
}

/** Install `vsix` in the profile with the VS Code CLI. */
export function installExtension(cli, { userDataDir, extensionsDir }, vsix) {
    const r = spawnSync(
        cli,
        ['--user-data-dir', userDataDir, '--extensions-dir', extensionsDir, '--install-extension', vsix, '--force'],
        { encoding: 'utf8', timeout: 180000, env: cleanEnv() },
    );
    if (r.status !== 0) {
        throw new Error(`could not install ${vsix}:\n${r.stdout}\n${r.stderr}`);
    }
}

/** Kill VS Code: its process group, then anything whose command line names the run folder. */
export function killVSCode(child, runDir) {
    if (child) {
        try {
            process.kill(-child.pid, 'SIGKILL');
        } catch {
            // already gone
        }
    }
    try {
        execFileSync('pkill', ['-KILL', '-f', '--', runDir]);
    } catch {
        // pkill exits 1 when nothing matched
    }
}

/**
 * Start VS Code offscreen on a `width` x `height` virtual screen, maximized,
 * and attach to its workbench page; `env` is added to its environment (the
 * extension host and the processes the extension starts inherit it).
 * Returns { cdp, child, session, targetId }.
 */
export async function launchVSCode({
    executable,
    runDir,
    userDataDir,
    extensionsDir,
    workspace,
    width,
    height,
    env = {},
    log,
}) {
    const args = [
        '--ozone-platform=headless',
        `--ozone-override-screen-size=${width},${height}`,
        '--remote-debugging-port=0',
        '--user-data-dir',
        userDataDir,
        '--extensions-dir',
        extensionsDir,
        '--no-sandbox',
        '--disable-gpu',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-workspace-trust',
        '--new-window',
        workspace,
    ];
    const child = spawn(executable, args, {
        env: { ...cleanEnv(), ...env },
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const logStream = fs.createWriteStream(path.join(runDir, 'vscode.log'));
    const url = await new Promise((resolve, reject) => {
        let output = '';
        const timer = setTimeout(() => reject(new Error(`VS Code did not open a DevTools port:\n${output}`)), 60000);
        const onData = (chunk) => {
            logStream.write(chunk);
            output += chunk;
            const match = /DevTools listening on (ws:\/\/\S+)/.exec(output);
            if (match) {
                clearTimeout(timer);
                resolve(match[1]);
            }
        };
        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.on('exit', (code) => {
            clearTimeout(timer);
            reject(new Error(`VS Code exited (${code}) before opening a DevTools port:\n${output}`));
        });
    });
    log?.(`VS Code started (pid ${child.pid})`);
    const cdp = await Cdp.connect(url);
    let page;
    for (let i = 0; i < 120 && !page; i++) {
        const { targetInfos } = await cdp.send('Target.getTargets');
        page = targetInfos.find((t) => t.type === 'page' && /workbench\.html/.test(t.url));
        if (!page) {
            await new Promise((r) => setTimeout(r, 250));
        }
    }
    if (!page) {
        throw new Error('no workbench page after 30 s');
    }
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    return { cdp, child, session: sessionId, targetId: page.targetId };
}
