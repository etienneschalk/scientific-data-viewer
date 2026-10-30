// Time range controls on cftime, GRIB and a datetime data variable.
import { FIXTURES, SAMPLES, makeChecker, openViewer, shutdown } from './harness.mjs';

const { check, finish } = makeChecker();
const CASES = [
    // [file, expected options, plot should succeed]
    [`${FIXTURES}/cftime_360_day.nc`, ['', 'time'], false], // cftime axes need nc-time-axis (documented)
    [`${SAMPLES}/sample_data.grib`, ['', 'time', 'valid_time'], true], // temperature `t` is not a time
    [`${FIXTURES}/dtype_zoo.nc`, ['', 'datetime_var', 't'], true],
];
for (const [file, expectedOptions, plots] of CASES) {
    const p = await openViewer(file, { config: { globalTimeControls: true, groupTimeControls: true } });
    await p.eval(`document.querySelectorAll('details').forEach(d => d.open = true); true`);
    const T = `.group-plot-controls-section[data-group="/"] .time-controls-section`;
    const opts = await p.eval(`[...document.querySelectorAll('${T} [data-time="variable"] option')].map(o => o.value)`);
    await p.eval(`(() => { const s = document.querySelector('${T} [data-time="variable"]'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', {bubbles:true})); })(); true`);
    const pre = await p.eval(`({ start: document.querySelector('${T} [data-time="start-text"]').value, end: document.querySelector('${T} [data-time="end-text"]').value })`);
    await p.eval(`document.querySelector('.variable-plot-controls [data-action="create-plot"]').click(); true`);
    await p.eval(`new Promise(r => { const f = () => document.querySelector('.variable-plot-controls .plot-loading') ? setTimeout(f, 200) : r(); setTimeout(f, 300); })`);
    const res = await p.eval(`({ img: !!document.querySelector('.variable-plot-controls img'), msg: (document.querySelector('.variable-plot-controls .plot-error pre')?.textContent || '').slice(0, 300) })`);
    const sent = p.hostLog.find((e) => e.command === 'createPlot')?.payload;
    const name = file.split('/').pop();
    check(`${name}: time selector offers only datetime variables`, JSON.stringify(opts) === JSON.stringify(expectedOptions), opts);
    check(`${name}: range prefilled from the data and sent as naive ISO`, pre.start !== '' && pre.end !== '' && sent?.startDatetime === pre.start.replace(' ', 'T'), { pre, sent: sent && [sent.datetimeVariableName, sent.startDatetime, sent.endDatetime] });
    check(`${name}: plot ${plots ? 'succeeds' : 'fails with the nc-time-axis message'}`, plots ? res.img : /nc-time-axis/.test(res.msg), res);
    check(`${name}: no script error / CSP violation`, (await p.qa()).errors.length === 0 && (await p.qa()).csp.length === 0, await p.qa());
    await p.close();
}
await shutdown();
finish();
