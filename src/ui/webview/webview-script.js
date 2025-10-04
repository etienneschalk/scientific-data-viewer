/**
 * Webview JavaScript for Scientific Data Viewer
 * Generated from JavaScriptGenerator.ts
 */

const vscode = acquireVsCodeApi();

// Initialization
function initialize() {
    console.log('🔧 WebView initialized - starting debug session');
    console.log('📍 Current location:', window.location);
    console.log('📍 Pathname:', window.location.pathname);
    console.log('📍 Search:', window.location.search);
    console.log('📍 Hash:', window.location.hash);

    // Set up event listeners
    setupEventListeners();
    setupMessageHandlers();

    console.log(
        '🚀 WebView initialized - waiting for data to be loaded via message system...'
    );
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initialize();
    });
} else {
    // DOM is already loaded
    initialize();
}

// Global state for file path
const globalState = {
    currentDatasetFilePath: null,
};

// Global state for plot all operation
const globalStatePlotAllOperation = {
    isRunning: false,
    completedCount: 0,
    totalCount: 0,
};

class WebviewMessageBus {
    constructor(vscode) {
        this.vscode = vscode;
        this.pendingRequests = new Map();
        this.eventListeners = new Map();
        this.setupMessageListener();
    }

    setupMessageListener() {
        window.addEventListener('message', (event) => {
            const message = event.data;

            if (message.type === 'response') {
                this.handleResponse(message);
            } else if (message.type === 'event') {
                this.handleEvent(message);
            }
        });
    }

    // Send a request and wait for response
    async sendRequest(command, payload, timeout = 60000) {
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
                `Received response for unknown request: ${message.requestId}`
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
                        error
                    );
                }
            });
        }
    }

    // Convenience methods for common operations
    async getDataInfo(filePath) {
        return this.sendRequest('getDataInfo', { filePath });
    }

    async createPlot(variable, plotType) {
        return this.sendRequest('createPlot', { variable, plotType });
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
}

const messageBus = new WebviewMessageBus(vscode);

