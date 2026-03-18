/**
 * Webview JavaScript for Scientific Data Viewer
 */

// TODO eschalk remove hardcoded supported extensions and use package.json
const SUPPORTED_EXTENSIONS_HARDOCDED = [
    '.nc',
    '.netcdf',
    '.nc4',
    '.cdf',
    '.zarr',
    '.h5',
    '.hdf5',
    '.grib',
    '.grib2',
    '.grb',
    '.grb2',
    '.tif',
    '.tiff',
    '.geotiff',
    '.jp2',
    '.jpeg2000',
    // '.safe',
];

const MAX_ATTR_DISPLAY_STR_LENGTH = 999999;

class WebviewMessageBus {
    constructor(vscode) {
        this.vscode = vscode;
        this.pendingRequests = new Map();
        this.eventListeners = new Map();
        this.isDegradedMode = vscode === null;
        this.setupMessageListener();
    }

    setupMessageListener() {
        window.addEventListener('message', (event) => {
            const message = event.data;
            console.log('🚌 Bus: Message received:', message);

            if (message.type === 'response') {
                this.handleResponse(message);
            } else if (message.type === 'event') {
                this.handleEvent(message);
            }
        });
    }

    // Send a request and wait for response
    async sendRequest(command, payload, timeout = 60000) {
        // In degraded mode, reject VSCode-specific requests
        if (this.isDegradedMode) {
            console.warn(
                `⚠️ Degraded mode: Cannot send request '${command}' - VSCode API not available`,
            );
            return Promise.reject(
                new Error(
                    `Command '${command}' not available in degraded mode`,
                ),
            );
        }

        const request = this.createRequest(command, payload);

        return new Promise((resolve, reject) => {
            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(request.id);
                reject(new Error(`Request timeout: ${command}`));
            }, timeout);

            // Store the request
            this.pendingRequests.set(request.id, {
                resolve: (value) => {
                    clearTimeout(timeoutId);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                },
            });

            // Send the request
            this.vscode.postMessage(request);
        });
    }

    // Register an event listener
    onEvent(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }

        this.eventListeners.get(event).push(listener);

        // Return unsubscribe function
        return () => {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }

    createRequest(command, payload) {
        return {
            id: this.generateId(),
            timestamp: Date.now(),
            type: 'request',
            command,
            payload,
        };
    }

    generateId() {
        return (
            Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
        );
    }

    handleResponse(message) {
        const pendingRequest = this.pendingRequests.get(message.requestId);

        if (!pendingRequest) {
            console.warn(
                `Received response for unknown request: ${message.requestId}`,
            );
            return;
        }

        this.pendingRequests.delete(message.requestId);

        if (message.success) {
            pendingRequest.resolve(message.payload);
        } else {
            pendingRequest.reject(new Error(message.error || 'Unknown error'));
        }
    }

    handleEvent(message) {
        const listeners = this.eventListeners.get(message.event);

        if (listeners) {
            listeners.forEach((listener) => {
                try {
                    listener(message.payload);
                } catch (error) {
                    console.error(
                        `Error in event listener for ${message.event}:`,
                        error,
                    );
                }
            });
        }
    }

    // Convenience methods for common operations
    async getDataInfo(filePath) {
        return this.sendRequest('getDataInfo', { filePath });
    }

    /**
     * Create a plot for a variable with timeout and abort support.
     * If the request times out, the backend Python process will be automatically killed.
     */
    async createPlot(
        variable,
        plotType,
        datetimeVariableName,
        startDatetime,
        endDatetime,
        dimensionSlices,
        facetRow,
        facetCol,
        colWrap,
        plotX,
        plotY,
        plotHue,
        xincrease,
        yincrease,
        aspect,
        size,
        robust,
        cmap,
        bins,
        timeout,
    ) {
        const effectiveTimeout =
            timeout !== null &&
            typeof timeout === 'number' &&
            Number.isFinite(timeout) &&
            timeout >= 1000
                ? Math.min(Math.floor(timeout), 600000)
                : (globalState.plotTimeoutMs ?? 20000);
        // Generate a unique operation ID for this plot request
        const operationId = `plot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const payload = {
            variable,
            plotType,
            operationId,
        };

        // Only include optional fields if they have values (not null/undefined/empty)
        if (datetimeVariableName !== null && datetimeVariableName !== '') {
            payload.datetimeVariableName = datetimeVariableName;
        }
        if (startDatetime !== null && startDatetime !== '') {
            payload.startDatetime = startDatetime;
        }
        if (endDatetime !== null && endDatetime !== '') {
            payload.endDatetime = endDatetime;
        }
        if (dimensionSlices && Object.keys(dimensionSlices).length > 0) {
            payload.dimensionSlices = dimensionSlices;
        }
        if (facetRow !== null && facetRow !== undefined && facetRow !== '') {
            payload.facetRow = facetRow;
        }
        if (facetCol !== null && facetCol !== undefined && facetCol !== '') {
            payload.facetCol = facetCol;
        }
        if (
            colWrap !== null &&
            colWrap !== undefined &&
            Number.isInteger(colWrap) &&
            colWrap >= 1
        ) {
            payload.colWrap = colWrap;
        }
        if (plotX !== null && plotX !== undefined && plotX !== '') {
            payload.plotX = plotX;
        }
        if (plotY !== null && plotY !== undefined && plotY !== '') {
            payload.plotY = plotY;
        }
        if (plotHue !== null && plotHue !== undefined && plotHue !== '') {
            payload.plotHue = plotHue;
        }
        if (xincrease !== null && xincrease !== undefined) {
            payload.xincrease = xincrease;
        }
        if (yincrease !== null && yincrease !== undefined) {
            payload.yincrease = yincrease;
        }
        if (
            aspect !== null &&
            aspect !== undefined &&
            Number.isFinite(aspect) &&
            aspect > 0
        ) {
            payload.aspect = aspect;
        }
        if (
            size !== null &&
            size !== undefined &&
            Number.isFinite(size) &&
            size > 0
        ) {
            payload.size = size;
        }
        if (robust === true) {
            payload.robust = true;
        }
        if (cmap !== null && cmap !== undefined && cmap !== '') {
            payload.cmap = cmap;
        }
        if (
            bins !== null &&
            bins !== undefined &&
            Number.isInteger(bins) &&
            bins >= 1
        ) {
            payload.bins = bins;
        }

        console.log('📤 WebviewMessageBus.createPlot payload:', payload);

        // Track this operation for cancel functionality
        activePlotOperations.add(operationId);
        updateCancelButtonVisibility();

        // Create a custom promise that handles timeout with abort
        return new Promise(async (resolve, reject) => {
            let timeoutId = null;
            let isResolved = false;

            // Helper to clean up operation tracking
            const cleanupOperation = () => {
                activePlotOperations.delete(operationId);
                updateCancelButtonVisibility();
            };

            // Set up timeout that will abort the backend process
            timeoutId = setTimeout(async () => {
                if (isResolved) {
                    return;
                }
                isResolved = true;

                console.warn(
                    `⏰ Plot request timed out after ${effectiveTimeout}ms, aborting process: ${operationId}`,
                );

                // Send abort request to kill the backend process
                try {
                    const abortResult = await this.abortPlot(operationId);
                    console.log('🛑 Abort result:', abortResult);
                } catch (abortError) {
                    console.error(
                        '❌ Failed to abort plot process:',
                        abortError,
                    );
                }

                cleanupOperation();
                reject(
                    new Error(
                        `Plot request timeout: The plot generation took too long (>${effectiveTimeout / 1000}s). The backend process has been terminated. Try selecting a smaller data subset or a simpler plot type.`,
                    ),
                );
            }, effectiveTimeout);

            try {
                // Send the actual request (without the default timeout)
                const request = this.createRequest('createPlot', payload);

                const result = await new Promise(
                    (innerResolve, innerReject) => {
                        // Store the request
                        this.pendingRequests.set(request.id, {
                            resolve: (value) => {
                                innerResolve(value);
                            },
                            reject: (error) => {
                                innerReject(error);
                            },
                        });

                        // Send the request
                        this.vscode.postMessage(request);
                    },
                );

                if (!isResolved) {
                    isResolved = true;
                    clearTimeout(timeoutId);
                    cleanupOperation();
                    resolve(result);
                }
            } catch (error) {
                if (!isResolved) {
                    isResolved = true;
                    clearTimeout(timeoutId);
                    cleanupOperation();
                    reject(error);
                }
            }
        });
    }

    /**
     * Get the current operation ID (for external cancel)
     */
    getActiveOperationIds() {
        return Array.from(activePlotOperations);
    }

    /**
     * Abort an active plot operation
     * @param operationId The ID of the plot operation to abort
     * @returns Result of the abort operation
     */
    async abortPlot(operationId) {
        return this.sendRequest('abortPlot', { operationId }, 5000); // Short timeout for abort
    }

    async savePlot(plotData, variable, fileName) {
        return this.sendRequest('savePlot', { plotData, variable, fileName });
    }

    async savePlotAs(plotData, variable) {
        return this.sendRequest('savePlotAs', { plotData, variable });
    }

    async openPlot(plotData, variable, fileName) {
        return this.sendRequest('openPlot', { plotData, variable, fileName });
    }

    async refresh() {
        return this.sendRequest('refresh', {});
    }

    async exportWebview(htmlContent) {
        return this.sendRequest('exportWebview', { htmlContent });
    }

    async showNotification(message, type) {
        return this.sendRequest('showNotification', { message, type });
    }

    // Event emission methods
    onDataLoaded(callback) {
        return this.onEvent('dataLoaded', callback);
    }

    onError(callback) {
        return this.onEvent('error', callback);
    }

    onPythonEnvironmentChanged(callback) {
        return this.onEvent('pythonEnvironmentChanged', callback);
    }

    onUIStateChanged(callback) {
        return this.onEvent('uiStateChanged', callback);
    }

    onScrollToHeader(callback) {
        return this.onEvent('scrollToHeaderCommandEvent', callback);
    }

    onExportWebviewCommand(callback) {
        return this.onEvent('exportWebviewCommandEvent', callback);
    }
}

// Do not use vscode directly ; communicate with vscode through messageBus
// Try to acquire VSCode API, but fail gracefully if not available (e.g., in browser)
let _vscode = null;
let messageBus = null;

try {
    if (typeof acquireVsCodeApi === 'function') {
        _vscode = acquireVsCodeApi();
        messageBus = new WebviewMessageBus(_vscode);
        console.log('✅ VSCode API acquired successfully');
    } else {
        throw new Error('acquireVsCodeApi is not available');
    }
} catch (error) {
    console.warn(
        '⚠️ VSCode API not available, running in degraded mode:',
        error.message,
    );
    // Create a mock messageBus that handles missing VSCode API gracefully
    messageBus = new WebviewMessageBus(null);
}

// Global state for file path
const globalState = {
    currentDatasetFilePath: null,
    /** Plot timeout in ms (from extension config); used by createPlot */
    plotTimeoutMs: 20000,
};

// Track active plot operations for cancel functionality
const activePlotOperations = new Set();

// Initialization
function initialize() {
    console.log('🔧 WebView initialized - starting debug session');
    console.log('📍 Current location:', window.location);
    console.log('📍 Pathname:', window.location.pathname);
    console.log('📍 Search:', window.location.search);
    console.log('📍 Hash:', window.location.hash);

    // Set up non-VSCode event listeners first (copy buttons, expand/collapse, etc.)
    setupEventListeners();

    // Set up VSCode-specific message handlers only if not in degraded mode
    if (!messageBus.isDegradedMode) {
        setupMessageHandlers();
        console.log('🚀 WebView initialized - VSCode mode enabled');
    } else {
        console.log(
            '🚀 WebView initialized - Degraded mode (browser-only features)',
        );
        // In degraded mode, we can still display static content if it's already loaded
        // but we won't be able to communicate with VSCode
        showDegradedModeIndicator();
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    console.log(
        '⚛️ 🔧 Document is not ready - Attach event listener to DOMContentLoaded',
    );
    document.addEventListener('DOMContentLoaded', () => {
        initialize();
    });
} else {
    console.log('⚛️ 🔧 Document is ready - DOM already loaded');
    initialize();
}

// Utility functions
function escapeHtml(unsafe) {
    return unsafe
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showDegradedModeIndicator() {
    // Add a visual indicator that we're in degraded mode
    const indicator = document.createElement('span');
    indicator.id = 'degraded-mode-indicator';
    indicator.textContent = '🌐 Browser Mode';
    indicator.title =
        'Running in browser mode - VSCode features disabled. Existing plots are still viewable.';

    // Try to append to top-level-title first, fallback to body
    const topLevelTitle = document.getElementById('top-level-title');
    if (topLevelTitle) {
        topLevelTitle.appendChild(indicator);
    } else {
        document.body.appendChild(indicator);
    }

    // Hide VSCode-specific buttons in degraded mode
    const vscodeButtons = [
        'refreshButton',
        'exportHtmlButton',
        'exportWebviewButton',
        'createAllPlotsButton',
        'resetAllPlotsButton',
        'saveAllPlotsButton',
    ];

    vscodeButtons.forEach((buttonId) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.style.display = 'none';
        }
    });

    // Hide plot controls for individual variables - be smart about it
    const plotControls = document.querySelectorAll('.variable-plot-controls');
    plotControls.forEach((control) => {
        const plotError = control.querySelector('.plot-error');
        const plotImageContainer = control.querySelector(
            '.plot-image-container',
        );
        const hasPlotError =
            plotError && !plotError.classList.contains('hidden');
        const hasPlotImage =
            plotImageContainer && plotImageContainer.querySelector('img');

        // Only hide the entire control if there's no plot content (no error, no image)
        if (!hasPlotError && !hasPlotImage) {
            control.style.display = 'none';
        } else {
            // If there's existing plot content, hide only the control buttons but keep containers visible
            const plotButtons = control.querySelectorAll(
                '.plot-controls-row, .plot-actions',
            );
            plotButtons.forEach((button) => {
                button.style.display = 'none';
            });

            // Ensure the plot container is visible for existing content
            const plotContainer = control.querySelector('.plot-container');
            if (plotContainer) {
                plotContainer.style.display = 'block';
            }
        }
    });

    console.log('🌐 Degraded mode indicator displayed');
}

// JoinId is used to join parts of an id together with a separator
// Must be similar to the one used in the HeaderExtractor.ts
function joinId(parts) {
    return parts.map((part) => part.replace(/[^a-zA-Z0-9_]/g, '-')).join('___');
}

function formatFileSize(bytes) {
    const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
    if (bytes === 0) {
        return '0 B';
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

function generateDefaultFileName(datasetFilePath, variablePath) {
    const fileName = datasetFilePath.split('/').pop();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    // Variable must be is a full path starting with /
    if (!variablePath.startsWith('/')) {
        variablePath = `/${variablePath}`;
    }
    return `sdv-plots/${fileName}${variablePath}_${timestamp}.png`;
}

function generateUUID() {
    return window.crypto.randomUUID();
}

// Message bus event handlers
function setupMessageHandlers() {
    // Set up event listeners for new message system
    messageBus.onDataLoaded((state) => {
        console.log('📊 Data loaded event received:', state);
        displayAll(state);
    });

    messageBus.onError((error) => {
        console.error('❌ Error event received:', error);
        displayGlobalError(error.message, error.details, error.errorType);
    });

    messageBus.onPythonEnvironmentChanged((data) => {
        console.log('🐍 Python environment changed:', data);
        displayPythonPath(data.pythonPath);
    });

    messageBus.onUIStateChanged((state) => {
        console.log('🔄 UI state changed:', state);
    });

    // When the user clicks on a TreeItem from the Data Structure TreeView
    messageBus.onScrollToHeader(({ headerId, headerLabel }) => {
        doScrollToHeader(headerId, headerLabel);
    });

    // When the user trigger the 'Export Wevbiew Content' command
    messageBus.onExportWebviewCommand(() => {
        handleExportWebview();
    });

    // Add debugging for all message bus communications
    const originalSendRequest = messageBus.sendRequest.bind(messageBus);
    messageBus.sendRequest = async function (command, payload, timeout) {
        console.log('📤 Sending request:', { command, payload, timeout });
        try {
            const result = await originalSendRequest(command, payload, timeout);
            console.log('📥 ✅ Request successful:', { command, result });
            return result;
        } catch (error) {
            console.error('📥 ❌ Request failed:', { command, error });
            throw error;
        }
    };
}

function displayAll(state) {
    displayDataInfo(
        state.data.dataInfo,
        state.data.currentFile,
        state.extension.extensionConfig,
    );
    displayHtmlRepresentation(state.data.dataInfo.xarray_html_repr, false);
    displayTextRepresentation(state.data.dataInfo.xarray_text_repr, false);
    displayHtmlRepresentation(
        state.data.dataInfo.xarray_html_repr_flattened,
        true,
    );
    displayTextRepresentation(
        state.data.dataInfo.xarray_text_repr_flattened,
        true,
    );
    displayPythonPath(state.python.pythonPath);
    displayExtensionConfig(state.extension.extensionConfig);
    displayShowVersions(state.data.dataInfo.xarray_show_versions);
    displayTimestamp(state.data.lastLoadTime);
}

function displayTimestamp(isoString, isLoading = false) {
    const timestampElement = document.getElementById('timestamp');
    const timestampText = document.getElementById('timestampText');

    if (isLoading) {
        timestampText.textContent = 'Loading...';
        timestampElement.classList.remove('hidden');
    } else if (isoString) {
        const date = new Date(isoString);
        const timeString = date.toISOString();
        timestampText.textContent = `Loaded: ${timeString}`;
        timestampElement.classList.remove('hidden');
    } else {
        timestampElement.classList.add('hidden');
    }
}

// Display functions
function displayDataInfo(data, filePath, extensionConfig) {
    if (!data) {
        displayGlobalError('No data available');
        return;
    }

    if (data.error) {
        displayGlobalError(data.error);
        return;
    }

    // Feature flags (default true when config not available; nestedAttributesView default true)
    const config = extensionConfig || {};
    const globalTimeControls = config.globalTimeControls !== false;
    const globalDimensionSlices = config.globalDimensionSlices !== false;
    const groupTimeControls = config.groupTimeControls !== false;
    const groupDimensionSlices = config.groupDimensionSlices !== false;
    const nestedAttributesView = config.nestedAttributesView !== false;
    const timeoutMs = config.plotTimeoutMs;
    globalState.plotTimeoutMs =
        typeof timeoutMs === 'number' &&
        Number.isFinite(timeoutMs) &&
        timeoutMs >= 1000
            ? Math.min(Math.floor(timeoutMs), 600000)
            : 20000;

    // Store current file path for plot operations
    globalState.currentDatasetFilePath = filePath;

    // Hide any previous errors since data loaded successfully
    hideGlobalError();

    // Display file path in code format with copy button
    const filePathCode = document.getElementById('filePathCode');
    filePathCode.textContent = filePath;

    // Display file information
    const fileInfo = document.getElementById('fileInfo');
    fileInfo.innerHTML = renderFileInformation(data);

    const groupInfoContainer = document.getElementById('group-info-container');
    groupInfoContainer.classList.remove('hidden');

    // Assumption: dimensions_flattened and coordinates_flattened and variables_flattened
    // are always present together and have the same group keys.
    const groups = Object.keys(data.dimensions_flattened);

    if (
        data.dimensions_flattened &&
        data.coordinates_flattened &&
        data.variables_flattened
    ) {
        // Display dimensions, coordinates, and variables for each group (with optional Group Plot Controls)
        groupInfoContainer.innerHTML = groups
            .map((groupName, index) =>
                renderGroup(data, groupName, {
                    groupTimeControls,
                    groupDimensionSlices,
                    nestedAttributesView,
                    isFirstRootGroup: index === 0,
                }),
            )
            .join('');
        // Open the first group by default
        groupInfoContainer
            .querySelector('details')
            .setAttribute('open', 'open');

        // Enable buttons for datatree variables
        Object.keys(data.variables_flattened).forEach((groupName) => {
            data.variables_flattened[groupName].forEach((variable) => {
                const fullVariableName = `${
                    groupName === '/' ? '' : groupName
                }/${variable.name}`;
                const createButton = document.querySelector(
                    `.create-plot-button[data-variable="${fullVariableName}"]`,
                );
                if (createButton) {
                    createButton.disabled = false;
                }
            });
        });

        setupGroupPlotControlsListeners();
    } else {
        contentContainer.innerHTML = '<p>No data available</p>';
    }

    // Populate datetime variables (respects globalTimeControls flag)
    populateDatetimeVariables(data, { globalTimeControls });

    // Populate dimension slices (respects globalDimensionSlices flag, merges all groups)
    populateDimensionSlices(data, { globalDimensionSlices });

    // Show content
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
}

function renderFileInformation(data) {
    let formatInfo = '<p>';

    if (data.fileSize) {
        formatInfo += /*html*/ `<strong>Size:</strong> ${formatFileSize(
            data.fileSize,
        )} · `;
    }

    formatInfo += /*html*/ `<strong>Format:</strong> ${
        data.format || data.format_info?.display_name || 'Unknown'
    } · `;

    if (data.format_info) {
        formatInfo += /*html*/ `
            <strong>Available Engines:</strong> ${
                data.format_info.available_engines.join(', ') || 'None'
            } ·
            ${
                data.used_engine
                    ? /*html*/ `<strong>Used Engine:</strong> ${data.used_engine}`
                    : ''
            }
        `;
    }
    formatInfo += '</p>';
    return formatInfo;
}

function renderGroup(data, groupName, flags) {
    const groupTimeControls = (flags && flags.groupTimeControls) !== false;
    const groupDimensionSlices =
        (flags && flags.groupDimensionSlices) !== false;
    const nestedAttributesView = (flags && flags.nestedAttributesView) === true;

    // Add dimensions for group
    const dimensions = data.dimensions_flattened[groupName];
    const dimensionsHtml =
        dimensions && Object.keys(dimensions).length > 0
            ? renderGroupDimensions(dimensions, groupName)
            : /*html*/ `<p class="muted-text">No dimensions found in this group.</p>`;

    // Add coordinates for group
    const coordinates = data.coordinates_flattened[groupName];
    const coordinatesHtml =
        coordinates && coordinates.length > 0
            ? renderGroupCoordinateVariables(coordinates, groupName)
            : /*html*/ `<p class="muted-text">No coordinates found in this group.</p>`;

    // Add variables for group
    const variables = data.variables_flattened[groupName];
    const variablesHtml =
        variables && variables.length > 0
            ? renderGroupDataVariables(variables, groupName)
            : /*html*/ `<p class="muted-text">No variables found in this group.</p>`;

    // Add attributes for group (flat list or collapsible tree when nestedAttributesView is on)
    const attributes = data.attributes_flattened[groupName];
    const attributesHtml =
        attributes && Object.keys(attributes).length > 0
            ? nestedAttributesView
                ? renderAttributesTree(attributes, groupName, [
                      'data-group',
                      groupName,
                      'attributes',
                  ])
                : Object.entries(attributes)
                      .map(([attrName, value]) => {
                          return renderGroupAttributes(
                              groupName,
                              attrName,
                              value,
                          );
                      })
                      .join('')
            : /*html*/ `<p class="muted-text">No attributes found in this group.</p>`;

    const groupPlotControlsHtml =
        groupTimeControls || groupDimensionSlices
            ? renderGroupPlotControls(data, groupName, {
                  groupTimeControls,
                  groupDimensionSlices,
                  isFirstRootGroup: (flags && flags.isFirstRootGroup) === true,
              })
            : '';

    return /*html*/ `
        <div class="info-section" id="${joinId(['data-group', groupName])}">
            <details class="sticky-group-details"> <summary><h3>Group: ${groupName}</h3></summary>
                ${groupPlotControlsHtml}
                <div class="info-section" id="${joinId([
                    'data-group',
                    groupName,
                    'dimensions',
                ])}">
                    <details class="" open> <summary><h4>Dimensions</h4></summary>
                        <div class="dimensions">
                            ${dimensionsHtml}
                        </div>
                    </details>
                </div>
                <div class="info-section" id="${joinId([
                    'data-group',
                    groupName,
                    'coordinates',
                ])}">
                    <details class="" open> <summary><h4>Coordinates</h4></summary>
                        <div class="coordinates">
                            ${coordinatesHtml}
                        </div>
                    </details>
                </div>
                <div class="info-section" id="${joinId([
                    'data-group',
                    groupName,
                    'variables',
                ])}">
                    <details class="" open> <summary><h4>Variables</h4></summary>
                        <div class="variables">
                            ${variablesHtml}
                        </div>
                    </details>
                </div>
                <div class="info-section" id="${joinId([
                    'data-group',
                    groupName,
                    'attributes',
                ])}">
                    <details class="" open> <summary><h4>Attributes</h4></summary>
                        <div class="attributes">
                            ${attributesHtml}
                        </div>
                    </details>
                </div>
            </details>
        </div>
        `;
}

function renderGroupPlotControls(data, groupName, flags) {
    const safeId = joinId(['group-plot', groupName]);
    const groupDateTimeVars = data.datetime_variables
        ? data.datetime_variables[groupName]
        : null;
    const groupDims = data.dimensions_flattened
        ? data.dimensions_flattened[groupName]
        : null;

    // Dedupe datetime vars by name, sort (same as global)
    const byName = new Map();
    if (groupDateTimeVars) {
        for (const varInfo of groupDateTimeVars) {
            const varName =
                typeof varInfo === 'string' ? varInfo : varInfo.name;
            const fullPath =
                groupName === '/' ? varName : `${groupName}/${varName}`;
            if (!byName.has(varName)) {
                byName.set(varName, { name: varName, fullPath });
            }
        }
    }
    const sortedTimeVars = [...byName.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
    );

    const dimNames =
        groupDims && Object.keys(groupDims).length > 0
            ? Object.keys(groupDims).sort()
            : [];

    const timeControlsHtml =
        flags.groupTimeControls && sortedTimeVars.length > 0
            ? `
                <div class="group-plot-controls time-controls-section">
                    <h4>Group Time Controls</h4>
                    <div class="time-controls-row">
                        <label for="group-datetime-select-${safeId}">Datetime variable:</label>
                        <select id="group-datetime-select-${safeId}" class="datetime-variable-select group-datetime-select" data-group="${escapeHtml(groupName)}">
                            <option value="">Select...</option>
                            ${sortedTimeVars.map((v) => `<option value="${escapeHtml(v.fullPath)}">${escapeHtml(v.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="time-controls-row">
                        <label for="group-start-datetime-${safeId}">Start:</label>
                        <input type="datetime-local" id="group-start-datetime-${safeId}" class="datetime-input group-datetime-input" data-group="${escapeHtml(groupName)}" />
                        <input type="text" id="group-start-datetime-text-${safeId}" class="datetime-text-input" placeholder="YYYY-MM-DD HH:MM:SS" data-group="${escapeHtml(groupName)}" />
                    </div>
                    <div class="time-controls-row">
                        <label for="group-end-datetime-${safeId}">End:</label>
                        <input type="datetime-local" id="group-end-datetime-${safeId}" class="datetime-input group-datetime-input" data-group="${escapeHtml(groupName)}" />
                        <input type="text" id="group-end-datetime-text-${safeId}" class="datetime-text-input" placeholder="YYYY-MM-DD HH:MM:SS" data-group="${escapeHtml(groupName)}" />
                    </div>
                    <div class="time-controls-row">
                        <button type="button" class="plot-control-button group-clear-time-btn" data-group="${escapeHtml(groupName)}">Clear Time</button>
                    </div>
                </div>`
            : '';

    const dimensionSlicesHtml =
        flags.groupDimensionSlices && dimNames.length > 0
            ? `
                <div class="group-plot-controls dimension-slices-section">
                    <div class="plot-controls-subsection dimension-slices-isel">
                        <h5 class="plot-controls-subsection-title">Dimension Slices (passed to isel)</h5>
                        <p class="dimension-slices-hint">Index or slice per dimension (e.g. <code>0:24:2</code>, <code>100:120</code>, or <code>130</code>). Applied as isel() before plotting. See <a href="https://docs.xarray.dev/en/stable/user-guide/indexing.html" target="_blank" rel="noopener noreferrer">Indexing and selecting data</a>.</p>
                        <div class="dimension-slices-container" data-group="${escapeHtml(groupName)}">
                            ${dimNames
                                .map(
                                    (dimName) => `
                                <div class="dimension-slice-row">
                                    <label for="group-dim-${safeId}-${dimName}">${escapeHtml(dimName)} (${groupDims[dimName]}):</label>
                                    <input type="text" id="group-dim-${safeId}-${dimName}" class="dimension-slice-input group-dimension-slice-input" data-group="${escapeHtml(groupName)}" data-dimension="${dimName}" placeholder="e.g. 0:24:2 or 130" />
                                </div>`,
                                )
                                .join('')}
                        </div>
                    </div>
                    <div class="plot-controls-subsection plot-parameters">
                        <h5 class="plot-controls-subsection-title">Plot Parameters (passed to plot)</h5>
                        <p class="dimension-slices-hint">Plot options follow <a href="https://docs.xarray.dev/en/latest/user-guide/plotting.html" target="_blank" rel="noopener noreferrer">xarray plotting</a>.</p>
                    <div class="dimension-slices-facets">
                        <div class="dimension-slices-row">
                            <label for="group-facet-row-${safeId}">row:</label>
                            <select id="group-facet-row-${safeId}" class="facet-select group-facet-select" data-group="${escapeHtml(groupName)}">
                                <option value="">None</option>
                                ${dimNames.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
                            </select>
                            <label for="group-facet-col-${safeId}">col:</label>
                            <select id="group-facet-col-${safeId}" class="facet-select group-facet-select" data-group="${escapeHtml(groupName)}">
                                <option value="">None</option>
                                ${dimNames.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
                            </select>
                            <label for="group-plot-col-wrap-${safeId}">col_wrap:</label>
                            <input type="number" id="group-plot-col-wrap-${safeId}" class="plot-col-wrap-input group-plot-col-wrap-input" min="1" placeholder="e.g. 4" data-group="${escapeHtml(groupName)}" title="xarray col_wrap" />
                        </div>
                        <div class="dimension-slices-row">
                            <label for="group-plot-x-${safeId}">x:</label>
                            <select id="group-plot-x-${safeId}" class="facet-select group-facet-select" data-group="${escapeHtml(groupName)}">
                                <option value="">None</option>
                                ${dimNames.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
                            </select>
                            <label for="group-plot-y-${safeId}">y:</label>
                            <select id="group-plot-y-${safeId}" class="facet-select group-facet-select" data-group="${escapeHtml(groupName)}">
                                <option value="">None</option>
                                ${dimNames.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
                            </select>
                            <label for="group-plot-hue-${safeId}">hue:</label>
                            <select id="group-plot-hue-${safeId}" class="facet-select group-facet-select" data-group="${escapeHtml(groupName)}">
                                <option value="">None</option>
                                ${dimNames.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="dimension-slices-row">
                            <label for="group-x-increase-${safeId}" class="plot-checkbox-label">xincrease:</label>
                            <input type="checkbox" id="group-x-increase-${safeId}" class="plot-checkbox group-plot-checkbox" checked data-group="${escapeHtml(groupName)}" title="xarray xincrease" />
                            <label for="group-y-increase-${safeId}" class="plot-checkbox-label">yincrease:</label>
                            <input type="checkbox" id="group-y-increase-${safeId}" class="plot-checkbox group-plot-checkbox" checked data-group="${escapeHtml(groupName)}" title="xarray yincrease" />
                            <label for="group-robust-${safeId}" class="plot-checkbox-label">robust:</label>
                            <input type="checkbox" id="group-robust-${safeId}" class="plot-checkbox group-plot-checkbox" data-group="${escapeHtml(groupName)}" title="xarray robust" />
                        </div>
                        <div class="dimension-slices-row">
                            <label for="group-bins-${safeId}">bins:</label>
                            <input type="number" id="group-bins-${safeId}" class="bins-input group-bins-input" min="1" placeholder="e.g. 100" data-group="${escapeHtml(groupName)}" title="Number of bins for histogram-style plots" />
                            <label for="group-plot-aspect-${safeId}">aspect:</label>
                            <input type="text" id="group-plot-aspect-${safeId}" class="plot-aspect-size-input group-plot-aspect-size-input" placeholder="e.g. 1 or 1.5" data-group="${escapeHtml(groupName)}" title="xarray aspect (float)" />
                            <label for="group-plot-size-${safeId}">size:</label>
                            <input type="text" id="group-plot-size-${safeId}" class="plot-aspect-size-input group-plot-aspect-size-input" placeholder="e.g. 4 or 5.5" data-group="${escapeHtml(groupName)}" title="xarray size (float)" />
                        </div>
                        <div class="dimension-slices-row">
                            <label for="group-plot-cmap-${safeId}">cmap:</label>
                            <input type="text" id="group-plot-cmap-${safeId}" class="plot-cmap-input group-plot-cmap-input" placeholder="e.g. viridis, plasma" data-group="${escapeHtml(groupName)}" title="Matplotlib colormap name (user must provide a valid existing cmap)" />
                        </div>
                    </div>
                    </div>
                    <div class="time-controls-row">
                        <button type="button" class="plot-control-button group-clear-dimension-slices-btn" data-group="${escapeHtml(groupName)}">Clear Dimension Slices and Plot Parameters</button>
                    </div>
                </div>`
            : '';

    if (!timeControlsHtml && !dimensionSlicesHtml) {
        return '';
    }

    const isFirstRootGroup = (flags && flags.isFirstRootGroup) === true;
    return `
                <div class="info-section group-plot-controls-section" data-group="${escapeHtml(groupName)}" id="${joinId(['data-group', groupName, 'group-plot-controls'])}">
                    <details class=""${isFirstRootGroup ? ' open' : ''}> <summary><h4>Group Plot Controls</h4></summary>
                        <div class="group-plot-controls-content">
                            ${timeControlsHtml}
                            ${dimensionSlicesHtml}
                        </div>
                    </details>
                </div>`;
}

function renderGroupDimensions(dimensions, groupName) {
    return /*html*/ `
        <div class="dimensions-compact">
            (${Object.entries(dimensions)
                .map(([name, size]) => renderDimension(groupName, name, size))
                .join(', ')})
        </div>`;
}

function renderGroupCoordinateVariables(coordinates, groupName) {
    return coordinates
        .map((variable) => {
            return renderCoordinateVariable(variable, groupName);
        })
        .join('');
}

function renderGroupDataVariables(variables, groupName) {
    return variables
        .map((variable) => {
            return renderDataVariable(variable, groupName);
        })
        .join('');
}

/**
 * Renders a nested attributes object as a collapsible tree (for Zarr .zattrs and similar).
 * Used when nestedAttributesView feature flag is on.
 * @param {Record<string, any>} attrsObj - Attributes object (may contain nested objects/arrays)
 * @param {string} groupName - Group name for id generation
 * @param {string[]} idParts - Base id parts for joinId (e.g. ['data-group', groupName, 'attributes'])
 * @returns {string} HTML string
 */
function renderAttributesTree(attrsObj, groupName, idParts) {
    if (!attrsObj || typeof attrsObj !== 'object') {
        return '';
    }
    const entries = Object.entries(attrsObj);
    if (entries.length === 0) {
        return /*html*/ `<p class="muted-text">No attributes.</p>`;
    }
    return entries
        .map(([key, value]) => {
            const safeKey = escapeHtml(String(key));
            const leafId = joinId([...idParts, 'attr', safeKey]);
            const isNested =
                value !== null &&
                typeof value === 'object' &&
                !(value instanceof Date) &&
                !(value instanceof RegExp);
            if (isNested && !Array.isArray(value)) {
                const childIdParts = [...idParts, 'attr', safeKey];
                const innerHtml = renderAttributesTree(
                    value,
                    groupName,
                    childIdParts,
                );
                return /*html*/ `
                    <details class="attributes-tree-node" id="${joinId(childIdParts)}">
                        <summary class="attribute-tree-summary"><span class="attribute-name">${safeKey}</span></summary>
                        <div class="attributes-tree-children">${innerHtml}</div>
                    </details>`;
            }
            if (isNested && Array.isArray(value)) {
                const arrId = joinId([...idParts, 'attr', safeKey]);
                const items = value
                    .map((item, i) => {
                        if (
                            item !== null &&
                            typeof item === 'object' &&
                            !Array.isArray(item) &&
                            !(item instanceof Date)
                        ) {
                            const inner = renderAttributesTree(
                                item,
                                groupName,
                                [...idParts, 'attr', safeKey, String(i)],
                            );
                            return /*html*/ `<details class="attributes-tree-node"><summary class="attribute-tree-summary">[${i}]</summary><div class="attributes-tree-children">${inner}</div></details>`;
                        }
                        const str =
                            typeof item === 'string'
                                ? item
                                : JSON.stringify(item);
                        return /*html*/ `<div class="attribute-item"><span class="attribute-value muted-text">${escapeHtml(str)}</span></div>`;
                    })
                    .join('');
                return /*html*/ `
                    <details class="attributes-tree-node" id="${arrId}">
                        <summary class="attribute-tree-summary"><span class="attribute-name">${safeKey}</span> <span class="muted-text">(${value.length} items)</span></summary>
                        <div class="attributes-tree-children">${items}</div>
                    </details>`;
            }
            const valueStr =
                typeof value === 'string' ? value : JSON.stringify(value);
            const displayStr =
                valueStr.length > MAX_ATTR_DISPLAY_STR_LENGTH
                    ? valueStr.slice(0, MAX_ATTR_DISPLAY_STR_LENGTH) + '…'
                    : valueStr;
            return /*html*/ `
                <div class="attribute-item" id="${leafId}">
                    <span class="attribute-name" title="${safeKey}">${safeKey}</span>
                    <span> : </span>
                    <span class="attribute-value muted-text" title="${escapeHtml(valueStr)}">${escapeHtml(displayStr)}</span>
                </div>`;
        })
        .join('\n');
}

function renderGroupAttributes(groupName, attrName, value) {
    const attrId = joinId(['data-group', groupName, 'attribute', attrName]);
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

    return /*html*/ `
        <div class="attribute-item" id="${attrId}">
            <span class="attribute-name" title="${attrName}">${attrName} : </span>
            <span class="attribute-value muted-text" title="${valueStr}">${valueStr}</span>
        </div>
    `;
}

function renderDimension(groupName, name, size) {
    return /*html*/ `<strong id="${joinId([
        'data-group',
        groupName,
        'dimension',
        name,
    ])}">${name}</strong>: ${size}`;
}

function renderCoordinateVariable(variable, groupName) {
    const shapeStr = variable.shape ? `(${variable.shape.join(', ')})` : '';
    const dimsStr = variable.dimensions
        ? `(${variable.dimensions.join(', ')})`
        : '';
    const sizeStr = variable.size_bytes
        ? `${formatFileSize(variable.size_bytes)}`
        : '';
    const coordId = joinId([
        'data-group',
        groupName,
        'coordinate',
        variable.name,
    ]);
    const hasAttributes =
        variable.attributes && Object.keys(variable.attributes).length > 0;

    const attributesContent = hasAttributes
        ? renderVariableAttributes(
              variable.attributes,
              joinId(['data-group', groupName, 'coordinate', variable.name]),
          )
        : '';

    return /*html*/ `
        <details
            class="variable-details"
            id="${coordId}"
            data-variable="${variable.name}"
        >
            <summary
                class="variable-summary ${hasAttributes ? '' : 'not-clickable'}"
            >
                <span class="variable-name" title="${variable.name}">
                    ${variable.name}
                </span>
                <span class="dims" title="${dimsStr}">
                    ${dimsStr}
                </span>
                <span class="dtype-shape" title="${escapeHtml(variable.dtype)}">
                    <code>${escapeHtml(variable.dtype)}</code>
                </span>
                <span class="dtype-shape" title="${shapeStr}">
                    ${shapeStr}
                </span>
                ${sizeStr ? `<span class="size">${sizeStr}</span>` : ''}
            </summary>
            <div class="variable-details-content">
                ${variable.display_value ? `<div class="variable-display-value"><code>${escapeHtml(variable.display_value)}</code></div>` : ''}
                <div id="${joinId([
                    'data-group',
                    groupName,
                    'coordinate',
                    variable.name,
                    'attributes',
                ])}">${attributesContent}</div>
            </div>
        </details>
    `;
}

function renderDataVariable(variable, groupName) {
    const shapeStr = variable.shape ? `(${variable.shape.join(', ')})` : '';
    const dimsStr = variable.dimensions
        ? `(${variable.dimensions.join(', ')})`
        : '';
    const sizeStr = variable.size_bytes
        ? `${formatFileSize(variable.size_bytes)}`
        : '';
    const varId = joinId(['data-group', groupName, 'variable', variable.name]);
    const hasAttributes =
        variable.attributes && Object.keys(variable.attributes).length > 0;

    const attributesContent = hasAttributes
        ? renderVariableAttributes(
              variable.attributes,
              joinId(['data-group', groupName, 'variable', variable.name]),
          )
        : '';

    // For datatree variables, use full path (group/variable) for plotting
    const fullVariableName = `${groupName === '/' ? '' : groupName}/${
        variable.name
    }`;
    const plotControls = renderVariablePlotControls(fullVariableName);
    const displayValueBlock = variable.display_value
        ? `<div class="variable-display-value"><code>${escapeHtml(variable.display_value)}</code></div>`
        : '';

    return /*html*/ `
        <details class="variable-details" id="${varId}" data-variable="${fullVariableName}">
            <summary class="variable-summary ${
                hasAttributes ? '' : 'not-clickable'
            }">
                <span class="variable-name" title="${fullVariableName}">
                    ${variable.name}
                </span>
                <span class="dims" title="${dimsStr}">
                    ${dimsStr}
                </span>
                <span class="dtype-shape" title="${escapeHtml(variable.dtype)}">
                    <code>${escapeHtml(variable.dtype)}</code>
                </span>
                <span class="dtype-shape" title="${shapeStr}">
                    ${shapeStr}
                </span>
                ${sizeStr ? `<span class="size">${sizeStr}</span>` : ''}
            </summary>
            <div class="variable-details-content">
                ${displayValueBlock}
                <div id="${joinId([
                    'data-group',
                    groupName,
                    'variable',
                    variable.name,
                    'attributes',
                ])}">${attributesContent}</div>
            </div>
        </details>
        ${plotControls}
    `;
}

// Helper function to generate attributes HTML for details content
function renderVariableAttributes(attributes, parentId) {
    if (!attributes || Object.keys(attributes).length === 0) {
        return '';
    }

    const attributesList = Object.entries(attributes)
        .map(([attrName, value]) => {
            const valueStr =
                typeof value === 'string' ? value : JSON.stringify(value);
            return /*html*/ `
            <div class="attribute-item" id="${joinId([
                parentId,
                'attribute',
                attrName,
            ])}">
                <span class="attribute-name" title="${attrName}">${attrName} : </span>
                <span class="attribute-value muted-text" title="${valueStr}">${valueStr}</span>
            </div>
        `;
        })
        .join('');

    return /*html*/ `
        <div class="attributes-container">
            ${attributesList}
        </div>
    `;
}

// Generate variable plot controls HTML
function renderVariablePlotControls(variableName) {
    return /*html*/ `
        <div class="variable-plot-controls" data-variable="${variableName}">
            <div class="plot-controls-row">
                <select class="plot-type-select" data-variable="${variableName}">
                    <option value="auto" selected>Auto (Recommended)</option>
                </select>
                <button class="create-plot-button" data-variable="${variableName}">Create Plot</button>
            </div>
            <div class="plot-container" data-variable="${variableName}" style="display: none;">
                <div class="plot-actions">
                    <button class="plot-action-button reset-plot" data-variable="${variableName}">Reset</button>
                    <button class="plot-action-button save-plot" data-variable="${variableName}">Save</button>
                    <button class="plot-action-button save-plot-as" data-variable="${variableName}">Save As...</button>
                    <button class="plot-action-button open-plot" data-variable="${variableName}">Open</button>
                </div>
                <div class="plot-error hidden" data-variable="${variableName}"></div>
                <div class="plot-image-container"></div>
            </div>
        </div>`;
}

// Representation display functions
function displayHtmlRepresentation(htmlData, isDatatree) {
    const container = isDatatree
        ? document.getElementById('htmlRepresentationForGroups')
        : document.getElementById('htmlRepresentation');
    container.parentElement.parentElement.classList.remove('hidden');

    if (htmlData) {
        if (isDatatree && typeof htmlData === 'object' && htmlData !== null) {
            // Handle datatree flattened HTML representations
            const prefixId = 'section-html-representation-for-groups';
            container.innerHTML = Object.entries(htmlData)
                .map(([name, value]) =>
                    renderHtmlRepresentationForGroup(prefixId, name, value),
                )
                .join('');
        } else {
            // Handle regular HTML representation
            container.innerHTML = htmlData;
        }
    } else {
        container.innerHTML =
            '<p class="muted-text">Failed to load HTML representation</p>';
    }
}

function renderHtmlRepresentationForGroup(prefixId, groupName, value) {
    return /*html*/ `
    <div class="info-section" id="${joinId([prefixId, groupName])}">
        <details> <summary>${groupName}</summary>
            <div class="html-representation">
                ${value || /*html*/ `<p>No HTML representation available</p>`}
            </div>
        </details>
    </div>
    `;
}

function displayTextRepresentation(textData, isDatatree = false) {
    const container = isDatatree
        ? document.getElementById('textRepresentationForGroups')
        : document.getElementById('textRepresentation');
    container.parentElement.parentElement.classList.remove('hidden');

    // This function uses textContent to avoid issue with special characters.
    if (textData) {
        if (isDatatree && typeof textData === 'object' && textData !== null) {
            // Handle datatree flattened text representations
            const prefixId = 'section-text-representation-for-groups';
            container.innerHTML = Object.keys(textData)
                .map((name) =>
                    renderEmptyTextRepresentationForGroup(prefixId, name),
                )
                .join('');

            for (const [name, value] of Object.entries(textData)) {
                const textRepresentation = document.getElementById(
                    joinId(['groupTextRepresentation', name]),
                );
                textRepresentation.textContent = value;
            }
        } else {
            container.textContent = textData;
        }
    } else {
        container.textContent = `<p class="muted-text">Failed to load text representation</p>`;
    }
}

function renderEmptyTextRepresentationForGroup(prefixId, name) {
    console.log('renderEmptyTextRepresentationForGroup', prefixId, name);
    const preId = joinId(['groupTextRepresentation', name]);
    return /*html*/ `
    <div class="info-section" id="${joinId([prefixId, name])}">
        <details> <summary>${name}</summary>
            <div class="text-representation-container">
                <button
                    id="${joinId(['groupTextCopyButton', name])}"
                    data-target-id="${preId}"
                    class="text-copy-button"
                > 📋 Copy </button>
                <pre
                    id="${preId}"
                ></pre>
            </div>
        </div>
        </details>
    </div>
    `;
}

function displayShowVersions(versionsData) {
    const container = document.getElementById('showVersions');
    if (versionsData) {
        container.textContent = versionsData;
    } else {
        container.textContent = /*html*/ `<p class="muted-text">Failed to load version information</p>`;
    }
}

function displayPythonPath(pythonPath) {
    const container = document.getElementById('pythonPath');
    if (pythonPath) {
        container.textContent = pythonPath;
    } else {
        container.textContent = /*html*/ `<p class="muted-text">No Python interpreter configured</p>`;
    }
}

function displayExtensionConfig(configData) {
    const container = document.getElementById('extensionConfig');
    if (configData) {
        container.textContent = JSON.stringify(configData, null, 2);
    } else {
        container.textContent = /*html*/ `<p class="muted-text">Failed to load extension configuration</p>`;
    }
}

// Error handling functions
function displayGlobalError(
    message,
    details = '',
    errorType = '',
    supportedFormats = SUPPORTED_EXTENSIONS_HARDOCDED.join(', '),
) {
    const errorDiv = document.getElementById('error');

    // Format message to handle multi-line errors
    const formattedMessage = message.replace(/\n/g, '<br>');
    const formattedDetails = details ? details.replace(/\n/g, '<br>') : '';

    let troubleshootingSteps = /*html*/ `
        <h4>💡 General Troubleshooting Steps</h4>
        <ol>
            <li>If this is the first time you are using the extension, please consult the <a href="https://github.com/etienneschalk/scientific-data-viewer/wiki/Getting-Started" target="_blank">🔗 Getting Started</a> guide</li>
            <li>If the file is indicated as too large, you can increase the Max File Size in the <a href="#" class="small-button-link" onclick="executeShowSettingsCommand()">🎮 Extension Settings</a></li>
            <li>Make sure that the file format is supported (${supportedFormats})</li>
            <li>Make sure Python is installed and accessible</li>
            <li>
                Make sure that the Python extension is installed and enabled.
                Please go to the Extensions pane and search for <code>ms-python.python</code>
                to verify that the official Python extension is both installed and enabled.
                <ul style="margin-left: 20px;">
                    <li>For VSCode users: <a href="https://marketplace.visualstudio.com/items?itemName=ms-python.python" target="_blank">🔗 Python extension (VSCode Marketplace)</a></li>
                    <li>For Cursor users: <a href="https://open-vsx.org/extension/ms-python/python" target="_blank">🔗 Python extension (Open VSX Registry)</a></li>
                </ul>
            </li>

            <li>Select the Python Interpreter: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → "Python: Select Interpreter"</li>
            <li>If the python environment is not ready, install required package:
                <a href="#" class="small-button-link" onclick="executeInstallPackagesCommand(['xarray'])">
                    🎮 Install xarray</a>
            <li>If you cannot create plots, install required package:
                <a href="#" class="small-button-link" onclick="executeInstallPackagesCommand(['matplotlib'])">
                    🎮 Install matplotlib</a>
            <li>Install additional packages for format
                <ul style="margin-left: 20px;">
                    <li>NetCDF:
                        <a href="#" class="small-button-link" onclick="executeInstallPackagesCommand(['netCDF4', 'h5netcdf', 'scipy'])">
                            🎮 Install netCDF4, h5netcdf and scipy</a>
                    </li>
                    <li>Zarr:
                        <a href="#" class="small-button-link" onclick="executeInstallPackagesCommand(['zarr'])">
                            🎮 Install zarr</a>
                    </li>
                    <li>GRIB:
                        <a href="#" class="small-button-link" onclick="executeInstallPackagesCommand(['cfgrib'])">
                            🎮 Install cfgrib</a>
                    </li>
                    <li>GeoTIFF:
                        <a href="#" class="small-button-link" onclick="executeInstallPackagesCommand(['rioxarray'])">
                            🎮 Install rioxarray</a>
                    </li>
                    <li>JPEG-2000:
                         <a href="#" class="small-button-link" onclick="executeInstallPackagesCommand(['rioxarray'])">
                            🎮 Install rioxarray</a>
                    </li>
                    <li>CDF (NASA):
                        <a href="#" class="small-button-link" onclick="executeInstallPackagesCommand(['cdflib'])">
                            🎮 Install cdflib</a>
                    </li>
                </ul>
            </li>
            <li>Refresh the Python environment: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → "Scientific Data Viewer: Refresh Python Environment"</li>
            <li>Finally, try to close and reopen the file to reload the page</li>
            <li><a href="#" class="small-button-link" onclick="executeShowLogsCommand()">🎮 Check VSCode Output panel</a> for more details (choose "Scientific Data Viewer" from the dropdown)</li>
            <li>If you need more help, please report the issue on the <a href="https://github.com/etienneschalk/scientific-data-viewer/issues" target="_blank">🔗 Scientific Data Viewer GitHub repository</a></li>
        </ol>
    `;

    errorDiv.innerHTML = /*html*/ `
        <h3>❌ Error</h3>
        <p><strong>Message:</strong> <strong>${formattedMessage}</strong></p>
        ${
            formattedDetails
                ? /*html*/ `<p><strong>Details:</strong> ${formattedDetails}</p>`
                : ''
        }
        ${
            errorType
                ? /*html*/ `<p><strong>Error Type:</strong> ${errorType}</p>`
                : ''
        }
        <div style="margin-top: 15px;">
            ${troubleshootingSteps}

            <p style="margin-top: 15px; font-style: italic;">
                Note: If you see this message even after you have configured the Python interpreter,
                you might need to wait a few moments for the Python environment to be initialized.
                This can happen if you opened the data viewer panel right after VSCode was opened.
            </p>
        </div>
    `;
    errorDiv.classList.remove('hidden');
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.add('hidden');

    // Hide header controls when error is displayed
    const headerControls = document.getElementById('header-controls');
    if (headerControls) {
        headerControls.classList.add('hidden');
    }
}

function hideGlobalError() {
    const errorDiv = document.getElementById('error');
    errorDiv.classList.add('hidden');
    errorDiv.innerHTML = '';

    // Show header controls when error is cleared
    const headerControls = document.getElementById('header-controls');
    if (headerControls) {
        headerControls.classList.remove('hidden');
    }
}

// Per-variable plot functions
function displayVariablePlotLoading(variable) {
    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`,
    );
    const imageContainer = container.querySelector('.plot-image-container');

    // Hide any previous errors
    hideVariablePlotError(variable);

    // Show loading indicator
    imageContainer.innerHTML = /*html*/ `<p style="text-align: center; color: var(--vscode-descriptionForeground); font-style: italic;">Loading...</p>`;
    container.style.display = 'block';
}

function displayVariablePlot(variable, plotData) {
    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`,
    );
    const imageContainer = container.querySelector('.plot-image-container');

    // Hide any previous errors
    hideVariablePlotError(variable);

    if (plotData && plotData.startsWith('iVBOR')) {
        imageContainer.innerHTML = /*html*/ `<img src="data:image/png;base64,${plotData}" alt="Plot for ${variable}">`;
        container.style.display = 'block';
    } else {
        // Clear the image container and show error in the dedicated error element
        imageContainer.innerHTML = '';
        displayVariablePlotError(
            variable,
            'Error creating plot: Python script failed',
        );
        container.style.display = 'block';
    }
}

