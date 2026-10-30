import { ICONS } from '../../shared/icons';
import { messageBus } from './bus';
import {
    invalidPlotParameters,
    mergePlotControls,
    readPlotControls,
} from './plotParams';
import { activePlotOperations, globalState, plotAllState } from './state';
import {
    convertDatetimeLocalToISO,
    globalTimeControlsSection,
    readTimeControls,
} from './timeControls';
import {
    findByData,
    generateDefaultFileName,
    setMultilineText,
    uniqueId,
} from './util';

/**
 * Every per-variable action works on the variable's `.variable-plot-controls`
 * element, so the (file-derived) variable name never goes into a selector.
 */
interface PlotParts {
    variable: string;
    container: HTMLElement;
    image: HTMLElement;
    message: HTMLElement;
}

function plotParts(controls: HTMLElement): PlotParts {
    const part = (selector: string) => {
        const element = controls.querySelector<HTMLElement>(selector);
        if (!element) {
            throw new Error(`Plot controls without ${selector}`);
        }
        return element;
    };
    return {
        variable: controls.dataset.variable ?? '',
        container: part('.plot-container'),
        image: part('.plot-image-container'),
        message: part('.plot-error'),
    };
}

/** Operation id of the plot each variable is running (for its Cancel button). */
const runningPlots = new WeakMap<HTMLElement, string>();

/** Operations cancelled by the user: their result is ignored when it arrives. */
const cancelledPlotOperations = new Set<string>();

export function allPlotControls(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll<HTMLElement>('.variable-plot-controls'),
    );
}

function hidePlotMessage(controls: HTMLElement): void {
    const { message } = plotParts(controls);
    message.classList.add('hidden');
    message.classList.remove('error', 'success');
    message.textContent = '';
}

/**
 * Open the variable card and its Plot section (the controls element), so a
 * plot started while they are collapsed (e.g. by Plot All) is seen. Enclosing
 * groups keep the state the user chose.
 */
function revealPlotSection(controls: HTMLElement): void {
    if (controls instanceof HTMLDetailsElement) {
        controls.open = true;
    }
    const card = controls.closest<HTMLDetailsElement>(
        'details.variable-details',
    );
    if (card) {
        card.open = true;
    }
}

function displayVariablePlotLoading(controls: HTMLElement): void {
    const { container, image } = plotParts(controls);
    revealPlotSection(controls);
    hidePlotMessage(controls);
    image.innerHTML = '<p class="plot-loading">Loading...</p>';
    container.classList.remove('hidden');
}

