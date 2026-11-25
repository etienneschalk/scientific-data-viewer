// Storyboard of the demo video: what a new user does, from a fresh VS Code to
// tuned plots. Captions, zooms and fast-forwards are cues for montage.py; the
// rest drives the real VS Code (see lib/director.mjs).
import { main, viewer } from './lib/director.mjs';

const EXPLORER_FILE = main('.explorer-folders-view .monaco-list-row', { text: 'sample_climate.nc' });
const UV_BUTTON = main('.gettingStartedContainer .monaco-button', { text: 'Let the Extension Manage Python (uv)' });
const PROGRESS_TOAST = main('.notifications-toasts .notification-toast', { text: 'creating its Python environment' });

const variable = (name, css = '') => viewer(`.variable-plot-controls[data-variable="${name}"] ${css}`);
const variableSummary = (text) => viewer('details.variable-details > summary', { text });
// The plot settings editor (one open at a time, under the Settings button that opened it)
const editor = (css = '') => viewer(`.plot-editor ${css}`);
const sliceBox = (dim, part) =>
    editor(`.dimension-slice-row[data-dimension="${dim}"] .slice-part[data-part="${part}"]`);

/** Is the "Set up Python" step of the walkthrough checked? */
const setUpPythonDone = (d) =>
    d.evalMain(() => {
        const step = [...document.querySelectorAll('.gettingStartedContainer .getting-started-step')].find((s) =>
            s.textContent.includes('Set up Python'),
        );
        return !!step && !!step.querySelector('.codicon-getting-started-step-checked');
    });

/** Click Create Plot of `name` and wait for a new image; returns its rect. */
async function createPlot(d, name) {
    const before = await d.evalViewer(
        (doc, win, v) => doc.querySelector(`.variable-plot-controls[data-variable="${v}"] .plot-image-container img`)?.src ?? '',
        name,
    );
    await d.scrollIntoView(variable(name, '[data-action="create-plot"]'), { block: 'start', offset: 120 });
    await d.click(variable(name, '[data-action="create-plot"]'));
    await d.waitUntil(
        () =>
            d.evalViewer(
                (doc, win, v, old) => {
                    const img = doc.querySelector(`.variable-plot-controls[data-variable="${v}"] .plot-image-container img`);
                    return !!img && img.src !== old && img.complete && img.naturalWidth > 0;
                },
                name,
                before,
            ),
        { timeoutMs: 120000, what: `plot of ${name}` },
    );
    await d.pause(400);
}

