import * as vscode from 'vscode';
import * as path from 'path';
import { DataProcessor, DataInfo } from './dataProcessor';

export class DataViewerPanel {
    public static currentPanel: DataViewerPanel | undefined;
    public static readonly viewType = 'scientificDataViewer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _dataInfo: DataInfo | null = null;
    private _currentFile: vscode.Uri;

    public static createOrShow(extensionUri: vscode.Uri, fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (DataViewerPanel.currentPanel) {
            DataViewerPanel.currentPanel._panel.reveal(column);
            DataViewerPanel.currentPanel._update(fileUri, dataProcessor);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            DataViewerPanel.viewType,
            `Data Viewer: ${path.basename(fileUri.fsPath)}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out')
                ]
            }
        );

        DataViewerPanel.currentPanel = new DataViewerPanel(panel, extensionUri, fileUri, dataProcessor);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        DataViewerPanel.currentPanel = new DataViewerPanel(panel, extensionUri, fileUri, dataProcessor);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, fileUri: vscode.Uri, private dataProcessor: DataProcessor) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._currentFile = fileUri;

        // Set the webview's initial html content
        this._update(fileUri, dataProcessor);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'getDataInfo':
                        await this._handleGetDataInfo();
                        break;
                    case 'getDataSlice':
                        await this._handleGetDataSlice(message.variable, message.sliceSpec);
                        break;
                    case 'createPlot':
                        await this._handleCreatePlot(message.variable, message.plotType);
                        break;
                    case 'getVariableList':
                        await this._handleGetVariableList();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public async _update(fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        this._currentFile = fileUri;
        this.dataProcessor = dataProcessor;
        
        this._panel.webview.html = this._getHtmlForWebview();
        
        // Load data info
        await this._handleGetDataInfo();
    }

    private async _handleGetDataInfo() {
        try {
            // Check if Python environment is ready
            if (!this.dataProcessor.pythonManagerInstance.isReady()) {
                this._panel.webview.postMessage({
                    command: 'error',
                    message: 'Python environment not ready. Please configure Python interpreter first.',
                    details: 'Use Command Palette (Ctrl+Shift+P) and run "Select Python Interpreter" to set up Python environment.'
                });
                return;
            }

            // Check file size
            const stat = await vscode.workspace.fs.stat(this._currentFile);
            const maxSize = vscode.workspace.getConfiguration('scientificDataViewer').get('maxFileSize', 100) * 1024 * 1024; // Convert MB to bytes
            
            if (stat.size > maxSize) {
                this._panel.webview.postMessage({
                    command: 'error',
                    message: `File too large (${Math.round(stat.size / 1024 / 1024)}MB). Maximum allowed: ${vscode.workspace.getConfiguration('scientificDataViewer').get('maxFileSize', 100)}MB`,
                    details: 'Increase the maxFileSize setting in VSCode settings to load larger files.'
                });
                return;
            }

            this._dataInfo = await this.dataProcessor.getDataInfo(this._currentFile);
            
            if (!this._dataInfo) {
                this._panel.webview.postMessage({
                    command: 'error',
                    message: 'Failed to load data file. The file might be corrupted or in an unsupported format.',
                    details: 'Supported formats: NetCDF (.nc, .netcdf), Zarr (.zarr), HDF5 (.h5, .hdf5)'
                });
                return;
            }

            if (this._dataInfo.error) {
                this._panel.webview.postMessage({
                    command: 'error',
                    message: `Data processing error: ${this._dataInfo.error}`,
                    details: 'This might be due to missing Python packages or file format issues.'
                });
                return;
            }

            this._panel.webview.postMessage({
                command: 'dataInfo',
                data: this._dataInfo
            });
        } catch (error) {
            console.error('Error in _handleGetDataInfo:', error);
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to load data info: ${error}`,
                details: 'Check the VSCode Output panel (View → Output → "Scientific Data Viewer") for more details.'
            });
        }
    }

    private async _handleGetDataSlice(variable: string, sliceSpec?: any) {
        try {
            const dataSlice = await this.dataProcessor.getDataSlice(this._currentFile, variable, sliceSpec);
            this._panel.webview.postMessage({
                command: 'dataSlice',
                data: dataSlice
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to load data slice: ${error}`
            });
        }
    }

    private async _handleCreatePlot(variable: string, plotType: string) {
        try {
            const plotData = await this.dataProcessor.createPlot(this._currentFile, variable, plotType);
            this._panel.webview.postMessage({
                command: 'plotData',
                data: plotData
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to create plot: ${error}`
            });
        }
    }

    private async _handleGetVariableList() {
        try {
            const variables = await this.dataProcessor.getVariableList(this._currentFile);
            this._panel.webview.postMessage({
                command: 'variableList',
                data: variables
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to load variable list: ${error}`
            });
        }
    }

    public dispose() {
        DataViewerPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scientific Data Viewer</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            font-weight: var(--vscode-font-weight);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .title {
            font-size: 1.5em;
            font-weight: bold;
        }
        
        .controls {
            display: flex;
            gap: 10px;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }
        
        select {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 8px;
            border-radius: 4px;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        
        .info-section {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .info-section h3 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }
        
        .dimensions, .variables {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }
        
        .dimension-item, .variable-item {
            padding: 8px;
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            cursor: pointer;
        }
        
        .dimension-item:hover, .variable-item:hover {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        
        .variable-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }
        
        .plot-container {
            margin: 20px 0;
            text-align: center;
        }
        
        .plot-container img {
            max-width: 100%;
            height: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        
        .data-table th, .data-table td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
        }
        
        .data-table th {
            background-color: var(--vscode-list-hoverBackground);
            font-weight: bold;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">Scientific Data Viewer</div>
        <div class="controls">
            <select id="variableSelect">
                <option value="">Select a variable...</option>
            </select>
            <select id="plotTypeSelect">
                <option value="line">Line Plot</option>
                <option value="heatmap">Heatmap</option>
                <option value="histogram">Histogram</option>
            </select>
            <button id="plotButton" disabled>Create Plot</button>
            <button id="refreshButton">Refresh</button>
        </div>
    </div>
    
    <div id="loading" class="loading">Loading data...</div>
    <div id="error" class="error hidden"></div>
    
    <div id="content" class="hidden">
        <div class="info-section">
            <h3>File Information</h3>
            <div id="fileInfo"></div>
        </div>
        
        <div class="info-section">
            <h3>Dimensions</h3>
            <div id="dimensions" class="dimensions"></div>
        </div>
        
        <div class="info-section">
            <h3>Variables</h3>
            <div id="variables" class="variables"></div>
        </div>
        
        <div class="info-section">
            <h3>Visualization</h3>
            <div id="plotContainer" class="plot-container"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentData = null;
        let selectedVariable = null;

        // Event listeners
        document.getElementById('variableSelect').addEventListener('change', (e) => {
            selectedVariable = e.target.value;
            document.getElementById('plotButton').disabled = !selectedVariable;
        });

        document.getElementById('plotButton').addEventListener('click', () => {
            if (selectedVariable) {
                const plotType = document.getElementById('plotTypeSelect').value;
                vscode.postMessage({
                    command: 'createPlot',
                    variable: selectedVariable,
                    plotType: plotType
                });
            }
        });

        document.getElementById('refreshButton').addEventListener('click', () => {
            vscode.postMessage({ command: 'getDataInfo' });
        });

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'dataInfo':
                    currentData = message.data;
                    displayDataInfo(message.data);
                    break;
                case 'variableList':
                    populateVariableSelect(message.data);
                    break;
                case 'plotData':
                    displayPlot(message.data);
                    break;
                case 'error':
                    showError(message.message, message.details);
                    break;
            }
        });

        function displayDataInfo(data) {
            if (!data) {
                showError('No data available');
                return;
            }

            if (data.error) {
                showError(data.error);
                return;
            }

            // Display file information
            const fileInfo = document.getElementById('fileInfo');
            fileInfo.innerHTML = \`
                <p><strong>Format:</strong> \${data.format || 'Unknown'}</p>
                \${data.fileSize ? \`<p><strong>Size:</strong> \${formatFileSize(data.fileSize)}</p>\` : ''}
            \`;

            // Display dimensions
            const dimensionsContainer = document.getElementById('dimensions');
            if (data.dimensions) {
                dimensionsContainer.innerHTML = Object.entries(data.dimensions)
                    .map(([name, size]) => \`<div class="dimension-item">\${name}: \${size}</div>\`)
                    .join('');
            } else {
                dimensionsContainer.innerHTML = '<p>No dimensions found</p>';
            }

            // Display variables
            const variablesContainer = document.getElementById('variables');
            if (data.variables && data.variables.length > 0) {
                variablesContainer.innerHTML = data.variables
                    .map(variable => \`
                        <div class="variable-item" data-variable="\${variable.name}">
                            <strong>\${variable.name}</strong><br>
                            <small>\${variable.dtype} \${variable.shape ? '(' + variable.shape.join(', ') + ')' : ''}</small>
                        </div>
                    \`)
                    .join('');
                
                // Add click handlers for variable selection
                variablesContainer.querySelectorAll('.variable-item').forEach(item => {
                    item.addEventListener('click', () => {
                        variablesContainer.querySelectorAll('.variable-item').forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        selectedVariable = item.dataset.variable;
                        document.getElementById('variableSelect').value = selectedVariable;
                        document.getElementById('plotButton').disabled = false;
                    });
                });
            } else {
                variablesContainer.innerHTML = '<p>No variables found</p>';
            }

            // Request variable list for dropdown
            vscode.postMessage({ command: 'getVariableList' });

            // Show content
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('content').classList.remove('hidden');
        }

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
                container.innerHTML = \`<img src="data:image/png;base64,\${plotData}" alt="Plot">\`;
            } else {
                container.innerHTML = '<p>Failed to generate plot</p>';
            }
        }

        function showError(message, details = '') {
            const errorDiv = document.getElementById('error');
            errorDiv.innerHTML = \`
                <h3>❌ Error</h3>
                <p><strong>Message:</strong> \${message}</p>
                \${details ? \`<p><strong>Details:</strong> \${details}</p>\` : ''}
                <div style="margin-top: 15px;">
                    <h4>💡 Troubleshooting Steps:</h4>
                    <ol>
                        <li>Make sure Python is installed and accessible</li>
                        <li>Install required packages: <code>pip install xarray netCDF4 zarr h5py numpy matplotlib</code></li>
                        <li>Use Command Palette (Ctrl+Shift+P) → "Select Python Interpreter"</li>
                        <li>Check file format is supported (.nc, .netcdf, .zarr, .h5, .hdf5)</li>
                        <li>Check VSCode Output panel for more details</li>
                    </ol>
                </div>
            \`;
            errorDiv.classList.remove('hidden');
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('content').classList.add('hidden');
        }

        function formatFileSize(bytes) {
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) return '0 B';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        }

        // Initial load
        vscode.postMessage({ command: 'getDataInfo' });
    </script>
</body>
</html>`;
    }
}