// Utility functions
function escapeHtml(unsafe) {
    return unsafe
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatFileSize(bytes) {
    const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

function updateTimestamp(isoString, isLoading = false) {
    const timestampElement = document.getElementById('timestamp');
    const timestampText = document.getElementById('timestampText');

    if (isLoading) {
        timestampText.textContent = 'Loading...';
        timestampElement.classList.remove('hidden');
    } else if (isoString) {
        const date = new Date(isoString);
        const timeString = date.toLocaleTimeString();
        timestampText.textContent = `Last loaded: ${timeString}`;
        timestampElement.classList.remove('hidden');
    } else {
        timestampElement.classList.add('hidden');
    }
}

// Display functions
function displayDataInfo(data, filePath) {
    if (!data) {
        showError('No data available');
        return;
    }

    if (data.error) {
        showError(data.error);
        return;
    }

    // Store current file path for plot operations
    globalState.currentDatasetFilePath = filePath;

    // Hide any previous errors since data loaded successfully
    hideError();

    // Display file path in code format with copy button
    const filePathContainer = document.getElementById('filePathContainer');
    const filePathCode = document.getElementById('filePathCode');
    if (filePath) {
        filePathCode.textContent = filePath;
        filePathContainer.classList.remove('hidden');
    } else {
        filePathContainer.classList.add('hidden');
    }

    // Display file information
    const fileInfo = document.getElementById('fileInfo');
    let formatInfo = '';

    if (data.fileSize) {
        formatInfo += /*html*/ `<strong>Size:</strong> ${formatFileSize(
            data.fileSize
        )} · `;
    }

    formatInfo += /*html*/ `<strong>Format:</strong> ${
        data.format || 'Unknown'
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

    fileInfo.innerHTML = /*html*/ `<p>${formatInfo}</p>`;

    const groupInfoContainer = document.getElementById('group-info-container');
    groupInfoContainer.classList.remove('hidden');

    // Assumption: dimensions_flattened and coordinates_flattened and variables_flattened
    //  are always present together and have the same group keys.
    const groups = Object.keys(data.dimensions_flattened);

    if (
        data.dimensions_flattened &&
        data.coordinates_flattened &&
        data.variables_flattened
    ) {
        // Display dimensions, coordinates, and variables for each group
        groupInfoContainer.innerHTML = groups
            .map((groupName) => {
                const groupId = `group-${groupName.replace(
                    /[^a-zA-Z0-9]/g,
                    '-'
                )}`;

                // Add dimensions for group
                const dimensions = data.dimensions_flattened[groupName];
                const dimensionsHtml =
                    dimensions && Object.keys(dimensions).length > 0
                        ? /*html*/ `<div class="dimensions-compact">
                        (${Object.entries(dimensions)
                            .map(
                                ([name, size]) =>
                                    `<strong id="${groupId}-dim-${name}">${name}</strong>: ${size}`
                            )
                            .join(', ')})
                    </div>`
                        : /*html*/ `<p>No dimensions found in this group.</p>`;

                // Add coordinates for group
                const coordinates = data.coordinates_flattened[groupName];
                const coordinatesHtml =
                    coordinates && coordinates.length > 0
                        ? coordinates
                              .map((variable) => {
                                  const shapeStr = variable.shape
                                      ? `(${variable.shape.join(', ')})`
                                      : '';
                                  const dimsStr = variable.dimensions
                                      ? `(${variable.dimensions.join(', ')})`
                                      : '';
                                  const sizeStr = variable.size_bytes
                                      ? `${formatFileSize(variable.size_bytes)}`
                                      : '';
                                  const coordId = `${groupId}-coord-${variable.name}`;
                                  const hasAttributes =
                                      variable.attributes &&
                                      Object.keys(variable.attributes).length >
                                          0;

                                  const attributesContent = hasAttributes
                                      ? generateAttributesContent(
                                            variable.attributes
                                        )
                                      : '';

                                  return /*html*/ `
                            <details class="variable-details" id="${coordId}" data-variable="${
                                      variable.name
                                  }">
                                <summary class="variable-summary ${
                                    hasAttributes ? '' : 'not-clickable'
                                }">
                                    <span class="variable-name" title="${
                                        variable.name
                                    }">${variable.name}</span>
                                    <span class="dims" title="${dimsStr}">${dimsStr}</span>
                                    <span class="dtype-shape" title="${escapeHtml(
                                        variable.dtype
                                    )}">
                                        <code>${escapeHtml(
                                            variable.dtype
                                        )}</code>
                                    </span>
                                    <span class="dtype-shape" title="${shapeStr}">
                                        ${shapeStr}
                                    </span>
                                    ${
                                        sizeStr
                                            ? `<span class="size">${sizeStr}</span>`
                                            : ''
                                    }
                                </summary>
                                ${attributesContent}
                            </details>
                        `;
                              })
                              .join('')
                        : /*html*/ `<p>No coordinates found in this group.</p>`;

                // Add variables for group
                const variables = data.variables_flattened[groupName];
                const variablesHtml =
                    variables && variables.length > 0
                        ? variables
                              .map((variable) => {
                                  const shapeStr = variable.shape
                                      ? `(${variable.shape.join(', ')})`
                                      : '';
                                  const dimsStr = variable.dimensions
                                      ? `(${variable.dimensions.join(', ')})`
                                      : '';
                                  const sizeStr = variable.size_bytes
                                      ? `${formatFileSize(variable.size_bytes)}`
                                      : '';
                                  const varId = `${groupId}-var-${variable.name}`;
                                  const hasAttributes =
                                      variable.attributes &&
                                      Object.keys(variable.attributes).length >
                                          0;

                                  const attributesContent = hasAttributes
                                      ? generateAttributesContent(
                                            variable.attributes
                                        )
                                      : '';

                                  // For datatree variables, use full path (group/variable) for plotting
                                  const fullVariableName = `${
                                      groupName == '/' ? '' : groupName
                                  }/${variable.name}`;
                                  const plotControls =
                                      generateVariablePlotControls(
                                          fullVariableName
                                      );

                                  return /*html*/ `
                            <details class="variable-details" id="${varId}" data-variable="${fullVariableName}">
                                <summary class="variable-summary ${
                                    hasAttributes ? '' : 'not-clickable'
                                }">
                                    <span class="variable-name" title="${fullVariableName}">${
                                      variable.name
                                  }</span>
                                    <span class="dims" title="${dimsStr}">${dimsStr}</span>
                                    <span class="dtype-shape" title="${escapeHtml(
                                        variable.dtype
                                    )}">
                                        <code>${escapeHtml(
                                            variable.dtype
                                        )}</code>
                                    </span>
                                    <span class="dtype-shape" title="${shapeStr}">
                                        ${shapeStr}
                                    </span>
                                    ${
                                        sizeStr
                                            ? `<span class="size">${sizeStr}</span>`
                                            : ''
                                    }
                                </summary>
                                ${attributesContent}
                            </details>
                            ${plotControls}
                        `;
                              })
                              .join('')
                        : /*html*/ `<p>No variables found in this group.</p>`;

                // Add attributes for group
                const attributes = data.attributes_flattened[groupName];
                const attributesHtml =
                    attributes && Object.keys(attributes).length > 0
                        ? Object.entries(attributes)
                              .map(([attrName, value]) => {
                                  const attrId = `${groupId}-attr-${attrName}`;
                                  const valueStr =
                                      typeof value === 'string'
                                          ? value
                                          : JSON.stringify(value);

                                  return /*html*/ `
                            <div class="attribute-item" id="${attrId}">
                                <span class="attribute-name" title="${attrName}">${attrName} : </span>
                                <span class="attribute-value" title="${valueStr}">${valueStr}</span>
                            </div>
                        `;
                              })
                              .join('')
                        : /*html*/ `<p class="attribute-value">No attributes found in this group.</p>`;

                return /*html*/ `
                <div class="info-section" id="${groupId}">
                    <details class="sticky-group-details"> <summary><h3>Group: ${groupName}</h3></summary>
                        <div class="info-section" id="${groupId}-dimensions">
                            <details class="" open> <summary><h4>Dimensions</h4></summary>
                                <div class="dimensions">
                                    ${dimensionsHtml}
                                </div>
                            </details>  
                        </div>  
                        <div class="info-section" id="${groupId}-coordinates">
                            <details class="" open> <summary><h4>Coordinates</h4></summary>
                                <div class="coordinates">
                                    ${coordinatesHtml}
                                </div>
                            </details>
                        </div>
                        <div class="info-section" id="${groupId}-variables">
                            <details class="" open> <summary><h4>Variables</h4></summary>
                                <div class="variables">
                                    ${variablesHtml}
                                </div>  
                            </details>
                        </div>
                        <div class="info-section" id="${groupId}-attributes">
                            <details class="" open> <summary><h4>Attributes</h4></summary>
                                <div class="attributes">
                                    ${attributesHtml}
                                </div>  
                            </details>
                        </div>
                    </div>
                </details>
                `;
            })
            .join('');
        // Open the first group by default
        groupInfoContainer
            .querySelector('details')
            .setAttribute('open', 'open');
    } else {
        contentContainer.innerHTML = '<p>No data available</p>';
    }

    // Enable create plot buttons for all variables
    if (data.variables_flattened) {
        // Enable buttons for datatree variables
        Object.keys(data.variables_flattened).forEach((groupName) => {
            data.variables_flattened[groupName].forEach((variable) => {
                const fullVariableName = `${
                    groupName == '/' ? '' : groupName
                }/${variable.name}`;
                const createButton = document.querySelector(
                    `.create-plot-button[data-variable="${fullVariableName}"]`
                );
                if (createButton) {
                    createButton.disabled = false;
                }
            });
        });
    }

    // Show content
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
}

// Plotting functions
function populateVariableSelect(variables) {
    const select = document.getElementById('variableSelect');
    select.innerHTML = /*html*/ `<option value="">Select a variable...</option>`;
    variables.forEach((variable) => {
        const option = document.createElement('option');
        option.value = variable.name;
        option.textContent = variable.name;
        select.appendChild(option);
    });
}

function displayPlot(plotData) {
    const container = document.getElementById('plotContainer');
    const plotControls = document.getElementById('plotControls');

    // Hide any previous errors
    hidePlotError();

    if (plotData && plotData.startsWith('iVBOR')) {
        container.innerHTML = /*html*/ `<img src="data:image/png;base64,${plotData}" alt="Plot">`;
        plotControls.classList.remove('hidden');
    } else {
        // Clear the container and show error in the dedicated error element
        container.innerHTML = '';
        showPlotError('Error creating plot: Python script failed');
        plotControls.classList.add('hidden');
    }
}

// Representation display functions
function displayHtmlRepresentation(htmlData, isDatatree = false) {
    const container = isDatatree
        ? document.getElementById('htmlRepresentationForGroups')
        : document.getElementById('htmlRepresentation');
    container.parentElement.parentElement.classList.remove('hidden');

    if (htmlData) {
        if (isDatatree && typeof htmlData === 'object' && htmlData !== null) {
            // Handle datatree flattened HTML representations
            const groups = Object.keys(htmlData);
            container.innerHTML = /*html*/ `
                    ${groups
                        .map(
                            (groupName) => `
                        <div class="info-section" id="html-representation-for-groups-${groupName.replace(
                            /[^a-zA-Z0-9]/g,
                            '-'
                        )}">
                            <details> <summary>${groupName}</summary>
                                <div class="html-representation">
                                    ${
                                        htmlData[groupName] ||
                                        /*html*/ `<p>No HTML representation available</p>`
                                    }
                                </div>
                            </details>
                        </div>
                    `
                        )
                        .join('')}
            `;
        } else {
            // Handle regular HTML representation
            container.innerHTML = htmlData;
        }
    } else {
        container.innerHTML = '<p>Failed to load HTML representation</p>';
    }
}

function displayTextRepresentation(textData, isDatatree = false) {
    const container = isDatatree
        ? document.getElementById('textRepresentationForGroups')
        : document.getElementById('textRepresentation');
    container.parentElement.parentElement.classList.remove('hidden');
    if (textData) {
        if (isDatatree && typeof textData === 'object' && textData !== null) {
            // Handle datatree flattened text representations
            const groups = Object.keys(textData);
            container.innerHTML = /*html*/ `
                    ${groups
                        .map(
                            (groupName) => /*html*/ `
                        <div class="info-section" id="text-representation-for-groups-${groupName.replace(
                            /[^a-zA-Z0-9]/g,
                            '-'
                        )}">
                            <details> <summary>${groupName}</summary>
                                <div class="text-representation-container">
                                    <button id="textCopyButton-${groupName}" data-group="${groupName}" class="text-copy-button">
                                        📋 Copy
                                    </button>
                                    <div class="text-representation" id="textRepresentation-${groupName}">
                                </div>
                            </div>
                            </details>
                        </div>
                    `
                        )
                        .join('')}
            `;
            for (const groupName in textData) {
                const textRepresentation = document.getElementById(
                    `textRepresentation-${groupName}`
                );
                textRepresentation.textContent = textData[groupName];
            }
        } else {
            const copyButton = document.getElementById('textCopyButton');
            // Handle regular text representation
            container.textContent = textData;
            copyButton.classList.remove('hidden');
        }
    } else {
        container.textContent = 'Failed to load text representation';
        copyButton.classList.add('hidden');
    }
}

function displayShowVersions(versionsData) {
    const container = document.getElementById('showVersions');
    const copyButton = document.getElementById('showVersionsCopyButton');
    if (versionsData) {
        container.textContent = versionsData;
        copyButton.classList.remove('hidden');
    } else {
        container.textContent = 'Failed to load version information';
        copyButton.classList.add('hidden');
    }
}

function displayPythonPath(pythonPath) {
    const container = document.getElementById('pythonPath');
    const copyButton = document.getElementById('pythonPathCopyButton');
    if (pythonPath) {
        container.textContent = pythonPath;
        copyButton.classList.remove('hidden');
    } else {
        container.textContent = 'No Python interpreter configured';
        copyButton.classList.add('hidden');
    }
}

function displayExtensionConfig(configData) {
    const container = document.getElementById('extensionConfig');
    const copyButton = document.getElementById('extensionConfigCopyButton');
    if (configData) {
        container.textContent = JSON.stringify(configData, null, 2);
        copyButton.classList.remove('hidden');
    } else {
        container.textContent = 'Failed to load extension configuration';
        copyButton.classList.add('hidden');
    }
}

// Error handling functions
function showError(message, details = '', errorType = '', formatInfo = null) {
    const errorDiv = document.getElementById('error');

    // Format message to handle multi-line errors
    const formattedMessage = message.replace(/\n/g, '<br>');
    const formattedDetails = details ? details.replace(/\n/g, '<br>') : '';

    let troubleshootingSteps = /*html*/ `
        <h4>💡 Generic Troubleshooting Steps:</h4>
        <ol>
            <li>Make sure Python is installed and accessible</li>
            <li>Use Command Palette (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) → "Python: Select Interpreter"</li>
            <li>Install required packages: <code>pip install xarray matplotlib</code></li>
            <li>Check file format is supported (.nc, .netcdf, .zarr, .h5, .hdf5, .grib, .grib2, .grb, .tif, .tiff, .geotiff, .jp2, .jpeg2000, .safe, .nc4, .cdf)</li>
            <li><a href="#" onclick="executeShowLogsCommand()">Check VSCode Output panel</a> for more details (choose "Scientific Data Viewer" from the dropdown)</li>
            <li>Refresh the Python environment: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → "Scientific Data Viewer: Refresh Python Environment"</li>
            <li>In doubt, close and reopen the file</li>
        </ol>
        <p>If you need more help, please report the issue on the <a href="https://github.com/etienneschalk/scientific-data-viewer/issues" target="_blank">Scientific Data Viewer GitHub repository</a>.</p>
    `;

    // Add specific troubleshooting for missing packages
    if (
        errorType === 'ImportError' &&
        formatInfo &&
        formatInfo.missing_packages
    ) {
        troubleshootingSteps = /*html*/ `
            <h4>💡 Missing Dependencies:</h4>
            <p>This file format requires additional packages that are not installed:</p>
            <ul>
                <li><strong>Missing packages:</strong> ${formatInfo.missing_packages.join(
                    ', '
                )}</li>
                <li><strong>File format:</strong> ${formatInfo.display_name} (${
            formatInfo.extension
        })</li>
            </ul>
            <p><strong>Installation command:</strong></p>
            <code>pip install ${formatInfo.missing_packages.join(' ')}</code>
            <p style="margin-top: 10px;">After installation, refresh the data viewer to try again.</p>
        `;
    }

    errorDiv.innerHTML = /*html*/ `
        <h3>❌ Error</h3>
        <p><strong>Message:</strong> ${formattedMessage}</p>
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

    // Hide refresh button when error is displayed
    const headerControls = document.getElementById('header-controls');
    if (headerControls) {
        headerControls.classList.add('hidden');
    }
}

