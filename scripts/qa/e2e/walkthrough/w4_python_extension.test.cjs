// W4: fresh VS Code with the Python extension installed before it starts
// (runner.cjs --with-extensions --install-extension ms-python.python).
const w = require('./wt.cjs');
const { h, vscode, KEY, PYTHON_EXTENSION_ID } = w;
const S = 'W4';

describe('W4 own interpreter through the Python extension', function () {
    this.timeout(600000);
    // Stop at the first failure: the next steps depend on it
    this.bail(true);

    before(async () => {
        await w.start(S);
    });

    it('"Use My Own Interpreter" opens Python: Select Interpreter; the interpreter picked there is used', async () => {
        if (!vscode.extensions.getExtension(PYTHON_EXTENSION_ID)) throw new Error('Python extension not installed by the runner');
        const click = await w.clickOwnInterpreterWithPythonExtension();
        await w.pickInPythonExtension(h.UV_PY);
        const used = await w.waitInterpreter(h.UV_PY);
        h.record({ s: S, step: 'select interpreter', click, used, env: w.environment(), pythonReady: w.contextKey(KEY.pythonReady) });
        if (!click.opened || click.fallback) throw new Error('Python: Select Interpreter not opened');
        if (!used) throw new Error(`the interpreter picked in the Python extension is not used: ${JSON.stringify(w.environment())}`);
        if (w.contextKey(KEY.pythonReady) !== true) throw new Error('"Set up Python" not checked');
    });

    it('opens the sample and plots', async () => {
        const sample = await w.openSample();
        if (sample.load.hasError) throw new Error(`sample failed to load: ${JSON.stringify(sample.load.error)}`);
        await w.explore(S, sample.panel);
        await h.closeAll();
    });
});