function displayVariablePlot(controls: HTMLElement, plotData: unknown): void {
    const { variable, container, image } = plotParts(controls);
    hidePlotMessage(controls);
    image.innerHTML = '';
    container.classList.remove('hidden');
    if (typeof plotData === 'string' && plotData.startsWith('iVBOR')) {
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${plotData}`;
        img.alt = `Plot for ${variable}`;
        image.appendChild(img);
    } else {
        displayVariablePlotError(
            controls,
            'Error creating plot: Python script failed',
        );
    }
}

function displayVariablePlotError(controls: HTMLElement, text: string): void {
    const { container, message } = plotParts(controls);
    const preId = uniqueId('plot-message');
    message.innerHTML = /*html*/ `
        <div>
            ${
                text.includes('Matplotlib is not installed')
                    ? `<button class="plot-action-button plot-install-button" data-action="install-packages" data-packages="matplotlib" title="Once installed (a notification should appear), retry 'Create Plot' again.">${ICONS.install} Install matplotlib</button>`
                    : ''
            }
            <button class="text-copy-button" data-target-id="${preId}" title="Copy error message">Copy</button>
            <pre id="${preId}"></pre>
        </div>`;
    const pre = message.querySelector('pre');
    if (pre) {
        pre.textContent = text;
    }
    message.classList.remove('hidden', 'success');
    message.classList.add('error');
    container.classList.remove('hidden');
}

function displayVariablePlotSuccess(controls: HTMLElement, text: string): void {
    const { message } = plotParts(controls);
    setMultilineText(message, text);
    message.classList.remove('hidden', 'error');
    message.classList.add('success');
}

function displayVariablePlotCancelled(controls: HTMLElement): void {
    const { image, message } = plotParts(controls);
    image.innerHTML = '';
    setMultilineText(message, 'Plot cancelled.');
    message.classList.remove('hidden', 'error', 'success');
}

/** While a plot runs: Create Plot is disabled and Cancel is shown. */
function setPlotRunning(controls: HTMLElement, running: boolean): void {
    const create = controls.querySelector<HTMLButtonElement>(
        '[data-action="create-plot"]',
    );
    if (create) {
        create.disabled = running;
    }
    controls
        .querySelector('[data-action="cancel-plot"]')
        ?.classList.toggle('hidden', !running);
}

function plotImageData(controls: HTMLElement): string | null {
    const img = plotParts(controls).image.querySelector('img');
    return img ? (img.src.split(',')[1] ?? null) : null;
}

function updatePlotAllUI(isRunning: boolean): void {
    const button = document.getElementById(
        'createAllPlotsButton',
    ) as HTMLButtonElement | null;
    if (button) {
        button.disabled = isRunning;
        button.innerHTML = isRunning
            ? 'Plotting...'
            : `${ICONS.warning} Plot All`;
    }
    updateCancelButtonVisibility();
}

function updateCancelButtonVisibility(): void {
    const cancelButton = document.getElementById('cancelAllPlotsButton');
    if (!cancelButton) {
        return;
    }
    const count = activePlotOperations.size;
    cancelButton.classList.toggle(
        'hidden',
        count === 0 && !plotAllState.running,
    );
    cancelButton.innerHTML = `${ICONS.stop} Cancel All${count > 0 ? ` (${count})` : ''}`;
}

function getVariableGroup(variable: string): string {
    if (!variable.includes('/')) {
        return '/';
    }
    const group = variable.slice(0, variable.lastIndexOf('/'));
    return group === '' ? '/' : group;
}

/** The Global Plot Controls and the variable's Group Plot Controls, if any. */
function plotControlSections(variable: string): {
    globalSection: HTMLElement | null;
    groupSection: HTMLElement | null;
} {
    return {
        globalSection: document.getElementById('section-global-plot-controls'),
        groupSection: findByData(
            document,
            '.group-plot-controls-section',
            'group',
            getVariableGroup(variable),
        ),
    };
}

/**
 * Numbers typed wrong in the controls that apply to the variable. A wrong
 * global value only counts when the group does not override it.
 */
function invalidPlotOptions(controls: HTMLElement): string[] {
    const { variable } = plotParts(controls);
    const { globalSection, groupSection } = plotControlSections(variable);
    const groupValues = groupSection ? readPlotControls(groupSection) : null;
    const groupInvalid = groupSection
        ? invalidPlotParameters(groupSection).map(
              ({ message }) =>
                  `Group Plot Controls (${getVariableGroup(variable)}): ${message}`,
          )
        : [];
    const globalInvalid = globalSection
        ? invalidPlotParameters(globalSection)
              .filter(({ key }) => groupValues?.[key] === undefined)
              .map(({ message }) => `Global Plot Controls: ${message}`)
        : [];
    return [...groupInvalid, ...globalInvalid];
}

/**
 * Everything createPlot needs for one variable: the variable's group
 * controls override the global ones field by field (see mergePlotControls).
 */
function resolvePlotOptions(controls: HTMLElement): Record<string, unknown> {
    const { variable } = plotParts(controls);
    const { globalSection, groupSection } = plotControlSections(variable);

    const globalTime = readTimeControls(globalTimeControlsSection());
    const groupTime = readTimeControls(
        groupSection?.querySelector('.time-controls-section') ?? null,
    );
    const params = mergePlotControls(
        groupSection ? readPlotControls(groupSection) : null,
        readPlotControls(globalSection ?? document.createElement('div')),
    );

    return {
        variable,
        datetimeVariableName:
            groupTime.datetimeVariableName ?? globalTime.datetimeVariableName,
        startDatetime: convertDatetimeLocalToISO(
            groupTime.startDatetime ?? globalTime.startDatetime,
        ),
        endDatetime: convertDatetimeLocalToISO(
            groupTime.endDatetime ?? globalTime.endDatetime,
        ),
        ...params,
    };
}

/** Drop unset fields (undefined / null / '' / empty object) from plot options. */
function compactPlotPayload(
    options: Record<string, unknown>,
): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(options)) {
        if (value === undefined || value === null || value === '') {
            continue;
        }
        if (typeof value === 'object' && Object.keys(value).length === 0) {
            continue;
        }
        payload[key] = value;
    }
    return payload;
}

type PlotOutcome = 'success' | 'error' | 'cancelled';

/** Create the plot of one variable block and display the result. */
export async function createVariablePlot(
    controls: HTMLElement,
): Promise<PlotOutcome> {
    // Plotting without them would silently ignore what the user typed
    const invalid = invalidPlotOptions(controls);
    if (invalid.length > 0) {
        revealPlotSection(controls);
        plotParts(controls).image.innerHTML = '';
        displayVariablePlotError(
            controls,
            `Invalid plot parameters, nothing was plotted:\n${invalid.join('\n')}`,
        );
        return 'error';
    }
    const operationId = `plot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
        ...compactPlotPayload(resolvePlotOptions(controls)),
        operationId,
    };

    displayVariablePlotLoading(controls);
    activePlotOperations.add(operationId);
    runningPlots.set(controls, operationId);
    setPlotRunning(controls, true);
    updateCancelButtonVisibility();
    try {
        const plotData = await messageBus.createPlot(
            payload,
            globalState.plotTimeoutMs,
        );
        if (cancelledPlotOperations.has(operationId)) {
            return 'cancelled';
        }
        displayVariablePlot(controls, plotData);
        return 'success';
    } catch (error) {
        if (cancelledPlotOperations.has(operationId)) {
            return 'cancelled';
        }
        console.error('Failed to create plot:', error);
        plotParts(controls).image.innerHTML = '';
        displayVariablePlotError(
            controls,
            'Error creating plot: ' + (error as Error).message,
        );
        return 'error';
    } finally {
        cancelledPlotOperations.delete(operationId);
        activePlotOperations.delete(operationId);
        if (runningPlots.get(controls) === operationId) {
            runningPlots.delete(controls);
            setPlotRunning(controls, false);
        }
        updateCancelButtonVisibility();
    }
}

