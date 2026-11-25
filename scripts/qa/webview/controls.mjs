import { IMG_DIR, SAMPLES, makeChecker, openViewer, shutdown } from './harness.mjs';

const NC = `${SAMPLES}/sample_data.netcdf`; // precipitation(time 6, lat 45, lon 90)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { check, finish } = makeChecker();
// The plot settings editor (one open at a time): every control below is looked up in it
const S = '.plot-editor';
/** Open the settings editor of the whole file (Plot section of group /) or of a variable, if not already open there. */
const openSettings = (p, variable = null) =>
    p.eval(`(() => {
        const host = ${variable === null ? `document.querySelector('.group-plot-section[data-group="/"]')` : `[...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === ${JSON.stringify(variable)})`};
        if (!host.querySelector('.plot-editor')) host.querySelector('.plot-settings-button').click();
        return !!host.querySelector('.plot-editor');
    })()`);
const resetBlock = (p, part) => p.eval(`document.querySelector('${S} [data-action="editor-reset"][data-part="${part}"]').click(); true`);
const setSelect = (p, key, value) =>
    p.eval(`(() => { const s = document.querySelector('${S} [data-param="${key}"]'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); })(); true`);
const box = (scope, dim, part) => `${scope} .dimension-slice-row[data-dimension="${dim}"] .slice-part[data-part="${part}"]`;
const boxes = (p, scope, dim) =>
    p.eval(`(() => { const row = document.querySelector('${scope} .dimension-slice-row[data-dimension="${dim}"]'); const v = (q) => row.querySelector(q); return {
        start: v('[data-part=start]').value, stop: v('[data-part=stop]').value, step: v('[data-part=step]').value,
        from: v('.slice-range-handle[id$="-from"]')?.value, to: v('.slice-range-handle[id$="-to"]')?.value,
        stopInvalid: v('[data-part=stop]').getAttribute('aria-invalid'), stepIgnored: row.classList.contains('slice-step-ignored'),
        sliderDisabled: v('.slice-range-handle')?.disabled, focused: document.activeElement?.dataset?.part ?? null }; })()`);