function hideError() {
    const errorDiv = document.getElementById('error');
    errorDiv.classList.add('hidden');
    errorDiv.innerHTML = '';

    // Show refresh button when error is cleared
    const headerControls = document.getElementById('header-controls');
    if (headerControls) {
        headerControls.classList.remove('hidden');
    }
}

// Plot-specific error handling
function showPlotError(message) {
    const plotError = document.getElementById('plotError');
    if (plotError) {
        // Format message to handle multi-line errors
        const formattedMessage = message.replace(/\n/g, '<br>');
        plotError.innerHTML = formattedMessage;
        plotError.classList.remove('hidden');
        plotError.classList.remove('success');
        plotError.classList.add('error');
    }
}

function showPlotSuccess(message) {
    const plotError = document.getElementById('plotError');
    if (plotError) {
        // Format message to handle multi-line messages
        const formattedMessage = message.replace(/\n/g, '<br>');
        plotError.innerHTML = formattedMessage;
        plotError.classList.remove('hidden');
        plotError.classList.remove('error');
        plotError.classList.add('success');
    }
}

function hidePlotError() {
    const plotError = document.getElementById('plotError');
    if (plotError) {
        plotError.classList.add('hidden');
        plotError.textContent = '';
        plotError.classList.remove('error', 'success');
    }
}