/**
 * Show the variable's plot as cancelled right away; the result of the
 * operation, which may still arrive, is ignored.
 */
function markPlotCancelled(controls: HTMLElement, operationId: string): void {
    cancelledPlotOperations.add(operationId);
    activePlotOperations.delete(operationId);
    runningPlots.delete(controls);
    setPlotRunning(controls, false);
    displayVariablePlotCancelled(controls);
    updateCancelButtonVisibility();
}

/** Cancel the running plot of one variable and abort its Python process. */
export async function cancelVariablePlot(controls: HTMLElement): Promise<void> {
    const operationId = runningPlots.get(controls);
    if (!operationId) {
        return;
    }
    markPlotCancelled(controls, operationId);
    try {
        await messageBus.abortPlot(operationId);
    } catch (error) {
        console.error('Failed to abort plot:', error);
    }
}

type Settled<T> =
    { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };

/**
 * Process items with a concurrency limit, so cancel requests still get through.
 * @returns settled results in the same order as items
 */
async function processWithConcurrencyLimit<I, T>(
    items: I[],
    processor: (item: I) => Promise<T>,
    concurrencyLimit: number,
): Promise<Settled<T>[]> {
    const results: Promise<Settled<T>>[] = [];
    const executing = new Set<Promise<Settled<T>>>();
    for (const item of items) {
        const promise = processor(item).then(
            (value): Settled<T> => ({ status: 'fulfilled', value }),
            (reason): Settled<T> => ({ status: 'rejected', reason }),
        );
        results.push(promise);
        executing.add(promise);
        promise.then(() => executing.delete(promise));
        if (executing.size >= concurrencyLimit) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

async function notify(
    message: string,
    type: 'info' | 'warning' | 'error',
): Promise<void> {
    try {
        await messageBus.showNotification(message, type);
    } catch (error) {
        console.error('Failed to show notification:', error);
    }
}

export async function handleCreateAllPlots(): Promise<void> {
    if (messageBus.isDegradedMode) {
        return;
    }
    // A variable whose plot is already running keeps that run: plotting it a
    // second time would leave one of the two processes out of reach of Cancel
    const controlsList = allPlotControls().filter(
        (controls) => !runningPlots.has(controls),
    );
    if (controlsList.length === 0) {
        return;
    }

    plotAllState.cancelled = false;
    plotAllState.running = true;
    updatePlotAllUI(true);

    try {
        // At most 5 at a time, leaving room for cancel operations
        const results = await processWithConcurrencyLimit(
            controlsList,
            async (controls) => {
                if (plotAllState.cancelled) {
                    return { success: false, skipped: true };
                }
                const outcome = await createVariablePlot(controls);
                return {
                    success: outcome === 'success',
                    skipped: outcome === 'cancelled',
                };
            },
            5,
        );

        const values = results.flatMap((r) =>
            r.status === 'fulfilled' ? [r.value] : [],
        );
        const successful = values.filter((v) => v.success).length;
        const skipped = values.filter((v) => v.skipped).length;
        const failed = results.length - successful - skipped;

        if (!plotAllState.cancelled || successful > 0) {
            let message = `Plot all: ${successful} successful`;
            if (failed > 0) {
                message += `, ${failed} failed`;
            }
            if (skipped > 0) {
                message += `, ${skipped} cancelled`;
            }
            await notify(message, failed > 0 ? 'warning' : 'info');
        }
    } catch (error) {
        console.error('Error in plot all operation:', error);
    } finally {
        plotAllState.running = false;
        plotAllState.cancelled = false;
        updatePlotAllUI(false);
    }
}

export async function handleCancelAllPlots(): Promise<void> {
    // Prevents queued plots of a running Plot All from starting
    plotAllState.cancelled = true;

    const operationIds = Array.from(activePlotOperations);
    if (operationIds.length === 0) {
        updatePlotAllUI(false);
        await notify(
            'Plot operation cancelled - no active processes to abort',
            'info',
        );
        return;
    }

    for (const controls of allPlotControls()) {
        const operationId = runningPlots.get(controls);
        if (operationId) {
            markPlotCancelled(controls, operationId);
        }
    }
    operationIds.forEach((operationId) =>
        cancelledPlotOperations.add(operationId),
    );
    const results = await Promise.allSettled(
        operationIds.map((operationId) => messageBus.abortPlot(operationId)),
    );
    activePlotOperations.clear();
    updatePlotAllUI(false);

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    await notify(`Cancelled: ${successful} process(es) aborted`, 'info');
}

export function resetVariablePlot(controls: HTMLElement): void {
    const { container, image } = plotParts(controls);
    image.innerHTML = '';
    container.classList.add('hidden');
    hidePlotMessage(controls);
}

export function handleResetAllPlots(): void {
    allPlotControls().forEach(resetVariablePlot);
}

/** Save under the default relative path; false when nothing was saved. */
export async function saveVariablePlot(
    controls: HTMLElement,
): Promise<boolean> {
    const { variable } = plotParts(controls);
    const plotData = plotImageData(controls);
    if (!plotData) {
        displayVariablePlotError(controls, 'No plot to save');
        return false;
    }
    const fileName = generateDefaultFileName(
        globalState.currentDatasetFilePath || 'unknown_file',
        variable,
    );
    try {
        const result: any = await messageBus.savePlot(
            plotData,
            variable,
            fileName,
        );
        if (result && result.success === false) {
            displayVariablePlotError(
                controls,
                `Failed to save plot: ${result.error}`,
            );
            return false;
        }
        displayVariablePlotSuccess(controls, `Plot saved: ${fileName}`);
        return true;
    } catch (error) {
        console.error('Error saving plot:', error);
        displayVariablePlotError(
            controls,
            'Failed to save plot: ' + (error as Error).message,
        );
        return false;
    }
}

export async function handleSaveAllPlots(): Promise<void> {
    if (messageBus.isDegradedMode) {
        return;
    }
    const withPlots = allPlotControls().filter((controls) =>
        plotImageData(controls),
    );
    if (withPlots.length === 0) {
        await notify('No plots to save', 'warning');
        return;
    }
    for (const controls of withPlots) {
        await saveVariablePlot(controls);
    }
}

export async function saveVariablePlotAs(controls: HTMLElement): Promise<void> {
    const { variable } = plotParts(controls);
    const plotData = plotImageData(controls);
    if (!plotData) {
        displayVariablePlotError(controls, 'No plot to save');
        return;
    }
    try {
        const result: any = await messageBus.savePlotAs(plotData, variable);
        if (
            result &&
            result.success === false &&
            result.error !== 'Save cancelled by user'
        ) {
            displayVariablePlotError(
                controls,
                `Failed to save plot: ${result.error}`,
            );
        }
    } catch (error) {
        console.error('Error saving plot as:', error);
        displayVariablePlotError(
            controls,
            'Failed to save plot: ' + (error as Error).message,
        );
    }
}

export async function openVariablePlot(controls: HTMLElement): Promise<void> {
    const { variable } = plotParts(controls);
    const plotData = plotImageData(controls);
    if (!plotData) {
        displayVariablePlotError(controls, 'No plot to open');
        return;
    }
    const fileName = generateDefaultFileName(
        globalState.currentDatasetFilePath || 'unknown_file',
        variable,
    );
    try {
        await messageBus.openPlot(plotData, variable, fileName);
    } catch (error) {
        console.error('Error opening plot:', error);
        displayVariablePlotError(
            controls,
            'Failed to open plot: ' + (error as Error).message,
        );
    }
}

/** Degraded mode: hide the controls of variables without plot or message. */
export function hidePlotControlsForBrowser(): void {
    allPlotControls().forEach((controls) => {
        const { container, message, image } = plotParts(controls);
        const hasContent =
            !message.classList.contains('hidden') ||
            image.querySelector('img') !== null;
        if (!hasContent) {
            controls.style.display = 'none';
            return;
        }
        controls
            .querySelectorAll<HTMLElement>('.plot-controls-row, .plot-actions')
            .forEach((el) => {
                el.style.display = 'none';
            });
        container.classList.remove('hidden');
    });
}
