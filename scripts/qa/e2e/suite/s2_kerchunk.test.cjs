const h = require('./helpers.cjs');
const { vscode, path, SAMPLE, ADV, REPO } = h;
const S = (f) => path.join(SAMPLE, f);
const A = (f) => path.join(ADV, f);

async function openCmd(cmd, file) {
    const before = h.maxId();
    await vscode.commands.executeCommand(cmd, vscode.Uri.file(file));
    const p = await h.waitNewPanel(before, file, 30000);
    return p;
}

describe('S2 kerchunk', function () {
    before(async () => {
        await h.setup();
    });

    it('uv env (no kerchunk): sample_data.kerchunk.json -> clean error, then switching interpreter auto-refreshes the errored panel', async function () {
        const p = await h.openWith(S('sample_data.kerchunk.json'), 'kerchunkEditor');
        const r = await h.waitLoaded(p);
        h.record({ s: 'S2', step: 'uv-no-kerchunk', python: h.pm().pythonPath, ...r });
        if (!r.hasError) throw new Error('expected error without kerchunk');
        const loadsBefore = p._uiController.__loadCount;
        await h.setConfig('python.overridePythonInterpreter', h.VENV_PY);
        // refreshPython -> refreshPanelsWithErrors
        await h.waitFor(() => h.pm().pythonPath === h.VENV_PY, 60000);
        await h.waitFor(() => p._uiController.__loadCount > loadsBefore, 60000);
        const r2 = await h.waitLoaded(p);
        h.record({ s: 'S2', step: 'after-switch-to-venv', python: h.pm().pythonPath, loads: p._uiController.__loadCount, ...r2 });
        if (r2.hasError) throw new Error('panel still in error after interpreter switch: ' + JSON.stringify(r2.error));
        await h.closeAll();
    });

    const cases = [
        ['kerchunkEditor', S('sample_data.kerchunk.json'), 'ok'],
        ['kerchunkEditor', A('inline.kerchunk.json'), 'ok'],
        ['kerchunkEditor', A('inline.ref.json'), 'ok'],
        ['kerchunkEditor', A('missing_target.kerchunk.json'), '?'],
        ['kerchunkEditor', A('invalid.kerchunk.json'), 'error'],
        ['kerchunkEditor', A('array.kerchunk.json'), 'error'],
        ['kerchunkEditor', A('empty_refs.kerchunk.json'), '?'],
    ];
    for (const [vt, f, exp] of cases) {
        it(`venv openWith ${path.basename(f)}`, async function () {
            const p = await h.openWith(f, vt);
            const r = await h.waitLoaded(p);
            h.record({ s: 'S2', how: 'openWith', file: path.basename(f), expected: exp, ...r });
            await h.closeAll();
            if (r.hung) throw new Error('hung');
            if (exp === 'ok' && r.hasError) throw new Error(JSON.stringify(r.error));
            if (exp === 'error' && !r.hasError) throw new Error('expected error');
        });
    }

    it('openAsKerchunk on inline_plain.json -> ok', async function () {
        const p = await openCmd('scientificDataViewer.openAsKerchunk', A('inline_plain.json'));
        if (!p) throw new Error('no panel');
        const r = await h.waitLoaded(p);
        h.record({ s: 'S2', how: 'openAsKerchunk', file: 'inline_plain.json', uri: p.getFileUri().toString(), ...r });
        if (r.hasError) throw new Error(JSON.stringify(r.error));
        // plot through the real host
        const resp = await h.request(p, 'createPlot', { variable: '/v', operationId: 'k1' });
        h.record({ s: 'S2', step: 'plot inline_plain v', success: resp.success, error: resp.error, pngLen: resp.payload && resp.payload.length });
        if (!resp.success) throw new Error(resp.error);
    });

    it('openViewer (plain) on inline_plain.json -> second tab', async function () {
        const p = await openCmd('scientificDataViewer.openViewer', A('inline_plain.json'));
        if (!p) throw new Error('no panel');
        const r = await h.waitLoaded(p);
        const n = h.panels().filter((x) => x.getFileUri().fsPath === A('inline_plain.json')).length;
        h.record({ s: 'S2', how: 'openViewer plain json', uri: p.getFileUri().toString(), panelsForFile: n, ...r });
        await h.closeAll();
        if (n !== 2) throw new Error('expected 2 tabs, got ' + n);
    });

    it('openAsKerchunk on package.json -> clean "not a Kerchunk reference" error', async function () {
        const p = await openCmd('scientificDataViewer.openAsKerchunk', path.join(REPO, 'package.json'));
        if (!p) throw new Error('no panel');
        const r = await h.waitLoaded(p);
        h.record({ s: 'S2', how: 'openAsKerchunk', file: 'package.json', ...r });
        await h.closeAll();
        if (!r.hasError) throw new Error('expected error');
    });

    it('same file normally AND as kerchunk -> two tabs; plot temperature slice on the kerchunk one', async function () {
        const f = S('sample_data.kerchunk.json');
        const p1 = await h.openWith(f, 'kerchunkEditor');
        const r1 = await h.waitLoaded(p1);
        const p2 = await openCmd('scientificDataViewer.openAsKerchunk', f);
        const r2 = p2 ? await h.waitLoaded(p2) : { noPanel: true };
        // a 2nd openAsKerchunk should reveal p2, not create a 3rd
        await vscode.commands.executeCommand('scientificDataViewer.openAsKerchunk', vscode.Uri.file(f));
        await h.sleep(1500);
        const n = h.panels().filter((x) => x.getFileUri().fsPath === f).length;
        h.record({ s: 'S2', step: 'two tabs', n, r1: { hasError: r1.hasError, format: r1.format, engine: r1.engine }, r2: { hasError: r2.hasError, format: r2.format, engine: r2.engine, uri: p2 && p2.getFileUri().toString() } });
        if (n !== 2) throw new Error('expected 2 panels, got ' + n);
        const t0 = Date.now();
        const resp = await h.request(p2, 'createPlot', { variable: '/temperature', dimensionSlices: { time: 0 }, operationId: 'k2' });
        h.record({ s: 'S2', step: 'plot kerchunk temperature time=0', ms: Date.now() - t0, success: resp.success, error: resp.error, pngLen: resp.payload && resp.payload.length });
        const resp2 = await h.request(p1, 'createPlot', { variable: '/temperature', dimensionSlices: { time: '0:2' }, facetCol: 'time', operationId: 'k3' });
        h.record({ s: 'S2', step: 'plot kerchunkEditor /temperature facet', success: resp2.success, error: resp2.error, pngLen: resp2.payload && resp2.payload.length });
        await h.closeAll();
        if (!resp.success) throw new Error(resp.error);
        if (!resp2.success) throw new Error(resp2.error);
    });
});
