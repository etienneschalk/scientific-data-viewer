const h = require('./helpers.cjs');
const { vscode, path, fs, SAMPLE, E, REPO } = h;
const os = require('os');
const Module = require('module');

/** The extension's own `vscode` API object (to stub dialogs it calls). */
function extVscode() {
    const fake = new Module(path.join(process.env.SDV_E2E_EXT_ROOT || REPO, 'out/src/common/config.js'), null);
    fake.filename = path.join(process.env.SDV_E2E_EXT_ROOT || REPO, 'out/src/common/config.js');
    fake.paths = Module._nodeModulePaths(path.join(process.env.SDV_E2E_EXT_ROOT || REPO, 'out/src'));
    return fake.require('vscode');
}

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex').toString('base64');
const DATA = path.join(E, 'data', 'save');
const OUTSIDE = path.join(E, 'data', 'outside');

describe('S4 save / open plot, S5 executeCommand, export', function () {
    let p;
    let ev;
    const notifications = [];
    before(async () => {
        await h.setup();
        fs.rmSync(path.join(E, 'data'), { recursive: true, force: true });
        fs.mkdirSync(DATA, { recursive: true });
        fs.mkdirSync(OUTSIDE, { recursive: true });
        fs.copyFileSync(path.join(SAMPLE, 'sample_data.h5'), path.join(DATA, 'sample_data.h5'));
        fs.symlinkSync(OUTSIDE, path.join(DATA, 'link_out'));
        ev = extVscode();
        const same = ev === vscode;
        const orig = ev.window.showInformationMessage;
        ev.window.showInformationMessage = (...a) => {
            notifications.push(['info', a[0]]);
            return Promise.resolve(undefined);
        };
        ev.window.__origInfo = orig;
        const origErr = ev.window.showErrorMessage;
        ev.window.showErrorMessage = (...a) => {
            notifications.push(['error', a[0]]);
            return Promise.resolve(undefined);
        };
        ev.window.__origErr = origErr;
        h.record({ s: 'S4', label: 'ext api object distinct from test api', distinct: !same, stubbed: ev.window.showInformationMessage !== orig });
        p = await h.openWith(path.join(DATA, 'sample_data.h5'), 'hdf5Editor');
        const r = await h.waitLoaded(p);
        if (r.hasError) throw new Error('load failed');
    });

    const saveCases = [
        ['plot.png', 'ok', 'plot.png'],
        ['sdv-plots/sample_data.h5/grp/var_2026-10-29T00-00-00.png', 'ok', 'sdv-plots/sample_data.h5/grp/var_2026-10-29T00-00-00.png'],
        ['../evil.png', 'reject'],
        ['a/../../evil2.png', 'reject'],
        ['sub\\..\\..\\evil3.png', 'reject'],
        [path.join(OUTSIDE, 'abs.png'), 'reject'],
        ['C:\\x.png', 'reject'],
        ['\\\\server\\share\\x.png', 'reject'],
        ['', 'reject'],
        ['.', 'error'],
        ['link_out/through_symlink.png', '?'],
        ['a\u0000b.png', 'error'],
        ['x'.repeat(300) + '.png', 'error'],
        ['%2e%2e/enc.png', 'ok', '%2e%2e/enc.png'],
        ['C:x.png', '?'],
    ];
    for (const [fileName, expected, rel] of saveCases) {
        it(`savePlot ${JSON.stringify(fileName.slice(0, 60))}`, async function () {
            const before = new Set(walk(path.join(E, 'data')));
            const resp = await h.request(p, 'savePlot', { plotData: PNG, variable: '/x', fileName });
            const after = walk(path.join(E, 'data')).filter((f) => !before.has(f));
            const r = { s: 'S4', label: 'savePlot', fileName: fileName.slice(0, 80), expected, respSuccess: resp.success, payload: resp.payload, newFiles: after };
            h.record(r);
            const ok = resp.success && resp.payload && resp.payload.success;
            if (expected === 'ok') {
                if (!ok) throw new Error(JSON.stringify(resp));
                if (!fs.existsSync(path.join(DATA, rel))) throw new Error('file not at ' + rel);
            }
            if ((expected === 'reject' || expected === 'error') && ok) throw new Error('was accepted: ' + JSON.stringify(after));
        });
    }

    it('openPlot with nested fileName creates folders under tmp', async function () {
        const fileName = `sdv-plots/qa-e2e-${Date.now()}/grp/var_2026.png`;
        const resp = await h.request(p, 'openPlot', { plotData: PNG, variable: '/grp/var', fileName });
        const target = path.join(os.tmpdir(), fileName);
        await h.sleep(800);
        const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs.map((t) => t.label));
        h.record({ s: 'S4', label: 'openPlot nested', resp, target, exists: fs.existsSync(target), tabs });
        if (!resp.success) throw new Error(resp.error);
        if (!fs.existsSync(target)) throw new Error('not written');
    });

    it('openPlot with ../ is rejected', async function () {
        const resp = await h.request(p, 'openPlot', { plotData: PNG, variable: '/x', fileName: '../qa-evil-open.png' });
        h.record({ s: 'S4', label: 'openPlot ../', resp, exists: fs.existsSync(path.join(path.dirname(os.tmpdir()), 'qa-evil-open.png')) });
        if (resp.success) throw new Error('accepted');
    });

    it('savePlotAs: dialog stubbed to a chosen path / cancelled', async function () {
        const target = path.join(OUTSIDE, 'saved_as.png');
        let seenDefault;
        const orig = ev.window.showSaveDialog;
        ev.window.showSaveDialog = async (o) => {
            seenDefault = o.defaultUri.fsPath;
            return vscode.Uri.file(target);
        };
        const resp = await h.request(p, 'savePlotAs', { plotData: PNG, variable: '/grp/sub/var' });
        ev.window.showSaveDialog = async () => undefined;
        const resp2 = await h.request(p, 'savePlotAs', { plotData: PNG, variable: '/v' });
        ev.window.showSaveDialog = orig;
        h.record({ s: 'S4', label: 'savePlotAs', seenDefault, resp, cancelled: resp2, exists: fs.existsSync(target) });
        if (!resp.payload.success || !fs.existsSync(target)) throw new Error(JSON.stringify(resp));
    });

    it('exportWebview: dialog stubbed; html written self-contained', async function () {
        const target = path.join(OUTSIDE, 'export.html');
        const orig = ev.window.showSaveDialog;
        let seenDefault;
        ev.window.showSaveDialog = async (o) => {
            seenDefault = o.defaultUri.fsPath;
            return vscode.Uri.file(target);
        };
        const html = p._webviewPanel.webview.html;
        const resp = await h.request(p, 'exportWebview', { htmlContent: html });
        ev.window.showSaveDialog = async () => undefined;
        const resp2 = await h.request(p, 'exportWebview', { htmlContent: html });
        // null htmlContent, as typed in the webview bus (htmlContent: string | null)
        ev.window.showSaveDialog = async () => vscode.Uri.file(path.join(OUTSIDE, 'export_null.html'));
        const resp3 = await h.request(p, 'exportWebview', { htmlContent: null });
        ev.window.showSaveDialog = orig;
        const written = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
        h.record({
            s: 'S4', label: 'exportWebview', seenDefault, resp, cancelled: resp2, nullContent: resp3,
            size: written.length, hasVscodeResource: /vscode-resource|vscode-cdn|vscode-webview:/.test(written),
            hasInlineScript: /<script[^>]*>[^<]{100,}/.test(written),
            externalRefs: (written.match(/(src|href)="[^"#][^"]*"/g) || []).slice(0, 10),
        });
        if (!resp.payload || !resp.payload.success) throw new Error(JSON.stringify(resp));
    });

    it('executeCommand allowlist', async function () {
        const results = {};
        for (const [cmd, args] of [
            ['scientificDataViewer.showLogs', undefined],
            ['scientificDataViewer.showSettings', undefined],
            ['scientificDataViewer.python.installPackages', []],
            ['workbench.action.terminal.new', undefined],
            ['vscode.open', [vscode.Uri.file('/etc/passwd')]],
            ['workbench.action.openSettings', undefined],
            ['scientificDataViewer.openViewer', undefined],
            ['scientificDataViewer.toggleDevMode', undefined],
            ['scientificDataViewer.showLogs ', undefined],
            ['SCIENTIFICDATAVIEWER.SHOWLOGS', undefined],
            ['__proto__', undefined],
            ['constructor', undefined],
            ['hasOwnProperty', undefined],
        ]) {
            const resp = await h.request(p, 'executeCommand', { command: cmd, args });
            results[cmd] = { success: resp.success, error: resp.error };
        }
        const terms = vscode.window.terminals.length;
        h.record({ s: 'S5', label: 'executeCommand', results, terminals: terms, notifications: notifications.slice(-5) });
        const allowed = ['scientificDataViewer.showLogs', 'scientificDataViewer.showSettings', 'scientificDataViewer.python.installPackages'];
        for (const [cmd, r] of Object.entries(results)) {
            if (allowed.includes(cmd) !== r.success) throw new Error(`${cmd}: ${JSON.stringify(r)}`);
        }
        if (terms > 0) throw new Error('terminal opened');
    });

    it('unknown request command and malformed messages', async function () {
        const r1 = await h.request(p, 'deleteEverything', {});
        const r2 = await h.request(p, 'savePlot', null);
        const r3 = await h.request(p, 'createPlot', null);
        const r4 = await h.request(p, 'abortPlot', null);
        h.record({ s: 'S5', label: 'malformed', unknown: r1, savePlotNull: r2, createPlotNull: r3, abortNull: r4 });
    });

    it('installPackages through webview passes arbitrary pip/uv options (throwaway venv, offline-safe)', async function () {
        const throwaway = path.join(E, 'throwaway-venv/bin/python');
        await h.setConfig('python.overridePythonInterpreter', throwaway);
        await h.waitFor(() => h.pm().pythonPath === throwaway, 60000);
        await h.pm().waitForInitialization();
        const mark = h.logs.length;
        const resp = await h.request(p, 'executeCommand', {
            command: 'scientificDataViewer.python.installPackages',
            args: [['--index-url', 'http://127.0.0.1:9/simple', '--no-cache', 'zzz-qa-nonexistent-pkg']],
        });
        await h.sleep(500);
        const lines = h.logsSince(mark).filter((l) => /install|uv|pip/i.test(l)).map((l) => l.slice(0, 400));
        h.record({ s: 'S5', label: 'installPackages arg passthrough', resp, logLines: lines.slice(0, 15), notifications: notifications.slice(-3) });
        await h.setConfig('python.overridePythonInterpreter', h.UV_PY);
        await h.waitFor(() => h.pm().pythonPath === h.UV_PY, 60000);
    });
});

function walk(dir) {
    const outp = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) outp.push(...walk(f));
        else outp.push(f);
    }
    return outp;
}