// Plot control functions
function resetPlot() {
    const container = document.getElementById('plotContainer');
    const plotControls = document.getElementById('plotControls');
    const plotError = document.getElementById('plotError');

    container.innerHTML = '';
    plotControls.classList.add('hidden');
    hidePlotError();
}

// Per-variable plot functions
function showVariablePlotLoading(variable) {
    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`
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
        `.plot-container[data-variable="${variable}"]`
    );
    const imageContainer = container.querySelector('.plot-image-container');
    const plotError = container.querySelector('.plot-error');

    // Hide any previous errors
    hideVariablePlotError(variable);

    if (plotData && plotData.startsWith('iVBOR')) {
        imageContainer.innerHTML = /*html*/ `<img src="data:image/png;base64,${plotData}" alt="Plot for ${variable}">`;
        container.style.display = 'block';
    } else {
        // Clear the image container and show error in the dedicated error element
        imageContainer.innerHTML = '';
        showVariablePlotError(
            variable,
            'Error creating plot: Python script failed'
        );
        container.style.display = 'block';
    }
}

function resetVariablePlot(variable) {
    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`
    );
    const imageContainer = container.querySelector('.plot-image-container');

    imageContainer.innerHTML = '';
    container.style.display = 'none';
    hideVariablePlotError(variable);
}

function resetAllPlots() {
    const containers = document.querySelectorAll('.plot-container');
    containers.forEach((container) => {
        const imageContainer = container.querySelector('.plot-image-container');
        imageContainer.innerHTML = '';
        container.style.display = 'none';
        const variable = container.getAttribute('data-variable');
        hideVariablePlotError(variable);
    });
}

function showVariablePlotError(variable, message) {
    const plotError = document.querySelector(
        `.plot-error[data-variable="${variable}"]`
    );
    if (plotError) {
        // Format message to handle multi-line errors
        const formattedMessage = message.replace(/\n/g, '<br>');
        plotError.innerHTML = /*html*/ `
            <div class="error-content">
                <button class="error-copy-button" data-variable="${variable}" title="Copy error message">
                    📋 Copy
                </button>
                <div class="error-message">${formattedMessage}</div>
            </div>
        `;
        plotError.classList.remove('hidden');
        plotError.classList.remove('success');
        plotError.classList.add('error');
    }
}

function showVariablePlotSuccess(variable, message) {
    const plotError = document.querySelector(
        `.plot-error[data-variable="${variable}"]`
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
        `.plot-error[data-variable="${variable}"]`
    );
    if (plotError) {
        plotError.classList.add('hidden');
        plotError.textContent = '';
        plotError.classList.remove('error', 'success');
    }
}

async function saveVariablePlot(variable) {
    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`
    );
    const img = container.querySelector('img');

    if (!img) {
        showVariablePlotError(variable, 'No plot to save');
        return;
    }

    const plotData = img.src.split(',')[1]; // Remove data:image/png;base64, prefix
    const filePath = globalState.currentDatasetFilePath || 'unknown_file';
    const fileName = generateDefaultFileName(variable, filePath);

    try {
        const result = await messageBus.savePlot(plotData, variable, fileName);
        if (result.success) {
            showVariablePlotSuccess(
                variable,
                `Plot saved successfully: ${fileName}`
            );
            console.log('Plot saved successfully:', result.filePath);
        } else {
            showVariablePlotError(
                variable,
                `Failed to save plot: ${result.error}`
            );
        }
    } catch (error) {
        console.error('Error saving plot:', error);
        showVariablePlotError(
            variable,
            'Failed to save plot: ' + error.message
        );
    }
}

async function saveVariablePlotAs(variable) {
    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`
    );
    const img = container.querySelector('img');

    if (!img) {
        showVariablePlotError(variable, 'No plot to save');
        return;
    }

    const plotData = img.src.split(',')[1]; // Remove data:image/png;base64, prefix

    try {
        const result = await messageBus.savePlotAs(plotData, variable);
        if (result.success) {
            showVariablePlotSuccess(
                variable,
                `Plot saved as: ${
                    result.filePath?.split('/').pop() || 'plot.png'
                }`
            );
            console.log('Plot saved as:', result.filePath);
        } else {
            if (result.error !== 'Save cancelled by user') {
                showVariablePlotError(
                    variable,
                    `Failed to save plot: ${result.error}`
                );
            }
        }
    } catch (error) {
        console.error('Error saving plot as:', error);
        showVariablePlotError(
            variable,
            'Failed to save plot: ' + error.message
        );
    }
}

async function openVariablePlot(variable) {
    const container = document.querySelector(
        `.plot-container[data-variable="${variable}"]`
    );
    const img = container.querySelector('img');

    if (!img) {
        showVariablePlotError(variable, 'No plot to open');
        return;
    }

    const plotData = img.src.split(',')[1]; // Remove data:image/png;base64, prefix
    const filePath = globalState.currentDatasetFilePath || 'unknown_file';
    const fileName = generateDefaultFileName(variable, filePath);

    try {
        await messageBus.openPlot(plotData, variable, fileName);
        // showVariablePlotSuccess(variable, `Plot opened: ${fileName}`);
    } catch (error) {
        console.error('Error opening plot:', error);
        showVariablePlotError(
            variable,
            'Failed to open plot: ' + error.message
        );
    }
}

