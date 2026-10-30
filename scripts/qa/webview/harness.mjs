// QA harness: the real webview page (HTMLGenerator markup, compiled bundle,
// styles.css, real CSP) in headless Chromium, with a host shim speaking the
// webview protocol over a CDP binding. The host side runs the real backend
// through the extension's compiled DataProcessor / runProcess / parseScriptResult.
// See scripts/qa/README.md. Needs `npm run compile` (out/) and Node 22.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const QA_OUT = path.resolve(process.env.SDV_QA_OUT ?? path.join(REPO, '.qa'));
export const FIXTURES = path.join(QA_OUT, 'fixtures');
export const SAMPLES = path.join(REPO, 'sample-data');
/** Screenshots and exported pages of the scenarios */
export const IMG_DIR = path.join(QA_OUT, 'webview');
fs.mkdirSync(IMG_DIR, { recursive: true });

const EXTENSION_ENV_PY = `${os.homedir()}/.config/Code/User/globalStorage/eschalk0.scientific-data-viewer/python-environment/bin/python`;
export const PY =
    process.env.SDV_PYTHON ??
    (fs.existsSync(EXTENSION_ENV_PY) ? EXTENSION_ENV_PY : path.join(REPO, '.venv', 'bin', 'python'));
const SCRIPT = path.join(REPO, 'python', 'get_data_info.py');
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));

/** CHROME_PATH, else the newest Playwright Chromium (`npx playwright install chromium`). */
function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const root = path.join(os.homedir(), '.cache', 'ms-playwright');
    const builds = fs.existsSync(root)
        ? fs.readdirSync(root).filter((n) => /^chromium-\d+$/.test(n)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
        : [];
    for (const build of builds) {
        for (const exe of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
            const candidate = path.join(root, build, exe);
            if (fs.existsSync(candidate)) return candidate;
        }
    }
    throw new Error('no Chromium found: set CHROME_PATH or run `npx playwright install chromium`');
}
const CHROME = findChrome();

