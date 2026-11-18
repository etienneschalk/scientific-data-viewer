import { execSync } from 'node:child_process';
import { FIXTURES, makeChecker, openViewer, shutdown } from './harness.mjs';

// Each plot of slow.nc takes ~20 s: a long timeout keeps parallel plots from timing out
const SLOW = `${FIXTURES}/slow.nc`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { check, finish } = makeChecker();
const pyProcs = () => {
    try {
        return execSync(`pgrep -af "get_data_info.py plot ${SLOW}" || true`).toString().trim().split('\n').filter((l) => l && !l.includes('pgrep')).length;
    } catch {
        return -1;
    }
};
const ctl = (v) => `[...document.querySelectorAll('.variable-plot-controls')].find(c => c.dataset.variable === ${JSON.stringify(v)})`;
const state = (v) => `(() => { const c = ${ctl(v)}; return {
    create_disabled: c.querySelector('[data-action="create-plot"]').disabled,
    cancel_visible: !c.querySelector('[data-action="cancel-plot"]').classList.contains('hidden'),
    img: !!c.querySelector('.plot-image-container img'),
    loading: !!c.querySelector('.plot-loading'),
    message: c.querySelector('.plot-error').textContent.trim().slice(0, 300),
    message_class: c.querySelector('.plot-error').className,
    card_open: c.closest('details.variable-details')?.open,
    cancelAll: document.getElementById('cancelAllPlotsButton').className + ' ' + document.getElementById('cancelAllPlotsButton').textContent.trim(),
  }; })()`;
const click = (p, v, action) => p.eval(`${ctl(v)}.querySelector('[data-action="${action}"]').click(); true`);

// 1. single cancel
{
    const p = await openViewer(SLOW, { config: { plotTimeoutMs: 120000 } });
    await click(p, '/slow0', 'create-plot');
    await sleep(1500);
    const running = await p.eval(state('/slow0'));
    const procsBefore = pyProcs();
    await click(p, '/slow0', 'cancel-plot');
    await sleep(300);
    const after = await p.eval(state('/slow0'));
    await sleep(2500);
    const procsAfter = pyProcs();
    await sleep(20000); // past the time the plot would have finished
    const late = await p.eval(state('/slow0'));
    const abort = p.hostLog.find((e) => e.command === 'abortPlot');
    const create = p.hostLog.find((e) => e.command === 'createPlot');
    check('single Cancel: while running Create disabled + Cancel shown', running.create_disabled && running.cancel_visible && running.loading, running);
    check('single Cancel: shows "Plot cancelled." at once, neutral', after.message === 'Plot cancelled.' && !after.message_class.split(' ').includes('error') && !after.create_disabled && !after.cancel_visible, after);
    check('single Cancel: abortPlot sent with the same operationId', abort && abort.payload.operationId === create.payload.operationId && abort.ok, { abort, createOp: create.payload.operationId });
    check('single Cancel: Python process killed', procsBefore >= 1 && procsAfter === 0, { procsBefore, procsAfter });
    check('single Cancel: no late image / error after the abort', !late.img && late.message === 'Plot cancelled.', late);
    check('single Cancel: no console errors', (await p.qa()).errors.length === 0, await p.qa());
    await p.close();
}

// 2. Create Plot on a variable, then Plot All while it runs (same variable plotted twice?)
{
    const p = await openViewer(SLOW, { config: { plotTimeoutMs: 120000 } });
    await click(p, '/slow0', 'create-plot');
    await sleep(800);
    await p.eval(`document.getElementById('createAllPlotsButton').click(); true`);
    await sleep(1500);
    const creates = p.hostLog.filter((e) => e.command === 'createPlot' && e.payload.variable === '/slow0');
    check('Plot All while a single plot of the same variable runs: only one process per variable', creates.length === 1, { createPlotRequestsForSlow0: creates.length, procs: pyProcs() });
    // Cancel that variable: does the other (first) process get aborted too?
    await click(p, '/slow0', 'cancel-plot');
    await sleep(300);
    const afterCancel = await p.eval(state('/slow0'));
    const aborts = p.hostLog.filter((e) => e.command === 'abortPlot');
    await p.eval(`waitFor = (c,t)=>new Promise((res,rej)=>{const s=Date.now();const f=()=>c()?res():(Date.now()-s>t?rej(new Error('timeout')):setTimeout(f,200));f();}); waitFor(() => !document.getElementById('createAllPlotsButton').disabled, 240000)`);
    await sleep(2000);
    const final = await p.eval(state('/slow0'));
    check('…after Cancel on that variable, it stays cancelled (no plot from the other run appears)', !final.img && final.message === 'Plot cancelled.', { afterCancel, final, aborts: aborts.map((a) => a.payload.operationId), creates: creates.map((c) => c.payload.operationId) });
    await p.close();
}

