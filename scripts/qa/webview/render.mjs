import fs from 'node:fs';
import { FIXTURES, IMG_DIR, SAMPLES, makeChecker, openViewer, openStaticHtml, shutdown } from './harness.mjs';

const ADV = FIXTURES;
const SD = SAMPLES;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { check, finish } = makeChecker();
const hostile = `(() => ({
    imgX: document.querySelectorAll('img[src="x"], img[src$="/x"]').length,
    svgOnload: [...document.querySelectorAll('svg')].filter(s => s.hasAttribute('onload')).length,
    anyOnAttr: [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).map(e => e.outerHTML.slice(0, 120)),
    scripts: document.querySelectorAll('script').length,
    jsLinks: [...document.querySelectorAll('a[href]')].filter(a => /^javascript:/i.test(a.getAttribute('href'))).map(a => a.outerHTML.slice(0, 150)),
}))()`;

async function waitAllPlots(p) {
    await p.eval(`new Promise((res, rej) => { const s = Date.now(); const f = () => { if (!document.querySelector('.plot-loading') && !document.getElementById('createAllPlotsButton').disabled) res(); else if (Date.now() - s > 300000) rej(new Error('timeout')); else setTimeout(f, 250); }; setTimeout(f, 500); })`);
}

// ---------- XSS through every place file data reaches ----------
for (const f of ['xss_names.nc', 'xss_groups.nc', 'xss_names.zarr', 'zarr_with_nested_attrs.zarr', 'nodata_float.tif', 'unicode_names.nc', 'dash_names.zarr', 'attr_zoo.nc']) {
    const p = await openViewer(`${ADV}/${f}`);
    await p.eval(`document.getElementById('expandAllButton').click(); true`);
    await sleep(300);
    // Plot every variable (names go into payloads, errors, alt text)
    await p.eval(`document.getElementById('createAllPlotsButton').click(); true`);
    await waitAllPlots(p);
    // Outline scroll to every element id present (ids derived from names)
    const ids = await p.eval(`[...document.querySelectorAll('[id]')].map(e => e.id).filter(id => /data-group|var|coord|attr/i.test(id)).slice(0, 200)`);
    for (const id of ids.slice(0, 40)) await p.emit('scrollToHeaderCommandEvent', { headerId: id, headerLabel: id });
    await p.eval(`document.getElementById('collapseAllButton').click(); document.getElementById('expandAllButton').click(); true`);
    // Export → open the exported page standalone (no CSP there)
    await p.eval(`document.getElementById('exportWebviewButton').click(); true`);
    await sleep(800);
    const q = await p.qa();
    const dom = await p.eval(hostile);
    const text = await p.eval(`document.body.innerText`);
    const plots = await p.eval(`[...document.querySelectorAll('.variable-plot-controls')].map(c => [c.dataset.variable, !!c.querySelector('img'), (c.querySelector('.plot-error pre')?.textContent ?? '').slice(0, 160)])`);
    const literal = f.startsWith('xss') ? text.includes('<img src=x onerror="alert(1)">') || text.includes('onerror') : true;
    check(`XSS ${f}: no script ran, no CSP violation, no injected element; names shown as text`, q.alerts.length === 0 && p.dialogs.length === 0 && q.csp.length === 0 && dom.imgX === 0 && dom.svgOnload === 0 && dom.anyOnAttr.length === 0 && literal, { alerts: q.alerts, dialogs: p.dialogs, csp: q.csp, errors: q.errors, dom, literal });
    check(`${f}: every variable plotted or failed with a message (no stuck spinner, no JS error)`, q.errors.length === 0 && plots.every(([, img, err]) => img || err), { plots, errors: q.errors, cdp: p.cdpLogs.filter((l) => /error|EXCEPTION/i.test(l)).slice(0, 5) });
    const exported = p.exported.at(-1);
    if (exported) {
        fs.writeFileSync(`${IMG_DIR}/export_${f}.html`, exported);
        const s = await openStaticHtml(exported);
        await sleep(800);
        await s.eval(`document.querySelectorAll('details').forEach(d => d.open = true); document.querySelectorAll('button, summary').forEach(b => { try { b.click(); } catch {} }); true`);
        await sleep(500);
        const sq = await s.qa();
        const sdom = await s.eval(hostile);
        check(`XSS ${f}: exported HTML opened in a browser runs nothing hostile`, sq.alerts.length === 0 && s.dialogs.length === 0 && sdom.imgX === 0 && sdom.anyOnAttr.length === 0, { alerts: sq.alerts, dialogs: s.dialogs, dom: sdom, errors: sq.errors });
        await s.close();
    } else check(`${f}: export produced HTML`, false, p.hostLog.filter((e) => e.command === 'exportWebview'));
    if (f === 'xss_names.nc') await p.screenshot(`${IMG_DIR}/ui_xss_names.png`);
    if (f === 'attr_zoo.nc') {
        const shown = await p.eval(`document.body.innerText.split('\\n').filter(l => /np\\.float|"nan"|"inf"/.test(l)).slice(0, 10)`);
        check('attr_zoo: inf / nan / -inf attributes display as inf / nan (release notes §19.2)', shown.length === 0, shown);
        const wide = await p.eval(`({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth })`);
        check('attr_zoo: 200 000-char attribute and 20 000-element array do not cause horizontal page scroll', wide.scrollW <= wide.innerW, wide);
        await p.screenshot(`${IMG_DIR}/ui_attr_zoo.png`, { full: false });
    }
    await p.close();
}