function displayVariablePlotError(variable, message) {
    const plotError = document.querySelector(
        `.plot-error[data-variable="${variable}"]`,
    );
    const errorMessageId = generateUUID();
    const matplotlibInstallButton = message.includes(
        'Matplotlib is not installed',
    )
        ? /*html*/ `
                <button
                    class="plot-action-button"
                    data-target-id="${errorMessageId}"
                    onclick="executeInstallPackagesCommand(['matplotlib'])"
                    style="margin-bottom: 6px;"
                    title="Once installed (a notification should appear), retry 'Create Plot' again."
                >
                    🎮 Install matplotlib
                </button>`
        : '';
    if (plotError) {
        plotError.innerHTML = /*html*/ `
            <div>
                ${matplotlibInstallButton}
                <button
                    class="text-copy-button"
                    data-target-id="${errorMessageId}"
                    title="Copy error message"
                >📋 Copy</button>
                <pre id="${errorMessageId}"></pre>
            </div>
        `;
        const textRepresentation = document.getElementById(errorMessageId);
        textRepresentation.textContent = message;
        plotError.classList.remove('hidden');
        plotError.classList.remove('success');
        plotError.classList.add('error');
    }
}

function displayVariablePlotSuccess(variable, message) {
    const plotError = document.querySelector(
        `.plot-error[data-variable="${variable}"]`,
    );
    if (plotError) {
        // Format message to handle multi-line messages
        const formattedMessage = message.replace(/\n/g, '<br>');
        plotError.innerHTML = formattedMessage;
        plotError.classList.remove('hidden');
        plotError.classList.remove('error');
        plotError.classList.add('success');
    }
}

