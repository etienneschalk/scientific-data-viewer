const h = require('./helpers.cjs');
const { vscode, path, fs, SAMPLE, E, REPO } = h;
const Module = require('module');
const S = (f) => path.join(SAMPLE, f);
function extVscode() {
    const root = process.env.SDV_E2E_EXT_ROOT || REPO;
    const fake = new Module(path.join(root, 'out/src/common/config.js'), null);
    fake.filename = path.join(root, 'out/src/common/config.js');
    fake.paths = Module._nodeModulePaths(path.join(root, 'out/src'));
    return fake.require('vscode');
}

describe('S11 which panel is "active" with split editors', function () {
    before(async () => {
        await h.setup();
    });
    it('Export Webview exports the focused panel', async function () {
        const ev = extVscode();
        ev.window.showInformationMessage = () => Promise.resolve(undefined);
        const pA = await h.openWith(S('sample_data.h5'), 'hdf5Editor');
        await h.waitLoaded(pA);
        const b = h.maxId();
        await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(S('sample_data.cdf')), 'cdfEditor', vscode.ViewColumn.Beside);
        const pB = await h.waitNewPanel(b, S('sample_data.cdf'));
        await h.waitLoaded(pB);
        // Focus the right-hand viewer explicitly: after other suites, focus can stay elsewhere
        pB._webviewPanel.reveal(vscode.ViewColumn.Beside, false);
        await h.waitFor(() => pB._webviewPanel.active, 10000);
        await h.sleep(500);
        const seen = [];
        ev.window.showSaveDialog = async (o) => (seen.push(o.defaultUri.fsPath), undefined);
        await vscode.commands.executeCommand('scientificDataViewer.exportWebview');
        await h.waitFor(() => seen.length, 10000);
        const state = { Avisible: pA._webviewPanel.visible, Aactive: pA._webviewPanel.active, Bvisible: pB._webviewPanel.visible, Bactive: pB._webviewPanel.active, getActivePanel: h.DataViewerPanel.getActivePanel().getFileUri().fsPath, exportDefault: seen[0] };
        h.record({ s: 'S11', label: 'active panel', state });
        await h.closeAll();
        if (!state.Bactive) throw new Error('setup: B not active');
        if (!String(seen[0]).includes('sample_data.cdf')) throw new Error('exported the wrong (non-focused) panel: ' + seen[0]);
    });
});
