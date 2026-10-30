const h = require('./helpers.cjs');
const { vscode, path, SAMPLE, ADV } = h;
const S = (f) => path.join(SAMPLE, f);
const A = (f) => path.join(ADV, f);

async function refresh(p) {
    const n = p._uiController.__loadCount;
    const resp = await h.request(p, 'refresh', {});
    const r = await h.waitLoaded(p);
    return { resp, loads: p._uiController.__loadCount - n, ...r };
}
function lastCmd(mark, kind) {
    return h
        .logsSince(mark)
        .filter((l) => l.includes('Full command (copy-paste)') && l.includes(` ${kind} `))
        .pop();
}
function slim(r) {
    const { vars, ...rest } = r;
    if (rest.error) rest.error = `${rest.error.errorType}: ${String(rest.error.message).slice(0, 200)}`;
    return rest;
}

describe('S6 settings', function () {
    before(async () => {
        await h.setup();
    });
    afterEach(async () => {
        await h.closeAll();
    });

    it('netcdfEngineOrder variants (sample_data.nc, netcdf3_classic.nc)', async function () {
        const p = await h.openWith(S('sample_data.nc'), 'netcdfEditor');
        const p3 = await h.openWith(A('netcdf3_classic.nc'), 'netcdfEditor');
        await h.waitLoaded(p);
        await h.waitLoaded(p3);
        const out = {};
        for (const order of [['h5netcdf'], ['scipy'], [], ['bogus'], ['h5netcdf', 'h5netcdf'], 'notAnArray', [42, 'scipy']]) {
            await h.setConfig('netcdfEngineOrder', order);
            const mark = h.logs.length;
            const r = await refresh(p);
            const r3 = await refresh(p3);
            const cmd = lastCmd(mark, 'info');
            out[JSON.stringify(order)] = {
                nc4: { hasError: r.hasError, engine: r.engine, error: r.error && r.error.message },
                nc3: { hasError: r3.hasError, engine: r3.engine, error: r3.error && r3.error.message },
                argOrder: cmd && (cmd.match(/--netcdf-engine-order (\S+)/) || [])[1],
            };
        }
        await h.setConfig('netcdfEngineOrder', undefined);
        h.record({ s: 'S6', label: 'netcdfEngineOrder', out });
        const exp = out['["h5netcdf"]'];
        if (exp.nc4.engine !== 'h5netcdf') throw new Error('h5netcdf order not applied: ' + JSON.stringify(exp));
        for (const [k, v] of Object.entries(out)) if (v.nc4.hasError || v.nc3.hasError) throw new Error(`${k}: ${JSON.stringify(v)}`);
    });

    it('netcdfEngineOrder does not apply to .cdf / .h5', async function () {
        await h.setConfig('netcdfEngineOrder', ['scipy']);
        const p = await h.openWith(S('sample_data.cdf'), 'cdfEditor');
        const r = await h.waitLoaded(p);
        const p2 = await h.openWith(S('sample_data.h5'), 'hdf5Editor');
        const r2 = await h.waitLoaded(p2);
        await h.setConfig('netcdfEngineOrder', undefined);
        h.record({ s: 'S6', label: 'engine order cdf/h5', cdf: slim(r), h5: slim(r2) });
        if (r.engine !== 'cdflib') throw new Error('cdf engine ' + r.engine);
    });

    it('showInheritedCoordinates false', async function () {
        const p = await h.openWith(S('sample_zarr_inherited_coords.zarr'), 'zarrEditor');
        await h.waitLoaded(p);
        const count = () => {
            const di = p._uiController.getDataInfo();
            return Object.fromEntries(Object.entries(di.coordinates_flattened).map(([g, cs]) => [g, cs.map((c) => c.name + (c.attributes && c.attributes.inherited_from ? `<-${c.attributes.inherited_from}` : ''))]));
        };
        const before = count();
        await h.setConfig('showInheritedCoordinates', false);
        const r = await refresh(p);
        const after = count();
        const mark = h.logs.length;
        const pr = await h.request(p, 'createPlot', { variable: '/root/temperature/raw/temperature_raw', dimensionSlices: { time: 0 }, operationId: 'inh' });
        const cmd = lastCmd(mark, 'plot');
        await h.setConfig('showInheritedCoordinates', undefined);
        h.record({ s: 'S6', label: 'showInheritedCoordinates', before, after, r: slim(r), plotOk: pr.success, plotErr: pr.error, cmdHasFlag: cmd && cmd.includes('--no-show-inherited-coordinates') });
        if (JSON.stringify(before) === JSON.stringify(after)) throw new Error('no change');
        if (!pr.success) throw new Error(pr.error);
    });

    it('showXarrayEncodingAttributes false', async function () {
        const p = await h.openWith(S('sample_netcdf_gzip.nc'), 'netcdfEditor');
        await h.waitLoaded(p);
        const enc = () => {
            const di = p._uiController.getDataInfo();
            const v = Object.values(di.variables_flattened).flat()[0];
            // Off, the encodings are empty (the webview then shows no Xarray Encoding section)
            const groupEncKeys = Object.values(di.encoding_flattened || {}).flatMap((e) => Object.keys(e));
            return { hasEncFlattened: groupEncKeys.length > 0, varEncKeys: v.encoding && Object.keys(v.encoding).length ? Object.keys(v.encoding) : null };
        };
        const before = enc();
        await h.setConfig('showXarrayEncodingAttributes', false);
        const r = await refresh(p);
        const after = enc();
        await h.setConfig('showXarrayEncodingAttributes', undefined);
        h.record({ s: 'S6', label: 'showXarrayEncodingAttributes', before, after, r: slim(r) });
        if (after.hasEncFlattened || (after.varEncKeys && after.varEncKeys.length)) throw new Error('encoding still present');
    });

    it('orderGroupsAlphabetically false', async function () {
        const p = await h.openWith(S('sample_data_unordered_groups.nc'), 'netcdfEditor');
        const r1 = await h.waitLoaded(p);
        await h.setConfig('orderGroupsAlphabetically', false);
        const r2 = await refresh(p);
        await h.setConfig('orderGroupsAlphabetically', undefined);
        h.record({ s: 'S6', label: 'orderGroupsAlphabetically', alpha: r1.groups, file: r2.groups });
        if (JSON.stringify(r1.groups) === JSON.stringify(r2.groups)) throw new Error('order unchanged');
    });

    it('maxFileSize 1 / 0 / -1', async function () {
        const out = {};
        for (const v of [1, 0, -1]) {
            await h.setConfig('maxFileSize', v);
            const res = {};
            for (const [f, vt] of [[S('sample_data.nc'), 'netcdfEditor'], [S('sample_data.h5'), 'hdf5Editor'], [S('sample_zarr_arborescence.zarr'), 'zarrEditor']]) {
                const p = await h.openWith(f, vt);
                const r = await h.waitLoaded(p);
                res[path.basename(f)] = { hasError: r.hasError, error: r.error && r.error.message };
            }
            out[v] = res;
            await h.closeAll();
        }
        await h.setConfig('maxFileSize', undefined);
        h.record({ s: 'S6', label: 'maxFileSize', out });
        if (!out[1]['sample_data.nc'].hasError || !/Maximum allowed: 1MB/.test(out[1]['sample_data.nc'].error)) throw new Error('1MB not enforced');
    });

    it('showLoadTimeInLocalTime false -> dataLoaded config after refresh', async function () {
        const p = await h.openWith(S('sample_data.h5'), 'hdf5Editor');
        await h.waitLoaded(p);
        const cfg = () => {
            const e = p._uiController.messageBus.__events.filter((x) => x.event === 'dataLoaded').pop();
            return e.payload.extension.extensionConfig.showLoadTimeInLocalTime;
        };
        const before = cfg();
        await h.setConfig('showLoadTimeInLocalTime', false);
        await refresh(p);
        const after = cfg();
        const html = p._webviewPanel.webview.html;
        await h.setConfig('showLoadTimeInLocalTime', undefined);
        h.record({ s: 'S6', label: 'showLoadTimeInLocalTime', before, after, htmlMentions: (html.match(/localtime|local-time|LocalTime[^"]*"[^"]*"/gi) || []).slice(0, 5) });
        if (before !== true || after !== false) throw new Error(`${before} -> ${after}`);
    });

    it('facetgridFigsize values', async function () {
        const p = await h.openWith(S('sample_large_4d_data.nc'), 'netcdfEditor');
        await h.waitLoaded(p);
        const out = {};
        for (const v of [undefined, [6, 2], [0, 0], [-1, 2], ['a', 'b'], [1], [1e-9, 1e-9], [2, 1e-7], [6, 2, 3], 'x']) {
            await h.setConfig('facetgridFigsize', v);
            const mark = h.logs.length;
            const resp = await h.request(p, 'createPlot', { variable: '/temperature_4d', dimensionSlices: { level: 0 }, facetCol: 'time', operationId: 'fg' + Math.random() });
            const cmd = lastCmd(mark, 'plot');
            out[JSON.stringify(v)] = { success: resp.success, error: resp.error && resp.error.slice(0, 300), pngLen: resp.payload && resp.payload.plotData && resp.payload.plotData.length, flag: cmd && (cmd.match(/--facetgrid-figsize (\S+)/) || [])[1] };
        }
        await h.setConfig('facetgridFigsize', undefined);
        h.record({ s: 'S6', label: 'facetgridFigsize', out });
        if (out['[6,2]'].flag !== '6,2') throw new Error('flag missing');
        const fails = Object.entries(out).filter(([, r]) => !r.success);
        if (fails.length) throw new Error(JSON.stringify(fails));
    });

    it('matplotlibStyle edge values', async function () {
        const p = await h.openWith(S('sample_data.h5'), 'hdf5Editor');
        await h.waitLoaded(p);
        const out = {};
        for (const v of ['ggplot', 'nonexistent_style', '--help', '-x']) {
            await h.setConfig('matplotlibStyle', v);
            const resp = await h.request(p, 'createPlot', { variable: '/reflectance', dimensionSlices: { time: 0 }, operationId: 'st' + Math.random() });
            out[v] = { success: resp.success, error: resp.error && resp.error.slice(0, 300) };
        }
        await h.setConfig('matplotlibStyle', undefined);
        h.record({ s: 'S6', label: 'matplotlibStyle', out });
    });

    it('convertBandsToVariables false', async function () {
        await h.setConfig('convertBandsToVariables', false);
        const p = await h.openWith(S('sample_multiband.tif'), 'geotiffEditor');
        const r = await h.waitLoaded(p);
        const resp = await h.request(p, 'createPlot', { variable: '/band_data', dimensionSlices: { band: 0 }, operationId: 'cb' });
        await h.setConfig('convertBandsToVariables', undefined);
        h.record({ s: 'S6', label: 'convertBandsToVariables false', vars: r.vars, plot: resp.success, err: resp.error });
        if (!resp.success) throw new Error(resp.error);
    });

    it('datetime filter on a real datetime variable', async function () {
        const p = await h.openWith(S('temporal-datasets/temporal_netcdf_datetime64.nc'), 'netcdfEditor');
        const r = await h.waitLoaded(p);
        const di = p._uiController.getDataInfo();
        const dtv = di.datetime_variables;
        const v = Object.values(di.variables_flattened).flat()[0];
        const dtName = Object.values(dtv).flat()[0];
        const resp = await h.request(p, 'createPlot', {
            variable: '/' + v.name, datetimeVariableName: typeof dtName === 'string' ? dtName : dtName && (dtName.name || dtName.path),
            startDatetime: '2000-01-01T00:00', endDatetime: '2100-01-01T00:00', operationId: 'dt',
        });
        h.record({ s: 'S6', label: 'datetime filter', dtv, v: v.name, dims: v.dimensions, success: resp.success, error: resp.error && resp.error.slice(0, 400) });
        if (!resp.success) throw new Error(resp.error);
    });
});