async function copyPlotError(variable) {
    try {
        const plotError = document.querySelector(
            `.plot-error[data-variable="${variable}"]`
        );
        if (!plotError) {
            return;
        }

        const errorMessage = plotError.querySelector('.error-message');
        if (!errorMessage) {
            return;
        }

        // Get the HTML content and convert <br> tags to newlines
        const htmlContent = errorMessage.innerHTML || '';
        const textContent = htmlContent.replace(/<br\s*\/?>/gi, '\n');

        await navigator.clipboard.writeText(textContent);

        // Show feedback
        const copyButton = plotError.querySelector('.error-copy-button');
        if (copyButton) {
            const originalText = copyButton.textContent;
            copyButton.textContent = '✓ Copied!';
            copyButton.style.color = '#4caf50';

            // Reset after 2 seconds
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.style.color = '';
            }, 2000);
        }
    } catch (error) {
        console.error('Failed to copy error message:', error);
        // Fallback: show the error message in an alert
        const plotError = document.querySelector(
            `.plot-error[data-variable="${variable}"]`
        );
        if (plotError) {
            const errorMessage = plotError.querySelector('.error-message');
            if (errorMessage) {
                const htmlContent = errorMessage.innerHTML || '';
                const textContent = htmlContent.replace(/<br\s*\/?>/gi, '\n');
                alert('Error message:\n\n' + textContent);
            }
        }
    }
}

async function plotAllVariables() {
    console.log('🔍 Plot All Variables - Debug Info:');

    // Check if operation is already running
    if (globalStatePlotAllOperation.isRunning) {
        console.log('Plot all operation already running');
        return;
    }

    // Get all variables to plot
    const buttons = document.querySelectorAll('.create-plot-button');
    if (buttons.length === 0) {
        console.log('No variables to plot');
        return;
    }

    // Initialize operation state
    globalStatePlotAllOperation.isRunning = true;
    globalStatePlotAllOperation.completedCount = 0;
    globalStatePlotAllOperation.totalCount = buttons.length;

    // Update UI to show operation in progress
    updatePlotAllUI(true);

    // Prepare all plot operations
    const plotPromises = Array.from(buttons).map(async (button) => {
        const variable = button.getAttribute('data-variable');
        const plotTypeSelect = document.querySelector(
            `.plot-type-select[data-variable="${variable}"]`
        );
        const plotType = plotTypeSelect ? plotTypeSelect.value : 'auto';

        // Show loading indicator
        showVariablePlotLoading(variable);

        try {
            const plotData = await messageBus.createPlot(variable, plotType);
            displayVariablePlot(variable, plotData);
            globalStatePlotAllOperation.completedCount++;
            updatePlotAllProgress();

            return { variable, success: true };
        } catch (error) {
            console.error('Failed to create plot:', error);

            // Clear loading state and show error
            const container = document.querySelector(
                `.plot-container[data-variable="${variable}"]`
            );
            const imageContainer = container.querySelector(
                '.plot-image-container'
            );
            imageContainer.innerHTML = '';
            showVariablePlotError(
                variable,
                'Error creating plot: ' + error.message
            );

            globalStatePlotAllOperation.completedCount++;
            updatePlotAllProgress();

            return { variable, success: false, error: error.message };
        }
    });

    try {
        // Wait for all plots to complete (or fail)
        const results = await Promise.allSettled(plotPromises);

        // Log results
        const successful = results.filter(
            (r) => r.status === 'fulfilled' && r.value.success
        ).length;
        const failed = results.length - successful;

        console.log(
            `Plot all completed: ${successful} successful, ${failed} failed`
        );

        // Show completion message
        try {
            await messageBus.showNotification(
                `Plot all completed: ${successful} successful, ${failed} failed`,
                failed > 0 ? 'warning' : 'info'
            );
        } catch (notificationError) {
            console.error('Failed to show notification:', notificationError);
        }
    } catch (error) {
        console.error('Error in plot all operation:', error);
    } finally {
        // Reset operation state
        globalStatePlotAllOperation.isRunning = false;
        globalStatePlotAllOperation.completedCount = 0;
        globalStatePlotAllOperation.totalCount = 0;

        // Update UI to show operation completed
        updatePlotAllUI(false);
    }
}

function updatePlotAllUI(isRunning) {
    const plotAllButton = document.getElementById('plotAllButton');
    const plotAllProgress = document.getElementById('plotAllProgress');

    if (isRunning) {
        // Show progress
        if (plotAllButton) {
            plotAllButton.disabled = true;
            plotAllButton.textContent = 'Plotting...';
        }
        if (plotAllProgress) {
            plotAllProgress.classList.remove('hidden');
            plotAllProgress.textContent = 'Starting...';
        }
    } else {
        // Reset to normal state
        if (plotAllButton) {
            plotAllButton.disabled = false;
            plotAllButton.textContent = '⚠️ Plot All';
        }
        if (plotAllProgress) {
            plotAllProgress.classList.add('hidden');
            plotAllProgress.textContent = '';
        }
    }
}

function updatePlotAllProgress() {
    const plotAllProgress = document.getElementById('plotAllProgress');
    if (
        plotAllProgress &&
        globalStatePlotAllOperation.isRunning &&
        globalStatePlotAllOperation.totalCount > 0
    ) {
        const percentage = Math.round(
            (globalStatePlotAllOperation.completedCount / globalStatePlotAllOperation.totalCount) *
                100
        );
        plotAllProgress.textContent = `Progress: ${globalStatePlotAllOperation.completedCount}/${globalStatePlotAllOperation.totalCount} (${percentage}%)`;
    }
}

async function saveAllPlots() {
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
            const filePath = globalState.currentDatasetFilePath || 'unknown_file';
            const fileName = generateDefaultFileName(variable, filePath);
            const result = await messageBus.savePlot(
                plotData,
                variable,
                fileName
            );
            if (result.success) {
                showVariablePlotSuccess(variable, `Plot saved: ${fileName}`);
            } else {
                showVariablePlotError(
                    variable,
                    `Failed to save: ${result.error}`
                );
            }
        }
    } catch (error) {
        console.error('Error saving all plots:', error);
        try {
            await messageBus.showNotification(
                'Failed to save all plots: ' + error.message,
                'error'
            );
        } catch (notificationError) {
            console.error('Failed to show notification:', notificationError);
        }
    }
}

function generateDefaultFileName(variable, filePath) {
    const fileName = filePath.split('/').pop();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    if (variable.includes('/')) {
        // Variable is a full path starting with /
        return `sdv-plots/${fileName}${variable}_${timestamp}.png`;
    } else {
        return `sdv-plots/${fileName}/${variable}_${timestamp}.png`;
    }
}

