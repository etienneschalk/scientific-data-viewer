/*
 * Helpers of the Getting Started walkthrough scenarios (scripts/qa/e2e/walkthrough.cjs).
 *
 * Each scenario runs in a fresh VS Code profile (runner.cjs --fresh): no
 * interpreter preset, an empty global storage, so no extension environment.
 * A user action is simulated with what the UI would run:
 *   - a walkthrough button = its command (the `command:` link of the step)
 *   - "Create Plot" / an "Install ..." button of the viewer = the webview
 *     request the button sends, through the panel's real MessageBus
 *   - typing a path in the settings = a settings update
 *   - picking an interpreter in Python: Select Interpreter = the Python
 *     extension's API (environments.updateActiveEnvironmentPath)
 * Walkthrough checkmarks are context keys (completionEvents onContext:): the
 * keys the extension sets are recorded from setContextKey.
 */
const h = require('../suite/helpers.cjs');
const { vscode, fs, path } = h;

const SDV_ID = 'eschalk0.scientific-data-viewer';
const CMD = {
    setUpUv: 'scientificDataViewer.setUpExtensionOwnEnvironment',
    ownInterpreter: 'scientificDataViewer.selectPythonInterpreter',
    openSample: 'scientificDataViewer.openSampleFile',
    openWalkthrough: 'scientificDataViewer.openWalkthrough',
    installPackages: 'scientificDataViewer.python.installPackages',
};
const KEY = { pythonReady: 'scientificDataViewer.pythonReady', plotCreated: 'scientificDataViewer.plotCreated' };
const PYTHON_EXTENSION_ID = 'ms-python.python';

const contextKeys = [];
let patched = false;

/** Record every context key the extension sets (before it is activated). */
function recordContextKeys() {
    if (patched) return;
    patched = true;
    const utils = h.out('common/vscodeutils.js');
    const original = utils.setContextKey;
    utils.setContextKey = (key, value) => {
        contextKeys.push({ key, value, t: Date.now() });
        return original(key, value);
    };
}

/** Last value set for a context key (undefined: never set). */
function contextKey(key) {
    const set = contextKeys.filter((k) => k.key === key);
    return set.length ? set[set.length - 1].value : undefined;
}

async function start(scenario) {
    recordContextKeys();
    // Keep extension.log current: a run stopped by the watchdog keeps its logs
    setInterval(() => h.flushLogs(), 5000).unref();
    if (process.env.SDV_E2E_FRESH !== '1') throw new Error('run with runner.cjs --fresh');
    await h.setup();
    const ext = vscode.extensions.getExtension(SDV_ID);
    const walkthroughs = ext.packageJSON.contributes.walkthroughs || [];
    if (!walkthroughs.some((w) => w.id === 'gettingStarted')) throw new Error('no gettingStarted walkthrough');
    // The walkthrough opens (Help: Welcome, or our command)
    await vscode.commands.executeCommand(CMD.openWalkthrough);
    h.record({ s: scenario, step: 'start', python: environment(), pythonReady: contextKey(KEY.pythonReady) });
}

function environment() {
    const info = h.pm().getCurrentEnvironmentInfo();
    return { ready: h.pm().ready, path: h.pm().pythonPath, source: info.source };
}

function setting(key) {
    return vscode.workspace.getConfiguration('scientificDataViewer').get(key);
}

/** Wait for a log line matching re, written after `mark` (index in h.logs). */
async function waitLog(re, mark = 0, timeoutMs = 30000) {
    return h.waitFor(() => h.logs.slice(mark).find((l) => re.test(l)), timeoutMs);
}

/** A walkthrough button: run its command, with a time limit. */
async function click(command, timeoutMs = 60000) {
    const run = Promise.resolve(vscode.commands.executeCommand(command));
    const result = await Promise.race([run.then(() => 'done'), h.sleep(timeoutMs).then(() => 'timeout')]);
    if (result === 'timeout') throw new Error(`${command} did not finish in ${timeoutMs / 1000} s`);
}

/**
 * The "Use My Own Interpreter" button when the Python extension is there:
 * it opens Python: Select Interpreter (a quick pick that waits for the user).
 * Closed here; the choice is made through the Python extension's API.
 */
async function clickOwnInterpreterWithPythonExtension() {
    const mark = h.logs.length;
    const run = Promise.resolve(vscode.commands.executeCommand(CMD.ownInterpreter));
    const opened = await waitLog(/Opening Python: Select Interpreter/, mark, 60000);
    await h.sleep(1500);
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    await Promise.race([run, h.sleep(20000)]);
    return { opened: !!opened, fallback: !!h.logs.slice(mark).find((l) => /opening the overridePythonInterpreter setting/.test(l)) };
}

