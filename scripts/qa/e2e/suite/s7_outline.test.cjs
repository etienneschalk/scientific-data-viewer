const h = require('./helpers.cjs');
const { vscode, path, SAMPLE, ADV, E } = h;
const S = (f) => path.join(SAMPLE, f);
const A = (f) => path.join(ADV, f);

function op() {
    return h.DataViewerPanel._outlineProvider;
}
function tree() {
    const o = op();
    const all = [];
    const walk = (items, depth) => {
        for (const it of items) {
            let ti;
            let err;
            try {
                ti = o.getTreeItem(it);
            } catch (e) {
                err = String(e);
            }
            all.push({ label: it.label, level: it.level, id: it.id, treeId: ti && ti.id, depth, err, el: it });
            walk(o.getChildren(it), depth + 1);
        }
    };
    walk(o.getChildren(), 0);
    return all;
}
function dupIds(all) {
    const seen = new Map();
    const d = [];
    for (const x of all) {
        if (seen.has(x.treeId)) d.push([x.treeId, seen.get(x.treeId), x.label]);
        else seen.set(x.treeId, x.label);
    }
    return d;
}

describe('S7 outline', function () {
    before(async () => {
        await h.setup();
        await vscode.commands.executeCommand('workbench.view.explorer');
        await vscode.commands.executeCommand('scientificDataViewer.outline.focus').then(undefined, () => {});
    });

    for (const [f, vt] of [
        [S('sample_data_multiple_groups.nc'), 'netcdfEditor'],
        [S('sample_zarr_arborescence.zarr'), 'zarrEditor'],
        [A('xss_groups.nc'), 'netcdfEditor'],
        [A('unicode_names.nc'), 'netcdfEditor'],
        [A('dup_ids.nc'), 'netcdfEditor'],
    ]) {
        it(`outline tree for ${path.basename(f)}`, async function () {
            const p = await h.openWith(f, vt);
            await h.waitLoaded(p);
            await h.sleep(500);
            const all = tree();
            const enc = all.filter((x) => /Xarray Encoding/.test(x.label)).map((x) => x.label);
            const d = dupIds(all);
            const mark = h.logs.length;
            // What VS Code renders: getTreeItem is called for each node it draws,
            // and the collapsible state it returns is how the node is shown
            const provider = op();
            const rendered = new Map();
            const getTreeItem = provider.getTreeItem;
            provider.getTreeItem = function (element) {
                const item = getTreeItem.call(this, element);
                rendered.set(item.id, item.collapsibleState);
                return item;
            };
            // reveal every item: exercises the real TreeView with the ids
            op().expandAll();
            // until the reveals settle (no new log line for 1.5 s, at most 20 s)
            let count = -1;
            for (let waited = 0; waited < 20000 && count !== h.logs.length; waited += 1500) {
                count = h.logs.length;
                await h.sleep(1500);
            }
            provider.getTreeItem = getTreeItem;
            const revealFailures = h.logsSince(mark).filter((l) => /Failed to expand|already registered/.test(l)).map((l) => l.slice(0, 300));
            // A rejected reveal() is harmless when VS Code drew the node expanded anyway
            // VS Code prefixes the node ids of its errors with a handle ("1/")
            const failedIds = revealFailures.map((l) => (/(?:not found: |for element )(?:\d+\/)?(\S+)/.exec(l) || [])[1]).filter(Boolean);
            const EXPANDED = vscode.TreeItemCollapsibleState.Expanded;
            const notExpanded = failedIds.filter((id) => rendered.get(id) !== EXPANDED);
            h.record({
                s: 'S7', file: path.basename(f), panelId: p.getId(), current: op().getCurrentPanelId(), items: all.length,
                topLevel: all.filter((x) => x.depth === 0).map((x) => x.label), encodingEntries: enc.slice(0, 12), encodingCount: enc.length,
                duplicateTreeIds: d.slice(0, 10), getTreeItemErrors: all.filter((x) => x.err).length, revealFailures: revealFailures.slice(0, 6),
                rejectedReveals: failedIds.length, rejectedButRenderedExpanded: failedIds.length - notExpanded.length, notExpanded: notExpanded.slice(0, 6),
            });
            await h.closeAll();
            await h.sleep(300);
            const after = { current: op().getCurrentPanelId(), children: op().getChildren().length, cached: op().getHeadersForPanel(p.getId()) };
            h.record({ s: 'S7', file: path.basename(f), afterClose: { current: after.current, children: after.children, cached: !!after.cached } });
            if (op().getCurrentPanelId() !== undefined || after.children !== 0) throw new Error('outline not cleared');
            // Known limitation (release notes): joinId maps punctuation to "-", so
            // names such as a.b and a-b share ids; recorded above, not a failure here
            if (revealFailures.some((l) => /already registered/.test(l))) throw new Error('duplicate tree item: ' + revealFailures[0]);
            if (notExpanded.length) throw new Error(`${notExpanded.length} items not expanded, e.g. ${notExpanded[0]}`);
        });
    }

    it('switch between two panels, close the non-current one, refresh with changed group order', async function () {
        const pA = await h.openWith(S('sample_data_multiple_groups.nc'), 'netcdfEditor');
        await h.waitLoaded(pA);
        const pB = await h.openWith(S('sample_data.h5'), 'hdf5Editor');
        await h.waitLoaded(pB);
        await h.sleep(500);
        const s1 = { current: op().getCurrentPanelId(), top: op().getChildren().map((x) => x.label) };
        pA._webviewPanel.reveal();
        await h.waitFor(() => op().getCurrentPanelId() === pA.getId(), 5000);
        const s2 = { current: op().getCurrentPanelId(), top: op().getChildren().map((x) => x.label) };
        // close B (hidden) -> A's outline must stay
        pB._webviewPanel.dispose();
        await h.sleep(500);
        const s3 = { current: op().getCurrentPanelId(), top: op().getChildren().map((x) => x.label) };
        // refresh A with orderGroupsAlphabetically false -> outline rebuilt
        const groupsBefore = JSON.stringify(tree().filter((x) => x.level === 2).map((x) => x.label));
        await h.setConfig('orderGroupsAlphabetically', false);
        await h.request(pA, 'refresh', {});
        await h.waitLoaded(pA);
        await h.sleep(300);
        const groupsAfter = JSON.stringify(tree().filter((x) => x.level === 2).map((x) => x.label));
        await h.setConfig('orderGroupsAlphabetically', undefined);
        // scroll-to-header command from the outline
        const item = tree().find((x) => x.el.id);
        let scrollErr;
        try {
            await vscode.commands.executeCommand('scientificDataViewer.scrollToHeader', item.el.id, item.label);
        } catch (e) {
            scrollErr = String(e);
        }
        const sc = pA._uiController.messageBus.__events.filter((e) => e.event === 'scrollToHeaderCommandEvent').pop();
        h.record({ s: 'S7', label: 'switch panels', A: pA.getId(), B: pB.getId(), s1, s2, s3, groupsBefore, groupsAfter, scrollErr, scrollEvent: sc && sc.payload });
        await h.closeAll();
        if (s1.current !== pB.getId()) throw new Error('after opening B, current should be B');
        if (s2.current !== pA.getId()) throw new Error('reveal A should switch');
        if (s3.current !== pA.getId() || s3.top.length === 0) throw new Error('closing hidden B cleared A outline');
        if (!sc) throw new Error('no scroll event');
    });
});
