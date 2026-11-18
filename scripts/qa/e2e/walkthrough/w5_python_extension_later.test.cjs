// W5: fresh VS Code, other extensions allowed but none installed
// (runner.cjs --with-extensions). The user clicks "Use My Own Interpreter",
// installs the Python extension in the same window, and clicks again.
const w = require('./wt.cjs');
const { h, vscode, CMD, KEY, PYTHON_EXTENSION_ID } = w;
const S = 'W5';

describe('W5 Python extension installed while VS Code runs', function () {
    this.timeout(900000);
    // Stop at the first failure: the next steps depend on it
    this.bail(true);

    before(async () => {
        await w.start(S);
    });

    it('without the Python extension, the button opens the setting', async () => {
        if (vscode.extensions.getExtension(PYTHON_EXTENSION_ID)) throw new Error('the Python extension is already installed');
        const mark = h.logs.length;
        await w.click(CMD.ownInterpreter);
        const settingOpened = h.logs.slice(mark).some((l) => /opening the overridePythonInterpreter setting/.test(l));
        h.record({ s: S, step: 'before install', settingOpened });
        if (!settingOpened) throw new Error('the overridePythonInterpreter setting was not opened');
    });

    it('installs the Python extension: it is followed without a restart', async () => {
        const mark = h.logs.length;
        await vscode.commands.executeCommand('workbench.extensions.installExtension', PYTHON_EXTENSION_ID);
        const installed = await h.waitFor(() => vscode.extensions.getExtension(PYTHON_EXTENSION_ID), 180000, 500);
        const followed = await w.waitLog(/Python extension installed or enabled/, mark, 60000);
        h.record({ s: S, step: 'install', installed: !!installed, followed: !!followed });
        if (!installed) throw new Error('the Python extension did not appear (network?)');
        if (!followed) throw new Error('the viewer did not notice the Python extension');
    });

    it('the button now opens Python: Select Interpreter; the interpreter picked there is used', async () => {
        const click = await w.clickOwnInterpreterWithPythonExtension();
        await w.pickInPythonExtension(h.UV_PY);
        const used = await w.waitInterpreter(h.UV_PY);
        h.record({ s: S, step: 'select interpreter', click, used, env: w.environment(), pythonReady: w.contextKey(KEY.pythonReady) });
        if (!click.opened || click.fallback) throw new Error('Python: Select Interpreter not opened after the install');
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