// 3. Plot All, then Cancel All
{
    const p = await openViewer(SLOW, { config: { plotTimeoutMs: 120000 } });
    await p.eval(`document.getElementById('createAllPlotsButton').click(); true`);
    await sleep(2000);
    const during = await p.eval(`({ btn: document.getElementById('createAllPlotsButton').textContent.trim(), disabled: document.getElementById('createAllPlotsButton').disabled, cancel: document.getElementById('cancelAllPlotsButton').textContent.trim(), cancelHidden: document.getElementById('cancelAllPlotsButton').classList.contains('hidden') })`);
    const procs = pyProcs();
    await p.eval(`document.getElementById('cancelAllPlotsButton').click(); true`);
    await sleep(3000);
    const after = await p.eval(`[...document.querySelectorAll('.variable-plot-controls')].map(c => [c.dataset.variable, c.querySelector('.plot-error').textContent.trim(), !!c.querySelector('img')])`);
    const btn = await p.eval(`({ btn: document.getElementById('createAllPlotsButton').textContent.trim(), disabled: document.getElementById('createAllPlotsButton').disabled, cancelHidden: document.getElementById('cancelAllPlotsButton').classList.contains('hidden') })`);
    const notes = p.hostLog.filter((e) => e.command === 'showNotification').map((e) => e.payload);
    check('Plot All runs max 5 at once and shows Cancel All (n)', during.disabled && !during.cancelHidden && procs <= 5 && procs >= 1, { during, procs });
    check('Cancel All: all processes killed, buttons restored', pyProcs() === 0 && !btn.disabled && btn.cancelHidden, { procsAfter: pyProcs(), btn });
    check('Cancel All: every running card says "Plot cancelled."', after.every(([, m, img]) => m === 'Plot cancelled.' || img), after);
    await sleep(25000);
    const late = await p.eval(`[...document.querySelectorAll('.variable-plot-controls')].map(c => [c.dataset.variable, c.querySelector('.plot-error').textContent.trim(), !!c.querySelector('img')])`);
    check('Cancel All: nothing appears later', JSON.stringify(late) === JSON.stringify(after), { after, late });
    check('Cancel All: notifications', true, notes);
    await p.close();
}

// 4. Plot All, cancel ONE variable during it: summary counts
{
    const p = await openViewer(SLOW, { config: { plotTimeoutMs: 120000 } });
    await p.eval(`document.getElementById('createAllPlotsButton').click(); true`);
    await sleep(2000);
    await click(p, '/slow1', 'cancel-plot');
    await p.eval(`waitFor = (c,t)=>new Promise((res,rej)=>{const s=Date.now();const f=()=>c()?res():(Date.now()-s>t?rej(new Error('timeout')):setTimeout(f,200));f();}); waitFor(() => !document.getElementById('createAllPlotsButton').disabled, 240000)`);
    await sleep(500);
    const notes = p.hostLog.filter((e) => e.command === 'showNotification').map((e) => e.payload);
    check('Plot All with one single Cancel: summary says 4 successful, 1 cancelled, 0 failed', notes.some((n) => /4 successful/.test(n.message) && /1 cancelled/.test(n.message) && !/failed/.test(n.message)), notes);
    await p.close();
}

// 5. Cancel before the request even reached the host (immediate click)
{
    const p = await openViewer(SLOW, { config: { plotTimeoutMs: 120000 } });
    await p.eval(`(() => { const c = ${ctl('/slow2')}; c.querySelector('[data-action="create-plot"]').click(); c.querySelector('[data-action="cancel-plot"]').click(); })(); true`);
    await sleep(2500);
    const procs = pyProcs();
    const log = p.hostLog.map((e) => [e.command, e.ok, e.payload?.operationId, e.error?.slice(0, 80)]);
    check('Cancel clicked immediately after Create: process does not survive', procs === 0, { procs, log });
    await sleep(22000);
    const late = await p.eval(state('/slow2'));
    check('…and no image appears later', !late.img, { late, procsLater: pyProcs(), log: p.hostLog.map((e) => [e.command, e.ok, e.payload?.operationId, e.error?.slice(0, 80)]) });
    await p.close();
}

// 6. Re-plot after cancel works
{
    const p = await openViewer(SLOW, { config: { plotTimeoutMs: 120000 } });
    await click(p, '/fast', 'create-plot');
    await click(p, '/fast', 'cancel-plot');
    await sleep(300);
    await click(p, '/fast', 'create-plot');
    await p.eval(`waitFor = (c,t)=>new Promise((res,rej)=>{const s=Date.now();const f=()=>c()?res():(Date.now()-s>t?rej(new Error('timeout')):setTimeout(f,200));f();}); waitFor(() => !${ctl('/fast')}.querySelector('.plot-loading'), 60000)`);
    const s = await p.eval(state('/fast'));
    check('Create → Cancel → Create again: plot shown, no stale "cancelled" message', s.img && s.message === '', s);
    await p.close();
}

await shutdown();
finish();