function hideVariablePlotError(variable) {
    const plotError = document.querySelector(
        `.plot-error[data-variable="${variable}"]`,
    );
    if (plotError) {
        plotError.classList.add('hidden');
        plotError.textContent = '';
        plotError.classList.remove('error', 'success');
    }
}

function updatePlotAllUI(isRunning) {
    const button = document.getElementById('createAllPlotsButton');
    const cancelButton = document.getElementById('cancelAllPlotsButton');

    if (isRunning) {
        if (button) {
            button.disabled = true;
            button.textContent = 'Plotting...';
        }
        if (cancelButton) {
            cancelButton.classList.remove('hidden');
        }
    } else {
        if (button) {
            button.disabled = false;
            button.textContent = '⚠️ Plot All';
        }
        if (cancelButton) {
            cancelButton.classList.add('hidden');
        }
    }
}

/**
 * Update cancel button visibility based on active operations
 */
function updateCancelButtonVisibility() {
    const cancelButton = document.getElementById('cancelAllPlotsButton');
    if (cancelButton) {
        if (activePlotOperations.size > 0) {
            cancelButton.classList.remove('hidden');
            cancelButton.textContent = `🛑 Cancel All (${activePlotOperations.size})`;
        } else {
            cancelButton.classList.add('hidden');
        }
    }
}