async function savePlot() {
    const container = document.getElementById('plotContainer');
    const img = container.querySelector('img');

    if (!img) {
        showPlotError('No plot to save');
        return;
    }

    const plotData = img.src.split(',')[1]; // Remove data:image/png;base64, prefix
    const variable = document.getElementById('variableSelect').value;
    const filePath = globalState.currentDatasetFilePath || 'unknown_file';
    const fileName = generateDefaultFileName(variable, filePath);

    try {
        const result = await messageBus.savePlot(plotData, variable, fileName);
        if (result.success) {
            // Show success message in the plot area
            showPlotSuccess(`Plot saved successfully: ${fileName}`);
            console.log('Plot saved successfully:', result.filePath);
        } else {
            showPlotError(`Failed to save plot: ${result.error}`);
        }
    } catch (error) {
        console.error('Error saving plot:', error);
        showPlotError('Failed to save plot: ' + error.message);
    }
}

async function savePlotAs() {
    const container = document.getElementById('plotContainer');
    const img = container.querySelector('img');

    if (!img) {
        showPlotError('No plot to save');
        return;
    }

    const plotData = img.src.split(',')[1]; // Remove data:image/png;base64, prefix
    const variable = document.getElementById('variableSelect').value;

    try {
        const result = await messageBus.savePlotAs(plotData, variable);
        if (result.success) {
            // Show success message in the plot area
            showPlotSuccess(
                `Plot saved as: ${
                    result.filePath?.split('/').pop() || 'plot.png'
                }`
            );
            console.log('Plot saved as:', result.filePath);
        } else {
            if (result.error !== 'Save cancelled by user') {
                showPlotError(`Failed to save plot: ${result.error}`);
            }
        }
    } catch (error) {
        console.error('Error saving plot as:', error);
        showPlotError('Failed to save plot: ' + error.message);
    }
}

async function openPlotInNewTab() {
    const container = document.getElementById('plotContainer');
    const img = container.querySelector('img');

    if (!img) {
        showPlotError('No plot to open');
        return;
    }

    const plotData = img.src.split(',')[1]; // Remove data:image/png;base64, prefix
    const variable = document.getElementById('variableSelect').value;
    const filePath = globalState.currentDatasetFilePath || 'unknown_file';
    const fileName = generateDefaultFileName(variable, filePath);

    try {
        await messageBus.openPlot(plotData, variable, fileName);
        // Show success message
        showPlotSuccess(`Plot opened: ${fileName}`);
    } catch (error) {
        console.error('Error opening plot:', error);
        showPlotError('Failed to open plot: ' + error.message);
    }
}

// Tree view control functions
function expandAllSections() {
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

function collapseAllSections() {
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

// Event listeners setup
function setupEventListeners() {
    // Tree control event listeners
    const expandAllButton = document.getElementById('expandAllButton');
    if (expandAllButton) {
        expandAllButton.addEventListener('click', expandAllSections);
    }

    const collapseAllButton = document.getElementById('collapseAllButton');
    if (collapseAllButton) {
        collapseAllButton.addEventListener('click', collapseAllSections);
    }

    // Plotting event listeners for plotting capabilities
    // Global plot controls
    const plotAllButton = document.getElementById('plotAllButton');
    if (plotAllButton) {
        plotAllButton.addEventListener('click', plotAllVariables);
    }

    const resetAllPlotsButton = document.getElementById('resetAllPlotsButton');
    if (resetAllPlotsButton) {
        resetAllPlotsButton.addEventListener('click', resetAllPlots);
    }

    const saveAllPlotsButton = document.getElementById('saveAllPlotsButton');
    if (saveAllPlotsButton) {
        saveAllPlotsButton.addEventListener('click', saveAllPlots);
    }

    // Per-variable plot controls - use event delegation
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('create-plot-button')) {
            const variable = e.target.getAttribute('data-variable');
            const plotTypeSelect = document.querySelector(
                `.plot-type-select[data-variable="${variable}"]`
            );
            const plotType = plotTypeSelect ? plotTypeSelect.value : 'auto';

            // Show loading indicator
            showVariablePlotLoading(variable);

            try {
                const plotData = await messageBus.createPlot(
                    variable,
                    plotType
                );
                displayVariablePlot(variable, plotData);
            } catch (error) {
                console.error('Failed to create plot:', error);
                // Clear loading state and show error
                const container = document.querySelector(
                    `.plot-container[data-variable="${variable}"]`
                );
                const imageContainer = container.querySelector(
                    '.plot-image-container'
                );
                imageContainer.innerHTML = '';
                showVariablePlotError(
                    variable,
                    'Error creating plot: ' + error.message
                );
            }
        } else if (e.target.classList.contains('reset-plot')) {
            const variable = e.target.getAttribute('data-variable');
            resetVariablePlot(variable);
        } else if (e.target.classList.contains('save-plot')) {
            const variable = e.target.getAttribute('data-variable');
            await saveVariablePlot(variable);
        } else if (e.target.classList.contains('save-plot-as')) {
            const variable = e.target.getAttribute('data-variable');
            await saveVariablePlotAs(variable);
        } else if (e.target.classList.contains('open-plot')) {
            const variable = e.target.getAttribute('data-variable');
            await openVariablePlot(variable);
        } else if (e.target.classList.contains('error-copy-button')) {
            const variable = e.target.getAttribute('data-variable');
            await copyPlotError(variable);
        }
    });

    // Enable create plot buttons when plot type is selected
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('plot-type-select')) {
            const variable = e.target.getAttribute('data-variable');
            const createButton = document.querySelector(
                `.create-plot-button[data-variable="${variable}"]`
            );
            if (createButton) {
                createButton.disabled = false;
            }
        }
    });

    // Refresh event listener
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            updateTimestamp(null, true);
            try {
                const data = await messageBus.refresh();
                if (data) {
                    displayDataInfo(data.data, data.filePath);
                    updateTimestamp(data.lastLoadTime);
                }
            } catch (error) {
                console.error('Failed to refresh data:', error);
                showError('Failed to refresh data: ' + error.message);
            }
        });
    }

    // Copy event listeners
    setupCopyEventListeners();
}