async function plot(p, variable) {
    const n = p.hostLog.length;
    await p.eval(`(() => { const c = [...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === ${JSON.stringify(variable)}); c.querySelector('[data-action="create-plot"]').click(); })(); true`);
    await p.eval(`new Promise((res, rej) => { const s = Date.now(); const f = () => { const c = [...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === ${JSON.stringify(variable)}); if (!c.querySelector('.plot-loading') && !c.querySelector('[data-action="create-plot"]').disabled) res(); else if (Date.now() - s > 120000) rej(new Error('timeout')); else setTimeout(f, 150); }; setTimeout(f, 150); })`);
    const entry = p.hostLog.slice(n).find((e) => e.command === 'createPlot');
    const ui = await p.eval(`(() => { const c = [...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === ${JSON.stringify(variable)}); return { img: !!c.querySelector('.plot-image-container img'), msg: c.querySelector('.plot-error pre')?.textContent ?? c.querySelector('.plot-error').textContent }; })()`);
    return { payload: entry?.payload, args: entry?.args, error: entry?.error, ...ui };
}
const typeText = async (p, sel, text) => {
    await p.typeInto(sel, text);
    await sleep(50);
};
const typeChars = async (p, sel, text) => {
    await p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.scrollIntoView({block:'center'}); el.focus(); el.value=''; })()`);
    for (const ch of text) {
        await p.send('Input.insertText', { text: ch });
        await sleep(30);
    }
};

// ---------- slices ----------
{
    const p = await openViewer(NC);
    await p.eval(`document.querySelectorAll('details').forEach(d => d.open = true); true`);
    const fieldsBefore = await p.eval(`document.querySelectorAll('.plot-field').length`);
    check('settings: no plot control is built before a Settings button is clicked', fieldsBefore === 0, { fieldsBefore });
    const opened = await openSettings(p);
    const fileTabs = await p.eval(`[...document.querySelectorAll('${S} .plot-editor-tab')].map((t) => t.childNodes[0].textContent)`);
    check('settings: the whole file editor opens from the Plot section of group /', opened && JSON.stringify(fileTabs) === '["Whole file"]', { opened, fileTabs });
    // A. pasted full slice
    await typeText(p, box(S, 'time', 'start'), '0:4:2');
    let b = await boxes(p, S, 'time');
    check('slice: "0:4:2" pasted in start spreads over the three boxes, slider 0..3', b.start === '0' && b.stop === '4' && b.step === '2' && b.from === '0' && b.to === '3', b);
    let r = await plot(p, '/precipitation');
    check('slice: payload "0:4:2" and plot OK', r.payload?.dimensionSlices?.time === '0:4:2' && r.img, r);
    // A2. typed char by char "1:5"
    await typeChars(p, box(S, 'time', 'start'), '1:5');
    b = await boxes(p, S, 'time');
    check('slice: typing "1:5" char by char moves from box to box', b.start === '1' && b.stop === '5' && b.focused === 'stop', b);
    // B. 5::2 -> open stop
    await typeText(p, box(S, 'time', 'step'), '');
    await typeText(p, box(S, 'time', 'stop'), '');
    await typeText(p, box(S, 'time', 'start'), '2::2');
    b = await boxes(p, S, 'time');
    check('slice: "2::2" keeps Python meaning (stop = size 6)', b.start === '2' && b.stop === '6' && b.step === '2', b);
    // C. negative index alone
    for (const part of ['start', 'stop', 'step']) await typeText(p, box(S, 'time', part), '');
    await typeText(p, box(S, 'time', 'start'), '-1');
    b = await boxes(p, S, 'time');
    r = await plot(p, '/precipitation');
    check('slice: start "-1" alone = last index; handles at 5', b.from === '5' && b.to === '5' && r.payload?.dimensionSlices?.time === -1 && r.img, { b, payload: r.payload, img: r.img, msg: r.msg });
    // D. step ignored when stop empty
    await typeText(p, box(S, 'time', 'step'), '2');
    b = await boxes(p, S, 'time');
    r = await plot(p, '/precipitation');
    check('slice: start set + stop empty + step → step marked ignored and not sent', b.stepIgnored && r.payload?.dimensionSlices?.time === -1, { b, sent: r.payload?.dimensionSlices });
    // E. empty selection
    for (const part of ['start', 'stop', 'step']) await typeText(p, box(S, 'time', part), '');
    await typeText(p, box(S, 'time', 'start'), '4');
    await typeText(p, box(S, 'time', 'stop'), '2');
    b = await boxes(p, S, 'time');
    r = await plot(p, '/precipitation');
    check('slice: stop<=start → stop outlined invalid; backend explains empty selection', b.stopInvalid === 'true' && /No data to plot/.test(r.msg), { b, msg: r.msg });
    // F. negative step disables slider
    await typeText(p, box(S, 'time', 'start'), '');
    await typeText(p, box(S, 'time', 'stop'), '');
    await typeText(p, box(S, 'time', 'step'), '-1');
    b = await boxes(p, S, 'time');
    r = await plot(p, '/precipitation');
    check('slice: "::-1" disables slider; plot works', b.sliderDisabled === true && r.payload?.dimensionSlices?.time === '::-1' && r.img, { b, payload: r.payload?.dimensionSlices, msg: r.msg });
    // G. non integer
    await typeText(p, box(S, 'time', 'step'), '');
    await typeText(p, box(S, 'time', 'start'), '1.5');
    b = await boxes(p, S, 'time');
    const invalidStart = await p.eval(`document.querySelector(${JSON.stringify(box(S, 'time', 'start'))}).matches(':invalid')`);
    r = await plot(p, '/precipitation');
    check('slice: non-integer "1.5" outlined red and rejected with a clear message', invalidStart && /Invalid dimension slice/.test(r.msg), { b, invalidStart, msg: r.msg, sent: r.payload?.dimensionSlices });
    // H. out-of-range index: slider clamps; backend message
    await typeText(p, box(S, 'time', 'start'), '99');
    b = await boxes(p, S, 'time');
    r = await plot(p, '/precipitation');
    check('slice: index 99 on size 6 → clear error', /out of bounds|IndexError/.test(r.msg), { b, msg: r.msg });
    // I. Reset of the slices block only
    await typeText(p, box(S, 'time', 'start'), '1');
    await typeText(p, `${S} [data-param="cmap"]`, 'magma');
    await resetBlock(p, 'slices');
    const afterResetSlices = { time: await boxes(p, S, 'time'), cmap: await p.eval(`document.querySelector('${S} [data-param="cmap"]').value`) };
    await typeText(p, box(S, 'time', 'start'), '1');
    await resetBlock(p, 'params');
    const afterResetParams = { time: await boxes(p, S, 'time'), cmap: await p.eval(`document.querySelector('${S} [data-param="cmap"]').value`) };
    // The summary shows the store: a Reset must not be undone by the change event of the box it removes
    const summaryAfterReset = await p.eval(`document.querySelector('.group-plot-section[data-group="/"] .plot-settings-summary').textContent`);
    check('Reset (slices) clears only slices; Reset (plot params) clears only params, in the stored settings too', afterResetSlices.time.start === '' && afterResetSlices.cmap === 'magma' && afterResetParams.time.start === '1' && afterResetParams.cmap === '' && summaryAfterReset === 'Settings:time1file', { afterResetSlices, afterResetParams, summaryAfterReset });
    await resetBlock(p, 'slices');

    // J. real mouse drag on the "from" handle of lon (size 90)
    await p.eval(`document.querySelector('${S} .dimension-slice-row[data-dimension="lon"]').scrollIntoView({block:'center'}); true`);
    const rect = await p.eval(`(() => { const r = document.querySelector('${S} .dimension-slice-row[data-dimension="lon"] .slice-range').getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; })()`);
    const y = rect.y + rect.h / 2;
    await p.mouseDrag(rect.x + 4, y, rect.x + rect.w * 0.5, y);
    const afterFrom = await boxes(p, S, 'lon');
    await p.mouseDrag(rect.x + rect.w - 4, y, rect.x + rect.w * 0.75, y);
    const afterTo = await boxes(p, S, 'lon');
    check('slider: first handle writes start (stop = size keeps it a range); second handle writes only stop', afterFrom.start !== '' && afterFrom.stop === '90' && afterTo.start === afterFrom.start && afterTo.stop !== '90' && afterTo.stop !== '', { rect, afterFrom, afterTo });
    // drag first handle past the second (crossing)
    await p.mouseDrag(rect.x + rect.w * 0.5, y, rect.x + rect.w - 2, y);
    const crossed = await boxes(p, S, 'lon');
    const sentCross = (await plot(p, '/precipitation')).payload?.dimensionSlices;
    check('slider: crossing handles gives a valid (non-empty) slice', crossed.stopInvalid !== 'true' && sentCross?.lon !== undefined && Number(String(sentCross.lon).split(':')[0]) < Number(String(sentCross.lon).split(':')[1] ?? 1e9), { crossed, sentCross });
    await resetBlock(p, 'slices');

    // ---------- plot parameters ----------
    const setParam = (scope, key, value) => typeText(p, `${scope} [data-param="${key}"]`, value);
    // vmin in scientific notation (negative)
    await typeText(p, box(S, 'time', 'start'), '0');
    await setParam(S, 'vmin', '-1e-7');
    r = await plot(p, '/precipitation');
    check('vmin "-1e-7" (negative, scientific): plot works', r.img, { args: r.args, msg: r.msg.slice(0, 700) });
    await setParam(S, 'vmin', '-0.5');
    r = await plot(p, '/precipitation');
    check('vmin "-0.5": plot works', r.img, { msg: r.msg.slice(0, 200) });
    // invalid numbers silently ignored?
    await setParam(S, 'vmin', '1,5');
    const commaInvalid = await p.eval(`document.querySelector('${S} [data-param="vmin"]').matches(':invalid') || document.querySelector('${S} [data-param="vmin"]').getAttribute('aria-invalid')`);
    r = await plot(p, '/precipitation');
    check('vmin "1,5" (decimal comma): user is told the value is invalid (not silently dropped)', commaInvalid || /vmin/.test(r.msg), { sentVmin: r.payload?.vmin, commaInvalid, img: r.img });
    await setParam(S, 'vmin', '');
    await setParam(S, 'size', '-3');
    r = await plot(p, '/precipitation');
    check('size "-3": rejected visibly (not silently dropped)', /size/.test(r.msg) || (await p.eval(`document.querySelector('${S} [data-param="size"]').matches(':invalid')`)), { sentSize: r.payload?.size, img: r.img });
    await setParam(S, 'size', '');
    // cmap invalid
    await setParam(S, 'cmap', 'notacmap');
    r = await plot(p, '/precipitation');
    check('cmap invalid → readable error', /not a valid value for cmap/.test(r.msg), { msg: r.msg.slice(0, 300) });
    // seaborn colormaps (v0.14; seaborn installed in the backend's interpreter)
    await setParam(S, 'cmap', 'seaborn:mako');
    r = await plot(p, '/precipitation');
    check('cmap "seaborn:mako" → plot OK, sent as typed', r.img && r.args?.join(' ').includes('--cmap seaborn:mako'), { args: r.args, msg: r.msg.slice(0, 300) });
    await setParam(S, 'cmap', 'seaborn:nope');
    r = await plot(p, '/precipitation');
    check('cmap "seaborn:nope" → one-line error naming the colormap', /cmap=seaborn:nope: not a seaborn colormap/.test(r.msg), { msg: r.msg.slice(0, 300) });
    await setParam(S, 'cmap', '');
    // norm = log (v0.14)
    await setSelect(p, 'norm', 'log');
    r = await plot(p, '/precipitation');
    const normItem = await p.eval(`[...document.querySelectorAll('.plot-layout-item--user')].map((e) => e.textContent).find((t) => t.startsWith('norm')) ?? ''`);
    const normOutlined = await p.eval(`document.querySelector('${S} [data-param="norm"]').closest('.plot-field').classList.contains('plot-field--changed')`);
    check('norm "log" → plot OK, "--norm log" sent, outlined, layout item "norm log, …"', r.img && r.args?.join(' ').includes('--norm log') && /^norm log, /.test(normItem) && normOutlined, { args: r.args, normItem, normOutlined, msg: r.msg.slice(0, 300) });
    await setSelect(p, 'norm', '');
    // col_wrap auto, at the file level and at the variable level
    await p.eval(`document.querySelector('${S} [data-param="colWrapAuto"]').click(); true`);
    const fileColWrapDisabled = await p.eval(`document.querySelector('${S} [data-param="colWrap"]').disabled`);
    await typeText(p, box(S, 'time', 'start'), '');
    await openSettings(p, '/precipitation');
    const inheritedColWrap = await p.eval(`document.querySelector('${S} [data-param="colWrap"]').placeholder`);
    await p.eval(`document.querySelector('${S} [data-param="colWrapAuto"]').click(); true`);
    const variableColWrapDisabled = await p.eval(`document.querySelector('${S} [data-param="colWrap"]').disabled`);
    check('col_wrap auto disables the number box (file and variable); the variable shows "auto (file)" before', fileColWrapDisabled && variableColWrapDisabled && inheritedColWrap === 'auto (file)', { fileColWrapDisabled, variableColWrapDisabled, inheritedColWrap });
    await setSelect(p, 'facetCol', 'time');
    r = await plot(p, '/precipitation');
    check('facet col=time + col_wrap auto → plot OK, "--col-wrap auto" sent', r.img && r.args?.join(' ').includes('--col-wrap auto'), { args: r.args, msg: r.msg.slice(0, 300) });
    await resetBlock(p, 'params');
    const variableAfterReset = await p.eval(`({ disabled: document.querySelector('${S} [data-param="colWrap"]').disabled, auto: document.querySelector('${S} [data-param="colWrapAuto"]').checked })`);
    await openSettings(p);
    await resetBlock(p, 'params');
    await resetBlock(p, 'slices');
    const fileAfterReset = await p.eval(`({ disabled: document.querySelector('${S} [data-param="colWrap"]').disabled, auto: document.querySelector('${S} [data-param="colWrapAuto"]').checked })`);
    check('Reset re-enables col_wrap (variable and file)', !variableAfterReset.disabled && !variableAfterReset.auto && !fileAfterReset.disabled && !fileAfterReset.auto, { variableAfterReset, fileAfterReset });

    // The nearest level wins, field by field: file cmap + robust, variable vmax + slice
    await setParam(S, 'cmap', 'magma');
    await setSelect(p, 'robust', 'true');
    await openSettings(p, '/precipitation');
    const tabs = await p.eval(`[...document.querySelectorAll('${S} .plot-editor-tab')].map((t) => t.childNodes[0].textContent)`);
    check('variable editor: tabs "This variable", "Whole file"', JSON.stringify(tabs) === '["This variable","Whole file"]', tabs);
    await setParam(S, 'vmax', '10');
    await typeText(p, box(S, 'time', 'start'), '0');
    r = await plot(p, '/precipitation');
    check('levels: variable vmax + file cmap + file robust all applied', r.payload?.cmap === 'magma' && r.payload?.robust === true && r.payload?.vmax === 10, { payload: r.payload });
    const chips = await p.eval(`[...[...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === '/precipitation').querySelectorAll('.settings-chip')].map((c) => c.textContent)`);
    check('summary under the Plot buttons: each setting with its level', JSON.stringify(chips) === JSON.stringify(['time0variable', 'vmax10variable', 'cmapmagmafile', 'robusttruefile']), chips);
    // A true / false setting: the file turns add_colorbar off, the variable on again
    await openSettings(p);
    await setSelect(p, 'addColorbar', 'false');
    await openSettings(p, '/precipitation');
    const inheritedLabel = await p.eval(`document.querySelector('${S} [data-param="addColorbar"]').options[0].textContent`);
    r = await plot(p, '/precipitation');
    const inherited = r.payload?.addColorbar;
    await setSelect(p, 'addColorbar', 'true');
    r = await plot(p, '/precipitation');
    check('true / false: the variable shows "false (file)", then its own value wins (add_colorbar)', inheritedLabel === 'false (file)' && inherited === false && r.payload?.addColorbar === true, { inheritedLabel, inherited, afterSet: r.payload?.addColorbar });
    // Slices merge dimension by dimension
    await openSettings(p);
    await typeText(p, box(S, 'lat', 'start'), '0:10');
    r = await plot(p, '/precipitation');
    check('[design] file slice lat=0:10 + variable slice time=0 → both sent', JSON.stringify(r.payload?.dimensionSlices) === '{"lat":"0:10","time":0}', { sent: r.payload?.dimensionSlices });
    const stale = await p.eval(`![...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === '/precipitation').querySelector('.plot-stale-note').classList.contains('hidden')`);
    await setParam(S, 'cmap', 'viridis');
    const staleAfter = await p.eval(`[...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === '/precipitation').querySelector('.plot-stale-note').classList.contains('hidden')`);
    check('a plot says "Settings changed" once a setting that applies to it changes', !stale && !staleAfter, { staleRightAfterPlot: stale, hiddenAfterChange: staleAfter });
    console.log('QA', JSON.stringify(await p.qa()));
    await p.screenshot(`${IMG_DIR}/ui_controls_end.png`);
    await p.close();
}

// ---------- load time in time zones ----------
for (const tz of ['Europe/Paris', 'America/New_York', 'Asia/Tokyo']) {
    const p = await openViewer(NC);
    await p.send('Emulation.setTimezoneOverride', { timezoneId: tz });
    await p.eval(`document.getElementById('refreshButton').click(); true`);
    await sleep(2500);
    const ts = await p.eval(`document.getElementById('timestamp')?.textContent.trim()`);
    check(`Loaded time [${tz}] shows an ISO time with an offset`, /Loaded: \d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}([+-]\d\d:\d\d|Z)/.test(ts), { ts, tz, host: p.lastLoadTime });
    await p.close();
}

// ---------- load time setting ----------
{
    const p = await openViewer(NC, { config: { showLoadTimeInLocalTime: false } });
    const ts = await p.eval(`document.getElementById('timestamp')?.textContent.trim()`);
    check('showLoadTimeInLocalTime=false → UTC (Z)', /Z/.test(ts), ts);
    await p.eval(`document.getElementById('refreshButton').click(); true`);
    await sleep(2500);
    const ts2 = await p.eval(`document.getElementById('timestamp')?.textContent.trim()`);
    check('after Refresh the timestamp updates and keeps the UTC format', ts2 !== ts && /Z/.test(ts2), { before: ts, after: ts2 });
    await p.close();
}
{
    const p = await openViewer(NC, { config: { showLoadTimeInLocalTime: true } });
    await p.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Kolkata' });
    await p.eval(`document.getElementById('refreshButton').click(); true`);
    await sleep(2500);
    const ts = await p.eval(`document.getElementById('timestamp')?.textContent.trim()`);
    check('local time in a half-hour zone (Asia/Kolkata) → +05:30', /\+05:30/.test(ts), ts);
    await p.close();
}

await shutdown();
finish();