// ---------- error page and its buttons ----------
for (const f of [`${SD}/broken_file.nc`, `${ADV}/text_as.nc`, `${ADV}/corrupt.zip`, `${ADV}/inline_plain.json`, `${SD}/sample_data.kerchunk.json`]) {
    const p = await openViewer(f);
    const err = await p.eval(`({ visible: !document.getElementById('error')?.classList.contains('hidden'), text: document.getElementById('error')?.innerText.slice(0, 600), buttons: [...document.querySelectorAll('#error [data-action], #error button, #error a')].map(b => (b.dataset.action || b.tagName) + ':' + b.textContent.trim()) })`);
    await p.eval(`[...document.querySelectorAll('#error [data-action]')].forEach(b => b.click()); true`);
    await sleep(500);
    const cmds = p.hostLog.filter((e) => e.command === 'executeCommand').map((e) => [e.payload.command, e.ok, e.error]);
    const q = await p.qa();
    check(`error page ${f.split('/').pop()}: message shown, every button maps to an allowed command`, err.visible && cmds.every((c) => c[1]) && q.csp.length === 0 && q.errors.length === 0, { err, cmds, q });
    if (f.endsWith('broken_file.nc')) await p.screenshot(`${IMG_DIR}/ui_error_page.png`);
    await p.close();
}

// ---------- cards, sections, encoding toggle, narrow ----------
{
    const p = await openViewer(`${SD}/sample_data_multiple_groups.nc`);
    const initial = await p.eval(`({ cardsOpen: [...document.querySelectorAll('details.variable-details')].filter(d => d.open).length, cards: document.querySelectorAll('details.variable-details').length, encodingSections: [...document.querySelectorAll('details')].filter(d => /Xarray Encoding/i.test(d.querySelector('summary')?.textContent || '')).length })`);
    check('cards start collapsed; encoding sections present by default', initial.cardsOpen === 0 && initial.cards > 0 && initial.encodingSections > 0, initial);
    // badge counts vs JSON
    const info = p.infoResponse.result;
    const badgeCheck = await p.eval(`[...document.querySelectorAll('details.variable-details')].slice(0, 8).map(d => ({ name: d.querySelector('summary')?.textContent.trim().split(/\\s+/)[0], badges: [...d.querySelectorAll('.count-badge, .badge, [class*=count]')].map(b => b.textContent.trim()) }))`);
    console.log('      badges sample', JSON.stringify(badgeCheck).slice(0, 600));
    await p.close();
    const p2 = await openViewer(`${SD}/sample_data_multiple_groups.nc`, { config: { showXarrayEncodingAttributes: false } });
    const off = await p2.eval(`[...document.querySelectorAll('details')].filter(d => /Xarray Encoding/i.test(d.querySelector('summary')?.textContent || '')).length`);
    check('showXarrayEncodingAttributes=false → no Xarray Encoding sections', off === 0, { off });
    await p2.close();
    for (const w of [420, 320]) {
        const p3 = await openViewer(`${SD}/sample_data_multiple_groups.nc`, { width: w });
        await p3.eval(`document.getElementById('expandAllButton').click(); true`);
        await sleep(300);
        const m = await p3.eval(`({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, overflowing: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 8).map(e => e.tagName + '.' + e.className + ' right=' + Math.round(e.getBoundingClientRect().right)) })`);
        check(`narrow ${w}px, everything expanded: no horizontal page scroll`, m.scrollW <= m.innerW, m);
        await p3.screenshot(`${IMG_DIR}/ui_narrow_${w}.png`);
        await p3.close();
    }
}

