// Headless Chrome for the development scripts (viewer screenshots, webview QA
// harness): find a browser, launch it, talk to it over the Chrome DevTools
// Protocol with the WebSocket built into Node 22. No dependency.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function onPath(name) {
    const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
    for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
        for (const ext of exts) {
            const candidate = path.join(dir, name + ext);
            if (dir && fs.existsSync(candidate)) {
                return candidate;
            }
        }
    }
    return null;
}

/** The newest Chromium installed by `npx playwright install chromium`. */
function playwrightChromium() {
    const cacheRoots = {
        linux: path.join(os.homedir(), '.cache', 'ms-playwright'),
        darwin: path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
        win32: path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright'),
    };
    const root = cacheRoots[process.platform];
    if (!root || !fs.existsSync(root)) {
        return null;
    }
    const executables = [
        'chrome-linux64/chrome',
        'chrome-linux/chrome',
        'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-win64/chrome.exe',
        'chrome-win/chrome.exe',
    ];
    const builds = fs
        .readdirSync(root)
        .filter((name) => /^chromium-\d+$/.test(name))
        .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const build of builds) {
        for (const executable of executables) {
            const candidate = path.join(root, build, executable);
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
    }
    return null;
}

/**
 * `explicit`, else CHROME_PATH, else the newest Playwright Chromium, else a
 * Chrome / Chromium / Edge on the PATH or in its usual install folder.
 * Throws when none is found.
 */
export function findChrome(explicit = undefined) {
    const chosen = explicit ?? process.env.CHROME_PATH;
    if (chosen) {
        return chosen;
    }
    const programFiles = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']];
    const installed = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ...programFiles.filter(Boolean).flatMap((dir) => [
            path.join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(dir, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        ]),
    ];
    const found =
        playwrightChromium() ??
        ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']
            .map(onPath)
            .find(Boolean) ??
        installed.find((candidate) => fs.existsSync(candidate));
    if (!found) {
        throw new Error(
            'no Chrome / Chromium found: pass --chrome <path> or set CHROME_PATH (or `npx playwright install chromium`)',
        );
    }
    return found;
}

/** Minimal Chrome DevTools Protocol client over the built-in WebSocket. */
export class Browser {
    /**
     * @param executable  path of the browser (findChrome())
     * @param options.profilePrefix  prefix of the throw-away profile folder (in the OS temp folder)
     * @param options.hideScrollbars  hide scrollbars (screenshots); keep them for layout checks
     */
    static async launch(executable, { profilePrefix = 'sdv-chrome-', hideScrollbars = false } = {}) {
        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), profilePrefix));
        const args = [
            '--headless',
            '--remote-debugging-port=0',
            `--user-data-dir=${userDataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-gpu',
            '--mute-audio',
            ...(hideScrollbars ? ['--hide-scrollbars'] : []),
            ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
            'about:blank',
        ];
        const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        const url = await new Promise((resolve, reject) => {
            let stderr = '';
            const timer = setTimeout(() => reject(new Error(`Chrome did not start:\n${stderr}`)), 30000);
            child.stderr.on('data', (chunk) => {
                stderr += chunk;
                const match = /DevTools listening on (ws:\/\/\S+)/.exec(stderr);
                if (match) {
                    clearTimeout(timer);
                    resolve(match[1]);
                }
            });
            child.on('exit', (code) => reject(new Error(`Chrome exited (${code}):\n${stderr}`)));
        });
        const socket = new WebSocket(url);
        await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, { once: true });
            socket.addEventListener('error', reject, { once: true });
        });
        return new Browser(child, socket, userDataDir);
    }

    constructor(child, socket, userDataDir) {
        this.child = child;
        this.socket = socket;
        this.userDataDir = userDataDir;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Set();
        socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.id && this.pending.has(message.id)) {
                const { resolve, reject } = this.pending.get(message.id);
                this.pending.delete(message.id);
                message.error ? reject(new Error(message.error.message)) : resolve(message.result);
            } else {
                this.listeners.forEach((listener) => listener(message));
            }
        });
    }

    send(method, params = {}, sessionId = undefined) {
        const id = this.nextId++;
        this.socket.send(JSON.stringify({ id, method, params, sessionId }));
        return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    }

    waitForEvent(method, sessionId) {
        return new Promise((resolve) => {
            const listener = (message) => {
                if (message.method === method && message.sessionId === sessionId) {
                    this.listeners.delete(listener);
                    resolve(message.params);
                }
            };
            this.listeners.add(listener);
        });
    }

    async close() {
        this.socket.close();
        this.child.kill();
        await new Promise((resolve) => setTimeout(resolve, 300));
        fs.rmSync(this.userDataDir, { recursive: true, force: true });
    }
}