/**
 * Cancel all active plot operations
 */
async function handleCancelAllPlots() {
    // Set the cancellation flag to prevent new plots from starting
    // This is especially important when using concurrency-limited Plot All
    plotAllCancelled = true;

    const operationIds = Array.from(activePlotOperations);
    const activeCount = operationIds.length;

    console.log(
        `🛑 Cancelling plot operations. Active: ${activeCount}, Flag set to prevent new plots.`,
    );

    if (activeCount === 0) {
        console.log(
            'No active plot operations to cancel (but flag set to prevent pending ones)',
        );
        // Still show notification and update UI
        updatePlotAllUI(false);
        try {
            await messageBus.showNotification(
                'Plot operation cancelled - no active processes to abort',
                'info',
            );
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
        return;
    }

    console.log(
        `🛑 Aborting ${activeCount} active plot operations:`,
        operationIds,
    );

    // Abort all active operations in parallel
    const abortPromises = operationIds.map(async (operationId) => {
        try {
            const result = await messageBus.abortPlot(operationId);
            console.log(`🛑 Aborted ${operationId}:`, result);
            return { operationId, success: true, result };
        } catch (error) {
            console.error(`❌ Failed to abort ${operationId}:`, error);
            return { operationId, success: false, error };
        }
    });

    const results = await Promise.allSettled(abortPromises);

    // Clear all tracked operations
    activePlotOperations.clear();
    updateCancelButtonVisibility();
    updatePlotAllUI(false);

    // Log summary
    const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success,
    ).length;
    console.log(
        `🛑 Cancel all completed: ${successful}/${activeCount} operations aborted`,
    );

    // Show notification
    try {
        await messageBus.showNotification(
            `Cancelled: ${successful} process(es) aborted`,
            'info',
        );
    } catch (error) {
        console.error('Failed to show notification:', error);
    }
}

