#!/usr/bin/env node
// Record the demo video footage: a real VS Code, fresh profile, the packaged
// extension installed, started offscreen (no window on your screen) and driven
// like a user by scenario.mjs. Writes the frames and the montage cues; then
// run montage.py (scripts/demo-video/README.md).
//
//   node scripts/demo-video/record.mjs [--vsix <file>] [--package] [--skip-setup]
//        [--vscode-version 1.147.0] [--limit 900] [--out artefacts/demo-video]
//
//   --vsix FILE     extension to install (default <out>/build/scientific-data-viewer.vsix,
//                   packaged from the working tree when missing)
//   --package       package the working tree again (vsce; rebuilds out/)
//   --skip-setup    no Python chapter: use the repository's .venv (faster iterations)
//   --warm-uv-cache uv uses your cache and Python installs: the environment is
//                   ready in seconds, so the video no longer shows a first
//                   install (default: empty ones in <out>/run/, like a new user)
//   --limit S       watchdog: stop and close VS Code after S seconds (default 900)
//
// Output: <out>/recording/ (frames/, frames.jsonl, events.jsonl, meta.json;
// failure.png when the scenario fails). The profile, the workspace and the
// extension's uv environment live in <out>/run/, rebuilt at each recording.
// Exit: 0 recorded, 1 the scenario failed or the watchdog stopped it.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { Director } from './lib/director.mjs';
import { cleanEnv, ensureVSCode, installExtension, killVSCode, launchVSCode } from './lib/vscode.mjs';
import { scenario } from './scenario.mjs';

const HERE = import.meta.dirname;
const REPO = path.resolve(HERE, '..', '..');

const { values } = parseArgs({
    options: {
        vsix: { type: 'string' },
        package: { type: 'boolean', default: false },
        'skip-setup': { type: 'boolean', default: false },
        'warm-uv-cache': { type: 'boolean', default: false },
        'vscode-version': { type: 'string', default: '1.147.0' },
        limit: { type: 'string', default: '900' },
        out: { type: 'string', default: path.join(REPO, 'artefacts', 'demo-video') },
    },
});

const OUT = path.resolve(values.out);
const RUN = path.join(OUT, 'run');
const RECORDING = path.join(OUT, 'recording');
const WIDTH = 1920;
const HEIGHT = 1080;
const log = (message) => console.log(`[demo-video] ${message}`);

/** Settings of the filmed VS Code: a clean window, nothing that is not ours. */
function demoSettings(skipSetup) {
    return {
        'window.newWindowDimensions': 'maximized',
        // 1920 x 1080 pixels, laid out as 1600 x 900: readable in a video
        'window.zoomLevel': 1,
        'workbench.colorTheme': 'Default Dark Modern',
        'workbench.startupEditor': 'none',
        'workbench.tips.enabled': false,
        'workbench.secondarySideBar.defaultVisibility': 'hidden',
        'workbench.welcomePage.walkthroughs.openOnInstall': false,
        'workbench.layoutControl.enabled': false,
        'chat.disableAIFeatures': true,
        'chat.commandCenter.enabled': false,
        'security.workspace.trust.enabled': false,
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        'extensions.autoUpdate': false,
        'extensions.autoCheckUpdates': false,
        'extensions.ignoreRecommendations': true,
        'git.enabled': false,
        'git.openRepositoryInParentFolders': 'never',
        'files.simpleDialog.enable': true,
        'editor.minimap.enabled': false,
        ...(skipSetup
            ? { 'scientificDataViewer.python.overridePythonInterpreter': path.join(REPO, '.venv', 'bin', 'python') }
            : {}),
    };
}

function packageVsix(vsix) {
    log(`packaging the working tree -> ${path.relative(REPO, vsix)}`);
    fs.mkdirSync(path.dirname(vsix), { recursive: true });
    const r = spawnSync('npx', ['vsce', 'package', '--out', vsix], { cwd: REPO, stdio: 'inherit', env: cleanEnv() });
    if (r.status !== 0) {
        throw new Error('vsce package failed');
    }
}