/** PASS / FAIL lines with evidence; `finish` prints the count and sets the exit code. */
export function makeChecker() {
    const results = [];
    return {
        results,
        check(name, ok, evidence) {
            results.push({ name, ok, evidence });
            console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${JSON.stringify(evidence).slice(0, 1200)}`);
        },
        finish() {
            const failed = results.filter((r) => !r.ok).length;
            console.log(`\n${results.length - failed}/${results.length} passed`);
            process.exitCode = failed > 0 ? 1 : 0;
        },
    };
}

// ---------- extension modules with vscode stubbed ----------
const require = createRequire(import.meta.url);
const Module = require('node:module');
const noop = new Proxy(function () {}, { get: () => noop, apply: () => undefined });
const vscodeStub = new Proxy(
    {},
    {
        get: (_, key) => {
            if (key === 'Uri') return { joinPath: () => ({}), file: (p) => ({ fsPath: p }) };
            if (key === 'window') return { createOutputChannel: () => ({ appendLine() {}, append() {}, show() {}, dispose() {}, info() {}, warn() {}, error() {}, debug() {}, trace() {} }) };
            if (key === 'workspace') return { getConfiguration: () => ({ get: (_k, d) => d }) };
            return noop;
        },
    },
);
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
    return request === 'vscode' ? vscodeStub : originalLoad.call(this, request, ...rest);
};
const out = (f) => path.join(REPO, 'out', 'src', f);
require(out('common/vscodeutils.js')).setPackageJson(PACKAGE_JSON);
const { HTMLGenerator } = require(out('panel/HTMLGenerator.js'));
const DataProcessor = require(out('python/DataProcessor.js'));
const { parseScriptResult } = require(out('python/PythonManager.js'));
const { runProcess } = require(out('common/runProcess.js'));
const { WEBVIEW_ALLOWED_COMMANDS } = require(out('panel/UIController.js'));
let ThemeManager = null;
try {
    ThemeManager = require(out('panel/ThemeManager.js')).ThemeManager;
} catch {
    /* optional */
}

export function defaultConfig(overrides = {}) {
    const prefix = 'scientificDataViewer.';
    const config = {};
    for (const section of [PACKAGE_JSON.contributes.configuration].flat()) {
        for (const [key, spec] of Object.entries(section.properties ?? {})) {
            if (key.startsWith(prefix) && 'default' in spec) config[key.slice(prefix.length)] = spec.default;
        }
    }
    return { ...config, ...overrides };
}

async function runBackend(args, { timeoutMs = 180000, signal } = {}) {
    const result = await runProcess(PY, [SCRIPT, ...args], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        timeoutMs,
        signal,
    });
    return parseScriptResult(result, timeoutMs);
}

export async function loadInfo(file, config, { kerchunk = false } = {}) {
    const args = DataProcessor.buildGetDataInfoCliArgs(file, {
        convertBandsToVariables: config.convertBandsToVariables && /\.(tif|tiff|geotiff)$/i.test(file),
        smallVariableBytes: config.smallVariableBytes,
        smallValueDisplayMaxLen: config.smallValueDisplayMaxLen,
        orderGroupsAlphabetically: config.orderGroupsAlphabetically,
        showXarrayEncodingAttributes: config.showXarrayEncodingAttributes,
        netcdfEngineOrder: config.netcdfEngineOrder,
        showInheritedCoordinates: config.showInheritedCoordinates,
        openAsKerchunk: kerchunk,
    });
    return runBackend(args);
}

// ---------- static server for the page and its assets ----------
const pages = new Map();
let server;
let origin;
async function ensureServer() {
    if (server) return;
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://x');
        if (url.pathname === '/webview.js') {
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            return res.end(fs.readFileSync(path.join(REPO, 'out', 'webview', 'webview.js')));
        }
        if (url.pathname === '/styles.css') {
            res.writeHead(200, { 'Content-Type': 'text/css' });
            return res.end(fs.readFileSync(path.join(REPO, 'src', 'panel', 'webview', 'styles.css')));
        }
        const html = pages.get(url.pathname.slice(1));
        res.writeHead(html ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html ?? 'not found');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    origin = `http://127.0.0.1:${server.address().port}`;
}

function loadTheme(id) {
    return JSON.parse(fs.readFileSync(path.join(REPO, 'scripts', 'screenshots', 'themes', `${id}.json`), 'utf8'));
}

function buildLivePage(theme, { useLocalTime = true, lastLoadTime = null } = {}) {
    // Same markup as the live webview: CSP + external script/style
    const fakeWebview = { cspSource: origin, asWebviewUri: () => '' };
    let html = HTMLGenerator.generateMainHTML(false, lastLoadTime, 1, { webview: fakeWebview, extensionUri: {} }, useLocalTime);
    html = html
        .replace(/<link rel="stylesheet" href="[^"]*">/, `<link rel="stylesheet" href="${origin}/styles.css">`)
        .replace(/<script src="[^"]*"><\/script>/, `<script src="${origin}/webview.js"></script>`);
    const bodyAttributes = Object.entries(theme.body)
        .map(([n, v]) => `${n}="${String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
        .join(' ');
    return html
        .replace('<html lang="en">', `<html lang="en" style="${theme.htmlStyle.replace(/"/g, '&quot;')}">`)
        .replace('<body>', `<body ${bodyAttributes}>`)
        .replace('<head>', `<head>\n<style id="_defaultStyles">${theme.defaultStyles}</style>`);
}

const SHIM = `(() => {
    const qa = (window.__qa = { alerts: [], csp: [], errors: [], sent: [], console: [] });
    for (const name of ['alert', 'confirm', 'prompt']) {
        window[name] = (m) => { qa.alerts.push(name + ':' + String(m)); };
    }
    document.addEventListener('securitypolicyviolation', (e) =>
        qa.csp.push(e.violatedDirective + ' blocked=' + e.blockedURI + ' sample=' + (e.sample || '') + ' at ' + (e.sourceFile || '') + ':' + e.lineNumber));
    window.addEventListener('error', (e) => qa.errors.push('error: ' + e.message));
    window.addEventListener('unhandledrejection', (e) => qa.errors.push('unhandledrejection: ' + String(e.reason && e.reason.message || e.reason)));
    let state;
    if (!window.__QA_DEGRADED) {
        window.acquireVsCodeApi = () => ({
            getState: () => state,
            setState: (s) => { state = s; },
            postMessage: (m) => { qa.sent.push(m); window.__hostSend(JSON.stringify(m)); },
        });
    }
})();`;

// ---------- CDP browser ----------
class Browser {
    static async launch() {
        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdv-qa-'));
        const child = spawn(CHROME, ['--headless', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`, '--no-first-run', '--disable-gpu', '--no-sandbox', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
        const url = await new Promise((resolve, reject) => {
            let err = '';
            child.stderr.on('data', (c) => {
                err += c;
                const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
                if (m) resolve(m[1]);
            });
            child.on('exit', (c) => reject(new Error('chrome exited ' + c + err)));
        });
        const socket = new WebSocket(url);
        await new Promise((r, j) => {
            socket.addEventListener('open', r, { once: true });
            socket.addEventListener('error', j, { once: true });
        });
        return new Browser(child, socket, userDataDir);
    }
    constructor(child, socket, dir) {
        Object.assign(this, { child, socket, dir, nextId: 1, pending: new Map(), listeners: new Set() });
        socket.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
            } else this.listeners.forEach((l) => l(msg));
        });
    }
    send(method, params = {}, sessionId) {
        const id = this.nextId++;
        this.socket.send(JSON.stringify({ id, method, params, sessionId }));
        return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    }
    async close() {
        this.socket.close();
        this.child.kill();
        await new Promise((r) => setTimeout(r, 300));
        fs.rmSync(this.dir, { recursive: true, force: true });
    }
}

let browser;
export async function getBrowser() {
    if (!browser) browser = await Browser.launch();
    return browser;
}
export async function shutdown() {
    if (browser) await browser.close();
    if (server) server.close();
}

/**
 * Open a viewer page on `file`. Returns a Page object with eval / click /
 * type helpers, the host log and the process table of running plots.
 */
export async function openViewer(file, { config = {}, theme = 'dark-modern', width = 1100, height = 900, kerchunk = false, info, error, useLocalTime } = {}) {
    await ensureServer();
    const b = await getBrowser();
    const cfg = defaultConfig(config);
    const th = loadTheme(theme);
    const key = `p${Math.random().toString(36).slice(2)}`;
    pages.set(key, buildLivePage(th, { useLocalTime: useLocalTime ?? cfg.showLoadTimeInLocalTime }));

    const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (m, p) => b.send(m, p, sessionId);
    const page = new Page(b, send, sessionId, targetId, file, cfg, th, kerchunk);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Runtime.addBinding', { name: '__hostSend' });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: SHIM });
    const loaded = page.waitEvent('Page.loadEventFired');
    await send('Page.navigate', { url: `${origin}/${key}` });
    await loaded;
    // Host loads the file like UIController.loadFile
    const t0 = Date.now();
    let response = info;
    if (!response && !error) {
        try {
            response = await loadInfo(file, cfg, { kerchunk });
        } catch (e) {
            error = { message: e.message };
        }
    }
    page.loadSecs = (Date.now() - t0) / 1000;
    page.infoResponse = response;
    if (error || response?.error) {
        const e = error ?? { message: response.error.error, details: response.error.suggestion, errorType: response.error.error_type };
        await page.emit('error', e);
    } else {
        page.lastLoadTime = new Date().toISOString();
        await page.emit('dataLoaded', {
            data: { currentFile: file, dataInfo: response.result, lastLoadTime: page.lastLoadTime },
            python: { pythonPath: PY },
            extension: { extensionConfig: cfg },
        });
    }
    await page.eval('new Promise(r => setTimeout(r, 200))');
    return page;
}

class Page {
    constructor(b, send, sessionId, targetId, file, cfg, theme, kerchunk) {
        Object.assign(this, { b, send, sessionId, targetId, file, cfg, theme, kerchunk });
        this.hostLog = [];
        this.processes = new Map(); // operationId -> {controller, child?}
        this.cdpLogs = [];
        this.dialogs = [];
        this.exported = [];
        this.listener = (msg) => {
            if (msg.sessionId !== sessionId) return;
            if (msg.method === 'Runtime.bindingCalled' && msg.params.name === '__hostSend') {
                this.onRequest(JSON.parse(msg.params.payload)).catch((e) => this.hostLog.push({ hostError: String(e) }));
            } else if (msg.method === 'Runtime.consoleAPICalled') {
                this.cdpLogs.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`.slice(0, 600));
            } else if (msg.method === 'Log.entryAdded') {
                this.cdpLogs.push(`log.${msg.params.entry.level}: ${msg.params.entry.text}`.slice(0, 600));
            } else if (msg.method === 'Runtime.exceptionThrown') {
                this.cdpLogs.push(`EXCEPTION: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`.slice(0, 800));
            } else if (msg.method === 'Page.javascriptDialogOpening') {
                this.dialogs.push(msg.params.message);
                this.send('Page.handleJavaScriptDialog', { accept: true });
            }
        };
        b.listeners.add(this.listener);
    }
    waitEvent(method) {
        return new Promise((resolve) => {
            const l = (msg) => {
                if (msg.method === method && msg.sessionId === this.sessionId) {
                    this.b.listeners.delete(l);
                    resolve(msg.params);
                }
            };
            this.b.listeners.add(l);
        });
    }
    async eval(expression, { timeout = 600000 } = {}) {
        const { result, exceptionDetails } = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout });
        if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
        return result.value;
    }
    async emit(event, payload) {
        await this.eval(`window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify({ type: 'event', event, payload })} })); true`);
    }
    async respond(requestId, success, payload, error) {
        await this.eval(`window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify({ type: 'response', requestId, success, payload, error })} })); true`);
    }
    plotStyle() {
        return this.cfg.matplotlibStyle || (this.theme.body['data-vscode-theme-kind'] === 'vscode-dark' ? 'dark_background' : 'default');
    }
    async onRequest(message) {
        if (message.type !== 'request') return;
        const { id, command, payload } = message;
        const entry = { command, payload: command === 'exportWebview' ? { htmlLength: payload?.htmlContent?.length } : summarize(payload), t: Date.now() };
        this.hostLog.push(entry);
        try {
            let reply;
            switch (command) {
                case 'createPlot': {
                    const args = DataProcessor.buildCreatePlotCliArgs(this.file, payload, {
                        style: this.plotStyle(),
                        convertBandsToVariables: this.cfg.convertBandsToVariables && /\.(tif|tiff|geotiff)$/i.test(this.file),
                        netcdfEngineOrder: this.cfg.netcdfEngineOrder,
                        showInheritedCoordinates: this.cfg.showInheritedCoordinates,
                        openAsKerchunk: this.kerchunk,
                        facetgridFigsize: Array.isArray(this.cfg.facetgridFigsize) && this.cfg.facetgridFigsize.length === 2 ? this.cfg.facetgridFigsize : null,
                    });
                    entry.args = args;
                    const controller = new AbortController();
                    if (payload.operationId) this.processes.set(payload.operationId, { controller, started: Date.now() });
                    try {
                        const response = await runBackend(args, { timeoutMs: this.cfg.plotTimeoutMs ?? 300000, signal: controller.signal });
                        if (response.error) throw new Error(`Data processing error: ${response.error.error}`);
                        if (!response.result) throw new Error('Failed to create plot');
                        reply = { plotData: response.result.plot_data, layout: response.result.plot_layout, appliedSlices: response.result.applied_isel_kwargs };
                    } finally {
                        this.processes.delete(payload.operationId);
                    }
                    break;
                }
                case 'abortPlot': {
                    const p = this.processes.get(payload.operationId);
                    if (p) {
                        this.processes.delete(payload.operationId);
                        p.controller.abort();
                        reply = { success: true, message: `Plot operation ${payload.operationId} was aborted successfully` };
                    } else reply = { success: false, message: `No active plot operation found with ID: ${payload.operationId}` };
                    break;
                }
                case 'savePlot':
                case 'openPlot':
                    reply = { success: true, filePath: payload.fileName };
                    break;
                case 'savePlotAs':
                    reply = { success: true, filePath: 'chosen.png' };
                    break;
                case 'exportWebview': {
                    let html = payload.htmlContent;
                    if (ThemeManager) {
                        try {
                            html = ThemeManager.applyThemeToWebviewContent(html, this.cfg.webviewExportTheme ?? '');
                        } catch (e) {
                            entry.themeError = String(e);
                        }
                    }
                    html = HTMLGenerator.inlineWebviewAssets(html, false);
                    this.exported.push(html);
                    reply = { success: true, filePath: 'export.html' };
                    break;
                }
                case 'refresh': {
                    const response = await loadInfo(this.file, this.cfg, { kerchunk: this.kerchunk });
                    if (response.error) await this.emit('error', { message: response.error.error, details: response.error.suggestion, errorType: response.error.error_type });
                    else await this.emit('dataLoaded', { data: { currentFile: this.file, dataInfo: response.result, lastLoadTime: new Date().toISOString() }, python: { pythonPath: PY }, extension: { extensionConfig: this.cfg } });
                    reply = undefined;
                    break;
                }
                case 'showNotification':
                    reply = undefined;
                    break;
                case 'executeCommand':
                    if (!WEBVIEW_ALLOWED_COMMANDS.has(payload.command)) throw new Error(`Command not allowed from the webview: ${payload.command}`);
                    reply = undefined;
                    break;
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
            entry.ok = true;
            await this.respond(id, true, reply);
        } catch (e) {
            entry.ok = false;
            entry.error = e.message;
            await this.respond(id, false, undefined, e.message);
        }
    }
    async qa() {
        return this.eval('JSON.parse(JSON.stringify({alerts: __qa.alerts, csp: __qa.csp, errors: __qa.errors}))');
    }
    async screenshot(file, { full = true } = {}) {
        const h = full ? await this.eval('Math.ceil(document.documentElement.scrollHeight)') : 900;
        const w = await this.eval('window.innerWidth');
        await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: Math.min(h, 16000), deviceScaleFactor: 1, mobile: false });
        await this.eval('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
        const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
        await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
    }
    async mouseDrag(x1, y1, x2, y2, steps = 10) {
        await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1 });
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
        for (let i = 1; i <= steps; i++) {
            await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps, button: 'left', buttons: 1 });
        }
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
    }
    async typeInto(selector, text, { clear = true } = {}) {
        await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); el.focus(); ${clear ? "el.select && el.select(); el.value='';" : ''} })()`);
        await this.send('Input.insertText', { text });
    }
    async close() {
        this.b.listeners.delete(this.listener);
        await this.b.send('Target.closeTarget', { targetId: this.targetId });
    }
}

function summarize(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const s = {};
    for (const [k, v] of Object.entries(payload)) s[k] = typeof v === 'string' && v.length > 200 ? `<${v.length} chars>` : v;
    return s;
}

export async function openStaticHtml(html, { width = 1100 } = {}) {
    await ensureServer();
    const b = await getBrowser();
    const key = `s${Math.random().toString(36).slice(2)}`;
    pages.set(key, html);
    const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (m, p) => b.send(m, p, sessionId);
    const page = new Page(b, send, sessionId, targetId, null, defaultConfig(), loadTheme('dark-modern'), false);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__QA_DEGRADED = true;\n' + SHIM });
    const loaded = page.waitEvent('Page.loadEventFired');
    await send('Page.navigate', { url: `${origin}/${key}` });
    await loaded;
    return page;
}
