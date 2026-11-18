// W3: fresh VS Code, uv not installed (runner.cjs --hide-uv). The uv button
// must fail cleanly; the user then uses their own interpreter.
const w = require('./wt.cjs');
const { h, CMD, KEY } = w;
const S = 'W3';

describe('W3 uv missing, then own interpreter', function () {
    this.timeout(600000);
    // Stop at the first failure: the next steps depend on it
    this.bail(true);

    before(async () => {
        await w.start(S);
    });

    it('"Let the Extension Manage Python (uv)" without uv: an error, nothing turned on, step unchecked', async () => {
        const mark = h.logs.length;
        await w.click(CMD.setUpUv, 120000);
        const noUv = h.logs.slice(mark).some((l) => /uv is not available/.test(l));
        const failed = h.logs.slice(mark).some((l) => /Failed to create extension environment/.test(l));
        const ownOn = w.setting('python.useExtensionOwnEnvironment');
        h.record({ s: S, step: 'uv missing', noUv, failed, ownOn, env: w.environment(), pythonReady: w.contextKey(KEY.pythonReady) });
        if (!noUv || !failed) throw new Error('uv was found, or no error was reported (is uv hidden from PATH?)');
        if (ownOn) throw new Error('useExtensionOwnEnvironment turned on although no environment exists');
        if (!w.environment().ready && w.contextKey(KEY.pythonReady) === true) throw new Error('"Set up Python" checked');
    });

    it('"Use My Own Interpreter", then the sample plots', async () => {
        const mark = h.logs.length;
        await w.click(CMD.ownInterpreter);
        const settingOpened = h.logs.slice(mark).some((l) => /opening the overridePythonInterpreter setting/.test(l));
        await h.setConfig('python.overridePythonInterpreter', h.UV_PY);
        const used = await w.waitInterpreter(h.UV_PY);
        h.record({ s: S, step: 'own interpreter', settingOpened, used, pythonReady: w.contextKey(KEY.pythonReady) });
        if (!settingOpened || !used) throw new Error('own interpreter not used');
        if (w.contextKey(KEY.pythonReady) !== true) throw new Error('"Set up Python" not checked');
        const sample = await w.openSample();
        if (sample.load.hasError) throw new Error(`sample failed to load: ${JSON.stringify(sample.load.error)}`);
        await w.explore(S, sample.panel);
        await h.closeAll();
    });
});
