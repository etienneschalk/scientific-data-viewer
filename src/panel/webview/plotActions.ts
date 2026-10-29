import { messageBus } from './bus';
import { mergePlotControls, readPlotControls } from './plotParams';
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
    plotTypeSelect: HTMLSelectElement | null;
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
        plotTypeSelect: controls.querySelector('.plot-type-select'),
    };
}

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

function displayVariablePlotLoading(controls: HTMLElement): void {
    const { container, image } = plotParts(controls);
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
                    ? `<button class="plot-action-button plot-install-button" data-action="install-packages" data-packages="matplotlib" title="Once installed (a notification should appear), retry 'Create Plot' again.">🎮 Install matplotlib</button>`
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
        button.textContent = isRunning ? 'Plotting...' : '⚠️ Plot All';
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
    cancelButton.textContent =
        count > 0 ? `🛑 Cancel All (${count})` : '🛑 Cancel All';
}

function getVariableGroup(variable: string): string {
    if (!variable.includes('/')) {
        return '/';
    }
    const group = variable.slice(0, variable.lastIndexOf('/'));
    return group === '' ? '/' : group;
}

/**
 * Everything createPlot needs for one variable: the variable's group
 * controls override the global ones field by field (see mergePlotControls).
 */
function resolvePlotOptions(controls: HTMLElement): Record<string, unknown> {
    const { variable, plotTypeSelect } = plotParts(controls);
    const globalSection = document.getElementById(
        'section-global-plot-controls',
    );
    const groupSection = findByData(
        document,
        '.group-plot-controls-section',
        'group',
        getVariableGroup(variable),
    );

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
        plotType: plotTypeSelect ? plotTypeSelect.value : 'auto',
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

/** Create the plot of one variable block and display the result. */
export async function createVariablePlot(
    controls: HTMLElement,
): Promise<boolean> {
    const operationId = `plot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
        ...compactPlotPayload(resolvePlotOptions(controls)),
        operationId,
    };

    displayVariablePlotLoading(controls);
    activePlotOperations.add(operationId);
    updateCancelButtonVisibility();
    try {
        const plotData = await messageBus.createPlot(
            payload,
            globalState.plotTimeoutMs,
        );
        displayVariablePlot(controls, plotData);
        return true;
    } catch (error) {
        console.error('Failed to create plot:', error);
        plotParts(controls).image.innerHTML = '';
        displayVariablePlotError(
            controls,
            'Error creating plot: ' + (error as Error).message,
        );
        return false;
    } finally {
        activePlotOperations.delete(operationId);
        updateCancelButtonVisibility();
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
    const controlsList = allPlotControls();
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
                return {
                    success: await createVariablePlot(controls),
                    skipped: false,
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