/** Pick an interpreter as in Python: Select Interpreter. */
async function pickInPythonExtension(pythonPath) {
    const ext = vscode.extensions.getExtension(PYTHON_EXTENSION_ID);
    if (!ext) throw new Error('Python extension not installed');
    const api = await ext.activate();
    await api.environments.updateActiveEnvironmentPath(pythonPath);
}

/** Wait until the viewer uses `pythonPath` (same file) and is ready. */
async function waitInterpreter(pythonPath, timeoutMs = 120000) {
    const real = (p) => {
        try {
            return fs.realpathSync(p);
        } catch {
            return p;
        }
    };
    const ok = await h.waitFor(() => h.pm().ready && h.pm().pythonPath && real(h.pm().pythonPath) === real(pythonPath), timeoutMs, 250);
    await h.pm().waitForInitialization();
    return !!ok;
}

/** The "Open Sample File" button; returns the panel once loaded. */
async function openSample(timeoutMs = 120000) {
    const before = h.maxId();
    await click(CMD.openSample, timeoutMs);
    const panel = await h.waitFor(
        () => h.panels().find((p) => p.getId() > before && p.getFileUri().fsPath.endsWith('sample_climate.nc')),
        timeoutMs,
    );
    if (!panel) throw new Error('the sample did not open in a viewer');
    const load = await h.waitLoaded(panel, timeoutMs);
    const fsPath = panel.getFileUri().fsPath;
    return { panel, load, fsPath, inGlobalStorage: fsPath.includes(`${path.sep}globalStorage${path.sep}`) };
}

/** A webview request with a time limit: a scenario must never wait forever. */
async function request(panel, command, payload, timeoutMs = 180000) {
    const response = await Promise.race([
        h.request(panel, command, payload),
        h.sleep(timeoutMs).then(() => ({ timedOut: true })),
    ]);
    if (response.timedOut) throw new Error(`${command} got no answer in ${timeoutMs / 1000} s`);
    return response;
}

let op = 0;
/** "Create Plot" with the given plot options. */
async function plot(panel, options) {
    const response = await request(panel, 'createPlot', { operationId: `wt-${++op}`, ...options });
    return {
        variable: options.variable,
        options,
        success: response.success,
        error: response.error ? String(response.error).slice(0, 400) : undefined,
        png: response.payload && typeof response.payload.plotData === 'string' && response.payload.plotData.startsWith('iVBOR'),
        payload: response.payload,
    };
}

/** What the walkthrough's "Explore and plot" step suggests, on the sample. */
const EXPLORE_PLOTS = [
    { variable: '/tas_global_mean' },
    { variable: '/sftlf' },
    { variable: '/tas' },
    { variable: '/tas', dimensionSlices: { time: '0:6' } },
    { variable: '/tas', dimensionSlices: { time: 6 } },
    { variable: '/stations/tas' },
    { variable: '/stations/tas', plotX: 'time', plotHue: 'station' },
];

/** Every plot of the "Explore and plot" step; throws on the first failure. */
async function explore(scenario, panel) {
    const results = [];
    for (const options of EXPLORE_PLOTS) {
        const r = await plot(panel, options);
        results.push({ variable: r.variable, options: r.options, success: r.success, png: r.png, error: r.error });
        if (!r.success || !r.png) {
            h.record({ s: scenario, step: 'explore', results });
            throw new Error(`plot ${JSON.stringify(options)} failed: ${r.error}`);
        }
    }
    // "Save": next to the sample copy, in global storage
    const last = await plot(panel, { variable: '/sftlf' });
    const save = await request(panel, 'savePlot', { plotData: last.payload.plotData, variable: '/sftlf', fileName: 'wt_sftlf.png' });
    const savedTo = save.payload && save.payload.filePath;
    const savedNextToSample = !!savedTo && path.dirname(savedTo) === path.dirname(panel.getFileUri().fsPath) && fs.existsSync(savedTo);
    h.record({ s: scenario, step: 'explore', results, savedTo, savedNextToSample, plotCreated: contextKey(KEY.plotCreated) });
    if (!savedNextToSample) throw new Error(`plot not saved next to the sample copy: ${JSON.stringify(save)}`);
    if (contextKey(KEY.plotCreated) !== true) throw new Error('"Explore and plot" not checked (plotCreated never set)');
}

/** Interpreter without xarray, as a user may have (uv venv; Python >= 3.10). */
function makeBareVenv(name) {
    const venv = path.join(h.RUN_DIR, name);
    fs.rmSync(venv, { recursive: true, force: true });
    const r = h.cp.spawnSync('uv', ['venv', '-q', '--python', '3.12', venv], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`uv venv failed: ${r.stderr}`);
    return path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
}

module.exports = {
    h, vscode, fs, path, CMD, KEY, PYTHON_EXTENSION_ID, contextKeys, contextKey, start, environment, setting,
    waitLog, click, clickOwnInterpreterWithPythonExtension, pickInPythonExtension, waitInterpreter, openSample,
    request, plot, explore, makeBareVenv,
};
