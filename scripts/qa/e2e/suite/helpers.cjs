/* Shared helpers for the e2e QA suites (run inside the VS Code extension host). */
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const { REPO, SAMPLE, QA, ADV, E, UV_PY, VENV_PY } = require('../paths.cjs');
const RUN_DIR = process.env.SDV_E2E_RUN_DIR || path.join(E, 'runs', 'adhoc');

const EXT = process.env.SDV_E2E_EXT_ROOT || REPO;
const out = (p) => require(path.join(EXT, 'out/src', p));
const { DataViewerPanel } = out('DataViewerPanel.js');
const { UIController } = out('panel/UIController.js');
const { MessageBus } = out('panel/communication/MessageBus.js');
const { Logger } = out('common/Logger.js');

const logs = [];
const results = [];
let patched = false;

function patchOnce() {
    if (patched) return;
    patched = true;
    const origLog = Logger.log;
    Logger.log = function (message, level = 'info') {
        logs.push(`${new Date().toISOString()} [${level}] ${message}`);
        return origLog.call(this, message, level);
    };
    const origLoad = UIController.prototype.loadFile;
    UIController.prototype.loadFile = function (uri) {
        const t0 = Date.now();
        const p = origLoad.call(this, uri);
        this.__loadCount = (this.__loadCount || 0) + 1;
        this.__load = p.then(() => ({ ms: Date.now() - t0 }));
        return p;
    };
    const origEmit = MessageBus.prototype.emit;
    MessageBus.prototype.emit = function (event, payload) {
        (this.__events = this.__events || []).push({ event, payload, t: Date.now() });
        return origEmit.call(this, event, payload);
    };
}

function flushLogs() {
    fs.mkdirSync(RUN_DIR, { recursive: true });
    fs.writeFileSync(path.join(RUN_DIR, 'extension.log'), logs.join('\n') + '\n');
    fs.writeFileSync(path.join(RUN_DIR, 'results.json'), JSON.stringify(results, null, 2));
}

function record(r) {
    results.push(r);
    console.log('RESULT ' + JSON.stringify(r));
    flushLogs();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setup() {
    const ext = vscode.extensions.getExtension('eschalk0.scientific-data-viewer');
    if (!ext) throw new Error('extension not found');
    patchOnce();
    await ext.activate();
    await sleep(200);
    await dp().pythonManagerInstance.waitForInitialization();
    return ext;
}

function dp() {
    return DataViewerPanel._dataProcessor;
}
function pm() {
    return dp().pythonManagerInstance;
}

function panels() {
    return Array.from(DataViewerPanel._panels.values());
}
function maxId() {
    return panels().reduce((m, p) => Math.max(m, p.getId()), DataViewerPanel._createdCount || 0);
}

async function waitFor(fn, timeoutMs = 30000, stepMs = 100) {
    const t0 = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - t0 > timeoutMs) return undefined;
        await sleep(stepMs);
    }
}

/** Wait for a panel created after `afterCount` showing fsPath (and optional query). */
async function waitNewPanel(afterCount, fsPath, timeoutMs = 30000) {
    return waitFor(
        () =>
            panels().find(
                (p) => p.getId() > afterCount && (!fsPath || p.getFileUri().fsPath === fsPath),
            ),
        timeoutMs,
    );
}

/** Wait for the (latest) load of panel; returns a summary. */
async function waitLoaded(panel, timeoutMs = 120000) {
    const ui = panel._uiController;
    const t0 = Date.now();
    await waitFor(() => ui.__load, 10000);
    if (!ui.__load) return { hung: true, reason: 'no load started' };
    const r = await Promise.race([ui.__load, sleep(timeoutMs).then(() => ({ timeout: true }))]);
    const events = ui.messageBus.__events || [];
    const last = events.filter((e) => e.event === 'dataLoaded' || e.event === 'error').pop();
    const di = ui.getDataInfo();
    return {
        ms: r.ms,
        hung: !!r.timeout,
        hasError: panel._hasError,
        lastEvent: last && last.event,
        error: last && last.event === 'error' ? last.payload : undefined,
        format: di && di.format_info && di.format_info.display_name,
        engine: di && di.used_engine,
        groups: di ? Object.keys(di.variables_flattened || {}) : undefined,
        vars: di
            ? Object.fromEntries(
                  Object.entries(di.variables_flattened || {}).map(([g, vs]) => [g, vs.map((v) => v.name)]),
              )
            : undefined,
        waitedMs: Date.now() - t0,
    };
}

async function openWith(fsPath, viewType, timeoutMs = 120000) {
    const before = maxId();
    const uri = vscode.Uri.file(fsPath);
    await vscode.commands.executeCommand('vscode.openWith', uri, viewType);
    // The panel is created once Python is initialised: on a CI runner the
    // first imports of a fresh environment (byte-compiling) can take a minute
    const panel = await waitNewPanel(before, fsPath, timeoutMs);
    if (!panel) throw new Error(`no viewer panel for ${fsPath} (${viewType}) after ${timeoutMs / 1000} s`);
    return panel;
}

async function closeAll() {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await waitFor(() => panels().length === 0, 5000);
    await sleep(200);
}

/** Send a request through the panel's real MessageBus and return the response. */
function request(panel, command, payload) {
    const bus = panel._uiController.messageBus;
    if (!bus.__patchedRespond) {
        bus.__patchedRespond = true;
        bus.__waiters = new Map();
        const o = bus.respond.bind(bus);
        bus.respond = (r) => {
            const w = bus.__waiters.get(r.requestId);
            if (w) {
                bus.__waiters.delete(r.requestId);
                w(r);
            }
            o(r);
        };
    }
    const id = 'e2e-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    return new Promise((resolve) => {
        bus.__waiters.set(id, resolve);
        bus.handleRequest({ type: 'request', id, command, payload });
    });
}

function pythonProcs(filter = 'get_data_info.py') {
    const txt = cp.execSync('ps -eo pid,ppid,etimes,args', { encoding: 'utf8' });
    return txt
        .split('\n')
        .filter((l) => l.includes(filter) && !l.includes('ps -eo'))
        .map((l) => l.trim());
}

async function setConfig(key, value) {
    await vscode.workspace
        .getConfiguration('scientificDataViewer')
        .update(key, value, vscode.ConfigurationTarget.Global);
    await sleep(150);
}

function logsSince(idx) {
    return logs.slice(idx);
}

module.exports = {
    vscode, fs, path, cp, REPO, SAMPLE, QA, ADV, E, RUN_DIR, UV_PY, VENV_PY,
    DataViewerPanel, UIController, MessageBus, Logger,
    logs, results, record, flushLogs, sleep, setup, dp, pm, panels, maxId,
    waitFor, waitNewPanel, waitLoaded, openWith, closeAll, request, pythonProcs,
    setConfig, logsSince, out,
};