// ---------- refresh with changed settings / while plotting ----------
{
    const p = await openViewer(`${ADV}/slow.nc`);
    await p.eval(`[...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === '/slow0').querySelector('[data-action="create-plot"]').click(); true`);
    await sleep(1000);
    await p.eval(`document.getElementById('refreshButton').click(); true`);
    await sleep(3000);
    const s1 = await p.eval(`(() => { const c = [...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === '/slow0'); return { loading: !!c.querySelector('.plot-loading'), createDisabled: c.querySelector('[data-action="create-plot"]').disabled, cancelAll: document.getElementById('cancelAllPlotsButton').textContent.trim(), cancelHidden: document.getElementById('cancelAllPlotsButton').classList.contains('hidden') }; })()`);
    await sleep(25000);
    const s2 = await p.eval(`(() => { const c = [...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === '/slow0'); return { img: !!c.querySelector('img'), msg: c.querySelector('.plot-error').textContent.trim().slice(0, 200), createDisabled: c.querySelector('[data-action="create-plot"]').disabled, cancelHidden: document.getElementById('cancelAllPlotsButton').classList.contains('hidden'), cancelAll: document.getElementById('cancelAllPlotsButton').textContent.trim() }; })()`);
    check('Refresh while a plot runs: UI state stays consistent (result shown or controls re-enabled, Cancel All not stuck)', !s2.createDisabled && s2.cancelHidden, { justAfterRefresh: s1, later: s2 });
    await p.close();
}

// ---------- big file render time ----------
for (const f of ['sample_data_many_groups_light_x5.nc', 'sample_data_many_vars.nc', 'sample_zarr_arborescence.zarr']) {
    const p = await openViewer(`${SD}/${f}`);
    const t = await p.eval(`(async () => { const t0 = performance.now(); document.getElementById('expandAllButton').click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const t1 = performance.now(); document.getElementById('collapseAllButton').click(); await new Promise(r => requestAnimationFrame(r)); return { expandMs: Math.round(t1 - t0), nodes: document.getElementsByTagName('*').length, cards: document.querySelectorAll('details.variable-details').length }; })()`);
    const q = await p.qa();
    check(`${f}: renders (backend ${p.loadSecs}s), expand all ${t.expandMs} ms, ${t.nodes} DOM nodes`, q.errors.length === 0 && t.expandMs < 5000, { ...t, q });
    await p.close();
}

// ---------- header toolbar at every width ----------
for (const width of [320, 360, 420, 600, 1000]) {
    const p = await openViewer(`${SD}/sample_data.netcdf`, { width });
    const m = await p.eval(`(() => { const t = document.getElementById('top-level-title').getBoundingClientRect(); const c = document.getElementById('header-controls').getBoundingClientRect(); const b = [...document.querySelectorAll('.header-control-button')].map(e => e.getBoundingClientRect()); return { titleRight: Math.round(t.right), controlsLeft: Math.round(c.left), buttonsVisible: b.filter(r => r.width >= 20 && r.right <= window.innerWidth).length }; })()`);
    check(`header at ${width}px: title ends before the toolbar, 4 buttons visible`, m.titleRight <= m.controlsLeft && m.buttonsVisible === 4, m);
    await p.close();
}

await shutdown();
finish();