function prepareRun(skipSetup) {
    fs.rmSync(RUN, { recursive: true, force: true });
    fs.rmSync(RECORDING, { recursive: true, force: true });
    const userDataDir = path.join(RUN, 'userdata');
    const extensionsDir = path.join(RUN, 'extensions');
    const workspace = path.join(RUN, 'climate-data');
    fs.mkdirSync(path.join(userDataDir, 'User'), { recursive: true });
    fs.mkdirSync(workspace, { recursive: true });
    fs.mkdirSync(RECORDING, { recursive: true });
    fs.copyFileSync(path.join(REPO, 'media', 'samples', 'sample_climate.nc'), path.join(workspace, 'sample_climate.nc'));
    fs.writeFileSync(path.join(userDataDir, 'User', 'settings.json'), JSON.stringify(demoSettings(skipSetup), null, 2));
    return { userDataDir, extensionsDir, workspace };
}

function startWatchdog(limitS) {
    const child = spawn(process.execPath, [path.join(HERE, 'lib', 'watchdog.mjs'), String(process.pid), String(limitS)], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, SDV_DEMO_RUN_DIR: RUN },
    });
    child.unref();
}

async function main() {
    const vsix = path.resolve(values.vsix ?? path.join(OUT, 'build', 'scientific-data-viewer.vsix'));
    if (values.package || (!values.vsix && !fs.existsSync(vsix))) {
        packageVsix(vsix);
    }
    const extensionVersion = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
    const profile = prepareRun(values['skip-setup']);
    startWatchdog(Number(values.limit));

    const { executable, cli } = await ensureVSCode(REPO, values['vscode-version']);
    log(`installing ${path.relative(REPO, vsix)}`);
    installExtension(cli, profile, vsix);

    let vscode;
    const stop = () => killVSCode(vscode?.child, RUN);
    process.on('SIGTERM', () => {
        // From the watchdog: past --limit
        console.error(`[demo-video] FAILED: still recording after ${values.limit} s (--limit), VS Code closed`);
        stop();
        process.exit(1);
    });
    process.on('SIGINT', () => {
        stop();
        process.exit(1);
    });
    let director;
    try {
        // A new user's uv has nothing cached: Python and the packages are
        // downloaded, and the video shows how long that takes (sped up)
        const env = values['warm-uv-cache']
            ? {}
            : { UV_CACHE_DIR: path.join(RUN, 'uv-cache'), UV_PYTHON_INSTALL_DIR: path.join(RUN, 'uv-python') };
        vscode = await launchVSCode({ executable, runDir: RUN, ...profile, width: WIDTH, height: HEIGHT, env, log });
        director = new Director({ cdp: vscode.cdp, session: vscode.session, outDir: RECORDING, log });
        await director.init();
        await director.waitFor(
            { frame: 'main', css: '.explorer-folders-view .monaco-list-row', text: 'sample_climate.nc' },
            { timeoutMs: 60000 },
        );
        // Let the workbench settle (layout, status bar, extension host)
        await director.pause(2500);
        await director.startRecording();
        const t0 = Date.now();
        log('recording');
        await scenario(director, { skipSetup: values['skip-setup'] });
        await director.stopRecording();
        fs.writeFileSync(
            path.join(RECORDING, 'meta.json'),
            JSON.stringify(
                {
                    width: WIDTH,
                    height: HEIGHT,
                    devicePixelRatio: director.dpr,
                    vscodeVersion: values['vscode-version'],
                    extensionVersion,
                    skipSetup: values['skip-setup'],
                    warmUvCache: values['warm-uv-cache'],
                    recordedAt: new Date().toISOString(),
                    seconds: Math.round((Date.now() - t0) / 1000),
                    frames: director.frameCount,
                },
                null,
                2,
            ),
        );
        log(`recorded ${director.frameCount} frames in ${Math.round((Date.now() - t0) / 1000)} s -> ${path.relative(REPO, RECORDING)}`);
    } catch (error) {
        console.error(`[demo-video] FAILED: ${error.stack ?? error}`);
        if (director) {
            await director.screenshot(path.join(RECORDING, 'failure.png')).catch(() => {});
            await director.stopRecording().catch(() => {});
            console.error(`[demo-video] screenshot of the failure: ${path.relative(REPO, path.join(RECORDING, 'failure.png'))}`);
        }
        process.exitCode = 1;
    } finally {
        vscode?.cdp.close();
        stop();
        // The filmed first install (~1.4 GB: downloads and the extension's
        // environment) is not needed any more; the logs stay
        for (const dir of [
            'uv-cache',
            'uv-python',
            'userdata/User/globalStorage/eschalk0.scientific-data-viewer/python-environment',
        ]) {
            fs.rmSync(path.join(RUN, dir), { recursive: true, force: true });
        }
    }
}

await main();
