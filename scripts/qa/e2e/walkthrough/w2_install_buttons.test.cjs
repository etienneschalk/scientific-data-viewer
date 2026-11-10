// W2: fresh VS Code, no Python extension. The user points the viewer at an
// interpreter that has none of the packages, then follows the "Install ..."
// buttons the viewer shows until the sample plots.
const w = require('./wt.cjs');
const { h, CMD, KEY } = w;
const S = 'W2';

/** The button a user would click, from what the viewer shows. */
function nextInstall(panel, plotError) {
    if (!h.pm().ready) return ['xarray']; // "If the python environment is not ready, install required package"
    if (panel._hasError) return ['netCDF4', 'h5netcdf', 'scipy']; // "Install additional packages for format: NetCDF"
    if (plotError && /matplotlib/i.test(plotError)) return ['matplotlib']; // plot error: "Install matplotlib"
    return null;
}

describe('W2 own interpreter without packages, Install buttons of the viewer', function () {
    this.timeout(900000);
    // Stop at the first failure: the next steps depend on it
    this.bail(true);

    before(async () => {
        await w.start(S);
    });

    it('"Use My Own Interpreter", a bare interpreter, then the Install buttons until the plot works', async () => {
        const mark = h.logs.length;
        await w.click(CMD.ownInterpreter);
        const settingOpened = h.logs.slice(mark).some((l) => /opening the overridePythonInterpreter setting/.test(l));
        const bare = w.makeBareVenv('user-venv');
        await h.setConfig('python.overridePythonInterpreter', bare);
        await h.waitFor(() => h.pm().pythonPath === bare, 60000);
        await h.pm().waitForInitialization();
        const readyBefore = w.contextKey(KEY.pythonReady);
        const sample = await w.openSample();
        const clicks = [];
        let plotResult;
        for (let round = 0; round < 6; round++) {
            plotResult = sample.panel._hasError || !h.pm().ready ? undefined : await w.plot(sample.panel, { variable: '/tas' });
            if (plotResult && plotResult.success) break;
            const packages = nextInstall(sample.panel, plotResult && plotResult.error);
            if (!packages) break;
            clicks.push(packages.join(','));
            const ui = sample.panel._uiController;
            const loadsBefore = ui.__loadCount || 0;
            const hadError = sample.panel._hasError;
            const response = await w.request(sample.panel, 'executeCommand', { command: CMD.installPackages, args: [packages] }, 600000);
            if (!response.success) throw new Error(`Install ${packages} failed: ${response.error}`);
            await h.pm().waitForInitialization();
            if (hadError) {
                // A viewer showing an error reloads after an install (it may
                // then show the next missing package)
                const reloaded = await h.waitFor(() => (ui.__loadCount || 0) > loadsBefore, 60000, 250);
                if (!reloaded) throw new Error(`the viewer did not reload after installing ${packages}`);
                await h.waitLoaded(sample.panel);
            }
        }
        h.record({ s: S, step: 'install buttons', settingOpened, bare, readyBefore, clicks, env: w.environment(), plot: plotResult && plotResult.success, error: plotResult && plotResult.error, pythonReady: w.contextKey(KEY.pythonReady) });
        if (!settingOpened) throw new Error('the overridePythonInterpreter setting was not opened');
        if (readyBefore === true) throw new Error('"Set up Python" checked with an interpreter without xarray');
        if (!plotResult || !plotResult.success) throw new Error(`still no plot after ${clicks.length} installs: ${clicks.join(' | ')}`);
        if (w.contextKey(KEY.pythonReady) !== true) throw new Error('"Set up Python" not checked once xarray is installed');
        await w.explore(S, sample.panel);
        await h.closeAll();
    });
});
