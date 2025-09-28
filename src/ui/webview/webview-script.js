/**
 * Webview JavaScript for Scientific Data Viewer
 * Generated from JavaScriptGenerator.ts
 */

const vscode = acquireVsCodeApi();

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
    async sendRequest(command, payload, timeout = 10000) {
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
                }
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
            payload
        };
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    handleResponse(message) {
        const pendingRequest = this.pendingRequests.get(message.requestId);
        
        if (!pendingRequest) {
            console.warn(`Received response for unknown request: ${message.requestId}`);
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
            listeners.forEach(listener => {
                try {
                    listener(message.payload);
                } catch (error) {
                    console.error(`Error in event listener for ${message.event}:`, error);
                }
            });
        }
    }


    async createPlot(variable, plotType) {
        return this.sendRequest('createPlot', { variable, plotType });
    }

    async refresh() {
        return this.sendRequest('refresh', {});
    }

    // Event emission methods
    onDataLoaded(callback) {
        return this.onEvent('dataLoaded', callback);
    }

    onError(callback) {
        return this.onEvent('error', callback);
    }

    onUIStateChanged(callback) {
        return this.onEvent('uiStateChanged', callback);
    }
}

const messageBus = new WebviewMessageBus(vscode);
let selectedVariable = null;

// Utility functions
function updateTimestamp(isoString, isLoading = false) {
    const timestampElement = document.getElementById('timestamp');
    const timestampText = document.getElementById('timestampText');
    
    if (isLoading) {
        timestampText.textContent = 'Loading...';
        timestampElement.classList.remove('hidden');
    } else if (isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        const timeString = date.toLocaleTimeString();
        timestampText.textContent = `Last loaded: ${timeString}`;
        timestampElement.classList.remove('hidden');
    } else {
        timestampElement.classList.add('hidden');
    }
}

function formatFileSize(bytes) {
    const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
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
    let formatInfo = `<p><strong>Format:</strong> ${data.format || 'Unknown'}</p>`;
    
    if (data.format_info) {
        formatInfo += `
            <p><strong>File Extension:</strong> ${data.format_info.extension}</p>
            <p><strong>Available Engines:</strong> ${data.format_info.available_engines.join(', ') || 'None'}</p>
            ${data.used_engine ? `<p><strong>Used Engine:</strong> ${data.used_engine}</p>` : ''}
        `;
    }
    
    if (data.fileSize) {
        formatInfo += `<p><strong>Size:</strong> ${formatFileSize(data.fileSize)}</p>`;
    }
    
    fileInfo.innerHTML = formatInfo;

    // Display dimensions
    const dimensionsContainer = document.getElementById('dimensions');
    if (dimensionsContainer) {
        if (data.dimensions) {
            dimensionsContainer.innerHTML = Object.entries(data.dimensions)
                .map(([name, size]) => `<div class="dimension-item">${name}: ${size}</div>`)
                .join('');
        } else {
            dimensionsContainer.innerHTML = '<p>No dimensions found</p>';
        }
    }
        
    // Display coordinates
    const coordinatesContainer = document.getElementById('coordinates');
    if (coordinatesContainer) {
        if (data.coordinates && data.coordinates.length > 0) {
            coordinatesContainer.innerHTML = data.coordinates
                .map(variable => `
                    <div class="variable-item" data-variable="${variable.name}">
                        <strong>${variable.name}</strong><br>
                        <small>
                            ${variable.dtype} ${variable.shape ? '(' + variable.shape.join(', ') + ')' : ''}<br>
                            ${variable.dimensions && variable.dimensions.length > 0 ? 'Dims: ' + variable.dimensions.join(', ') : ''}<br>
                            ${variable.size_bytes ? 'Size: ' + formatFileSize(variable.size_bytes) : ''}
                        </small>
                    </div>
                `)
                .join('');
        } else {
            coordinatesContainer.innerHTML = '<p>No coordinates found at top-level group.</p>';
        }
    }

    // Display variables
    const variablesContainer = document.getElementById('variables');
    if (variablesContainer) {
        if (data.variables && data.variables.length > 0) {
            variablesContainer.innerHTML = data.variables
                .map(variable => `
                    <div class="variable-item" data-variable="${variable.name}">
                        <strong>${variable.name}</strong><br>
                        <small>
                            ${variable.dtype} ${variable.shape ? '(' + variable.shape.join(', ') + ')' : ''}<br>
                            ${variable.dimensions && variable.dimensions.length > 0 ? 'Dims: ' + variable.dimensions.join(', ') : ''}<br>
                            ${variable.size_bytes ? 'Size: ' + formatFileSize(variable.size_bytes) : ''}
                        </small>
                    </div>
                `)
                .join('');
        } else {
            variablesContainer.innerHTML = '<p>No variables found at top-level group.</p>';
        }
    }
    
    // Show content
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
}

