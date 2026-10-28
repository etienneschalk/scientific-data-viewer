/**
 * Webview entry point for Scientific Data Viewer, bundled by esbuild into
 * out/webview/webview.js (scripts/build-webview.mjs).
 *
 * No inline event handlers (the webview CSP forbids them): every click goes
 * through one delegated listener, using element ids for the header/global
 * buttons and `data-action` attributes for everything rendered dynamically.
 */
import { messageBus } from './bus';
import {
    displayGlobalError,
    executeInstallPackagesCommand,
    executeShowLogsCommand,
    executeShowSettingsCommand,
} from './errors';
import { handleExportWebview } from './export';
import {
    createVariablePlot,
    handleCancelAllPlots,
    handleCreateAllPlots,
    handleResetAllPlots,
    handleSaveAllPlots,
    hidePlotControlsForBrowser,
    openVariablePlot,
    resetVariablePlot,
    saveVariablePlot,
    saveVariablePlotAs,
} from './plotActions';
import { resetPlotControls, syncColWrapAutoCheckbox } from './plotParams';
import {
    DataLoadedPayload,
    displayAll,
    renderGlobalPlotParameters,
} from './render/dataInfo';
import { displayTimestamp } from './render/representations';
import { clearTimeControls, handleTimeControlEvent } from './timeControls';

function showDegradedModeIndicator(): void {
    const indicator = document.createElement('span');
    indicator.id = 'degraded-mode-indicator';
    indicator.textContent = '🌐 Browser Mode';
    indicator.title =
        'Running in browser mode - VSCode features disabled. Existing plots are still viewable.';
    (document.getElementById('top-level-title') ?? document.body).appendChild(
        indicator,
    );

    // Hide VSCode-specific buttons in degraded mode
    [
        'refreshButton',
        'exportWebviewButton',
        'createAllPlotsButton',
        'resetAllPlotsButton',
        'saveAllPlotsButton',
    ].forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.style.display = 'none';
        }
    });

    hidePlotControlsForBrowser();
}

async function handleTextCopy(button: HTMLElement): Promise<void> {
    const targetElement = document.getElementById(
        button.dataset.targetId ?? '',
    );
    const text = targetElement?.textContent ?? '';
    try {
        await navigator.clipboard.writeText(text);
        button.textContent = '✓ Copied!';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = '📋 Copy';
            button.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text:', err);
        button.textContent = '❌ Failed';
        setTimeout(() => {
            button.textContent = '📋 Copy';
        }, 2000);
    }
}

async function handleRefresh(): Promise<void> {
    if (messageBus.isDegradedMode) {
        return;
    }
    displayTimestamp(null, true);
    try {
        await messageBus.refresh();
    } catch (error) {
        console.error('Failed to refresh data:', error);
        displayGlobalError(
            'Failed to refresh data: ' + (error as Error).message,
        );
    }
}

function setAllDetailsOpen(open: boolean): void {
    document.querySelectorAll('details').forEach((details) => {
        details.open = open;
    });
}

/** Scroll to an outline target, opening every enclosing <details>. */
function doScrollToHeader(
    headerId: string,
    headerLabel: string,
    verticalOffset = 80,
    highlightTimeout = 3000,
): void {
    const element = document.getElementById(headerId);
    if (!element) {
        console.warn(`📋 Header not found: ${headerLabel} (${headerId})`);
        return;
    }
    let current: Element | null = element;
    while (current) {
        const parentDetails: HTMLDetailsElement | null =
            current.closest('details');
        if (parentDetails && !parentDetails.open) {
            parentDetails.open = true;
        }
        current = parentDetails ? parentDetails.parentElement : null;
    }
    const top =
        element.getBoundingClientRect().top +
        window.pageYOffset -
        verticalOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    element.classList.add('highlighted');
    setTimeout(() => element.classList.remove('highlighted'), highlightTimeout);
}

/** Header and global buttons (by id). */
const BUTTON_HANDLERS: Record<string, () => unknown> = {
    refreshButton: handleRefresh,
    expandAllButton: () => setAllDetailsOpen(true),
    collapseAllButton: () => setAllDetailsOpen(false),
    exportWebviewButton: handleExportWebview,
    createAllPlotsButton: handleCreateAllPlots,
    cancelAllPlotsButton: handleCancelAllPlots,
    resetAllPlotsButton: handleResetAllPlots,
    saveAllPlotsButton: handleSaveAllPlots,
};