function setupCopyEventListeners() {
    // File path copy button
    const copyPathButton = document.getElementById('copyPathButton');
    if (copyPathButton) {
        copyPathButton.addEventListener('click', async () => {
            const filePathCode = document.getElementById('filePathCode');
            const filePath = filePathCode ? filePathCode.textContent : '';

            if (filePath) {
                try {
                    await navigator.clipboard.writeText(filePath);
                    copyPathButton.textContent = '✓ Copied!';
                    copyPathButton.classList.add('copied');
                    setTimeout(() => {
                        copyPathButton.textContent = '📋 Copy';
                        copyPathButton.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy file path:', err);
                    copyPathButton.textContent = '❌ Failed';
                    setTimeout(() => {
                        copyPathButton.textContent = '📋 Copy';
                    }, 2000);
                }
            }
        });
    }

    // Text representation copy button
    const textCopyButton = document.getElementById('textCopyButton');
    if (textCopyButton) {
        textCopyButton.addEventListener('click', async () => {
            const textRepresentation =
                document.getElementById('textRepresentation');
            const text = textRepresentation
                ? textRepresentation.textContent
                : '';

            if (text) {
                try {
                    await navigator.clipboard.writeText(text);
                    textCopyButton.textContent = '✓ Copied!';
                    textCopyButton.classList.add('copied');
                    setTimeout(() => {
                        textCopyButton.textContent = '📋 Copy';
                        textCopyButton.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy text representation:', err);
                    textCopyButton.textContent = '❌ Failed';
                    setTimeout(() => {
                        textCopyButton.textContent = '📋 Copy';
                    }, 2000);
                }
            }
        });
    }

    // Copy buttons for groups cannot be set here yet, they will be generated dynamically

    // Python path copy button
    const pythonPathCopyButton = document.getElementById(
        'pythonPathCopyButton'
    );
    if (pythonPathCopyButton) {
        pythonPathCopyButton.addEventListener('click', async () => {
            const pythonPath = document.getElementById('pythonPath');
            const text = pythonPath ? pythonPath.textContent : '';

            if (
                text &&
                text !== 'Loading Python path...' &&
                text !== 'No Python interpreter configured'
            ) {
                try {
                    await navigator.clipboard.writeText(text);
                    pythonPathCopyButton.textContent = '✓ Copied!';
                    pythonPathCopyButton.classList.add('copied');
                    setTimeout(() => {
                        pythonPathCopyButton.textContent = '📋 Copy';
                        pythonPathCopyButton.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy Python path:', err);
                    pythonPathCopyButton.textContent = '❌ Failed';
                    setTimeout(() => {
                        pythonPathCopyButton.textContent = '📋 Copy';
                    }, 2000);
                }
            }
        });
    }

    // Extension config copy button
    const extensionConfigCopyButton = document.getElementById(
        'extensionConfigCopyButton'
    );
    if (extensionConfigCopyButton) {
        extensionConfigCopyButton.addEventListener('click', async () => {
            const extensionConfig = document.getElementById('extensionConfig');
            const text = extensionConfig ? extensionConfig.textContent : '';

            if (
                text &&
                text !== 'Loading configuration...' &&
                text !== 'Failed to load extension configuration'
            ) {
                try {
                    await navigator.clipboard.writeText(text);
                    extensionConfigCopyButton.textContent = '✓ Copied!';
                    extensionConfigCopyButton.classList.add('copied');
                    setTimeout(() => {
                        extensionConfigCopyButton.textContent = '📋 Copy';
                        extensionConfigCopyButton.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy extension config:', err);
                    extensionConfigCopyButton.textContent = '❌ Failed';
                    setTimeout(() => {
                        extensionConfigCopyButton.textContent = '📋 Copy';
                    }, 2000);
                }
            }
        });
    }

    // Show versions copy button
    const showVersionsCopyButton = document.getElementById(
        'showVersionsCopyButton'
    );
    if (showVersionsCopyButton) {
        showVersionsCopyButton.addEventListener('click', async () => {
            const showVersions = document.getElementById('showVersions');
            const text = showVersions ? showVersions.textContent : '';

            if (
                text &&
                text !== 'Loading version information...' &&
                text !== 'Failed to load version information'
            ) {
                try {
                    await navigator.clipboard.writeText(text);
                    showVersionsCopyButton.textContent = '✓ Copied!';
                    showVersionsCopyButton.classList.add('copied');
                    setTimeout(() => {
                        showVersionsCopyButton.textContent = '📋 Copy';
                        showVersionsCopyButton.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy version information:', err);
                    showVersionsCopyButton.textContent = '❌ Failed';
                    setTimeout(() => {
                        showVersionsCopyButton.textContent = '📋 Copy';
                    }, 2000);
                }
            }
        });
    }
}

// Message bus event handlers
function setupMessageHandlers() {
    // Set up event listeners for new message system
    messageBus.onDataLoaded((state) => {
        console.log('📊 Data loaded event received:', state);
        updateTimestamp(state.data.lastLoadTime);
        displayDataInfo(state.data.dataInfo, state.data.currentFile);

        displayHtmlRepresentation(state.data.dataInfo.xarray_html_repr, false);
        displayTextRepresentation(state.data.dataInfo.xarray_text_repr, false);

        // Handle datatree data
        displayHtmlRepresentation(
            state.data.dataInfo.xarray_html_repr_flattened,
            true
        );
        displayTextRepresentation(
            state.data.dataInfo.xarray_text_repr_flattened,
            true
        );

        // Text representation copy button for groups
        const textCopyButtonForGroups = document.querySelectorAll(
            '[id^="textCopyButton-"]'
        );
        textCopyButtonForGroups.forEach((button) => {
            button.addEventListener('click', async () => {
                const textRepresentation = document.getElementById(
                    `textRepresentation-${button.dataset.group}`
                );
                const text = textRepresentation
                    ? textRepresentation.textContent
                    : '';
                if (text) {
                    try {
                        await navigator.clipboard.writeText(text);
                        button.textContent = '✓ Copied!';
                        button.classList.add('copied');
                        setTimeout(() => {
                            button.textContent = '📋 Copy';
                            button.classList.remove('copied');
                        }, 2000);
                    } catch (err) {
                        console.error(
                            'Failed to copy text representation:',
                            err
                        );
                        button.textContent = '❌ Failed';
                        setTimeout(() => {
                            button.textContent = '📋 Copy';
                        }, 2000);
                    }
                }
            });
        });

        // Attributes are now handled natively by details elements, no JavaScript needed

        displayShowVersions(state.data.dataInfo.xarray_show_versions);
        displayExtensionConfig(state.extension.extensionConfig);
        displayPythonPath(state.python.pythonPath);
    });

    messageBus.onError((error) => {
        console.error('❌ Error event received:', error);
        showError(
            error.message,
            error.details,
            error.errorType,
            error.formatInfo
        );
    });

    messageBus.onPythonEnvironmentChanged((data) => {
        console.log('🐍 Python environment changed:', data);
        displayPythonPath(data.pythonPath);
    });

    messageBus.onUIStateChanged((state) => {
        console.log('🔄 UI state changed:', state);
    });

    // Listen for scroll to header messages
    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.command === 'scrollToHeader') {
            scrollToHeader(message.headerId, message.headerLabel);
        }
    });

    // Add debugging for all message bus communications
    const originalSendRequest = messageBus.sendRequest.bind(messageBus);
    messageBus.sendRequest = async function (command, payload, timeout) {
        console.log('📤 Sending request:', { command, payload, timeout });
        try {
            const result = await originalSendRequest(command, payload, timeout);
            console.log('📥 Request successful:', { command, result });
            return result;
        } catch (error) {
            console.error('📥 Request failed:', { command, error });
            throw error;
        }
    };
}

// Scroll to header function
function scrollToHeader(headerId, headerLabel) {
    console.log(`📋 Scrolling to header: ${headerLabel} (${headerId})`);

    // Try to find the element by ID first
    let element = document.getElementById(headerId);

    // If not found by ID, check if this is an attribute ID and find the parent variable/coordinate
    if (!element) {
        // Check if this is an attribute ID (contains '-attr-' or '-attributes')
        if (headerId.includes('-attr-') || headerId.includes('-attributes')) {
            // Extract the parent variable/coordinate ID
            let parentId = headerId;

            // Remove attribute-specific parts to get parent ID
            if (headerId.includes('-attr-')) {
                parentId = headerId.split('-attr-')[0];
            } else if (headerId.includes('-attributes')) {
                parentId = headerId.replace('-attributes', '');
            }

            console.log(`📋 Looking for parent element: ${parentId}`);
            const parentElement = document.getElementById(parentId);

            // If we found the parent, ensure it's a details element and open it
            if (parentElement && parentElement.tagName === 'DETAILS') {
                parentElement.open = true;
                console.log(`📋 Opened details element for: ${parentId}`);

                // Now try to find the specific attribute within the details content
                // Look for attribute items that match the header label
                const attributeItems =
                    parentElement.querySelectorAll('.attribute-item');
                for (const attrItem of attributeItems) {
                    const attrName = attrItem.querySelector('.attribute-name');
                    const attrValue =
                        attrItem.querySelector('.attribute-value');

                    if (attrName) {
                        const attrNameText = attrName.textContent
                            .trim()
                            .replace(' :', '')
                            .trim();
                        const headerName = headerLabel.split(':')[0].trim();

                        // Match by attribute name
                        if (attrNameText === headerName) {
                            element = attrItem;
                            console.log(
                                `📋 Found specific attribute by name: ${headerName}`
                            );
                            break;
                        }

                        // Also try to match the full label if it contains the value
                        if (attrValue) {
                            const fullAttrText = `${attrNameText}: ${attrValue.textContent.trim()}`;
                            if (fullAttrText === headerLabel.trim()) {
                                element = attrItem;
                                console.log(
                                    `📋 Found specific attribute by full text: ${headerLabel}`
                                );
                                break;
                            }
                        }
                    }
                }

                // If we didn't find the specific attribute, fall back to the parent element
                if (!element) {
                    element = parentElement;
                }
            } else {
                element = parentElement;
            }
        }
    }

    // If still not found by ID, try to find by text content in summary elements (for details/summary structure)
    if (!element) {
        const summaries = document.querySelectorAll('summary');
        for (const summary of summaries) {
            if (summary.textContent.trim().includes(headerLabel)) {
                element = summary;
                break;
            }
        }
    }

    // If still not found, try to find by text content in headers
    if (!element) {
        const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const header of headers) {
            if (header.textContent.trim() === headerLabel) {
                element = header;
                break;
            }
        }
    }

    // If still not found, try to find by partial text match in headers
    if (!element) {
        const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const header of headers) {
            if (header.textContent.trim().includes(headerLabel)) {
                element = header;
                break;
            }
        }
    }

    // If still not found, try to find by partial text match in summaries
    if (!element) {
        const summaries = document.querySelectorAll('summary');
        for (const summary of summaries) {
            if (summary.textContent.trim().includes(headerLabel)) {
                element = summary;
                break;
            }
        }
    }

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
                console.log(
                    `📋 Opened parent details: ${
                        parentDetails
                            .querySelector('summary')
                            ?.textContent?.trim() || 'Unknown'
                    }`
                );
            }
            // Move up to the parent of the current details element to check for more nested details
            currentElement = parentDetails?.parentElement;
        }

        if (openedCount > 0) {
            console.log(
                `📋 Opened ${openedCount} parent details groups for: ${headerLabel}`
            );
        }

        // Scroll to the element with offset to account for sticky headers
        const offset = 80; // Adjust this value based on your sticky header height
        const elementRect = element.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        const offsetPosition = absoluteElementTop - offset;

        window.scrollTo({
            top: Math.max(0, offsetPosition), // Ensure we don't scroll above the page
            behavior: 'smooth',
        });

        // Add a temporary highlight effect
        element.classList.add('highlighted');

        // Remove highlight after 3 seconds
        setTimeout(() => {
            element.classList.remove('highlighted');
        }, 3000);

        console.log(`📋 Successfully scrolled to header: ${headerLabel}`);
    } else {
        console.warn(`📋 Header not found: ${headerLabel} (${headerId})`);
        console.log(
            '📋 Available headers:',
            Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
                (h) => h.textContent.trim()
            )
        );
        console.log(
            '📋 Available summaries:',
            Array.from(document.querySelectorAll('summary')).map((s) =>
                s.textContent.trim()
            )
        );
    }
}

// Helper function to generate attributes HTML for details content
function generateAttributesContent(attributes) {
    if (!attributes || Object.keys(attributes).length === 0) {
        return '';
    }

    const attributesList = Object.entries(attributes)
        .map(([attrName, value]) => {
            const valueStr =
                typeof value === 'string' ? value : JSON.stringify(value);
            return /*html*/ `
            <div class="attribute-item">
                <span class="attribute-name" title="${attrName}">${attrName} : </span>
                <span class="attribute-value" title="${valueStr}">${valueStr}</span>
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
function generateVariablePlotControls(variableName) {
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

// Function to execute the show logs command
async function executeShowLogsCommand() {
    try {
        console.log('🔧 Executing show logs command...');
        await messageBus.sendRequest('executeCommand', {
            command: 'scientificDataViewer.showLogs',
        });
        console.log('🔧 Show logs command executed successfully');
    } catch (error) {
        console.error('❌ Failed to execute show logs command:', error);
        // Fallback: show a notification to the user
        showError(
            'Failed to open extension logs. Please use Command Palette (Ctrl+Shift+P) → "Scientific Data Viewer: Show Extension Logs"'
        );
    }
}