// Plotting functions (if plotting capabilities are enabled)
function populateVariableSelect(variables) {
    const select = document.getElementById('variableSelect');
    select.innerHTML = '<option value="">Select a variable...</option>';
    variables.forEach(variable => {
        const option = document.createElement('option');
        option.value = variable;
        option.textContent = variable;
        select.appendChild(option);
    });
}

function displayPlot(plotData) {
    const container = document.getElementById('plotContainer');
    if (plotData && plotData.startsWith('iVBOR')) {
        container.innerHTML = `<img src="data:image/png;base64,${plotData}" alt="Plot">`;
    } else {
        container.innerHTML = '<p>Failed to generate plot</p>';
    }
}

// Representation display functions
function displayHtmlRepresentation(htmlData) {
    const container = document.getElementById('htmlRepresentation');
    if (htmlData) {
        container.innerHTML = htmlData;
    } else {
        container.innerHTML = '<p>Failed to load HTML representation</p>';
    }
}

function displayTextRepresentation(textData) {
    const container = document.getElementById('textRepresentation');
    const copyButton = document.getElementById('textCopyButton');
    
    if (textData) {
        container.textContent = textData;
        copyButton.classList.remove('hidden');
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
    
    let troubleshootingSteps = `
        <h4>💡 Troubleshooting Steps:</h4>
        <ol>
            <li>Make sure Python is installed and accessible</li>
            <li>Install required packages: <code>pip install xarray</code></li>
            <li>Use Command Palette (Ctrl+Shift+P) → "Python: Select Interpreter"</li>
            <li>Check file format is supported (.nc, .netcdf, .zarr, .h5, .hdf5, .grib, .grib2, .tif, .tiff, .geotiff, .jp2, .jpeg2000, .safe, .nc4, .cdf)</li>
            <li>Check VSCode Output panel for more details</li>
        </ol>
    `;
    
    // Add specific troubleshooting for missing packages
    if (errorType === 'ImportError' && formatInfo && formatInfo.missing_packages) {
        troubleshootingSteps = `
            <h4>💡 Missing Dependencies:</h4>
            <p>This file format requires additional packages that are not installed:</p>
            <ul>
                <li><strong>Missing packages:</strong> ${formatInfo.missing_packages.join(', ')}</li>
                <li><strong>File format:</strong> ${formatInfo.display_name} (${formatInfo.extension})</li>
            </ul>
            <p><strong>Installation command:</strong></p>
            <code>pip install ${formatInfo.missing_packages.join(' ')}</code>
            <p style="margin-top: 10px;">After installation, refresh the data viewer to try again.</p>
        `;
    }
    
    errorDiv.innerHTML = `
        <h3>❌ Error</h3>
        <p><strong>Message:</strong> ${formattedMessage}</p>
        ${formattedDetails ? `<p><strong>Details:</strong> ${formattedDetails}</p>` : ''}
        ${errorType ? `<p><strong>Error Type:</strong> ${errorType}</p>` : ''}
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
}

function hideError() {
    const errorDiv = document.getElementById('error');
    errorDiv.classList.add('hidden');
    errorDiv.innerHTML = '';
}

// Event listeners setup
function setupEventListeners(plottingCapabilities = false) {
    // Plotting event listeners (if plotting capabilities are enabled)
    if (plottingCapabilities) {
        const variableSelect = document.getElementById('variableSelect');
        const plotButton = document.getElementById('plotButton');
        
        if (variableSelect) {
            variableSelect.addEventListener('change', (e) => {
                selectedVariable = e.target.value;
                if (plotButton) {
                    plotButton.disabled = !selectedVariable;
                }
            });
        }

        if (plotButton) {
            plotButton.addEventListener('click', async () => {
                if (selectedVariable) {
                    const plotTypeSelect = document.getElementById('plotTypeSelect');
                    const plotType = plotTypeSelect ? plotTypeSelect.value : 'auto';
                    const actualPlotType = plotType === 'auto' ? 'line' : plotType;
                    try {
                        const plotData = await messageBus.createPlot(selectedVariable, actualPlotType);
                        displayPlot(plotData);
                    } catch (error) {
                        console.error('Failed to create plot:', error);
                        showError('Failed to create plot: ' + error.message);
                    }
                }
            });
        }
    }

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
            const textRepresentation = document.getElementById('textRepresentation');
            const text = textRepresentation ? textRepresentation.textContent : '';
            
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

    // Python path copy button
    const pythonPathCopyButton = document.getElementById('pythonPathCopyButton');
    if (pythonPathCopyButton) {
        pythonPathCopyButton.addEventListener('click', async () => {
            const pythonPath = document.getElementById('pythonPath');
            const text = pythonPath ? pythonPath.textContent : '';
            
            if (text && text !== 'Loading Python path...' && text !== 'No Python interpreter configured') {
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
    const extensionConfigCopyButton = document.getElementById('extensionConfigCopyButton');
    if (extensionConfigCopyButton) {
        extensionConfigCopyButton.addEventListener('click', async () => {
            const extensionConfig = document.getElementById('extensionConfig');
            const text = extensionConfig ? extensionConfig.textContent : '';
            
            if (text && text !== 'Loading configuration...' && text !== 'Failed to load extension configuration') {
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
    const showVersionsCopyButton = document.getElementById('showVersionsCopyButton');
    if (showVersionsCopyButton) {
        showVersionsCopyButton.addEventListener('click', async () => {
            const showVersions = document.getElementById('showVersions');
            const text = showVersions ? showVersions.textContent : '';
            
            if (text && text !== 'Loading version information...' && text !== 'Failed to load version information') {
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
        displayHtmlRepresentation(state.data.dataInfo.xarray_html_repr);
        displayTextRepresentation(state.data.dataInfo.xarray_text_repr);
        displayShowVersions(state.data.dataInfo.xarray_show_versions);
        displayExtensionConfig(state.extension.extensionConfig);
        displayPythonPath(state.python.pythonPath);
    });

    messageBus.onError((error) => {
        console.error('❌ Error event received:', error);
        showError(error.message, error.details, error.errorType, error.formatInfo);
    });

    messageBus.onUIStateChanged((state) => {
        console.log('🔄 UI state changed:', state);
    });
    
    // Add debugging for all message bus communications
    const originalSendRequest = messageBus.sendRequest.bind(messageBus);
    messageBus.sendRequest = async function(command, payload, timeout) {
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

// Initialization
function initialize(plottingCapabilities = false) {
    console.log('🔧 WebView initialized - starting debug session');
    console.log('📍 Current location:', window.location);
    console.log('📍 Pathname:', window.location.pathname);
    console.log('📍 Search:', window.location.search);
    console.log('📍 Hash:', window.location.hash);
    
    // Set up event listeners
    setupEventListeners(plottingCapabilities);
    setupMessageHandlers();
    
    console.log('🚀 WebView initialized - waiting for data to be loaded via message system...');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Check if plotting capabilities are enabled by looking for plot-related elements
        const hasPlottingElements = document.getElementById('variableSelect') && document.getElementById('plotButton');
        initialize(hasPlottingElements);
    });
} else {
    // DOM is already loaded
    const hasPlottingElements = document.getElementById('variableSelect') && document.getElementById('plotButton');
    initialize(hasPlottingElements);
}

// Export functions for external use if needed
window.ScientificDataViewer = {
    messageBus,
    displayDataInfo,
    displayPlot,
    showError,
    hideError,
    updateTimestamp,
    formatFileSize
};