// Time controls state management
const globalTimeControlsState = {
    datetimeVariableName: null,
    startDatetime: null,
    endDatetime: null,
    datetimeVarsMap: new Map(), // Map fullPath -> {name, fullPath, group, min, max}
};

function getVariableGroup(variable) {
    if (!variable || typeof variable !== 'string') {
        return '/';
    }
    if (variable.includes('/')) {
        const group = variable.slice(0, variable.lastIndexOf('/'));
        return group === '' ? '/' : group;
    }
    return '/';
}

function findGroupPlotControlsSection(groupName) {
    const sections = document.querySelectorAll('.group-plot-controls-section');
    for (const el of sections) {
        if (el.getAttribute('data-group') === groupName) {
            return el;
        }
    }
    return null;
}

function getGroupTimeControlsState(groupName) {
    const section = findGroupPlotControlsSection(groupName);
    if (!section) {
        return null;
    }
    const safeId = joinId(['group-plot', groupName]);
    const select = document.getElementById(`group-datetime-select-${safeId}`);
    const startInput = document.getElementById(
        `group-start-datetime-${safeId}`,
    );
    const endInput = document.getElementById(`group-end-datetime-${safeId}`);
    if (!select) {
        return null;
    }
    const datetimeVariableName = select.value || null;
    const startDatetime =
        startInput && startInput.value ? startInput.value : null;
    const endDatetime = endInput && endInput.value ? endInput.value : null;
    if (!datetimeVariableName && !startDatetime && !endDatetime) {
        return null;
    }
    return {
        datetimeVariableName: datetimeVariableName || undefined,
        startDatetime: startDatetime || undefined,
        endDatetime: endDatetime || undefined,
    };
}

/**
 * For group vs global resolution: treat null, undefined, or empty string as "not set"
 * so we fall back to global. Selectors use <option value="">None</option>, so without
 * this we would use the group's "" and never fall back to global for that field.
 */
function groupOrGlobalString(groupVal, globalVal) {
    if (groupVal === null) {
        return globalVal;
    }
    if (typeof groupVal === 'string' && groupVal.trim() === '') {
        return globalVal;
    }
    return groupVal;
}

function getGroupDimensionSlicesState(groupName) {
    const section = findGroupPlotControlsSection(groupName);
    if (!section) {
        return null;
    }
    const inputs = section.querySelectorAll(
        '.group-dimension-slice-input[data-group]',
    );
    const dimensionSlices = {};
    inputs.forEach((input) => {
        if (input.dataset.group !== groupName) {
            return;
        }
        const val = input.value && input.value.trim();
        if (val && input.dataset.dimension) {
            const num = Number(val);
            dimensionSlices[input.dataset.dimension] = Number.isInteger(num)
                ? num
                : val;
        }
    });
    const safeId = joinId(['group-plot', groupName]);
    const facetRowEl = document.getElementById(`group-facet-row-${safeId}`);
    const facetColEl = document.getElementById(`group-facet-col-${safeId}`);
    const colWrapEl = document.getElementById(`group-plot-col-wrap-${safeId}`);
    const plotXEl = document.getElementById(`group-plot-x-${safeId}`);
    const plotYEl = document.getElementById(`group-plot-y-${safeId}`);
    const plotHueEl = document.getElementById(`group-plot-hue-${safeId}`);
    const binsEl = document.getElementById(`group-bins-${safeId}`);
    const xIncreaseEl = document.getElementById(`group-x-increase-${safeId}`);
    const yIncreaseEl = document.getElementById(`group-y-increase-${safeId}`);
    const aspectEl = document.getElementById(`group-plot-aspect-${safeId}`);
    const sizeEl = document.getElementById(`group-plot-size-${safeId}`);
    const robustEl = document.getElementById(`group-robust-${safeId}`);
    const cmapEl = document.getElementById(`group-plot-cmap-${safeId}`);
    const facetRow = facetRowEl && facetRowEl.value ? facetRowEl.value : '';
    const facetCol = facetColEl && facetColEl.value ? facetColEl.value : '';
    let colWrap = undefined;
    if (colWrapEl && colWrapEl.value && colWrapEl.value.trim() !== '') {
        const n = parseInt(colWrapEl.value.trim(), 10);
        if (Number.isInteger(n) && n >= 1) {
            colWrap = n;
        }
    }
    const plotX = plotXEl && plotXEl.value ? plotXEl.value : '';
    const plotY = plotYEl && plotYEl.value ? plotYEl.value : '';
    const plotHue = plotHueEl && plotHueEl.value ? plotHueEl.value : '';
    let bins = null;
    if (binsEl && binsEl.value && binsEl.value.trim() !== '') {
        const n = parseInt(binsEl.value.trim(), 10);
        if (Number.isInteger(n) && n >= 1) {
            bins = n;
        }
    }
    let aspect = undefined;
    if (aspectEl && aspectEl.value && aspectEl.value.trim() !== '') {
        const n = Number(aspectEl.value.trim());
        if (Number.isFinite(n) && n > 0) {
            aspect = n;
        }
    }
    let size = undefined;
    if (sizeEl && sizeEl.value && sizeEl.value.trim() !== '') {
        const n = Number(sizeEl.value.trim());
        if (Number.isFinite(n) && n > 0) {
            size = n;
        }
    }
    const robust = robustEl ? robustEl.checked : false;
    const cmap =
        cmapEl && cmapEl.value && cmapEl.value.trim()
            ? cmapEl.value.trim()
            : '';
    if (
        Object.keys(dimensionSlices).length === 0 &&
        !facetRow &&
        !facetCol &&
        colWrap === undefined &&
        !plotX &&
        !plotY &&
        !plotHue &&
        (bins === null || bins === undefined) &&
        aspect === undefined &&
        size === undefined &&
        !robust &&
        !cmap
    ) {
        return null;
    }
    return {
        dimensionSlices:
            Object.keys(dimensionSlices).length > 0 ? dimensionSlices : null,
        facetRow,
        facetCol,
        colWrap,
        plotX,
        plotY,
        plotHue,
        xincrease: xIncreaseEl ? xIncreaseEl.checked : true,
        yincrease: yIncreaseEl ? yIncreaseEl.checked : true,
        aspect,
        size,
        robust,
        cmap,
        bins,
    };
}

// Populate datetime variable select (dedupe by name, sorted; optional feature flag)
function populateDatetimeVariables(data, flags) {
    const timeControlsSection = document.querySelector(
        '.time-controls-section',
    );
    if (!timeControlsSection) {
        return;
    }

    const globalTimeControls = (flags && flags.globalTimeControls) !== false;
    if (!globalTimeControls) {
        timeControlsSection.style.display = 'none';
        return;
    }

    // data is already the result object (not wrapped in data.result)
    if (
        !data ||
        !data.datetime_variables ||
        Object.keys(data.datetime_variables).length === 0
    ) {
        console.log('No datetime variables found in data:', data);
        timeControlsSection.style.display = 'none';
        return;
    }

    timeControlsSection.style.display = 'block';

    const select = document.getElementById('datetimeVariableSelect');
    if (!select) {
        return;
    }

    select.innerHTML = '<option value="">Select datetime variable...</option>';

    // Collect all datetime variables from all groups; dedupe by name (keep first), then sort by name
    const datetimeVarsMap = new Map(); // fullPath -> {name, fullPath, group, min, max}
    const byName = new Map(); // name -> {name, fullPath, ...} (first occurrence per name)

    for (const [groupName, vars] of Object.entries(data.datetime_variables)) {
        for (const varInfo of vars) {
            const varName =
                typeof varInfo === 'string' ? varInfo : varInfo.name;
            const minVal = typeof varInfo === 'object' ? varInfo.min : null;
            const maxVal = typeof varInfo === 'object' ? varInfo.max : null;
            const fullPath =
                groupName === '/' ? varName : `${groupName}/${varName}`;
            const varData = {
                name: varName,
                fullPath: fullPath,
                group: groupName,
                min: minVal,
                max: maxVal,
            };
            datetimeVarsMap.set(fullPath, varData);
            if (!byName.has(varName)) {
                byName.set(varName, varData);
            }
        }
    }

    const sortedUnique = [...byName.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
    );

    sortedUnique.forEach(({ name, fullPath }) => {
        const option = document.createElement('option');
        option.value = fullPath;
        option.textContent = name;
        select.appendChild(option);
    });

    globalTimeControlsState.datetimeVarsMap = datetimeVarsMap;
}

let groupPlotControlsListenersSetup = false;
function setupGroupPlotControlsListeners() {
    if (groupPlotControlsListenersSetup) {
        return;
    }
    groupPlotControlsListenersSetup = true;
    document.body.addEventListener('click', (e) => {
        const clearTimeBtn = e.target.closest('.group-clear-time-btn');
        if (clearTimeBtn) {
            const groupName = clearTimeBtn.getAttribute('data-group');
            if (!groupName) {
                return;
            }
            const section = findGroupPlotControlsSection(groupName);
            if (!section) {
                return;
            }
            const safeId = joinId(['group-plot', groupName]);
            const select = document.getElementById(
                `group-datetime-select-${safeId}`,
            );
            const startInput = document.getElementById(
                `group-start-datetime-${safeId}`,
            );
            const startText = document.getElementById(
                `group-start-datetime-text-${safeId}`,
            );
            const endInput = document.getElementById(
                `group-end-datetime-${safeId}`,
            );
            const endText = document.getElementById(
                `group-end-datetime-text-${safeId}`,
            );
            if (select) {
                select.value = '';
            }
            if (startInput) {
                startInput.value = '';
            }
            if (startText) {
                startText.value = '';
            }
            if (endInput) {
                endInput.value = '';
            }
            if (endText) {
                endText.value = '';
            }
            return;
        }

        const clearDimBtn = e.target.closest(
            '.group-clear-dimension-slices-btn',
        );
        if (clearDimBtn) {
            const groupName = clearDimBtn.getAttribute('data-group');
            if (!groupName) {
                return;
            }
            const section = findGroupPlotControlsSection(groupName);
            if (!section) {
                return;
            }
            section
                .querySelectorAll('.group-dimension-slice-input')
                .forEach((input) => {
                    input.value = '';
                });
            const safeId = joinId(['group-plot', groupName]);
            const facetRowEl = document.getElementById(
                `group-facet-row-${safeId}`,
            );
            const facetColEl = document.getElementById(
                `group-facet-col-${safeId}`,
            );
            const colWrapEl = document.getElementById(
                `group-plot-col-wrap-${safeId}`,
            );
            const plotXEl = document.getElementById(`group-plot-x-${safeId}`);
            const plotYEl = document.getElementById(`group-plot-y-${safeId}`);
            const plotHueEl = document.getElementById(
                `group-plot-hue-${safeId}`,
            );
            const binsEl = document.getElementById(`group-bins-${safeId}`);
            const xIncreaseEl = document.getElementById(
                `group-x-increase-${safeId}`,
            );
            const yIncreaseEl = document.getElementById(
                `group-y-increase-${safeId}`,
            );
            const aspectEl = document.getElementById(
                `group-plot-aspect-${safeId}`,
            );
            const sizeEl = document.getElementById(`group-plot-size-${safeId}`);
            const robustEl = document.getElementById(`group-robust-${safeId}`);
            const cmapEl = document.getElementById(`group-plot-cmap-${safeId}`);
            if (facetRowEl) {
                facetRowEl.value = '';
            }
            if (facetColEl) {
                facetColEl.value = '';
            }
            if (colWrapEl) {
                colWrapEl.value = '';
            }
            if (plotXEl) {
                plotXEl.value = '';
            }
            if (plotYEl) {
                plotYEl.value = '';
            }
            if (plotHueEl) {
                plotHueEl.value = '';
            }
            if (binsEl) {
                binsEl.value = '';
            }
            if (xIncreaseEl) {
                xIncreaseEl.checked = true;
            }
            if (yIncreaseEl) {
                yIncreaseEl.checked = true;
            }
            if (aspectEl) {
                aspectEl.value = '';
            }
            if (sizeEl) {
                sizeEl.value = '';
            }
            if (robustEl) {
                robustEl.checked = false;
            }
            if (cmapEl) {
                cmapEl.value = '';
            }
        }
    });
}

// Populate dimension slice inputs from all groups (merge, dedupe, sorted); optional feature flag
function populateDimensionSlices(data, flags) {
    const section = document.querySelector('.dimension-slices-section');
    if (!section) {
        return;
    }

    const globalDimensionSlices =
        (flags && flags.globalDimensionSlices) !== false;
    if (!globalDimensionSlices) {
        section.style.display = 'none';
        return;
    }

    if (
        !data ||
        !data.dimensions_flattened ||
        Object.keys(data.dimensions_flattened).length === 0
    ) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    const container = document.getElementById('dimensionSlicesContainer');
    if (!container) {
        return;
    }

    // Merge dimensions from all groups: dimName -> max size (or first non-zero)
    const mergedDimensions = {};
    for (const groupName of Object.keys(data.dimensions_flattened)) {
        const dims = data.dimensions_flattened[groupName];
        if (!dims) {
            continue;
        }
        for (const [dimName, size] of Object.entries(dims)) {
            const existing = mergedDimensions[dimName];
            if (existing === undefined || size > existing) {
                mergedDimensions[dimName] = size;
            }
        }
    }

    const dimNames = Object.keys(mergedDimensions).sort();

    if (dimNames.length === 0) {
        container.innerHTML =
            '<p class="muted-text">No dimensions in any group.</p>';
        const facetRowSelect = document.getElementById('facetRowSelect');
        const facetColSelect = document.getElementById('facetColSelect');
        const plotXSelect = document.getElementById('plotXSelect');
        const plotYSelect = document.getElementById('plotYSelect');
        const plotHueSelect = document.getElementById('plotHueSelect');
        if (facetRowSelect) {
            facetRowSelect.innerHTML = '<option value="">None</option>';
        }
        if (facetColSelect) {
            facetColSelect.innerHTML = '<option value="">None</option>';
        }
        if (plotXSelect) {
            plotXSelect.innerHTML = '<option value="">None</option>';
        }
        if (plotYSelect) {
            plotYSelect.innerHTML = '<option value="">None</option>';
        }
        if (plotHueSelect) {
            plotHueSelect.innerHTML = '<option value="">None</option>';
        }
        return;
    }

    container.innerHTML = dimNames
        .map(
            (dimName) =>
                `<div class="dimension-slice-row">
                    <label for="dim-slice-${dimName}">${escapeHtml(dimName)} (${mergedDimensions[dimName]}):</label>
                    <input type="text" id="dim-slice-${dimName}" class="dimension-slice-input" data-dimension="${dimName}" placeholder="e.g. 0:24:2 or 130" />
                </div>`,
        )
        .join('');

    const facetRowSelect = document.getElementById('facetRowSelect');
    const facetColSelect = document.getElementById('facetColSelect');
    const plotXSelect = document.getElementById('plotXSelect');
    const plotYSelect = document.getElementById('plotYSelect');
    const plotHueSelect = document.getElementById('plotHueSelect');
    const facetOptions =
        '<option value="">None</option>' +
        dimNames
            .map(
                (d) =>
                    `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`,
            )
            .join('');
    if (facetRowSelect) {
        facetRowSelect.innerHTML = facetOptions;
    }
    if (facetColSelect) {
        facetColSelect.innerHTML = facetOptions;
    }
    if (plotXSelect) {
        plotXSelect.innerHTML = facetOptions;
    }
    if (plotYSelect) {
        plotYSelect.innerHTML = facetOptions;
    }
    if (plotHueSelect) {
        plotHueSelect.innerHTML = facetOptions;
    }
}

