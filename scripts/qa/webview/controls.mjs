import { IMG_DIR, SAMPLES, makeChecker, openViewer, shutdown } from './harness.mjs';

const NC = `${SAMPLES}/sample_data.netcdf`; // precipitation(time 6, lat 45, lon 90)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { check, finish } = makeChecker();
const G = (group = '/') => `.group-plot-controls-section[data-group="${group}"]`;
const GLOBAL = '#section-global-plot-controls';
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
    const S = G('/');
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
    await p.eval(`document.querySelector('${S} .dimension-slices-isel [data-action="clear-plot-controls"]').click(); true`);
    const afterResetSlices = { time: await boxes(p, S, 'time'), cmap: await p.eval(`document.querySelector('${S} [data-param="cmap"]').value`) };
    await typeText(p, box(S, 'time', 'start'), '1');
    await p.eval(`document.querySelector('${S} .plot-parameters [data-action="clear-plot-controls"]').click(); true`);
    const afterResetParams = { time: await boxes(p, S, 'time'), cmap: await p.eval(`document.querySelector('${S} [data-param="cmap"]').value`) };
    check('Reset (slices) clears only slices; Reset (plot params) clears only params', afterResetSlices.time.start === '' && afterResetSlices.cmap === 'magma' && afterResetParams.time.start === '1' && afterResetParams.cmap === '', { afterResetSlices, afterResetParams });
    await p.eval(`document.querySelector('${S} .dimension-slices-isel [data-action="clear-plot-controls"]').click(); true`);

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
    await p.eval(`document.querySelector('${S} .dimension-slices-isel [data-action="clear-plot-controls"]').click(); true`);

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
    await setParam(S, 'cmap', '');
    // col_wrap auto (group + global)
    await p.eval(`(() => { const a = document.querySelector('${S} [data-param="colWrapAuto"]'); a.click(); })(); true`);
    const groupColWrapDisabled = await p.eval(`document.querySelector('${S} [data-param="colWrap"]').disabled`);
    await p.eval(`(() => { const a = document.querySelector('${GLOBAL} [data-param="colWrapAuto"]'); a.click(); })(); true`);
    const globalColWrapDisabled = await p.eval(`document.querySelector('${GLOBAL} [data-param="colWrap"]').disabled`);
    check('col_wrap auto disables the number box (group and global)', groupColWrapDisabled && globalColWrapDisabled, { groupColWrapDisabled, globalColWrapDisabled });
    await typeText(p, box(S, 'time', 'start'), '');
    await p.eval(`document.querySelector('${S} [data-param="facetCol"]').value = 'time'; document.querySelector('${S} [data-param="facetCol"]').dispatchEvent(new Event('change', {bubbles: true})); true`);
    r = await plot(p, '/precipitation');
    check('facet col=time + col_wrap auto → plot OK, "--col-wrap auto" sent', r.img && r.args?.join(' ').includes('--col-wrap auto'), { args: r.args, msg: r.msg.slice(0, 300) });
    await p.eval(`document.querySelector('${S} .plot-parameters [data-action="clear-plot-controls"]').click(); document.querySelector('${GLOBAL} .plot-parameters [data-action="clear-plot-controls"]')?.click(); true`);
    const afterReset = await p.eval(`({ g: document.querySelector('${S} [data-param="colWrap"]').disabled, gl: document.querySelector('${GLOBAL} [data-param="colWrap"]').disabled, glAuto: document.querySelector('${GLOBAL} [data-param="colWrapAuto"]').checked })`);
    check('Reset re-enables col_wrap', !afterReset.g && !afterReset.gl && !afterReset.glAuto, afterReset);

    // group overrides field by field
    await setParam(GLOBAL, 'cmap', 'magma');
    await p.eval(`document.querySelector('${GLOBAL} [data-param="robust"]').click(); true`);
    await setParam(S, 'vmax', '10');
    await typeText(p, box(S, 'time', 'start'), '0');
    r = await plot(p, '/precipitation');
    check('group override: group vmax + global cmap + global robust all applied', r.payload?.cmap === 'magma' && r.payload?.robust === true && r.payload?.vmax === 10, { payload: r.payload });
    // group checkbox cannot turn off a global true
    await p.eval(`document.querySelector('${GLOBAL} [data-param="addColorbar"]').click(); true`); // global off
    const inheritedState = await p.eval(`document.querySelector('${S} [data-param="addColorbar"]').indeterminate`);
    r = await plot(p, '/precipitation');
    const inherited = r.payload?.addColorbar;
    await p.eval(`document.querySelector('${S} [data-param="addColorbar"]').click(); true`); // group: own value (on)
    r = await plot(p, '/precipitation');
    check('group checkbox shows "use the global value" until clicked, then overrides the global one (add_colorbar)', inheritedState === true && inherited === false && r.payload?.addColorbar === true, { inheritedState, inherited, afterClick: r.payload?.addColorbar });
    // global slices replaced by group slices
    await typeText(p, box(GLOBAL, 'lat', 'start'), '0:10');
    r = await plot(p, '/precipitation');
    check('[design] global slice lat=0:10 + group slice time=0 → only group slices sent', JSON.stringify(r.payload?.dimensionSlices) === '{"time":0}', { sent: r.payload?.dimensionSlices });
    console.log('QA', JSON.stringify(await p.qa()));
    await p.screenshot(`${IMG_DIR}/ui_controls_end.png`);
    await p.close();
}

// ---------- time controls ----------
for (const tz of ['Europe/Paris', 'America/New_York', 'Asia/Tokyo']) {
    const p = await openViewer(NC, { config: { globalTimeControls: true, groupTimeControls: true } });
    await p.send('Emulation.setTimezoneOverride', { timezoneId: tz });
    await p.eval(`document.querySelectorAll('details').forEach(d => d.open = true); true`);
    const T = `${G('/')} .time-controls-section`;
    const options = await p.eval(`[...document.querySelectorAll('${T} [data-time="variable"] option')].map(o => o.value)`);
    await p.eval(`(() => { const s = document.querySelector('${T} [data-time="variable"]'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', {bubbles:true})); })(); true`);
    const prefilled = await p.eval(`({ start: document.querySelector('${T} [data-time="start"]').value, end: document.querySelector('${T} [data-time="end"]').value, startText: document.querySelector('${T} [data-time="start-text"]').value, endText: document.querySelector('${T} [data-time="end-text"]').value })`);
    await typeText(p, `${T} [data-time="start-text"]`, '2020-01-31 00:00:00');
    await p.eval(`document.querySelector('${T} [data-time="start-text"]').dispatchEvent(new Event('change', {bubbles:true})); true`);
    await typeText(p, `${T} [data-time="end-text"]`, '2020-03-31 00:00:00');
    await p.eval(`document.querySelector('${T} [data-time="end-text"]').dispatchEvent(new Event('change', {bubbles:true})); true`);
    const r = await plot(p, '/precipitation');
    check(`time range [${tz}]: options only datetime vars; prefilled with data range; range sent naive; inclusive bounds (3 steps)`, options.join(',') === ',time' && r.payload?.startDatetime === '2020-01-31T00:00:00' && r.payload?.endDatetime === '2020-03-31T00:00:00' && r.img, { options, prefilled, sent: [r.payload?.datetimeVariableName, r.payload?.startDatetime, r.payload?.endDatetime], msg: r.msg.slice(0, 300) });
    if (tz === 'Europe/Paris') await p.screenshot(`${IMG_DIR}/ui_time_paris.png`);
    // timestamp shown in header
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
