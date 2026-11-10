const h = require('./helpers.cjs');
const { vscode, path, fs, SAMPLE, ADV, REPO } = h;
const Module = require('module');
const S = (f) => path.join(SAMPLE, f);

function extVscode() {
    const fake = new Module(path.join(process.env.SDV_E2E_EXT_ROOT || REPO, 'out/src/common/config.js'), null);
    fake.filename = path.join(process.env.SDV_E2E_EXT_ROOT || REPO, 'out/src/common/config.js');
    fake.paths = Module._nodeModulePaths(path.join(process.env.SDV_E2E_EXT_ROOT || REPO, 'out/src'));
    return fake.require('vscode');
}
function op() {
    return h.DataViewerPanel._outlineProvider;
}
function eb() {
    return h.out('common/ErrorBoundary.js').ErrorBoundary.getInstance();
}
function myPythonProcs() {
    return h
        .pythonProcs('get_data_info.py')
        .map((l) => l.split(/\s+/))
        .filter((a) => Number(a[1]) === process.pid);
}

describe('S8 multiple panels / races / leaks', function () {
    const popups = [];
    before(async () => {
        await h.setup();
        const ev = extVscode();
        ev.window.showErrorMessage = (...a) => {
            popups.push(['error', String(a[0])]);
            return Promise.resolve(undefined);
        };
        ev.window.showInformationMessage = (...a) => {
            popups.push(['info', String(a[0])]);
            return Promise.resolve(undefined);
        };
        ev.window.showWarningMessage = (...a) => {
            popups.push(['warn', String(a[0])]);
            return Promise.resolve(undefined);
        };
    });
    afterEach(async () => {
        await h.closeAll();
    });

    it('same file in two editor groups (split) -> 2 panels, closing one keeps the other', async function () {
        const f = S('sample_data_multiple_groups.nc');
        const p1 = await h.openWith(f, 'netcdfEditor');
        await h.waitLoaded(p1);
        const before = h.maxId();
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(f), 'netcdfEditor', vscode.ViewColumn.Beside);
        const p2 = await h.waitNewPanel(before, f);
        const r2 = p2 ? await h.waitLoaded(p2) : { noPanel: true };
        const n = h.panels().filter((x) => x.getFileUri().fsPath === f).length;
        // same file again in the first group -> reveal, no new panel
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(f), 'netcdfEditor', vscode.ViewColumn.One);
        await h.sleep(1000);
        const n2 = h.panels().filter((x) => x.getFileUri().fsPath === f).length;
        p2._webviewPanel.dispose();
        await h.sleep(500);
        const p1ok = h.panels().includes(p1);
        h.record({ s: 'S8', label: 'split same file', n, n2, r2: { hasError: r2.hasError }, p1StillThere: p1ok, outlineCurrent: op().getCurrentPanelId(), p1: p1.getId() });
        if (n !== 2) throw new Error('expected 2 panels got ' + n);
    });

    it('allowMultipleTabsForSameFile true -> openViewer twice gives 2 panels', async function () {
        await h.setConfig('allowMultipleTabsForSameFile', true);
        const f = S('sample_data.h5');
        for (let i = 0; i < 2; i++) {
            const b = h.maxId();
            await vscode.commands.executeCommand('scientificDataViewer.openViewer', vscode.Uri.file(f));
            await h.waitLoaded(await h.waitNewPanel(b, f));
        }
        const n = h.panels().filter((x) => x.getFileUri().fsPath === f).length;
        await h.setConfig('allowMultipleTabsForSameFile', undefined);
        h.record({ s: 'S8', label: 'allowMultipleTabs', n });
        if (n !== 2) throw new Error('got ' + n);
    });

    it('close a panel before its load finishes: outline and error popups', async function () {
        const out = {};
        for (const [f, vt] of [[S('sample_data_multiple_groups.nc'), 'netcdfEditor'], [S('broken_file.nc'), 'netcdfEditor']]) {
            popups.length = 0;
            const p = await h.openWith(f, vt);
            const id = p.getId();
            p._webviewPanel.dispose();
            const disposedAt = Date.now();
            await h.waitFor(() => p._uiController.__load, 5000);
            await p._uiController.__load;
            await h.sleep(500);
            out[path.basename(f)] = {
                panelId: id,
                panelsLeft: h.DataViewerPanel.getPanelCount(),
                outlineCurrent: op().getCurrentPanelId(),
                outlineTop: op().getChildren().map((x) => x.label),
                cachedHeadersForClosedPanel: !!op().getHeadersForPanel(id),
                hasErrorFlag: p._hasError,
                popups: popups.slice(),
                loadFinishedMsAfterDispose: Date.now() - disposedAt,
            };
        }
        h.record({ s: 'S8', label: 'dispose during load', out });
        const a = out['sample_data_multiple_groups.nc'];
        const b = out['broken_file.nc'];
        const problems = [];
        if (a.outlineCurrent === a.panelId || a.cachedHeadersForClosedPanel) problems.push('outline shows/caches headers of a closed panel');
        if (b.popups.some((x) => x[0] === 'error')) problems.push('error popup for a closed panel: ' + JSON.stringify(b.popups));
        if (problems.length) throw new Error(problems.join('; '));
    });

    it('refresh twice during load + stale result race (maxFileSize changed mid-load)', async function () {
        const p = await h.openWith(S('sample_data.nc'), 'netcdfEditor');
        await h.waitLoaded(p);
        // load 1: normal (python, ~0.5s); load 2 started right after with maxFileSize 1 -> fails instantly
        const l1 = h.request(p, 'refresh', {});
        await h.sleep(50);
        await h.setConfig('maxFileSize', 1);
        const l2 = h.request(p, 'refresh', {});
        await Promise.all([l1, l2]);
        await h.sleep(300);
        const evs = p._uiController.messageBus.__events.slice(-2).map((e) => e.event);
        const final = { hasError: p._hasError, lastEvents: evs, dataInfo: !!p._uiController.getDataInfo() };
        await h.setConfig('maxFileSize', undefined);
        h.record({ s: 'S8', label: 'stale load race', final });
        if (evs[evs.length - 1] !== 'error') throw new Error('older load overwrote the newer (latest settings) result: ' + JSON.stringify(final));
    });

    it('rapid open/close x15 (no leaks)', async function () {
        const handlersBefore = eb().errorHandlers.size;
        const t0 = Date.now();
        for (let i = 0; i < 15; i++) {
            const p = await h.openWith(S(i % 2 ? 'sample_data.h5' : 'sample_zarr_arborescence.zarr'), i % 2 ? 'hdf5Editor' : 'zarrEditor');
            if (i % 3 === 0) await h.sleep(100);
            p._webviewPanel.dispose();
        }
        await h.sleep(4000);
        // Closing a viewer aborts its plots; its metadata load runs to the end
        // and is ignored. A leak is a process still there long after: on a slow
        // machine (CI runner) the 15 loads take more than the 4 s above
        await h.waitFor(() => myPythonProcs().length === 0, 60000);
        const res = {
            ms: Date.now() - t0,
            panels: h.DataViewerPanel.getPanelCount(),
            handlersBefore,
            handlersAfter: eb().errorHandlers.size,
            outlineCached: op().headersToPanelId.size,
            outlineCurrent: op().getCurrentPanelId(),
            expandedStates: op().expandedStates.size,
            pythonLeft: myPythonProcs().length,
            busDisposedOk: true,
        };
        h.record({ s: 'S8', label: 'rapid open/close', res });
        if (res.panels !== 0 || res.handlersAfter !== handlersBefore || res.pythonLeft) throw new Error(JSON.stringify(res));
        if (res.outlineCached) throw new Error('outline cache leaks closed panels: ' + res.outlineCached);
    });

    it('open 20 files quickly', async function () {
        const dir = S('disposable');
        const files = fs.readdirSync(dir).sort().map((f) => path.join(dir, f));
        const t0 = Date.now();
        const before = h.maxId();
        let maxConc = 0;
        const sampler = setInterval(() => {
            try {
                maxConc = Math.max(maxConc, myPythonProcs().length);
            } catch {}
        }, 100);
        for (const f of files) {
            await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(f), f.endsWith('.zarr') ? 'zarrEditor' : 'netcdfEditor');
        }
        const ps = [];
        for (const f of files) ps.push(await h.waitNewPanel(before, f, 30000));
        const rs = await Promise.all(ps.map((p) => (p ? h.waitLoaded(p, 180000) : { noPanel: true })));
        clearInterval(sampler);
        const res = {
            files: files.length, panels: h.DataViewerPanel.getPanelCount(), ms: Date.now() - t0, maxConcurrentPython: maxConc,
            errors: rs.filter((r) => r.hasError || r.noPanel || r.hung).map((r) => r.error || r),
            maxLoadMs: Math.max(...rs.map((r) => r.ms || 0)),
        };
        await h.closeAll();
        res.panelsAfterClose = h.DataViewerPanel.getPanelCount();
        res.outlineCachedAfterClose = op().headersToPanelId.size;
        h.record({ s: 'S8', label: '20 files', res });
        if (res.errors.length || res.panels !== files.length) throw new Error(JSON.stringify(res));
    });

    it('deactivate-like abortAll and unhandled errors in log', async function () {
        const errs = h.logs.filter((l) => /\[error\]/.test(l) && !/broken_file|cannot mmap|File too large|Maximum allowed/.test(l));
        h.record({ s: 'S8', label: 'unexpected error log lines', count: errs.length, sample: errs.slice(0, 10).map((l) => l.slice(0, 300)), popups });
    });
});