function getDimensionSlicesState() {
    const dimensionSlices = {};
    const globalSection = document.getElementById(
        'section-global-plot-controls',
    );
    const inputs = globalSection
        ? globalSection.querySelectorAll('.dimension-slice-input')
        : [];
    inputs.forEach((input) => {
        const val = input.value && input.value.trim();
        if (val) {
            const dim = input.dataset.dimension;
            if (dim) {
                const num = Number(val);
                dimensionSlices[dim] = Number.isInteger(num) ? num : val;
            }
        }
    });
    const facetRowSelect = document.getElementById('facetRowSelect');
    const facetColSelect = document.getElementById('facetColSelect');
    const plotXSelect = document.getElementById('plotXSelect');
    const plotYSelect = document.getElementById('plotYSelect');
    const plotHueSelect = document.getElementById('plotHueSelect');
    const binsInput = document.getElementById('plotBinsInput');
    const xIncreaseCheckbox = document.getElementById('xIncreaseCheckbox');
    const yIncreaseCheckbox = document.getElementById('yIncreaseCheckbox');
    const plotAspectInput = document.getElementById('plotAspectInput');
    const plotSizeInput = document.getElementById('plotSizeInput');
    const robustCheckbox = document.getElementById('robustCheckbox');
    const plotCmapInput = document.getElementById('plotCmapInput');
    let bins = null;
    if (binsInput && binsInput.value && binsInput.value.trim() !== '') {
        const n = parseInt(binsInput.value.trim(), 10);
        if (Number.isInteger(n) && n >= 1) {
            bins = n;
        }
    }
    let aspect = null;
    if (
        plotAspectInput &&
        plotAspectInput.value &&
        plotAspectInput.value.trim() !== ''
    ) {
        const n = Number(plotAspectInput.value.trim());
        if (Number.isFinite(n) && n > 0) {
            aspect = n;
        }
    }
    let size = null;
    if (
        plotSizeInput &&
        plotSizeInput.value &&
        plotSizeInput.value.trim() !== ''
    ) {
        const n = Number(plotSizeInput.value.trim());
        if (Number.isFinite(n) && n > 0) {
            size = n;
        }
    }
    return {
        dimensionSlices: Object.keys(dimensionSlices).length
            ? dimensionSlices
            : null,
        facetRow:
            facetRowSelect && facetRowSelect.value ? facetRowSelect.value : '',
        facetCol:
            facetColSelect && facetColSelect.value ? facetColSelect.value : '',
        colWrap: (() => {
            if (
                plotColWrapInput &&
                plotColWrapInput.value &&
                plotColWrapInput.value.trim() !== ''
            ) {
                const n = parseInt(plotColWrapInput.value.trim(), 10);
                if (Number.isInteger(n) && n >= 1) {
                    return n;
                }
            }
            return undefined;
        })(),
        plotX: plotXSelect && plotXSelect.value ? plotXSelect.value : '',
        plotY: plotYSelect && plotYSelect.value ? plotYSelect.value : '',
        plotHue:
            plotHueSelect && plotHueSelect.value ? plotHueSelect.value : '',
        xincrease: xIncreaseCheckbox ? xIncreaseCheckbox.checked : true,
        yincrease: yIncreaseCheckbox ? yIncreaseCheckbox.checked : true,
        aspect: aspect ?? undefined,
        size: size ?? undefined,
        robust: robustCheckbox ? robustCheckbox.checked : false,
        cmap:
            plotCmapInput && plotCmapInput.value && plotCmapInput.value.trim()
                ? plotCmapInput.value.trim()
                : '',
        bins,
    };
}

// Convert datetime-local format to text format (YYYY-MM-DD HH:MM:SS)
function convertDatetimeLocalToText(datetimeLocal) {
    if (!datetimeLocal) {
        return '';
    }
    // datetime-local format: "YYYY-MM-DDTHH:mm"
    // Convert to: "YYYY-MM-DD HH:MM:SS"
    const [date, time] = datetimeLocal.split('T');
    if (!time) {
        return datetimeLocal;
    }
    const [hours, minutes] = time.split(':');
    return `${date} ${hours}:${minutes || '00'}:00`;
}

// Convert text format (YYYY-MM-DD HH:MM:SS or variations) to datetime-local format
function convertTextToDatetimeLocal(textValue) {
    if (!textValue) {
        return '';
    }

    // Try to parse various formats
    // Formats: "YYYY-MM-DD HH:MM:SS", "YYYY-MM-DD HH:MM", "YYYY-MM-DD", etc.
    let dateStr = textValue.trim();

    // Replace space between date and time with 'T' if present
    if (dateStr.includes(' ')) {
        dateStr = dateStr.replace(' ', 'T');
    }

    // If it already has 'T', keep it
    if (!dateStr.includes('T')) {
        // If no time part, add default time
        dateStr += 'T00:00';
    }

    // Parse and validate
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return '';
        }

        // Convert to datetime-local format: YYYY-MM-DDTHH:mm
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
        return '';
    }
}

// Setup time controls event listeners
function setupTimeControlsEventListeners() {
    const datetimeSelect = document.getElementById('datetimeVariableSelect');
    const startInput = document.getElementById('startDatetimeInput');
    const startTextInput = document.getElementById('startDatetimeTextInput');
    const endInput = document.getElementById('endDatetimeInput');
    const endTextInput = document.getElementById('endDatetimeTextInput');
    const clearButton = document.getElementById('clearTimeControlsButton');

    if (datetimeSelect) {
        datetimeSelect.addEventListener('change', (e) => {
            const selectedPath = e.target.value || null;
            globalTimeControlsState.datetimeVariableName = selectedPath;

            // Prefill start/end time inputs with min/max if available
            if (
                selectedPath &&
                globalTimeControlsState.datetimeVarsMap.has(selectedPath)
            ) {
                const varData =
                    globalTimeControlsState.datetimeVarsMap.get(selectedPath);
                const startInput =
                    document.getElementById('startDatetimeInput');
                const startTextInput = document.getElementById(
                    'startDatetimeTextInput',
                );
                const endInput = document.getElementById('endDatetimeInput');
                const endTextInput = document.getElementById(
                    'endDatetimeTextInput',
                );

                // Convert ISO format to datetime-local format
                function isoToDatetimeLocal(isoString) {
                    if (!isoString) {
                        return '';
                    }
                    // ISO format: "2025-01-01T12:30:00" or "2025-01-01T12:30:00.000000"
                    // datetime-local format: "2025-01-01T12:30"
                    const dateTime = isoString.split('T');
                    if (dateTime.length !== 2) {
                        return '';
                    }
                    const date = dateTime[0];
                    const time = dateTime[1].split(':');
                    if (time.length < 2) {
                        return '';
                    }
                    return `${date}T${time[0]}:${time[1]}`;
                }

                // Set min value to start time inputs
                if (varData.min) {
                    const minDatetimeLocal = isoToDatetimeLocal(varData.min);
                    if (minDatetimeLocal) {
                        if (startInput) {
                            startInput.value = minDatetimeLocal;
                            // Update state explicitly
                            globalTimeControlsState.startDatetime =
                                minDatetimeLocal;
                            // Trigger change event to ensure all listeners are notified
                            startInput.dispatchEvent(
                                new Event('change', { bubbles: true }),
                            );
                        }
                        if (startTextInput) {
                            startTextInput.value =
                                convertDatetimeLocalToText(minDatetimeLocal);
                        }
                    }
                } else {
                    // Clear start time if no min value
                    if (startInput) {
                        startInput.value = '';
                        globalTimeControlsState.startDatetime = null;
                    }
                    if (startTextInput) {
                        startTextInput.value = '';
                    }
                }

                // Set max value to end time inputs
                if (varData.max) {
                    const maxDatetimeLocal = isoToDatetimeLocal(varData.max);
                    if (maxDatetimeLocal) {
                        if (endInput) {
                            endInput.value = maxDatetimeLocal;
                            // Update state explicitly
                            globalTimeControlsState.endDatetime =
                                maxDatetimeLocal;
                            // Trigger change event to ensure all listeners are notified
                            endInput.dispatchEvent(
                                new Event('change', { bubbles: true }),
                            );
                        }
                        if (endTextInput) {
                            endTextInput.value =
                                convertDatetimeLocalToText(maxDatetimeLocal);
                        }
                    }
                } else {
                    // Clear end time if no max value
                    if (endInput) {
                        endInput.value = '';
                        globalTimeControlsState.endDatetime = null;
                    }
                    if (endTextInput) {
                        endTextInput.value = '';
                    }
                }
            }
        });
    }

    // Start time: sync datetime-local -> text
    if (startInput) {
        startInput.addEventListener('change', (e) => {
            const value = e.target.value || null;
            globalTimeControlsState.startDatetime = value;
            if (startTextInput) {
                startTextInput.value = convertDatetimeLocalToText(value);
            }
        });
    }

    // Start time: sync text -> datetime-local
    if (startTextInput) {
        startTextInput.addEventListener('input', (e) => {
            const textValue = e.target.value;
            const datetimeLocalValue = convertTextToDatetimeLocal(textValue);
            if (datetimeLocalValue && startInput) {
                startInput.value = datetimeLocalValue;
                globalTimeControlsState.startDatetime = datetimeLocalValue;
            } else if (!textValue) {
                // Clear both if text is cleared
                if (startInput) {
                    startInput.value = '';
                }
                globalTimeControlsState.startDatetime = null;
            }
        });
    }

    // End time: sync datetime-local -> text
    if (endInput) {
        endInput.addEventListener('change', (e) => {
            const value = e.target.value || null;
            globalTimeControlsState.endDatetime = value;
            if (endTextInput) {
                endTextInput.value = convertDatetimeLocalToText(value);
            }
        });
    }

    // End time: sync text -> datetime-local
    if (endTextInput) {
        endTextInput.addEventListener('input', (e) => {
            const textValue = e.target.value;
            const datetimeLocalValue = convertTextToDatetimeLocal(textValue);
            if (datetimeLocalValue && endInput) {
                endInput.value = datetimeLocalValue;
                globalTimeControlsState.endDatetime = datetimeLocalValue;
            } else if (!textValue) {
                // Clear both if text is cleared
                if (endInput) {
                    endInput.value = '';
                }
                globalTimeControlsState.endDatetime = null;
            }
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            globalTimeControlsState.datetimeVariableName = null;
            globalTimeControlsState.startDatetime = null;
            globalTimeControlsState.endDatetime = null;
            if (datetimeSelect) {
                datetimeSelect.value = '';
            }
            if (startInput) {
                startInput.value = '';
            }
            if (startTextInput) {
                startTextInput.value = '';
            }
            if (endInput) {
                endInput.value = '';
            }
            if (endTextInput) {
                endTextInput.value = '';
            }
        });
    }

    const clearDimSlicesButton = document.getElementById(
        'clearDimensionSlicesButton',
    );
    if (clearDimSlicesButton) {
        clearDimSlicesButton.addEventListener('click', () => {
            const globalSection = document.getElementById(
                'section-global-plot-controls',
            );
            if (globalSection) {
                globalSection
                    .querySelectorAll('.dimension-slice-input')
                    .forEach((input) => {
                        input.value = '';
                    });
            }
            const facetRowSelect = document.getElementById('facetRowSelect');
            const facetColSelect = document.getElementById('facetColSelect');
            const plotColWrapInput =
                document.getElementById('plotColWrapInput');
            const plotXSelect = document.getElementById('plotXSelect');
            const plotYSelect = document.getElementById('plotYSelect');
            const plotHueSelect = document.getElementById('plotHueSelect');
            const binsInput = document.getElementById('plotBinsInput');
            const xIncreaseCheckbox =
                document.getElementById('xIncreaseCheckbox');
            const yIncreaseCheckbox =
                document.getElementById('yIncreaseCheckbox');
            const plotAspectInput = document.getElementById('plotAspectInput');
            const plotSizeInput = document.getElementById('plotSizeInput');
            if (facetRowSelect) {
                facetRowSelect.value = '';
            }
            if (facetColSelect) {
                facetColSelect.value = '';
            }
            if (plotColWrapInput) {
                plotColWrapInput.value = '';
            }
            if (plotXSelect) {
                plotXSelect.value = '';
            }
            if (plotYSelect) {
                plotYSelect.value = '';
            }
            if (plotHueSelect) {
                plotHueSelect.value = '';
            }
            if (binsInput) {
                binsInput.value = '';
            }
            if (xIncreaseCheckbox) {
                xIncreaseCheckbox.checked = true;
            }
            if (yIncreaseCheckbox) {
                yIncreaseCheckbox.checked = true;
            }
            if (plotAspectInput) {
                plotAspectInput.value = '';
            }
            if (plotSizeInput) {
                plotSizeInput.value = '';
            }
            if (robustCheckbox) {
                robustCheckbox.checked = false;
            }
            const plotCmapInput = document.getElementById('plotCmapInput');
            if (plotCmapInput) {
                plotCmapInput.value = '';
            }
        });
    }
}

