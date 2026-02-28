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
        timeout = 15000,
    ) {
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
                    `⏰ Plot request timed out after ${timeout}ms, aborting process: ${operationId}`,
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
                        `Plot request timeout: The plot generation took too long (>${timeout / 1000}s). The backend process has been terminated. Try selecting a smaller data subset or a simpler plot type.`,
                    ),
                );
            }, timeout);

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
    displayDataInfo(state.data.dataInfo, state.data.currentFile);
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
function displayDataInfo(data, filePath) {
    if (!data) {
        displayGlobalError('No data available');
        return;
    }

    if (data.error) {
        displayGlobalError(data.error);
        return;
    }

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
        // Display dimensions, coordinates, and variables for each group
        groupInfoContainer.innerHTML = groups
            .map((groupName) => renderGroup(data, groupName))
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
    } else {
        contentContainer.innerHTML = '<p>No data available</p>';
    }

    // Populate datetime variables
    populateDatetimeVariables(data);

    // Populate dimension slices (Issue #117)
    populateDimensionSlices(data);

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

function renderGroup(data, groupName) {
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

    // Add attributes for group
    const attributes = data.attributes_flattened[groupName];
    const attributesHtml =
        attributes && Object.keys(attributes).length > 0
            ? Object.entries(attributes)
                  .map(([attrName, value]) => {
                      return renderGroupAttributes(groupName, attrName, value);
                  })
                  .join('')
            : /*html*/ `<p class="muted-text">No attributes found in this group.</p>`;

    return /*html*/ `
        <div class="info-section" id="${joinId(['data-group', groupName])}">
            <details class="sticky-group-details"> <summary><h3>Group: ${groupName}</h3></summary>
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
            </div>
        </details>
        `;
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

// Populate datetime variable select
function populateDatetimeVariables(data) {
    const timeControlsSection = document.querySelector(
        '.time-controls-section',
    );
    if (!timeControlsSection) {
        return;
    }

    // data is already the result object (not wrapped in data.result)
    if (
        !data ||
        !data.datetime_variables ||
        Object.keys(data.datetime_variables).length === 0
    ) {
        console.log('No datetime variables found in data:', data);
        // Hide the time controls section if no datetime variables are available
        timeControlsSection.style.display = 'none';
        return;
    }

    // Show the time controls section
    timeControlsSection.style.display = 'block';

    const select = document.getElementById('datetimeVariableSelect');
    if (!select) {
        return;
    }

    // Clear existing options
    select.innerHTML = '<option value="">Select datetime variable...</option>';

    console.log('Found datetime variables:', data.datetime_variables);

    // Collect all datetime variables from all groups with min/max values
    const datetimeVars = [];
    const datetimeVarsMap = new Map(); // Map fullPath -> {name, fullPath, group, min, max}

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
            datetimeVars.push(varData);
            datetimeVarsMap.set(fullPath, varData);
        }
    }

    console.log('Collected datetime variables:', datetimeVars);

    // Add options
    datetimeVars.forEach(({ name, fullPath }) => {
        const option = document.createElement('option');
        option.value = fullPath;
        option.textContent = name;
        select.appendChild(option);
    });

    // Store the map for later use when selecting datetime variables
    globalTimeControlsState.datetimeVarsMap = datetimeVarsMap;
}

// Populate dimension slice inputs and facet dropdowns (Issue #117)
function populateDimensionSlices(data) {
    const section = document.querySelector('.dimension-slices-section');
    if (!section) {
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
    const groupNames = Object.keys(data.dimensions_flattened);
    const firstGroup = groupNames[0] || '/';
    const dimensions = data.dimensions_flattened[firstGroup];
    if (!dimensions || Object.keys(dimensions).length === 0) {
        container.innerHTML = '<p class="muted-text">No dimensions in this group.</p>';
        const facetRowSelect = document.getElementById('facetRowSelect');
        const facetColSelect = document.getElementById('facetColSelect');
        if (facetRowSelect) {
            facetRowSelect.innerHTML = '<option value="">None</option>';
        }
        if (facetColSelect) {
            facetColSelect.innerHTML = '<option value="">None</option>';
        }
        return;
    }
    const dimNames = Object.keys(dimensions);
    container.innerHTML = dimNames
        .map(
            (dimName) =>
                `<div class="dimension-slice-row">
                    <label for="dim-slice-${dimName}">${escapeHtml(dimName)} (${dimensions[dimName]}):</label>
                    <input type="text" id="dim-slice-${dimName}" class="dimension-slice-input" data-dimension="${escapeHtml(dimName)}" placeholder="e.g. 0:24:2 or 130" />
                </div>`,
        )
        .join('');
    const facetRowSelect = document.getElementById('facetRowSelect');
    const facetColSelect = document.getElementById('facetColSelect');
    const facetOptions = '<option value="">None</option>' + dimNames.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    if (facetRowSelect) {
        facetRowSelect.innerHTML = facetOptions;
    }
    if (facetColSelect) {
        facetColSelect.innerHTML = facetOptions;
    }
}

function getDimensionSlicesState() {
    const dimensionSlices = {};
    const inputs = document.querySelectorAll('.dimension-slice-input');
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
    return {
        dimensionSlices: Object.keys(dimensionSlices).length ? dimensionSlices : null,
        facetRow: facetRowSelect && facetRowSelect.value ? facetRowSelect.value : '',
        facetCol: facetColSelect && facetColSelect.value ? facetColSelect.value : '',
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

    const clearDimSlicesButton = document.getElementById('clearDimensionSlicesButton');
    if (clearDimSlicesButton) {
        clearDimSlicesButton.addEventListener('click', () => {
            document.querySelectorAll('.dimension-slice-input').forEach((input) => {
                input.value = '';
            });
            const facetRowSelect = document.getElementById('facetRowSelect');
            const facetColSelect = document.getElementById('facetColSelect');
            if (facetRowSelect) {
                facetRowSelect.value = '';
            }
            if (facetColSelect) {
                facetColSelect.value = '';
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

function captureWebviewContent() {
    console.log('🖼️ Capturing webview content...');

    try {
        // Get the current document HTML
        const htmlContent = document.documentElement.outerHTML;
        console.log(
            '🖼️ Content captured, size:',
            htmlContent.length,
            'characters',
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

    const { dimensionSlices, facetRow, facetCol } = getDimensionSlicesState();

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

        // Check if cancelled before starting
        if (plotAllCancelled) {
            return {
                variable,
                success: false,
                error: 'Cancelled',
                skipped: true,
            };
        }

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

    // Get time control values - also read directly from inputs as fallback
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

    const { dimensionSlices, facetRow, facetCol } = getDimensionSlicesState();

    console.log('Creating plot with time controls:', {
        datetimeVariableName,
        startDatetime,
        endDatetime,
        startDatetimeISO,
        endDatetimeISO,
        dimensionSlices,
        facetRow,
        facetCol,
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