export async function scenario(d, { skipSetup = false } = {}) {
    await d.pause(1500);

    // 1. Python, once: the Getting Started walkthrough, uv does the rest
    if (!skipSetup) {
        d.caption('Set up Python once, from the Getting Started walkthrough', { step: 1 });
        await d.pause(600);
        await d.press('Control+Shift+P');
        await d.type('getting started scientific');
        await d.pause(500);
        await d.click(main('.quick-input-list .monaco-list-row', { text: 'Scientific Data Viewer: Open Getting Started' }));
        await d.waitFor(UV_BUTTON, { timeoutMs: 20000 });
        await d.pause(1200);
        const step = await d.rect(main('.gettingStartedContainer .getting-started-step.expanded'));
        await d.zoom({ x: step.x - 40, y: step.y - 120, width: 760, height: step.height + 180 }, { padding: 0 });
        await d.pause(2600);
        await d.click(UV_BUTTON);
        await d.waitFor(PROGRESS_TOAST, { timeoutMs: 30000 });
        await d.zoom(null);
        d.caption('The extension creates its own environment with uv', {
            step: 1,
            sub: 'First time only: downloads Python 3.13, xarray, netCDF4, zarr, matplotlib…',
        });
        await d.pause(2200);
        d.speed('fit', 'sped up');
        await d.waitUntil(
            async () =>
                !(await d.rect(PROGRESS_TOAST, { optional: true })) && (await setUpPythonDone(d)),
            { timeoutMs: 900000, intervalMs: 500, what: 'the uv environment' },
        );
        d.speed(1);
        await d.pause(400);
        await d.zoom(main('.gettingStartedContainer .getting-started-step', { text: 'Set up Python' }), {
            padding: 60,
        });
        d.caption('Python is ready', { step: 1 });
        await d.pause(2200);
        await d.zoom(null);
    }

    // 2. Open a NetCDF file from the Explorer
    d.caption('Open a NetCDF file: click it in the Explorer', { step: 2 });
    await d.pause(600);
    await d.click(EXPLORER_FILE);
    await d.waitFor(viewer('details.variable-details'), { timeoutMs: 60000 });
    await d.pause(1000);
    await d.zoom(viewer('details.sticky-group-details', { text: 'File Information' }), { padding: 16 });
    d.caption('Format, size, engine, CF decoding at a glance', { step: 2 });
    await d.pause(2800);
    await d.zoom(null);

    // 3. Explore: the xarray view, then the structure group by group
    d.caption('Browse groups, dimensions, variables and attributes', { step: 3 });
    await d.hover(viewer('.xr-var-name', { exact: 'tas' }), { durationMs: 700 });
    await d.pause(900);
    await d.scrollIntoView(viewer('details.group-section > summary', { text: 'Variables' }), {
        block: 'start',
        offset: 70,
        durationMs: 1600,
    });
    await d.pause(500);
    await d.click(variableSummary('tas (time, lat, lon)'));
    await d.pause(600);
    await d.zoom(viewer('details.variable-details[open] .variable-section', { text: 'Attributes' }), { padding: 30 });
    d.caption('Every variable with its attributes, encoding and plot', { step: 3 });
    await d.hover(viewer('details.variable-details[open] .variable-section', { text: 'Attributes' }), {
        at: { x: 0.35, y: 0.55 },
        durationMs: 800,
    });
    await d.pause(2400);
    await d.zoom(null);
    await d.scrollIntoView(variable('/tas', '[data-action="create-plot"]'), { block: 'center', durationMs: 900 });
    await d.pause(400);

    // 4. One click, one plot
    d.caption('Plot a variable in one click', { step: 4 });
    await createPlot(d, '/tas');
    await d.scrollIntoView(variable('/tas', '.plot-image-container img'), { block: 'start', offset: 52, durationMs: 1200 });
    await d.moveTo(d.viewport.width - 90, d.viewport.height - 160, { durationMs: 600 });
    d.caption('12 monthly maps, faceted automatically', { step: 4 });
    await d.pause(2200);
    // The figure fills the view: no caption over it
    d.clearCaption();
    await d.pause(1500);

    // 5. A time series
    d.caption('Time series too', { step: 5 });
    await d.click(variableSummary('tas_global_mean'));
    await d.pause(500);
    await createPlot(d, '/tas_global_mean');
    await d.scrollIntoView(variable('/tas_global_mean', '.plot-image-container img'), { block: 'center', durationMs: 1000 });
    await d.moveTo(d.viewport.width - 90, d.viewport.height - 160, { durationMs: 600 });
    await d.zoom(variable('/tas_global_mean', '.plot-image-container img'), { padding: 10 });
    await d.pause(2600);
    await d.zoom(null);

    // 6. Tune: Settings of the variable, slice a dimension, change the colormap, plot again
    d.caption('Settings: slice dimensions, pick a colormap, plot again', { step: 6 });
    await d.scrollIntoView(variable('/tas', '.plot-settings-button'), { block: 'center', durationMs: 1200 });
    await d.click(variable('/tas', '.plot-settings-button'));
    await d.waitFor(editor(), { timeoutMs: 10000 });
    await d.scrollIntoView(editor('.dimension-slice-row[data-dimension="time"]'), {
        block: 'center',
        durationMs: 1800,
    });
    const controls = await d.rect(editor(''));
    await d.zoom({ x: controls.x, y: controls.viewTop + 40, width: controls.width, height: 620 }, { padding: 0 });
    await d.click(sliceBox('time', 'start'));
    await d.type('0:12:3', { delayMs: 140 });
    await d.pause(600);
    await d.click(editor('[data-param="cmap"]'));
    await d.type('RdYlBu_r', { delayMs: 90 });
    await d.pause(900);
    await d.zoom(null);
    await createPlot(d, '/tas');
    await d.scrollIntoView(variable('/tas', '.plot-image-container img'), { block: 'start', offset: 52, durationMs: 1200 });
    await d.moveTo(d.viewport.width - 90, d.viewport.height - 160, { durationMs: 600 });
    await d.zoom(variable('/tas', '.plot-image-container img'), { padding: 10 });
    d.caption('Every third month, in RdYlBu_r', { step: 6 });
    await d.pause(3400);
    await d.zoom(null);
    d.clearCaption();
    await d.pause(1200);
}
