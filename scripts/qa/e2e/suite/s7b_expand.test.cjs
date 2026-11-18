const h = require('./helpers.cjs');
const { vscode, path, SAMPLE, E } = h;
const S = (f) => path.join(SAMPLE, f);
function op() {
    return h.DataViewerPanel._outlineProvider;
}
function all() {
    const o = op();
    const out = [];
    const walk = (items) => items.forEach((it) => (out.push(it), walk(o.getChildren(it))));
    walk(o.getChildren());
    return out;
}

describe('S7b outline Expand All in a visible outline view', function () {
    before(async () => {
        await h.setup();
    });
    for (const [f, vt] of [
        [S('sample_data_multiple_groups.nc'), 'netcdfEditor'],
        [S('sample_zarr_arborescence.zarr'), 'zarrEditor'],
        [path.join(h.ADV, 'dup_ids.nc'), 'netcdfEditor'],
    ]) {
        it(`expandAll x2 on ${path.basename(f)}`, async function () {
            const p = await h.openWith(f, vt);
            await h.waitLoaded(p);
            await h.sleep(1500);
            await vscode.commands.executeCommand('scientificDataViewer.outline.focus').then(undefined, (e) => h.record({ focusErr: String(e) }));
            await h.sleep(1500);
            const visible = op().treeView && op().treeView.visible;
            const runs = [];
            for (let i = 0; i < 2; i++) {
                const mark = h.logs.length;
                await vscode.commands.executeCommand('scientificDataViewer.expandAll');
                await h.sleep(4000);
                const fails = h.logsSince(mark).filter((l) => /Failed to expand/.test(l));
                runs.push({ fails: fails.length, sample: fails.slice(0, 3).map((l) => l.replace(/.*Failed to expand element: /, '').slice(0, 220)) });
            }
            const expandable = all().filter((x) => x.children.length).length;
            // reveal a single deep element directly and report the error, if any
            const deep = all().filter((x) => x.children.length === 0).pop();
            let revealErr;
            try {
                await op().treeView.reveal(deep, { select: false, focus: false, expand: false });
            } catch (e) {
                revealErr = String(e).slice(0, 300);
            }
            h.record({ s: 'S7b', file: path.basename(f), visible, expandable, runs, deepLabel: deep && deep.label, revealErr });
            await h.closeAll();
            if (runs[1].fails) throw new Error(`${runs[1].fails}/${expandable} reveal failures on 2nd Expand All`);
        });
    }
});
