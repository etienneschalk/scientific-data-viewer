const h = require('./helpers.cjs');
const { vscode, path, fs, SAMPLE, ADV, E } = h;
const S = (f) => path.join(SAMPLE, f);
const A = (f) => path.join(ADV, f);

async function switchPy(p) {
    await h.setConfig('python.overridePythonInterpreter', p);
    await h.waitFor(() => h.pm().pythonPath === p, 60000);
    await h.pm().waitForInitialization();
    await h.sleep(300);
}
function slim(r) {
    return { hasError: r.hasError, format: r.format, error: r.error && `${r.error.errorType}: ${String(r.error.message).slice(0, 250)} || ${String(r.error.details).slice(0, 200)}` };
}

describe('S9 interpreters, kerchunk plots, deactivate', function () {
    before(async () => {
        await h.setup();
    });

    it('nonexistent interpreter / interpreter without xarray -> clean errors; switching back recovers errored panels', async function () {
        await switchPy('/nonexistent/bin/python');
        const env1 = h.pm().getCurrentEnvironmentInfo();
        const p1 = await h.openWith(S('sample_data.h5'), 'hdf5Editor');
        const r1 = await h.waitLoaded(p1, 60000);
        await switchPy(path.join(E, 'throwaway-venv/bin/python'));
        const env2 = h.pm().getCurrentEnvironmentInfo();
        const p2 = await h.openWith(S('sample_data.cdf'), 'cdfEditor');
        const r2 = await h.waitLoaded(p2, 60000);
        const loads1 = p1._uiController.__loadCount;
        await switchPy(h.UV_PY);
        await h.waitFor(() => !p1._hasError && !p2._hasError, 30000);
        const r1b = await h.waitLoaded(p1);
        const r2b = await h.waitLoaded(p2);
        h.record({ s: 'S9', label: 'interpreters', env1, r1: slim(r1), env2, r2: slim(r2), afterSwitchBack: { p1: slim(r1b), p2: slim(r2b), p1Loads: p1._uiController.__loadCount - loads1 } });
        await h.closeAll();
        if (!r1.hasError || !r2.hasError) throw new Error('expected errors');
        if (r1b.hasError || r2b.hasError) throw new Error('panels did not recover');
    });

    it('openAsKerchunk + plot with --open-as-kerchunk (venv)', async function () {
        await switchPy(h.VENV_PY);
        const out = {};
        for (const [f, v, sl] of [[A('inline_plain.json'), '/v', {}], [S('sample_data.kerchunk.json'), '/temperature', { time: 0 }], [S('my_refs.json'), null, null]]) {
            const b = h.maxId();
            await vscode.commands.executeCommand('scientificDataViewer.openAsKerchunk', vscode.Uri.file(f));
            const p = await h.waitNewPanel(b, f);
            const r = await h.waitLoaded(p);
            let variable = v;
            let slices = sl;
            if (!variable && !r.hasError) {
                const di = p._uiController.getDataInfo();
                const vv = Object.values(di.variables_flattened).flat()[0];
                variable = '/' + vv.name;
                slices = {};
                vv.dimensions.slice(0, Math.max(0, vv.dimensions.length - 2)).forEach((d) => (slices[d] = 0));
            }
            const mark = h.logs.length;
            const resp = variable ? await h.request(p, 'createPlot', { variable, dimensionSlices: slices, operationId: 'k' + Math.random() }) : { success: false, error: 'no var' };
            const cmd = h.logsSince(mark).find((l) => l.includes('Full command') && l.includes(' plot '));
            out[path.basename(f)] = { load: slim(r), variable, plot: resp.success, err: resp.error && resp.error.slice(0, 300), hasFlag: !!(cmd && cmd.includes('--open-as-kerchunk')) };
        }
        h.record({ s: 'S9', label: 'kerchunk plots', out });
        await h.closeAll();
        await switchPy(h.UV_PY);
        for (const [k, v] of Object.entries(out)) if (!v.load.hasError && !v.plot) throw new Error(`${k}: ${v.err}`);
    });

    it('LAST: start a long plot and let VS Code shut down (deactivate must kill it)', async function () {
        await h.setConfig('plotTimeoutMs', 600000);
        const p = await h.openWith(S('sample_data.nc'), 'netcdfEditor');
        await h.waitLoaded(p);
        h.request(p, 'createPlot', { variable: '/temperature', operationId: 'shutdown-1' });
        const proc = await h.waitFor(
            () => h.pythonProcs('get_data_info.py plot').map((l) => l.split(/\s+/)).find((a) => Number(a[1]) === process.pid),
            15000,
        );
        fs.writeFileSync(path.join(h.RUN_DIR, 'shutdown_pid.txt'), proc ? proc[0] : 'none');
        h.record({ s: 'S9', label: 'shutdown plot started', pid: proc && proc[0], extHostPid: process.pid });
    });
});
