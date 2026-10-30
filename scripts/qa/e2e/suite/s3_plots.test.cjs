const h = require('./helpers.cjs');
const { vscode, path, SAMPLE, ADV, cp } = h;
const S = (f) => path.join(SAMPLE, f);
const A = (f) => path.join(ADV, f);

let opSeq = 0;
async function plot(panel, opts, label) {
    const operationId = opts.operationId || `e2e-op-${++opSeq}`;
    const t0 = Date.now();
    const resp = await h.request(panel, 'createPlot', { ...opts, operationId });
    const rec = {
        s: 'S3', label, file: path.basename(panel.getFileUri().fsPath), opts,
        ms: Date.now() - t0, success: resp.success,
        error: resp.error ? String(resp.error).slice(0, 600) : undefined,
        pngLen: resp.payload ? resp.payload.length : undefined,
    };
    h.record(rec);
    return rec;
}

function pidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}
function plotPids() {
    return h
        .pythonProcs('get_data_info.py plot')
        .map((l) => ({ pid: Number(l.split(/\s+/)[0]), ppid: Number(l.split(/\s+/)[1]), line: l }))
        .filter((x) => x.ppid === process.pid);
}

describe('S3 plots through the real host', function () {
    let p4d;
    before(async () => {
        await h.setup();
        p4d = await h.openWith(S('sample_large_4d_data.nc'), 'netcdfEditor');
        const r = await h.waitLoaded(p4d);
        if (r.hasError) throw new Error('load failed');
    });

    const cases4d = [
        ['slices time=0 level=0', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 } }, true],
        ['facetCol time + colWrap auto', { variable: '/temperature_4d', dimensionSlices: { level: 0 }, facetCol: 'time', colWrap: 'auto' }, true],
        ['colWrap 2', { variable: '/temperature_4d', dimensionSlices: { level: '0:4' , time: 0}, facetCol: 'level', colWrap: 2 }, true],
        ['vmin -1e-7 vmax 1', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, vmin: -1e-7, vmax: 1 }, true],
        ['vmin -0.5 vmax 0.5 (control)', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, vmin: -0.5, vmax: 0.5 }, true],
        ['vmax -1e-7 only', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, vmax: -1e-7 }, true],
        ['vmin -1e21', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, vmin: -1e21 }, true],
        ['vmin 1e-7 positive small', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, vmin: 1e-7 }, true],
        ['cmap viridis robust', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, cmap: 'viridis', robust: true }, true],
        ['cmap with spaces trimmed', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, cmap: '  magma  ' }, true],
        ['cmap invalid', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, cmap: 'not_a_cmap' }, false],
        ['slice unknown dim', { variable: '/temperature_4d', dimensionSlices: { nope: 0, time: 0, level: 0 } }, '?'],
        ['slice invalid string', { variable: '/temperature_4d', dimensionSlices: { time: 'abc', level: 0 } }, false],
        ['slice out of range', { variable: '/temperature_4d', dimensionSlices: { time: 99, level: 0 } }, false],
        ['slice step', { variable: '/temperature_4d', dimensionSlices: { time: '0:3:2', level: 0, x: '::10', y: '::10' }, facetCol: 'time' }, true],
        ['plotX/plotY swap', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, plotX: 'y', plotY: 'x', xincrease: false, yincrease: true }, true],
        ['1D robust (regression note)', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0, y: 0 }, robust: true }, true],
        ['hue line', { variable: '/temperature_4d', dimensionSlices: { time: 0, y: 0 , level: '0:3'}, plotHue: 'level', addLegend: true }, true],
        ['aspect/size/bins', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, aspect: 2, size: 3, bins: 20, addColorbar: false }, true],
        ['NaN / Infinity numbers ignored', { variable: '/temperature_4d', dimensionSlices: { time: 0, level: 0 }, vmin: NaN, vmax: Infinity, aspect: -1, size: 0, bins: 0 }, true],
        ['unknown variable', { variable: '/does_not_exist' }, false],
        ['empty variable', { variable: '' }, false],
        ['datetime filter', { variable: '/temperature_4d', dimensionSlices: { level: 0 }, datetimeVariableName: '/time', startDatetime: '2020-01-01T00:00', endDatetime: '2030-01-01T00:00', facetCol: 'time' }, '?'],
    ];
    for (const [label, opts, expectOk] of cases4d) {
        it(`4d: ${label}`, async function () {
            const r = await plot(p4d, opts, label);
            if (expectOk === true && !r.success) throw new Error(r.error);
            if (expectOk === false && r.success) throw new Error('expected failure');
        });
    }

    it('dash_names.zarr: plot every variable + dimension "-x" in plotX / facetCol', async function () {
        const p = await h.openWith(A('dash_names.zarr'), 'zarrEditor');
        const r = await h.waitLoaded(p);
        const failures = [];
        for (const v of r.vars['/']) {
            const rr = await plot(p, { variable: `/${v}` }, `dash var ${v}`);
            if (!rr.success) failures.push(`/${v}: ${rr.error}`);
        }
        const r2 = await plot(p, { variable: '/-dash_leading', plotX: '-x' }, 'dash plotX -x');
        if (!r2.success) failures.push(`plotX -x: ${r2.error}`);
        const r3 = await plot(p, { variable: '/-dash_leading', dimensionSlices: { '-x': '0:2' } }, 'dash slice -x');
        if (!r3.success) failures.push(`slice -x: ${r3.error}`);
        await h.closeAll();
        p4d = await h.openWith(S('sample_large_4d_data.nc'), 'netcdfEditor');
        await h.waitLoaded(p4d);
        if (failures.length) throw new Error(failures.join('\n'));
    });

    it('xss_names.nc / xss_groups.nc / unicode_names.nc: plot every variable', async function () {
        const failures = [];
        for (const f of ['xss_names.nc', 'xss_groups.nc', 'unicode_names.nc']) {
            const p = await h.openWith(A(f), 'netcdfEditor');
            const r = await h.waitLoaded(p);
            for (const [g, vs] of Object.entries(r.vars || {})) {
                for (const v of vs) {
                    const full = `${g === '/' ? '' : g}/${v}`;
                    const rr = await plot(p, { variable: full }, `${f} ${full}`);
                    // Known limitation (upstream): netCDF-C reads names longer than
                    // its 256-byte limit as garbage, so netcdf4 may open the file
                    // with another name than the one listed by `info`.
                    const tooLong = Buffer.byteLength(v) > 256;
                    if (!rr.success && !tooLong) failures.push(`${f} ${full}: ${rr.error}`);
                }
            }
        }
        if (failures.length) throw new Error(failures.join('\n'));
    });

    const formatFiles = [
        [S('sample_data.grib'), 'gribEditor'],
        [S('sample_data.tif'), 'geotiffEditor'],
        [S('sample_multiband.tif'), 'geotiffEditor'],
        [S('sample_data.jp2'), 'jp2Editor'],
        [S('sample_data.cdf'), 'cdfEditor'],
        [S('sample_data.h5'), 'hdf5Editor'],
        [S('sample_data_multiple_groups.nc'), 'netcdfEditor'],
        [S('sample_zarr_inherited_coords.zarr'), 'zarrEditor'],
        [S('sample_zarr_v3_sharded.zarr'), 'zarrEditor'],
        [A('cftime_noleap.nc'), 'netcdfEditor'],
    ];
    for (const [f, vt] of formatFiles) {
        it(`first variable of each group: ${path.basename(f)}`, async function () {
            const p = await h.openWith(f, vt);
            const r = await h.waitLoaded(p);
            const di = p._uiController.getDataInfo();
            const failures = [];
            for (const [g, vs] of Object.entries(di.variables_flattened)) {
                if (!vs.length) continue;
                const v = vs[0];
                const slices = {};
                v.dimensions.slice(0, Math.max(0, v.dimensions.length - 2)).forEach((d) => (slices[d] = 0));
                const full = `${g === '/' ? '' : g}/${v.name}`;
                const rr = await plot(p, { variable: full, dimensionSlices: slices }, `${path.basename(f)} ${full}`);
                // Known limitation: cftime axes need nc-time-axis (not in the uv env)
                const needsNcTimeAxis = !rr.success && /nc-time-axis/.test(rr.error || '');
                if (!rr.success && !needsNcTimeAxis) failures.push(`${full}: ${rr.error}`);
            }
            if (failures.length) throw new Error(failures.join('\n'));
        });
    }

    it('zip and unsuffixed zarr folders plot', async function () {
        const failures = [];
        for (const f of [S('sample_zarr_v3.zarr.zip'), S('sample_ocean_grid_v3'), A('prefixed.zip')]) {
            const before = h.maxId();
            const cmd = f.endsWith('.zip') ? 'scientificDataViewer.openViewer' : 'scientificDataViewer.openViewerFolder';
            await vscode.commands.executeCommand(cmd, vscode.Uri.file(f));
            const p = await h.waitNewPanel(before, f);
            await h.waitLoaded(p);
            const di = p._uiController.getDataInfo();
            for (const [g, vs] of Object.entries(di.variables_flattened)) {
                if (!vs.length) continue;
                const v = vs[0];
                const slices = {};
                v.dimensions.slice(0, Math.max(0, v.dimensions.length - 2)).forEach((d) => (slices[d] = 0));
                const full = `${g === '/' ? '' : g}/${v.name}`;
                const rr = await plot(p, { variable: full, dimensionSlices: slices }, `${path.basename(f)} ${full}`);
                if (!rr.success) failures.push(`${path.basename(f)} ${full}: ${rr.error}`);
            }
        }
        if (failures.length) throw new Error(failures.join('\n'));
    });

    it('abortPlot with unknown id', async function () {
        const resp = await h.request(p4d, 'abortPlot', { operationId: 'nope' });
        h.record({ s: 'S3', label: 'abort unknown', resp });
        if (!resp.success || resp.payload.success !== false) throw new Error(JSON.stringify(resp));
    });

    describe('long plot: abort / dispose / timeout (sample_data.nc /temperature)', function () {
        let pBig;
        before(async () => {
            await h.setConfig('plotTimeoutMs', 600000);
            pBig = await h.openWith(S('sample_data.nc'), 'netcdfEditor');
            await h.waitLoaded(pBig);
        });

        it('abort: promise rejects quickly and the python process dies', async function () {
            const operationId = 'abort-long-1';
            const t0 = Date.now();
            const pr = h.request(pBig, 'createPlot', { variable: '/temperature', operationId });
            const proc = await h.waitFor(() => plotPids()[0], 15000);
            if (!proc) throw new Error('no plot process seen');
            await h.sleep(3000);
            const stillRunning = pidAlive(proc.pid);
            const tAbort = Date.now();
            const ab = await h.request(pBig, 'abortPlot', { operationId });
            const resp = await pr;
            const tResp = Date.now();
            await h.sleep(1500);
            const alive = pidAlive(proc.pid);
            const rec = { s: 'S3', label: 'abort long', pid: proc.pid, stillRunningBeforeAbort: stillRunning, abortResp: ab.payload, respSuccess: resp.success, respError: resp.error, msAbortToReject: tResp - tAbort, totalMs: tResp - t0, aliveAfter1500ms: alive, remaining: plotPids() };
            h.record(rec);
            if (resp.success) throw new Error('plot was not rejected');
            if (alive) throw new Error('python process still alive after abort');
            if (tResp - tAbort > 3000) throw new Error('slow rejection');
        });

        it('dispose panel while plot runs: is the subprocess killed?', async function () {
            const operationId = 'dispose-long-1';
            h.request(pBig, 'createPlot', { variable: '/temperature', operationId }).then((r) =>
                h.record({ s: 'S3', label: 'dispose-long response (after close)', success: r.success, error: r.error && r.error.slice(0, 300) }),
            );
            const proc = await h.waitFor(() => plotPids()[0], 15000);
            if (!proc) throw new Error('no plot process seen');
            await h.sleep(1000);
            await h.closeAll();
            await h.sleep(5000);
            const alive = pidAlive(proc.pid);
            const registered = h.pm().isOperationActive(operationId);
            h.record({ s: 'S3', label: 'dispose while plotting', pid: proc.pid, aliveAfterClose5s: alive, stillRegistered: registered, procs: plotPids() });
            // cleanup
            h.pm().abortProcess(operationId);
            await h.sleep(1500);
            if (alive) throw new Error(`python plot process ${proc.pid} still alive 5s after the panel was closed (killed only by plotTimeoutMs)`);
        });

        it('plotTimeoutMs 3000: plot rejected after ~3s and process killed', async function () {
            await h.setConfig('plotTimeoutMs', 3000);
            pBig = await h.openWith(S('sample_data.nc'), 'netcdfEditor');
            await h.waitLoaded(pBig);
            const operationId = 'timeout-1';
            const t0 = Date.now();
            const pr = h.request(pBig, 'createPlot', { variable: '/temperature', operationId });
            const proc = await h.waitFor(() => plotPids()[0], 15000);
            const resp = await pr;
            const ms = Date.now() - t0;
            await h.sleep(1500);
            const alive = proc ? pidAlive(proc.pid) : null;
            h.record({ s: 'S3', label: 'plot timeout 3000', ms, success: resp.success, error: resp.error, alive });
            await h.setConfig('plotTimeoutMs', 20000);
            if (resp.success) throw new Error('not timed out');
            if (alive) throw new Error('process alive after timeout');
            if (ms > 8000) throw new Error('timeout took ' + ms);
        });

        it('plotTimeoutMs invalid values fall back', async function () {
            const { getPlotTimeoutMs } = h.out('common/config.js');
            const res = {};
            for (const v of [500, -1, 'abc', 1e9, 1500.7]) {
                await h.setConfig('plotTimeoutMs', v);
                res[String(v)] = getPlotTimeoutMs();
            }
            await h.setConfig('plotTimeoutMs', undefined);
            h.record({ s: 'S3', label: 'plotTimeout clamps', res });
        });
    });
});