// Convert datetime-local to ISO format (preserving local time, no timezone conversion)
function convertDatetimeLocalToISO(datetimeLocal) {
    // datetime-local format: "YYYY-MM-DDTHH:mm"
    // Need to convert to ISO format for Python (YYYY-MM-DDTHH:mm:ss)
    // IMPORTANT: Preserve local time without timezone conversion to avoid shifting dates
    if (!datetimeLocal) {
        return null;
    }

    // datetime-local already has the format "YYYY-MM-DDTHH:mm"
    // Just add seconds if not present to make it "YYYY-MM-DDTHH:mm:ss"
    let isoString = datetimeLocal;

    // Count colons to determine if we need to add seconds
    const colonCount = (isoString.match(/:/g) || []).length;
    if (colonCount === 1) {
        // Has hours:minutes, add seconds
        isoString += ':00';
    } else if (colonCount === 0) {
        // No time part at all (shouldn't happen with datetime-local, but handle it)
        isoString += 'T00:00:00';
    }
    // If colonCount === 2, it already has seconds, so we're good

    // Return as-is (naive datetime, no timezone conversion)
    // Python's pd.Timestamp will interpret this as the exact time entered
    return isoString;
}

// Event listeners setup
function setupEventListeners() {
    // Global event listeners (no data-variable attribute)
    const clickEventMappingIdToHandler = {
        // Refresh button
        refreshButton: handleRefresh,
        // Tree control event listeners
        expandAllButton: handleExpandAllSections,
        collapseAllButton: handleCollapseAllSections,
        // Export buttons
        exportWebviewButton: handleExportWebview,
        // Global plot controls
        createAllPlotsButton: handleCreateAllPlots,
        cancelAllPlotsButton: handleCancelAllPlots,
        resetAllPlotsButton: handleResetAllPlots,
        saveAllPlotsButton: handleSaveAllPlots,
    };

    // Per-variable event listeners for plot controls (needs data-variable attribute)
    const clickEventMappingClassToHandler = {
        'create-plot-button': handleCreateVariablePlot,
        'reset-plot': handleResetVariablePlot,
        'save-plot': handleSaveVariablePlot,
        'save-plot-as': handleSaveVariablePlotAs,
        'open-plot': handleOpenVariablePlot,
    };

    // Change event listeners for plot type select
    const changeEventMappingClassToHandler = {
        'plot-type-select': handlePlotTypeSelect,
    };

    // Setup time controls event listeners
    setupTimeControlsEventListeners();

    // Event delegation for dynamic event handling (eg tags added after page load)
    document.addEventListener('click', async (e) => {
        // Text copy button
        if (e.target.classList.contains('text-copy-button')) {
            const button = e.target;
            await handleTextCopy(button);
            return;
        }

        // Global event listeners (no data-variable attribute)
        for (const [id, handler] of Object.entries(
            clickEventMappingIdToHandler,
        )) {
            if (e.target.id === id) {
                handler();
                return;
            }
        }

        // Per-variable event listeners for plot controls (needs data-variable attribute)
        for (const [className, handler] of Object.entries(
            clickEventMappingClassToHandler,
        )) {
            if (e.target.classList.contains(className)) {
                const variable = e.target.dataset.variable;
                await handler(variable);
                return;
            }
        }
    });
    document.addEventListener('change', async (e) => {
        // Change event listeners for plot type select
        for (const [className, handler] of Object.entries(
            changeEventMappingClassToHandler,
        )) {
            if (e.target.classList.contains(className)) {
                const variable = e.target.getAttribute('data-variable');
                await handler(variable);
                return;
            }
        }
    });
}

async function handleTextCopy(button) {
    const targetElement = document.getElementById(button.dataset.targetId);
    const text = targetElement ? targetElement.textContent : '';
    try {
        await navigator.clipboard.writeText(text);
        button.textContent = '✓ Copied!';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = '📋 Copy';
            button.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text representation:', err);
        button.textContent = '❌ Failed';
        setTimeout(() => {
            button.textContent = '📋 Copy';
        }, 2000);
    }
}

async function handleRefresh() {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Refresh not available in degraded mode');
        return;
    }

    displayTimestamp(null, true);
    try {
        await messageBus.refresh();
    } catch (error) {
        console.error('Failed to refresh data:', error);
        displayGlobalError('Failed to refresh data: ' + error.message);
    }
}

async function handleExportWebview() {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Export webview not available in degraded mode');
        return;
    }

    console.log('🖼️ Exporting webview content...');
    const htmlContent = captureWebviewContent();
    try {
        const result = await messageBus.exportWebview(htmlContent);
        if (result.success) {
            console.log(
                '🖼️ Webview content exported successfully:',
                result.filePath,
            );
        } else {
            console.error('🖼️ Failed to export webview content:', result.error);
            displayGlobalError(
                'Failed to export webview content: ' + result.error,
            );
        }
    } catch (error) {
        console.error('🖼️ Error exporting webview content:', error);
        displayGlobalError(
            'Failed to export webview content: ' + error.message,
        );
    }
}

/**
 * Selectors for user-filled form controls that should be exported with their
 * current values and made read-only in the exported HTML.
 */
const EXPORT_FORM_CONTROL_SELECTORS = [
    'select.datetime-variable-select',
    'select.group-datetime-select',
    'input.datetime-input',
    'input.group-datetime-input',
    'input.datetime-text-input',
    'input.dimension-slice-input',
    'input.group-dimension-slice-input',
    'select.facet-select',
    'select.group-facet-select',
    'input.bins-input',
    'input.group-bins-input',
].join(', ');

/**
 * Capture current values of exportable form controls (by id) from the live document.
 * @returns {Map<string, string>} id -> current value
 */
function captureFormControlValues() {
    const valueById = new Map();
    const elements = document.querySelectorAll(EXPORT_FORM_CONTROL_SELECTORS);
    elements.forEach((el) => {
        if (el.id) {
            valueById.set(
                el.id,
                el.value === undefined ? '' : String(el.value),
            );
        }
    });
    return valueById;
}

/**
 * Apply captured values to the cloned document and make form controls read-only
 * so the exported HTML reflects the state at export time (browser view = readonly).
 */
function applyExportStateToClone(clone, valueById) {
    if (!valueById || valueById.size === 0) {
        return;
    }
    valueById.forEach((value, id) => {
        try {
            const escapedId = CSS.escape
                ? CSS.escape(id)
                : id.replace(/"/g, '\\"');
            const el = clone.querySelector(`[id="${escapedId}"]`);
            if (!el) {
                return;
            }
            if (el.tagName === 'SELECT') {
                el.value = value;
                // Set selected attribute on the matching option so serialized HTML shows it (outerHTML may not reflect .value)
                Array.from(el.options).forEach((opt) => {
                    if (opt.value === value) {
                        opt.setAttribute('selected', 'selected');
                    } else {
                        opt.removeAttribute('selected');
                    }
                });
                el.disabled = true;
            } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.setAttribute('value', value);
                el.value = value;
                el.readOnly = true;
            }
        } catch (e) {
            console.warn('Export: could not set value for id', id, e);
        }
    });
}

function captureWebviewContent() {
    console.log('🖼️ Capturing webview content...');

    try {
        const valueById = captureFormControlValues();
        const clone = document.documentElement.cloneNode(true);
        applyExportStateToClone(clone, valueById);

        const htmlContent = clone.outerHTML;
        console.log(
            '🖼️ Content captured, size:',
            htmlContent.length,
            'characters',
            valueById.size > 0
                ? `(${valueById.size} form values preserved)`
                : '',
        );
        return htmlContent;
    } catch (error) {
        console.error('🖼️ Error capturing webview content:', error);
        return null;
    }
}

// Tree view control functions
function handleExpandAllSections() {
    console.log('📂 Expanding all sections...');
    const allDetails = document.querySelectorAll('details');
    let expandedCount = 0;

    allDetails.forEach((details) => {
        if (!details.open) {
            details.open = true;
            expandedCount++;
        }
    });

    console.log(`📂 Expanded ${expandedCount} sections`);
}

function handleCollapseAllSections() {
    console.log('📁 Collapsing all sections...');
    const allDetails = document.querySelectorAll('details');
    let collapsedCount = 0;

    allDetails.forEach((details) => {
        if (details.open) {
            details.open = false;
            collapsedCount++;
        }
    });

    console.log(`📁 Collapsed ${collapsedCount} sections`);
}

/**
 * Process items with a concurrency limit.
 * This ensures we don't overwhelm the system with too many parallel operations.
 * @param items Array of items to process
 * @param processor Async function to process each item
 * @param concurrencyLimit Maximum number of concurrent operations
 * @returns Array of results in the same order as items
 */
async function processWithConcurrencyLimit(
    items,
    processor,
    concurrencyLimit = 5,
) {
    const results = [];
    const executing = new Set();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Create the promise for this item
        const promise = (async () => {
            try {
                const result = await processor(item, i);
                return { status: 'fulfilled', value: result };
            } catch (error) {
                return { status: 'rejected', reason: error };
            }
        })();

        // Track this promise
        results[i] = promise;
        executing.add(promise);

        // When promise completes, remove from executing set
        promise.then(() => executing.delete(promise));

        // If we've reached the concurrency limit, wait for one to complete
        if (executing.size >= concurrencyLimit) {
            await Promise.race(executing);
        }
    }

    // Wait for all remaining promises to complete
    return Promise.all(results);
}

// Flag to track if plot all operation was cancelled
let plotAllCancelled = false;

async function handleCreateAllPlots() {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Create plots not available in degraded mode');
        return;
    }

    console.log('🔍 Plot All Variables - Debug Info:');

    // Reset cancellation flag
    plotAllCancelled = false;

    // Get all variables to plot
    const buttons = document.querySelectorAll('.create-plot-button');
    if (buttons.length === 0) {
        console.log('No variables to plot');
        return;
    }

    // Update UI to show operation in progress
    updatePlotAllUI(true);

    // Get time control values (same for all plots) - also read directly from inputs as fallback
    let datetimeVariableName = globalTimeControlsState.datetimeVariableName;
    let startDatetime = globalTimeControlsState.startDatetime;
    let endDatetime = globalTimeControlsState.endDatetime;

    // Fallback: read directly from inputs if state is not set
    if (!startDatetime) {
        const startInput = document.getElementById('startDatetimeInput');
        if (startInput && startInput.value) {
            startDatetime = startInput.value;
            globalTimeControlsState.startDatetime = startDatetime;
        }
    }
    if (!endDatetime) {
        const endInput = document.getElementById('endDatetimeInput');
        if (endInput && endInput.value) {
            endDatetime = endInput.value;
            globalTimeControlsState.endDatetime = endDatetime;
        }
    }
    if (!datetimeVariableName) {
        const datetimeSelect = document.getElementById(
            'datetimeVariableSelect',
        );
        if (datetimeSelect && datetimeSelect.value) {
            datetimeVariableName = datetimeSelect.value;
            globalTimeControlsState.datetimeVariableName = datetimeVariableName;
        }
    }

    // Convert to ISO format for Python
    const startDatetimeISO = startDatetime
        ? convertDatetimeLocalToISO(startDatetime)
        : null;
    const endDatetimeISO = endDatetime
        ? convertDatetimeLocalToISO(endDatetime)
        : null;

    const {
        dimensionSlices,
        facetRow,
        facetCol,
        colWrap,
        plotX,
        plotY,
        plotHue,
        xincrease,
        yincrease,
        aspect,
        size,
        robust,
        cmap,
        bins,
    } = getDimensionSlicesState();

    // Prepare plot tasks (not promises yet - we'll create them with concurrency control)
    const plotTasks = Array.from(buttons).map((button) => ({
        variable: button.getAttribute('data-variable'),
        plotTypeSelect: document.querySelector(
            `.plot-type-select[data-variable="${button.getAttribute('data-variable')}"]`,
        ),
    }));

    console.log(
        `📊 Starting Plot All with ${plotTasks.length} variables (max 5 concurrent)`,
    );

    // Process plots with concurrency limit to leave room for cancel operations
    const processSinglePlot = async (task) => {
        const { variable, plotTypeSelect } = task;
        const plotType = plotTypeSelect ? plotTypeSelect.value : 'auto';

        if (plotAllCancelled) {
            return {
                variable,
                success: false,
                error: 'Cancelled',
                skipped: true,
            };
        }

        const variableGroup = getVariableGroup(variable);
        const groupTime = getGroupTimeControlsState(variableGroup);
        const groupDim = getGroupDimensionSlicesState(variableGroup);

        const dtName = groupTime?.datetimeVariableName ?? datetimeVariableName;
        const startISO = groupTime?.startDatetime
            ? convertDatetimeLocalToISO(groupTime.startDatetime)
            : startDatetimeISO;
        const endISO = groupTime?.endDatetime
            ? convertDatetimeLocalToISO(groupTime.endDatetime)
            : endDatetimeISO;
        const dimSlices = groupDim?.dimensionSlices ?? dimensionSlices;
        const fRow = groupOrGlobalString(groupDim?.facetRow, facetRow);
        const fCol = groupOrGlobalString(groupDim?.facetCol, facetCol);
        const fColWrap = groupDim?.colWrap ?? colWrap;
        const fPlotX = groupOrGlobalString(groupDim?.plotX, plotX);
        const fPlotY = groupOrGlobalString(groupDim?.plotY, plotY);
        const fPlotHue = groupOrGlobalString(groupDim?.plotHue, plotHue);
        const fXincrease = groupDim?.xincrease ?? xincrease;
        const fYincrease = groupDim?.yincrease ?? yincrease;
        const fAspect = groupDim?.aspect ?? aspect;
        const fSize = groupDim?.size ?? size;
        const fRobust = groupDim?.robust ?? robust;
        const fCmap = groupOrGlobalString(groupDim?.cmap, cmap);
        const fBins = groupDim?.bins ?? bins;

        displayVariablePlotLoading(variable);

        try {
            const plotData = await messageBus.createPlot(
                variable,
                plotType,
                dtName,
                startISO,
                endISO,
                dimSlices,
                fRow,
                fCol,
                fColWrap,
                fPlotX,
                fPlotY,
                fPlotHue,
                fXincrease,
                fYincrease,
                fAspect,
                fSize,
                fRobust,
                fCmap,
                fBins,
                globalState.plotTimeoutMs,
            );
            displayVariablePlot(variable, plotData);

            return { variable, success: true };
        } catch (error) {
            console.error('Failed to create plot:', error);

            // Clear loading state and show error
            const container = document.querySelector(
                `.plot-container[data-variable="${variable}"]`,
            );
            if (container) {
                const imageContainer = container.querySelector(
                    '.plot-image-container',
                );
                if (imageContainer) {
                    imageContainer.innerHTML = '';
                }
            }
            displayVariablePlotError(
                variable,
                'Error creating plot: ' + error.message,
            );

            return { variable, success: false, error: error.message };
        }
    };

    try {
        // Process with concurrency limit of 5 (leaves room for cancel operations)
        const results = await processWithConcurrencyLimit(
            plotTasks,
            processSinglePlot,
            5,
        );

        // Log results
        const successful = results.filter(
            (r) => r.status === 'fulfilled' && r.value.success,
        ).length;
        const skipped = results.filter(
            (r) => r.status === 'fulfilled' && r.value.skipped,
        ).length;
        const failed = results.length - successful - skipped;

        console.log(
            `Plot all completed: ${successful} successful, ${failed} failed, ${skipped} skipped (cancelled)`,
        );

        // Show completion message (only if not fully cancelled)
        if (!plotAllCancelled || successful > 0) {
            try {
                let message = `Plot all: ${successful} successful`;
                if (failed > 0) {
                    message += `, ${failed} failed`;
                }
                if (skipped > 0) {
                    message += `, ${skipped} cancelled`;
                }

                await messageBus.showNotification(
                    message,
                    failed > 0 ? 'warning' : 'info',
                );
            } catch (notificationError) {
                console.error(
                    'Failed to show notification:',
                    notificationError,
                );
            }
        }
    } catch (error) {
        console.error('Error in plot all operation:', error);
    } finally {
        // Update UI to show operation completed
        updatePlotAllUI(false);
        // Reset cancellation flag
        plotAllCancelled = false;
    }
}