/** Per-variable plot actions (`data-action` inside `.variable-plot-controls`). */
const PLOT_ACTIONS: Record<string, (controls: HTMLElement) => unknown> = {
    'create-plot': createVariablePlot,
    'reset-plot': resetVariablePlot,
    'save-plot': saveVariablePlot,
    'save-plot-as': saveVariablePlotAs,
    'open-plot': openVariablePlot,
};

/** Other `data-action` elements. */
const ACTIONS: Record<string, (element: HTMLElement) => unknown> = {
    'show-logs': () => executeShowLogsCommand(),
    'show-settings': () => executeShowSettingsCommand(),
    'install-packages': (element) =>
        executeInstallPackagesCommand(
            (element.dataset.packages ?? '').split(',').filter(Boolean),
        ),
    'clear-time': (element) => {
        const section = element.closest('.time-controls-section');
        if (section) {
            clearTimeControls(section);
        }
    },
    'clear-plot-controls': (element) => {
        const section = element.closest('.dimension-slices-section');
        if (section) {
            resetPlotControls(section);
        }
    },
};

async function handleDocumentClick(event: MouseEvent): Promise<void> {
    if (!(event.target instanceof Element)) {
        return;
    }
    const target = event.target;
    const copyButton = target.closest<HTMLElement>('.text-copy-button');
    if (copyButton) {
        await handleTextCopy(copyButton);
        return;
    }
    const button = target.closest('button[id]');
    if (button && BUTTON_HANDLERS[button.id]) {
        await BUTTON_HANDLERS[button.id]();
        return;
    }
    const actionElement = target.closest<HTMLElement>('[data-action]');
    if (!actionElement) {
        return;
    }
    const action = actionElement.dataset.action ?? '';
    if (actionElement.tagName === 'A') {
        event.preventDefault();
    }
    const controls = actionElement.closest<HTMLElement>(
        '.variable-plot-controls',
    );
    if (controls && PLOT_ACTIONS[action]) {
        if (messageBus.isDegradedMode && action !== 'reset-plot') {
            return;
        }
        await PLOT_ACTIONS[action](controls);
    } else if (ACTIONS[action]) {
        await ACTIONS[action](actionElement);
    }
}

function setupEventListeners(): void {
    document.addEventListener('click', (event) => {
        handleDocumentClick(event).catch((error) =>
            console.error('Click handler failed:', error),
        );
    });
    document.addEventListener('change', (event) => {
        const target = event.target;
        if (
            target instanceof HTMLInputElement &&
            target.classList.contains('plot-col-wrap-auto')
        ) {
            syncColWrapAutoCheckbox(target);
        }
        handleTimeControlEvent(target);
    });
    document.addEventListener('input', (event) => {
        handleTimeControlEvent(event.target);
    });
}

function setupMessageHandlers(): void {
    messageBus.onEvent('dataLoaded', (state: DataLoadedPayload) =>
        displayAll(state),
    );
    messageBus.onEvent('error', (error) =>
        displayGlobalError(
            error?.message || 'Unknown error',
            error?.details,
            error?.errorType,
        ),
    );
    // When the user clicks on a TreeItem from the Data Structure TreeView
    messageBus.onEvent('scrollToHeaderCommandEvent', (payload) =>
        doScrollToHeader(payload?.headerId, payload?.headerLabel),
    );
    // When the user triggers the 'Export Webview Content' command
    messageBus.onEvent('exportWebviewCommandEvent', () =>
        handleExportWebview(),
    );
}

function initialize(): void {
    renderGlobalPlotParameters();
    setupEventListeners();
    if (messageBus.isDegradedMode) {
        // Exported HTML viewed in a browser: static content, no extension.
        showDegradedModeIndicator();
    }
}

// Listen right away (the script is at the end of <body>, so the page
// elements exist) so no extension message is missed before DOMContentLoaded.
if (!messageBus.isDegradedMode) {
    setupMessageHandlers();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
