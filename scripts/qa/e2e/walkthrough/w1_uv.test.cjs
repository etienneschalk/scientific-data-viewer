// W1: fresh VS Code, no Python extension, uv installed. The user opens the
// sample before setting up Python, then lets the extension manage Python,
// explores and plots, clicks the uv button again, then switches to their own
// interpreter (with and without an override).
const w = require('./wt.cjs');
const { h, vscode, CMD, KEY } = w;
const S = 'W1';

describe('W1 extension-managed Python (uv), sample opened first', function () {
    this.timeout(900000);
    // Stop at the first failure: the next steps depend on it
    this.bail(true);
    let sample;

    before(async () => {
        await w.start(S);
    });

    it('opens the sample before Python is set up: the viewer explains, "Set up Python" stays unchecked', async () => {
        const env = w.environment();
        sample = await w.openSample();
        h.record({ s: S, step: 'sample first', env, inGlobalStorage: sample.inGlobalStorage, hasError: sample.load.hasError, error: sample.load.error, pythonReady: w.contextKey(KEY.pythonReady) });
        if (!sample.inGlobalStorage) throw new Error(`sample opened from ${sample.fsPath}`);
        if (env.ready) {
            // A Python with xarray was found on this machine: nothing to explain
            return;
        }
        if (!sample.load.hasError) throw new Error('no error shown without a usable Python');
        if (w.contextKey(KEY.pythonReady) === true) throw new Error('"Set up Python" checked without a usable Python');
    });

    it('"Let the Extension Manage Python (uv)": creates the environment, the open viewer recovers by itself', async () => {
        const mark = h.logs.length;
        const t0 = Date.now();
        await w.click(CMD.setUpUv, 900000);
        const created = h.logs.slice(mark).some((l) => /Extension virtual environment created successfully/.test(l));
        const ownOn = w.setting('python.useExtensionOwnEnvironment');
        const ready = await h.waitFor(() => h.pm().ready && /python-environment/.test(h.pm().pythonPath || ''), 180000, 250);
        const recovered = await h.waitFor(() => !sample.panel._hasError, 120000, 250);
        const reload = await h.waitLoaded(sample.panel);
        h.record({ s: S, step: 'uv set up', seconds: Math.round((Date.now() - t0) / 1000), created, ownOn, env: w.environment(), pythonReady: w.contextKey(KEY.pythonReady), recovered: !!recovered, hasError: reload.hasError, groups: reload.groups });
        if (!created) throw new Error('environment not created');
        if (!ownOn) throw new Error('useExtensionOwnEnvironment not turned on');
        if (!ready) throw new Error('the extension environment is not used');
        if (w.contextKey(KEY.pythonReady) !== true) throw new Error('"Set up Python" not checked (pythonReady)');
        if (!recovered || reload.hasError) throw new Error('the viewer opened before the set up did not recover');
    });

    it('"Explore and plot": every suggested plot, saved next to the sample copy', async () => {
        await w.explore(S, sample.panel);
    });

    it('"Let the Extension Manage Python (uv)" again: the environment is reused', async () => {
        const mark = h.logs.length;
        await w.click(CMD.setUpUv, 120000);
        await h.pm().waitForInitialization();
        const recreated = h.logs.slice(mark).some((l) => /Creating extension virtual environment/.test(l));
        h.record({ s: S, step: 'uv again', recreated, env: w.environment() });
        if (recreated) throw new Error('the environment was created again');
        const r = await w.plot(sample.panel, { variable: '/sftlf' });
        if (!r.success) throw new Error(`plot failed: ${r.error}`);
    });

    it('"Use My Own Interpreter" (no Python extension): own environment off, setting opened; the interpreter typed there is used', async () => {
        const mark = h.logs.length;
        await w.click(CMD.ownInterpreter);
        const ownOff = w.setting('python.useExtensionOwnEnvironment') === false;
        const settingOpened = h.logs.slice(mark).some((l) => /opening the overridePythonInterpreter setting/.test(l));
        // The user types the path of their interpreter in the setting
        await h.setConfig('python.overridePythonInterpreter', h.UV_PY);
        const used = await w.waitInterpreter(h.UV_PY);
        const r = await w.plot(sample.panel, { variable: '/tas' });
        h.record({ s: S, step: 'own interpreter', ownOff, settingOpened, used, env: w.environment(), plot: r.success, error: r.error });
        if (!ownOff) throw new Error('useExtensionOwnEnvironment still on');
        if (!settingOpened) throw new Error('the overridePythonInterpreter setting was not opened');
        if (!used) throw new Error(`the interpreter set by the user is not used: ${JSON.stringify(w.environment())}`);
        if (!r.success) throw new Error(`plot failed: ${r.error}`);
    });

    it('"Use My Own Interpreter" with an override set: shows the setting, changes nothing', async () => {
        const mark = h.logs.length;
        await w.click(CMD.ownInterpreter);
        const shown = h.logs.slice(mark).some((l) => /overridePythonInterpreter is set/.test(l));
        const unchanged = w.setting('python.overridePythonInterpreter') === h.UV_PY && w.setting('python.useExtensionOwnEnvironment') === false;
        const r = await w.plot(sample.panel, { variable: '/tas_global_mean' });
        h.record({ s: S, step: 'own interpreter with override', shown, unchanged, plot: r.success });
        if (!shown || !unchanged) throw new Error('override not shown, or settings changed');
        if (!r.success) throw new Error(`plot failed: ${r.error}`);
        await h.closeAll();
    });
});