function handleResetAllPlots() {
    const containers = document.querySelectorAll('.plot-container');
    containers.forEach((container) => {
        const imageContainer = container.querySelector('.plot-image-container');
        imageContainer.innerHTML = '';
        container.style.display = 'none';
        const variable = container.getAttribute('data-variable');
        hideVariablePlotError(variable);
    });
}

async function handleSaveAllPlots() {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Save plots not available in degraded mode');
        return;
    }

    const containers = document.querySelectorAll('.plot-container');
    const plotsToSave = [];

    containers.forEach((container) => {
        const img = container.querySelector('img');
        if (img) {
            const variable = container.getAttribute('data-variable');
            const plotData = img.src.split(',')[1];
            plotsToSave.push({ variable, plotData });
        }
    });

    if (plotsToSave.length === 0) {
        try {
            await messageBus.showNotification('No plots to save', 'warning');
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
        return;
    }

    try {
        for (const { variable, plotData } of plotsToSave) {
            const filePath =
                globalState.currentDatasetFilePath || 'unknown_file';
            const fileName = generateDefaultFileName(filePath, variable);
            const result = await messageBus.savePlot(
                plotData,
                variable,
                fileName,
            );
            if (result.success) {
                displayVariablePlotSuccess(variable, `Plot saved: ${fileName}`);
            } else {
                displayVariablePlotError(
                    variable,
                    `Failed to save: ${result.error}`,
                );
            }
        }
    } catch (error) {
        console.error('Error saving all plots:', error);
        try {
            await messageBus.showNotification(
                'Failed to save all plots: ' + error.message,
                'error',
            );
        } catch (notificationError) {
            console.error('Failed to show notification:', notificationError);
        }
    }
}

async function handleCreateVariablePlot(variable) {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Create plot not available in degraded mode');
        return;
    }

    const plotTypeSelect = document.querySelector(
        `.plot-type-select[data-variable="${variable}"]`,
    );
    const plotType = plotTypeSelect ? plotTypeSelect.value : 'auto';

    const variableGroup = getVariableGroup(variable);
    const groupTime = getGroupTimeControlsState(variableGroup);
    const groupDim = getGroupDimensionSlicesState(variableGroup);

    // Time: use group overrides if present, else global
    let datetimeVariableName =
        groupTime?.datetimeVariableName ??
        globalTimeControlsState.datetimeVariableName;
    let startDatetime =
        groupTime?.startDatetime ?? globalTimeControlsState.startDatetime;
    let endDatetime =
        groupTime?.endDatetime ?? globalTimeControlsState.endDatetime;

    if (!startDatetime && !groupTime) {
        const startInput = document.getElementById('startDatetimeInput');
        if (startInput && startInput.value) {
            startDatetime = startInput.value;
            globalTimeControlsState.startDatetime = startDatetime;
        }
    }
    if (!endDatetime && !groupTime) {
        const endInput = document.getElementById('endDatetimeInput');
        if (endInput && endInput.value) {
            endDatetime = endInput.value;
            globalTimeControlsState.endDatetime = endDatetime;
        }
    }
    if (!datetimeVariableName && !groupTime) {
        const datetimeSelect = document.getElementById(
            'datetimeVariableSelect',
        );
        if (datetimeSelect && datetimeSelect.value) {
            datetimeVariableName = datetimeSelect.value;
            globalTimeControlsState.datetimeVariableName = datetimeVariableName;
        }
    }

    const startDatetimeISO = startDatetime
        ? convertDatetimeLocalToISO(startDatetime)
        : null;
    const endDatetimeISO = endDatetime
        ? convertDatetimeLocalToISO(endDatetime)
        : null;

    const globalDim = getDimensionSlicesState();
    const dimensionSlices =
        groupDim?.dimensionSlices ?? globalDim.dimensionSlices;
    const facetRow = groupOrGlobalString(
        groupDim?.facetRow,
        globalDim.facetRow,
    );
    const facetCol = groupOrGlobalString(
        groupDim?.facetCol,
        globalDim.facetCol,
    );
    const colWrap = groupDim?.colWrap ?? globalDim.colWrap;
    const plotX = groupOrGlobalString(groupDim?.plotX, globalDim.plotX);
    const plotY = groupOrGlobalString(groupDim?.plotY, globalDim.plotY);
    const plotHue = groupOrGlobalString(groupDim?.plotHue, globalDim.plotHue);
    const xincrease = groupDim?.xincrease ?? globalDim.xincrease;
    const yincrease = groupDim?.yincrease ?? globalDim.yincrease;
    const aspect = groupDim?.aspect ?? globalDim.aspect;
    const size = groupDim?.size ?? globalDim.size;
    const robust = groupDim?.robust ?? globalDim.robust;
    const cmap = groupOrGlobalString(groupDim?.cmap, globalDim.cmap);
    const bins = groupDim?.bins ?? globalDim.bins;

    console.log('Creating plot with time controls:', {
        datetimeVariableName,
        startDatetime,
        endDatetime,
        startDatetimeISO,
        endDatetimeISO,
        dimensionSlices,
        facetRow,
        facetCol,
        colWrap,
        plotX,
        plotY,
        plotHue,
        xincrease,
        yincrease,
        aspect,
        size,
        robust,
        cmap,
        bins,
        rawState: globalTimeControlsState,
    });

    // Show loading indicator
    displayVariablePlotLoading(variable);

    try {
        const plotData = await messageBus.createPlot(
            variable,
            plotType,
            datetimeVariableName,
            startDatetimeISO,
            endDatetimeISO,
            dimensionSlices,
            facetRow,
            facetCol,
            colWrap,
            plotX,
            plotY,
            plotHue,
            xincrease,
            yincrease,
            aspect,
            size,
            robust,
            cmap,
            bins,
            globalState.plotTimeoutMs,
        );
        displayVariablePlot(variable, plotData);
    } catch (error) {
        console.error('Failed to create plot:', error);
        // Clear loading state and show error
        const container = document.querySelector(
            `.plot-container[data-variable="${variable}"]`,
        );
        const imageContainer = container.querySelector('.plot-image-container');
        imageContainer.innerHTML = '';
        displayVariablePlotError(
            variable,
            'Error creating plot: ' + error.message,
        );
    }
}

async function handleResetVariablePlot(variable) {
    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`,
    );
    const imageContainer = container.querySelector('.plot-image-container');

    imageContainer.innerHTML = '';
    container.style.display = 'none';
    hideVariablePlotError(variable);
}

async function handleSaveVariablePlot(variable) {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Save plot not available in degraded mode');
        return;
    }

    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`,
    );
    const img = container.querySelector('img');

    if (!img) {
        displayVariablePlotError(variable, 'No plot to save');
        return;
    }

    const plotData = img.src.split(',')[1]; // Remove data:image/png;base64, prefix
    const filePath = globalState.currentDatasetFilePath || 'unknown_file';
    const fileName = generateDefaultFileName(filePath, variable);

    try {
        const result = await messageBus.savePlot(plotData, variable, fileName);
        if (result.success) {
            displayVariablePlotSuccess(
                variable,
                `Plot saved successfully: ${fileName}`,
            );
            console.log('Plot saved successfully:', result.filePath);
        } else {
            displayVariablePlotError(
                variable,
                `Failed to save plot: ${result.error}`,
            );
        }
    } catch (error) {
        console.error('Error saving plot:', error);
        displayVariablePlotError(
            variable,
            'Failed to save plot: ' + error.message,
        );
    }
}

async function handleSaveVariablePlotAs(variable) {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Save plot as not available in degraded mode');
        return;
    }

    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`,
    );
    const img = container.querySelector('img');

    if (!img) {
        displayVariablePlotError(variable, 'No plot to save');
        return;
    }

    const plotData = img.src.split(',')[1]; // Remove data:image/png;base64, prefix

    try {
        const result = await messageBus.savePlotAs(plotData, variable);
        if (result.success) {
            console.log('Plot saved as:', result.filePath);
        } else {
            if (result.error !== 'Save cancelled by user') {
                displayVariablePlotError(
                    variable,
                    `Failed to save plot: ${result.error}`,
                );
            }
        }
    } catch (error) {
        console.error('Error saving plot as:', error);
        displayVariablePlotError(
            variable,
            'Failed to save plot: ' + error.message,
        );
    }
}

async function handleOpenVariablePlot(variable) {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Open plot not available in degraded mode');
        return;
    }

    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`,
    );
    const img = container.querySelector('img');

    if (!img) {
        displayVariablePlotError(variable, 'No plot to open');
        return;
    }

    const plotData = img.src.split(',')[1]; // Remove data:image/png;base64, prefix
    const filePath = globalState.currentDatasetFilePath || 'unknown_file';
    const fileName = generateDefaultFileName(filePath, variable);

    try {
        await messageBus.openPlot(plotData, variable, fileName);
        // showVariablePlotSuccess(variable, `Plot opened: ${fileName}`);
    } catch (error) {
        console.error('Error opening plot:', error);
        displayVariablePlotError(
            variable,
            'Failed to open plot: ' + error.message,
        );
    }
}

async function handlePlotTypeSelect(variable) {
    const createButton = document.querySelector(
        `.create-plot-button[data-variable="${variable}"]`,
    );
    if (createButton) {
        createButton.disabled = false;
    }
}

// Scroll to header function
function doScrollToHeader(
    headerId,
    headerLabel,
    verticalOffset = 80,
    highlightTimeout = 3000,
) {
    console.log(`📋 Scrolling to header: ${headerLabel} (${headerId})`);

    // Try to find the element by ID first
    let element = document.getElementById(headerId);

    if (element) {
        // Ensure the element is visible by expanding ALL parent details if needed
        let currentElement = element;
        let openedCount = 0;

        // Walk up the DOM tree and open all parent details elements
        while (currentElement) {
            const parentDetails = currentElement.closest('details');
            if (parentDetails && !parentDetails.open) {
                parentDetails.open = true;
                openedCount++;
                const summary = parentDetails.querySelector('summary');
                const summaryText = summary
                    ? summary.textContent.trim()
                    : 'Unknown';
                console.log(`📋 Opened parent details: ${summaryText}`);
            }
            // Move up to the parent of the current details element to check for more nested details
            currentElement = parentDetails ? parentDetails.parentElement : null;
        }

        if (openedCount > 0) {
            console.log(
                `📋 Opened ${openedCount} parent details groups for: ${headerLabel}`,
            );
        }

        // Scroll to the element with offset to account for sticky headers
        const elementRect = element.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        const offsetPosition = absoluteElementTop - verticalOffset;

        window.scrollTo({
            top: Math.max(0, offsetPosition), // Ensure we don't scroll above the page
            behavior: 'smooth',
        });

        // Add a temporary highlight effect
        element.classList.add('highlighted');

        // Remove highlight after 3 seconds
        setTimeout(() => {
            element.classList.remove('highlighted');
        }, highlightTimeout);

        console.log(`📋 Successfully scrolled to header: ${headerLabel}`);
    } else {
        console.warn(`📋 Header not found: ${headerLabel} (${headerId})`);
        console.log(
            '📋 Available headers:',
            Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
                (h) => h.textContent.trim(),
            ),
        );
        console.log(
            '📋 Available summaries:',
            Array.from(document.querySelectorAll('summary')).map((s) =>
                s.textContent.trim(),
            ),
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeShowLogsCommand() {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Show logs command not available in degraded mode');
        return;
    }

    try {
        console.log('🔧 Executing show logs command...');
        await messageBus.sendRequest('executeCommand', {
            // TODO dehardcode and use CMD_SHOW_LOGS
            // Create sugar functions in the bus
            command: 'scientificDataViewer.showLogs',
        });
        console.log('🔧 Show logs command executed successfully');
    } catch (error) {
        console.error('❌ Failed to execute show logs command:', error);
        // Fallback: show a notification to the user
        displayGlobalError(
            'Failed to open extension logs. Please use Command Palette (Ctrl+Shift+P) → "Scientific Data Viewer: Show Extension Logs"',
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeInstallPackagesCommand(packages) {
    if (messageBus.isDegradedMode) {
        console.warn(
            '⚠️ Install packages command not available in degraded mode',
        );
        return;
    }

    try {
        console.log('🔧 Executing install packages command...', packages);
        await messageBus.sendRequest('executeCommand', {
            // TODO dehardcode and use CMD_PYTHON_INSTALL_PACKAGES
            // Create sugar functions in the bus
            command: 'scientificDataViewer.python.installPackages',
            args: [packages],
        });
        console.log('🔧 Install packages command executed successfully');
    } catch (error) {
        console.error('❌ Failed to execute install packages command:', error);
        // Fallback: show a notification to the user
        displayGlobalError(
            `Failed to install packages: ${error.message}. Please use Command Palette (Ctrl+Shift+P) → "Scientific Data Viewer: Install Python Packages"`,
        );
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeShowSettingsCommand() {
    if (messageBus.isDegradedMode) {
        console.warn('⚠️ Show settings command not available in degraded mode');
        return;
    }

    try {
        console.log('🔧 Executing show settings command...');
        await messageBus.sendRequest('executeCommand', {
            // TODO dehardcode and use CMD_SHOW_SETTINGS
            // Create sugar functions in the bus
            command: 'scientificDataViewer.showSettings',
        });
        console.log('🔧 Show settings command executed successfully');
    } catch (error) {
        console.error('❌ Failed to execute show settings command:', error);
        displayGlobalError(
            'Failed to open extension settings. Please use Command Palette (Ctrl+Shift+P) → "Scientific Data Viewer: Show Settings"',
        );
    }
}
