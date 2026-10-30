const h = require('./helpers.cjs');
const { vscode, path, fs, SAMPLE, ADV, E, REPO } = h;
const Module = require('module');
const S = (f) => path.join(SAMPLE, f);
const A = (f) => path.join(ADV, f);
function extVscode() {
    const root = process.env.SDV_E2E_EXT_ROOT || REPO;
    const fake = new Module(path.join(root, 'out/src/common/config.js'), null);
    fake.filename = path.join(root, 'out/src/common/config.js');
    fake.paths = Module._nodeModulePaths(path.join(root, 'out/src'));
    return fake.require('vscode');
}
const OUT = path.join(E, 'data', 'roundtrip');

describe('S10 real webview round trips (dialogs stubbed)', function () {
    let ev;
    const popups = [];
    before(async () => {
        await h.setup();
        fs.mkdirSync(OUT, { recursive: true });
        ev = extVscode();
        ev.window.showInformationMessage = (...a) => (popups.push(['info', String(a[0])]), Promise.resolve(undefined));
        ev.window.showErrorMessage = (...a) => (popups.push(['error', String(a[0])]), Promise.resolve(undefined));
    });

    it('openViewer without uri -> open dialog (stubbed, 2 files) -> 2 panels', async function () {
        let seen;
        ev.window.showOpenDialog = async (o) => ((seen = o), [vscode.Uri.file(S('sample_data.h5')), vscode.Uri.file(A('xss_names.nc'))]);
        const b = h.maxId();
        await vscode.commands.executeCommand('scientificDataViewer.openViewer');
        const p1 = await h.waitNewPanel(b, S('sample_data.h5'));
        const p2 = await h.waitNewPanel(b, A('xss_names.nc'));
        const r1 = await h.waitLoaded(p1);
        const r2 = await h.waitLoaded(p2);
        ev.window.showOpenDialog = async () => undefined;
        await vscode.commands.executeCommand('scientificDataViewer.openViewerFolder');
        h.record({ s: 'S10', label: 'open dialog', filters: seen && seen.filters, r1: r1.hasError, r2: r2.hasError });
        if (r1.hasError || r2.hasError) throw new Error('load error');
    });

    it('Export Webview command -> real webview serialises DOM -> host writes HTML', async function () {
        const p = h.panels().find((x) => x.getFileUri().fsPath === A('xss_names.nc'));
        p._webviewPanel.reveal();
        await h.sleep(3000); // let the webview render dataLoaded
        const target = path.join(OUT, 'xss_export.html');
        ev.window.showSaveDialog = async () => vscode.Uri.file(target);
        const mark = h.logs.length;
        await vscode.commands.executeCommand('scientificDataViewer.exportWebview');
        const ok = await h.waitFor(() => fs.existsSync(target), 20000);
        const html = ok ? fs.readFileSync(target, 'utf8') : '';
        const rec = {
            s: 'S10', label: 'export roundtrip', written: !!ok, size: html.length,
            activePanel: h.DataViewerPanel.getActivePanel() && h.DataViewerPanel.getActivePanel().getFileUri().fsPath,
            rawImgTag: /<img src=x onerror/i.test(html), escapedImg: /&lt;img src=x onerror/.test(html),
            hasVariableName: html.includes('javascript_link'),
            vscodeResourceRefs: (html.match(/vscode-(resource|cdn|webview)[^"' )]*/g) || []).slice(0, 5),
            hasCSP: /Content-Security-Policy/i.test(html),
            logs: h.logsSince(mark).filter((l) => /export/i.test(l)).map((l) => l.slice(0, 200)).slice(0, 5),
        };
        h.record(rec);
        if (!ok) throw new Error('export not written (webview did not answer exportWebviewCommandEvent?)');
        if (rec.rawImgTag) throw new Error('unescaped HTML from variable names in export');
    });

    it('webview createPlot round trip via the plot button is not driven here; plot via request and check webview gets response', async function () {
        const p = h.panels().find((x) => x.getFileUri().fsPath === S('sample_data.h5'));
        const resp = await h.request(p, 'createPlot', { variable: '/reflectance', dimensionSlices: { time: 0 }, operationId: 'rt' });
        h.record({ s: 'S10', label: 'plot h5', ok: resp.success });
        if (!resp.success) throw new Error(resp.error);
    });

    it('Healthcheck command runs', async function () {
        const mark = h.logs.length;
        let err;
        try {
            await vscode.commands.executeCommand('scientificDataViewer.healthcheck');
        } catch (e) {
            err = String(e);
        }
        await h.sleep(1000);
        const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs.map((t) => t.label));
        h.record({ s: 'S10', label: 'healthcheck', err, tabs, popups: popups.slice(-3), errLogs: h.logsSince(mark).filter((l) => /\[error\]/.test(l)).map((l) => l.slice(0, 250)).slice(0, 5) });
        if (err) throw new Error(err);
    });
});
