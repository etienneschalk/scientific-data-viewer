#!/usr/bin/env node
// Full-page screenshots of the data viewer, saved per version and theme:
//
//   screenshots/v0.13/<theme>/<NN>-<scenario>.png  (+ screenshots/v0.13/index.html)
//
// The page is the real one: HTMLGenerator markup with the compiled webview
// bundle and styles.css, fed by the real Python backend (info and plots run
// through `get_data_info.py` with the same CLI arguments as the extension),
// themed with the --vscode-* variables recorded from VS Code by
// capture-themes.mjs. Headless Chromium is driven over the DevTools protocol
// (Node 22 WebSocket), so no npm dependency is needed.
//
// Usage: node scripts/screenshots/take-screenshots.mjs [options]
//   --python <path>     interpreter with xarray, netCDF4, matplotlib
//                       (default: $SDV_PYTHON, .venv, python3)
//   --chrome <path>     Chrome / Chromium / Edge (default: $CHROME_PATH, then
//                       Playwright's Chromium, then the usual install locations)
//   --file <path>       screenshot this data file instead of the generated one
//   --theme <id>        only this theme (repeatable; see themes.mjs)
//   --scenario <name>   only this scenario (repeatable)
//   --setting <k=v>     override an extension setting, e.g. groupDimensionSlices=false
//                       (repeatable; defaults come from package.json)
//   --out <dir>         root folder (default: screenshots)
//   --width <px>        viewport width (default: 1024)
//   --scale <n>         device pixel ratio (default: 1; 2 for sharp docs images)
//   --skip-compile      do not run `npm run compile` first
import { execFile, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

import { THEMES, THEMES_DIR } from './themes.mjs';

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const GET_DATA_INFO = path.join(REPO, 'python', 'get_data_info.py');
const PACKAGE_JSON = JSON.parse(
    fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'),
);

const { values: options } = parseArgs({
    options: {
        python: { type: 'string' },
        chrome: { type: 'string' },
        file: { type: 'string' },
        theme: { type: 'string', multiple: true },
        scenario: { type: 'string', multiple: true },
        setting: { type: 'string', multiple: true },
        out: { type: 'string', default: 'screenshots' },
        width: { type: 'string', default: '1024' },
        scale: { type: 'string', default: '1' },
        'skip-compile': { type: 'boolean', default: false },
    },
});

/**
 * Each scenario loads the page, runs `action` inside it (stringified, so it
 * may only use page globals), then takes a full-page screenshot.
 */
const SCENARIOS = [
    { name: 'overview' },
    {
        name: 'expanded',
        action: async () => {
            document.querySelectorAll('details').forEach((d) => (d.open = true));
        },
    },
    {
        name: 'plots',
        action: async () => {
            const buttons = [
                ...document.querySelectorAll('[data-action="create-plot"]'),
            ];
            buttons.forEach((button) => button.click());
            await waitFor(
                () => !document.querySelector('.plot-loading'),
                180000,
            );
        },
    },
    {
        name: 'plot-error',
        action: async () => {
            // An out-of-range slice makes the backend fail like a real user error
            const input = document.querySelector('.dimension-slice-input');
            input.value = '9999';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            document.querySelector('[data-action="create-plot"]').click();
            await waitFor(
                () => document.querySelector('.plot-error.error, .plot-image-container img'),
                120000,
            );
        },
    },
    { name: 'error-page', query: 'error' },
    { name: 'narrow', width: 420 },
];

function fail(message) {
    console.error(`error: ${message}`);
    process.exit(1);
}

function versionFolder() {
    const [major, minor] = PACKAGE_JSON.version.split('.');
    return `v${major}.${minor}`;
}

/** Extension settings as the panel would send them: defaults + --setting. */
function extensionConfig() {
    const prefix = 'scientificDataViewer.';
    const config = {};
    for (const section of [PACKAGE_JSON.contributes.configuration].flat()) {
        for (const [key, spec] of Object.entries(section.properties ?? {})) {
            if (key.startsWith(prefix) && 'default' in spec) {
                config[key.slice(prefix.length)] = spec.default;
            }
        }
    }
    for (const setting of options.setting ?? []) {
        const [key, ...rest] = setting.split('=');
        const raw = rest.join('=');
        if (!(key in config)) {
            fail(`unknown setting ${key}`);
        }
        try {
            config[key] = JSON.parse(raw);
        } catch {
            config[key] = raw;
        }
    }
    return config;
}

function findPython() {
    const candidates = [
        options.python,
        process.env.SDV_PYTHON,
        path.join(REPO, '.venv', 'bin', 'python'),
        path.join(REPO, '.venv', 'Scripts', 'python.exe'),
    ].filter(Boolean);
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    return found ?? (process.platform === 'win32' ? 'python' : 'python3');
}

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

function findChrome() {
    const explicit = options.chrome ?? process.env.CHROME_PATH;
    if (explicit) {
        return explicit;
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
        fail('no Chrome / Chromium found: pass --chrome <path> or set CHROME_PATH (or `npx playwright install chromium`)');
    }
    return found;
}

/** Host modules of the compiled extension, with `vscode` stubbed out. */
function loadExtensionModules() {
    const require = createRequire(import.meta.url);
    const Module = require('node:module');
    const vscodeStub = { Uri: { joinPath: () => ({}) } };
    const originalLoad = Module._load;
    Module._load = function (request, ...rest) {
        return request === 'vscode' ? vscodeStub : originalLoad.call(this, request, ...rest);
    };
    const out = (file) => path.join(REPO, 'out', 'src', file);
    if (!fs.existsSync(out('panel/HTMLGenerator.js'))) {
        fail('out/ is missing: run `npm run compile` (or drop --skip-compile)');
    }
    require(out('common/vscodeutils.js')).setPackageJson(PACKAGE_JSON);
    return {
        HTMLGenerator: require(out('panel/HTMLGenerator.js')).HTMLGenerator,
        DataProcessor: require(out('python/DataProcessor.js')),
    };
}

async function runBackend(python, args) {
    const { stdout } = await execFileAsync(python, [GET_DATA_INFO, ...args], {
        cwd: REPO,
        maxBuffer: 512 * 1024 * 1024,
        timeout: 180000,
    });
    const lastLine = stdout.trim().split('\n').pop();
    return JSON.parse(lastLine);
}

function loadTheme(id) {
    const file = path.join(THEMES_DIR, `${id}.json`);
    if (!fs.existsSync(file)) {
        fail(`${file} is missing: run node scripts/screenshots/capture-themes.mjs`);
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** JSON safe to embed in an inline <script>. */
function scriptJson(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeAttribute(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** The viewer page as VS Code would show it in `theme`, with a fake host. */
function buildPage(HTMLGenerator, theme, data) {
    const bodyAttributes = Object.entries(theme.body)
        .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
        .join(' ');
    const host = `<style id="_defaultStyles">${theme.defaultStyles}</style>
<script>
    window.__SDV = ${scriptJson(data)};
    window.acquireVsCodeApi = () => ({
        getState: () => undefined,
        setState: () => undefined,
        postMessage: async (message) => {
            if (message.type !== 'request') return;
            let reply = { success: true };
            if (message.command === 'createPlot') {
                const response = await fetch('/plot', {
                    method: 'POST',
                    body: JSON.stringify({ theme: ${scriptJson(theme.id)}, plot: message.payload }),
                });
                reply = await response.json();
            }
            window.dispatchEvent(new MessageEvent('message', { data: {
                type: 'response', requestId: message.id, success: reply.success,
                payload: reply.payload, error: reply.error,
            } }));
        },
    });
    window.waitFor = (condition, timeout) => new Promise((resolve, reject) => {
        const start = Date.now();
        const poll = () => {
            if (condition()) resolve();
            else if (Date.now() - start > timeout) reject(new Error('timeout'));
            else setTimeout(poll, 100);
        };
        poll();
    });
    window.addEventListener('DOMContentLoaded', () => setTimeout(() => {
        const event = location.search.includes('error')
            ? { event: 'error', payload: window.__SDV.error }
            : { event: 'dataLoaded', payload: window.__SDV.loaded };
        window.dispatchEvent(new MessageEvent('message', { data: { type: 'event', ...event } }));
    }, 0));
</script>`;
    return HTMLGenerator.generateMainHTML(false, data.loaded.data.lastLoadTime, 1)
        .replace('<html lang="en">', `<html lang="en" style="${escapeAttribute(theme.htmlStyle)}">`)
        .replace('<body>', `<body ${bodyAttributes}>`)
        .replace('<head>', `<head>\n${host}`);
}

/** Minimal Chrome DevTools Protocol client over the built-in WebSocket. */
class Browser {
    static async launch(executable) {
        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdv-screenshots-'));
        const args = [
            '--headless',
            '--remote-debugging-port=0',
            `--user-data-dir=${userDataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-gpu',
            '--hide-scrollbars',
            '--mute-audio',
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

const MAX_VIEWPORT_HEIGHT = 16000;

async function screenshot(browser, url, scenario, width, scale, file) {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => browser.send(method, params, sessionId);
    const evaluate = async (expression) => {
        const { result, exceptionDetails } = await page('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true,
        });
        if (exceptionDetails) {
            throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
        }
        return result.value;
    };
    try {
        const metrics = { width, height: 900, deviceScaleFactor: scale, mobile: false };
        await page('Emulation.setDeviceMetricsOverride', metrics);
        await page('Page.enable');
        const loaded = browser.waitForEvent('Page.loadEventFired', sessionId);
        await page('Page.navigate', { url });
        await loaded;
        await evaluate(`waitFor(() => !document.getElementById('loading') || document.getElementById('loading').classList.contains('hidden'), 30000)`);
        if (scenario.action) {
            await evaluate(`(${scenario.action.toString()})()`);
        }
        await evaluate('document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))');
        const height = await evaluate('Math.ceil(document.documentElement.scrollHeight)');
        await page('Emulation.setDeviceMetricsOverride', {
            ...metrics,
            height: Math.min(height, MAX_VIEWPORT_HEIGHT),
        });
        await evaluate('window.scrollTo(0, 0); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
        const { data } = await page('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: height > MAX_VIEWPORT_HEIGHT,
        });
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
    } finally {
        await browser.send('Target.closeTarget', { targetId });
    }
}

function writeIndex(versionDir, themes, scenarios) {
    const sections = themes
        .map((theme) => {
            const figures = scenarios
                .filter(({ file }) => fs.existsSync(path.join(versionDir, theme.id, file)))
                .map(({ name, file }) => `<figure><a href="${theme.id}/${file}"><img src="${theme.id}/${file}" alt="${name}" loading="lazy"></a><figcaption>${name}</figcaption></figure>`)
                .join('\n');
            return figures && `<h2>${theme.vscodeName}</h2>\n<div class="grid">${figures}</div>`;
        })
        .join('\n');
    fs.writeFileSync(
        path.join(versionDir, 'index.html'),
        `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Scientific Data Viewer ${PACKAGE_JSON.version} screenshots</title>
<style>
body { font-family: system-ui, sans-serif; margin: 24px; background: #f5f5f5; color: #222; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
figure { margin: 0; }
img { width: 100%; height: 320px; object-fit: cover; object-position: top; border: 1px solid #ccc; border-radius: 6px; background: #fff; }
figcaption { font-size: 13px; margin-top: 4px; }
</style></head><body>
<h1>Scientific Data Viewer ${PACKAGE_JSON.version}</h1>
<p>Generated ${new Date().toISOString()} by scripts/screenshots/take-screenshots.mjs</p>
${sections}
</body></html>
`,
    );
}

async function main() {
    if (typeof WebSocket === 'undefined') {
        fail(`Node ${process.version} has no WebSocket: use Node 22 (nvm use)`);
    }
    if (!options['skip-compile']) {
        console.log('Compiling (npm run compile)...');
        const result = spawnSync('npm', ['run', 'compile'], {
            cwd: REPO,
            stdio: 'inherit',
            shell: process.platform === 'win32',
        });
        if (result.status !== 0) {
            fail('npm run compile failed');
        }
    }
    const { HTMLGenerator, DataProcessor } = loadExtensionModules();
    const python = findPython();
    const chrome = findChrome();
    const config = extensionConfig();
    const width = Number(options.width);
    const scale = Number(options.scale);

    const themes = THEMES.filter((t) => !options.theme || options.theme.includes(t.id)).map((t) => ({ ...t, ...loadTheme(t.id) }));
    // Numbered by position in SCENARIOS, so a partial run keeps the file names
    const allScenarios = SCENARIOS.map((s, i) => ({
        ...s,
        file: `${String(i + 1).padStart(2, '0')}-${s.name}.png`,
    }));
    const scenarios = allScenarios.filter((s) => !options.scenario || options.scenario.includes(s.name));
    if (themes.length === 0 || scenarios.length === 0) {
        fail(`nothing to do: themes ${THEMES.map((t) => t.id).join(', ')}; scenarios ${SCENARIOS.map((s) => s.name).join(', ')}`);
    }

    const versionDir = path.resolve(REPO, options.out, versionFolder());
    const fixtureDir = path.resolve(REPO, options.out, '.fixture');
    fs.mkdirSync(fixtureDir, { recursive: true });
    let dataFile = options.file && path.resolve(options.file);
    const brokenFile = path.join(fixtureDir, 'not_a_netcdf_file.nc');
    if (!dataFile) {
        dataFile = path.join(fixtureDir, 'screenshot_sample.nc');
        console.log(`Creating ${path.relative(REPO, dataFile)} with ${python}`);
        await execFileAsync(python, [path.join(HERE, 'make_fixture.py'), dataFile, brokenFile], { cwd: REPO });
    } else if (!fs.existsSync(brokenFile)) {
        fs.writeFileSync(brokenFile, 'This is not a NetCDF file.\n');
    }

    const infoArgs = (file) =>
        DataProcessor.buildGetDataInfoCliArgs(file, {
            convertBandsToVariables: config.convertBandsToVariables,
            smallVariableBytes: config.smallVariableBytes,
            smallValueDisplayMaxLen: config.smallValueDisplayMaxLen,
            orderGroupsAlphabetically: config.orderGroupsAlphabetically,
            showXarrayEncodingAttributes: config.showXarrayEncodingAttributes,
            netcdfEngineOrder: config.netcdfEngineOrder,
            showInheritedCoordinates: config.showInheritedCoordinates,
        });
    console.log(`Reading ${dataFile}`);
    const info = await runBackend(python, infoArgs(dataFile));
    if (info.error) {
        fail(`the backend could not read ${dataFile}: ${info.error.error}`);
    }
    const broken = (await runBackend(python, infoArgs(brokenFile))).error ?? {};
    const lastLoadTime = new Date().toISOString();
    const data = {
        loaded: {
            data: { currentFile: dataFile, dataInfo: info.result, lastLoadTime },
            python: { pythonPath: python },
            extension: { extensionConfig: config },
        },
        error: { message: broken.error, details: broken.suggestion, errorType: broken.error_type },
    };

    // Plots go through the backend like in the extension; cached per argv
    const plotCache = new Map();
    const plot = (theme, payload) => {
        const style = config.matplotlibStyle || (theme.body['data-vscode-theme-kind'] === 'vscode-dark' ? 'dark_background' : 'default');
        const args = DataProcessor.buildCreatePlotCliArgs(dataFile, payload, {
            style,
            convertBandsToVariables: config.convertBandsToVariables,
            netcdfEngineOrder: config.netcdfEngineOrder,
            showInheritedCoordinates: config.showInheritedCoordinates,
            facetgridFigsize: null,
        });
        const key = JSON.stringify(args);
        if (!plotCache.has(key)) {
            plotCache.set(
                key,
                runBackend(python, args).then(
                    (response) =>
                        response.error
                            ? { success: false, error: `Data processing error: ${response.error.error}` }
                            : { success: true, payload: response.result.plot_data },
                    (error) => ({ success: false, error: String(error.message ?? error) }),
                ),
            );
        }
        return plotCache.get(key);
    };

    const pages = new Map(themes.map((theme) => [theme.id, buildPage(HTMLGenerator, theme, data)]));
    const server = http.createServer(async (request, response) => {
        const url = new URL(request.url, 'http://localhost');
        if (request.method === 'POST' && url.pathname === '/plot') {
            let body = '';
            for await (const chunk of request) {
                body += chunk;
            }
            const { theme, plot: payload } = JSON.parse(body);
            const reply = await plot(themes.find((t) => t.id === theme), payload);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(reply));
            return;
        }
        const pageHtml = pages.get(url.pathname.slice(1));
        response.writeHead(pageHtml ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(pageHtml ?? 'Not found');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;

    console.log(`Chrome: ${chrome}`);
    const browser = await Browser.launch(chrome);
    let failures = 0;
    try {
        for (const theme of themes) {
            const themeDir = path.join(versionDir, theme.id);
            fs.mkdirSync(themeDir, { recursive: true });
            for (const scenario of scenarios) {
                const file = path.join(themeDir, scenario.file);
                const query = scenario.query ? `?${scenario.query}` : '';
                try {
                    await screenshot(browser, `${origin}/${theme.id}${query}`, scenario, scenario.width ?? width, scale, file);
                    console.log(`  ${path.relative(REPO, file)}`);
                } catch (error) {
                    failures++;
                    console.error(`  FAILED ${theme.id} / ${scenario.name}: ${error.message}`);
                }
            }
        }
    } finally {
        await browser.close();
        server.close();
    }
    writeIndex(versionDir, THEMES.map((t) => ({ ...t, ...loadTheme(t.id) })), allScenarios);
    console.log(`Done: ${path.relative(REPO, path.join(versionDir, 'index.html'))}`);
    if (failures > 0) {
        fail(`${failures} screenshot(s) failed`);
    }
}

await main();
