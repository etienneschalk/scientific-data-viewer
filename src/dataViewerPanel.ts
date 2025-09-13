import * as vscode from 'vscode';
import * as path from 'path';
import { DataProcessor, DataInfo } from './dataProcessor';
import { Logger } from './logger';

export class DataViewerPanel {
    public static activePanels: Set<DataViewerPanel> = new Set();
    public static readonly viewType = 'scientificDataViewer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _dataInfo: DataInfo | null = null;
    private _currentFile: vscode.Uri;
    private _lastLoadTime: Date | null = null;

    public static createOrShow(extensionUri: vscode.Uri, fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Get configuration directly from VSCode
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        const allowMultipleTabs = config.get('allowMultipleTabsForSameFile', false);

        // Check if this file is already open in an existing panel (only if multiple tabs are not allowed)
        if (!allowMultipleTabs) {
            for (const panel of DataViewerPanel.activePanels) {
                if (panel._currentFile.fsPath === fileUri.fsPath) {
                    // File is already open, focus on the existing panel without refreshing
                    Logger.info(`File ${fileUri.fsPath} is already open, focusing existing panel (allowMultipleTabsForSameFile: false)`);
                    panel._panel.reveal(column);
                    return;
                }
            }
        } else {
            Logger.info(`Creating new panel for ${fileUri.fsPath} (allowMultipleTabsForSameFile: true)`);
        }

        // File is not open or multiple tabs are allowed, create a new panel
        const panel = vscode.window.createWebviewPanel(
            DataViewerPanel.viewType,
            `Data Viewer: ${path.basename(fileUri.fsPath)}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out')
                ]
            }
        );

        const dataViewerPanel = new DataViewerPanel(panel, extensionUri, fileUri, dataProcessor);
        DataViewerPanel.activePanels.add(dataViewerPanel);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        const dataViewerPanel = new DataViewerPanel(panel, extensionUri, fileUri, dataProcessor);
        DataViewerPanel.activePanels.add(dataViewerPanel);
    }

    public static async refreshCurrentPanel(dataProcessor: DataProcessor) {
        Logger.info(`Refreshing ${DataViewerPanel.activePanels.size} active panels due to Python environment change...`);
        for (const panel of DataViewerPanel.activePanels) {
            await panel._handleGetDataInfo();
        }
    }

    /**
     * Dispose of static resources
     */
    public static dispose(): void {
        // Static resources are now managed by the main extension
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
                        if (vscode.workspace.getConfiguration('scientificDataViewer').get('plottingCapabilities', false)) {
                            await this._handleCreatePlot(message.variable, message.plotType);
                        }
                        break;
                    case 'getVariableList':
                        if (vscode.workspace.getConfiguration('scientificDataViewer').get('plottingCapabilities', false)) {
                            await this._handleGetVariableList();
                        }
                        break;
                    case 'getHtmlRepresentation':
                        await this._handleGetHtmlRepresentation();
                        break;
                    case 'getTextRepresentation':
                        await this._handleGetTextRepresentation();
                        break;
                    case 'getShowVersions':
                        await this._handleGetShowVersions();
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

        // Update the panel title to reflect the new file
        this._panel.title = `Data Viewer: ${path.basename(fileUri.fsPath)}`;

        // Get configuration for plotting capabilities
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        const plottingCapabilities = config.get('plottingCapabilities', false);

        this._panel.webview.html = this._getHtmlForWebview(plottingCapabilities);

        // Load data info
        await this._handleGetDataInfo();
    }

    private async _handleGetDataInfo() {
        try {
            // Check if Python environment is ready
            if (!this.dataProcessor.pythonManagerInstance.isReady()) {
                Logger.error('Python environment not ready. Please configure Python interpreter first.');
                Logger.error(`${this.dataProcessor.pythonManagerInstance.getPythonPath()}`);
                Logger.error(`${this.dataProcessor.pythonManagerInstance.isReady()}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    message: 'Python environment not ready. Please configure Python interpreter first.',
                    details: 'Use Command Palette (Ctrl+Shift+P) and run "Python: Select Interpreter" to set up Python environment.'
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

            // Update last load time
            this._lastLoadTime = new Date();

            this._panel.webview.postMessage({
                command: 'dataInfo',
                data: this._dataInfo,
                filePath: this._currentFile.fsPath,
                lastLoadTime: this._lastLoadTime.toISOString()
            });
        } catch (error) {
            Logger.error(`Error in _handleGetDataInfo: ${error}`);
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
            // Show notification that plotting has started
            vscode.window.showInformationMessage(
                `Creating plot for variable '${variable}'... Check the output panel for progress.`,
                'Show Logs'
            ).then(selection => {
                if (selection === 'Show Logs') {
                    Logger.show();
                }
            });

            const plotData = await this.dataProcessor.createPlot(this._currentFile, variable, plotType);
            if (plotData) {
                this._panel.webview.postMessage({
                    command: 'plotData',
                    data: plotData
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'error',
                    message: 'Failed to create plot',
                    details: 'Check the output panel for more details'
                });
            }
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

    private async _handleGetHtmlRepresentation() {
        try {
            const htmlRepresentation = await this.dataProcessor.getHtmlRepresentation(this._currentFile);
            this._panel.webview.postMessage({
                command: 'htmlRepresentation',
                data: htmlRepresentation
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to load HTML representation: ${error}`
            });
        }
    }

    private async _handleGetTextRepresentation() {
        try {
            const textRepresentation = await this.dataProcessor.getTextRepresentation(this._currentFile);
            this._panel.webview.postMessage({
                command: 'textRepresentation',
                data: textRepresentation
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to load text representation: ${error}`
            });
        }
    }

    private async _handleGetShowVersions() {
        try {
            const showVersions = await this.dataProcessor.getShowVersions();
            this._panel.webview.postMessage({
                command: 'showVersions',
                data: showVersions
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to load show versions: ${error}`
            });
        }
    }

    public dispose() {
        // Remove this panel from the active panels set
        DataViewerPanel.activePanels.delete(this);

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(plottingCapabilities: boolean = false) {
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
            color: #ff6b6b;
            background-color: #2d1b1b;
            border: 2px solid #ff6b6b;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            font-weight: 500;
            box-shadow: 0 2px 8px rgba(255, 107, 107, 0.2);
        }
        
        .error h3 {
            color: #ff6b6b;
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 1.2em;
        }
        
        .error p {
            margin: 8px 0;
            line-height: 1.5;
        }
        
        .error strong {
            color: #ff8a8a;
        }
        
        .error code {
            background-color: #1a0f0f;
            color: #ffa8a8;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
        }
        
        .error ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .error li {
            margin: 5px 0;
            line-height: 1.4;
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
        
        .html-representation {
            max-height: 500px;
            overflow: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            /* font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace); */
            font-size: 12px;
        }
        
        .html-representation table {
            width: 100%;
            border-collapse: collapse;
            margin: 5px 0;
        }
        
        .html-representation th, .html-representation td {
            border: 1px solid var(--vscode-panel-border);
            padding: 4px 8px;
            text-align: left;
            font-size: 11px;
        }
        
        .html-representation th {
            background-color: var(--vscode-list-hoverBackground);
            font-weight: bold;
        }
        
        .html-representation .xr-var-data {
            /* font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace); */
        }
        
        .file-path-container {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 8px 0;
        }
        
        .file-path-code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
            padding: 4px 8px;
            border-radius: 3px;
            border: 1px solid var(--vscode-panel-border);
            flex: 1;
            word-break: break-all;
            font-size: 12px;
        }
        
        .copy-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            min-width: 60px;
        }
        
        .copy-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .copy-button:active {
            background-color: var(--vscode-button-secondaryBackground);
        }
        
        .copy-button.copied {
            background-color: var(--vscode-charts-green);
            color: var(--vscode-foreground);
        }
        
        .timestamp {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-left: 10px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .timestamp-icon {
            font-size: 0.8em;
        }
        
        .text-representation {
            max-height: 400px;
            overflow: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
            font-size: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .text-representation-container {
            position: relative;
        }
        
        .text-copy-button {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            z-index: 10;
        }
        
        .text-copy-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .text-copy-button.copied {
            background-color: var(--vscode-charts-green);
            color: var(--vscode-foreground);
        }
        
        .troubleshooting-section {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .troubleshooting-section h3 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }
        
        .troubleshooting-content {
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
            font-size: 11px;
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 10px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
            max-height: 300px;
            overflow: auto;
        }
        
        details summary {
            cursor: pointer;
            padding: 8px 0;
            font-weight: 500;
            color: var(--vscode-foreground);
        }
        
        details summary:hover {
            color: var(--vscode-button-hoverBackground);
        }
        
        details[open] summary {
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">Scientific Data Viewer</div>
        <div class="controls">
            ${plottingCapabilities ? `
            <select id="variableSelect">
                <option value="">Select a variable...</option>
            </select>
            <select id="plotTypeSelect">
                <option value="auto" selected>Auto (Recommended)</option>
                <option value="line">Line Plot</option>
                <option value="heatmap">Heatmap</option>
                <option value="histogram">Histogram</option>
            </select>
            <button id="plotButton" disabled>Create Plot</button>
            ` : ''}
            <div id="timestamp" class="timestamp hidden">
                <span class="timestamp-icon">🕒</span>
                <span id="timestampText">Last loaded: --</span>
            </div>
            <button id="refreshButton">Refresh</button>
        </div>
    </div>
    
    <div id="loading" class="loading">Loading data...</div>
    <div id="error" class="error hidden"></div>
    
    <div id="content" class="hidden">
        <div class="info-section">
            <h3>File Information</h3>
            <div id="filePathContainer" class="file-path-container hidden">
            <p><strong>File Path:</strong></p>
            <code id="filePathCode" class="file-path-code"></code>
            <button id="copyPathButton" class="copy-button">
            📋 Copy
            </button>
            </div>
            <div id="fileInfo"></div>
        </div>
        
        <div class="info-section">
            <h3>Xarray HTML Representation</h3>
            <div id="htmlRepresentation" class="html-representation"></div>
        </div>
        
        <div class="info-section">
            <h3>Xarray Text Representation</h3>
            <div class="text-representation-container">
                <button id="textCopyButton" class="text-copy-button hidden">
                    📋 Copy
                </button>
                <div id="textRepresentation" class="text-representation"></div>
            </div>
        </div>
        
        <div class="troubleshooting-section">
            <h3>Troubleshooting</h3>
            <details>
                <summary>Show xarray version information</summary>
                <div id="showVersions" class="troubleshooting-content">Loading version information...</div>
            </details>
        </div>

        <div class="info-section">
            <h3>Dimensions</h3>
            <div id="dimensions" class="dimensions"></div>
        </div>
        
        <div class="info-section">
            <h3>Variables</h3>
            <div id="variables" class="variables"></div>
        </div>
        
        ${plottingCapabilities ? `
        <div class="info-section">
            <h3>Visualization</h3>
            <div id="plotContainer" class="plot-container"></div>
        </div>
        ` : ''}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentData = null;
        let selectedVariable = null;
        let lastLoadTime = null;

        // Event listeners
        ${plottingCapabilities ? `
        document.getElementById('variableSelect').addEventListener('change', (e) => {
            selectedVariable = e.target.value;
            document.getElementById('plotButton').disabled = !selectedVariable;
        });

        document.getElementById('plotButton').addEventListener('click', () => {
            if (selectedVariable) {
                const plotType = document.getElementById('plotTypeSelect').value;
                // Use 'line' as default for auto mode, the Python script will handle the strategy detection
                const actualPlotType = plotType === 'auto' ? 'line' : plotType;
                vscode.postMessage({
                    command: 'createPlot',
                    variable: selectedVariable,
                    plotType: actualPlotType
                });
            }
        });
        ` : ''}

        document.getElementById('refreshButton').addEventListener('click', () => {
            // Show loading state for timestamp
            updateTimestamp(null, true);
            vscode.postMessage({ command: 'getDataInfo' });
        });

        document.getElementById('copyPathButton').addEventListener('click', async () => {
            const filePathCode = document.getElementById('filePathCode');
            const copyButton = document.getElementById('copyPathButton');
            const filePath = filePathCode.textContent;
            
            if (filePath) {
                try {
                    await navigator.clipboard.writeText(filePath);
                    copyButton.textContent = '✓ Copied!';
                    copyButton.classList.add('copied');
                    setTimeout(() => {
                        copyButton.textContent = '📋 Copy';
                        copyButton.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy file path:', err);
                    copyButton.textContent = '❌ Failed';
                    setTimeout(() => {
                        copyButton.textContent = '📋 Copy';
                    }, 2000);
                }
            }
        });

        document.getElementById('textCopyButton').addEventListener('click', async () => {
            const textRepresentation = document.getElementById('textRepresentation');
            const copyButton = document.getElementById('textCopyButton');
            const text = textRepresentation.textContent;
            
            if (text) {
                try {
                    await navigator.clipboard.writeText(text);
                    copyButton.textContent = '✓ Copied!';
                    copyButton.classList.add('copied');
                    setTimeout(() => {
                        copyButton.textContent = '📋 Copy';
                        copyButton.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy text representation:', err);
                    copyButton.textContent = '❌ Failed';
                    setTimeout(() => {
                        copyButton.textContent = '📋 Copy';
                    }, 2000);
                }
            }
        });

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'dataInfo':
                    currentData = message.data;
                    lastLoadTime = message.lastLoadTime;
                    displayDataInfo(message.data, message.filePath);
                    updateTimestamp(message.lastLoadTime);
                    break;
                ${plottingCapabilities ? `
                case 'variableList':
                    populateVariableSelect(message.data);
                    break;
                ` : ''}
                ${plottingCapabilities ? `
                case 'plotData':
                    displayPlot(message.data);
                    break;
                ` : ''}
                case 'htmlRepresentation':
                    displayHtmlRepresentation(message.data);
                    break;
                case 'textRepresentation':
                    displayTextRepresentation(message.data);
                    break;
                case 'showVersions':
                    displayShowVersions(message.data);
                    break;
                case 'error':
                    showError(message.message, message.details);
                    break;
            }
        });

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
                
                // let timeAgo;
                // if (diffMinutes < 1) {
                //     timeAgo = 'just now';
                // } else if (diffMinutes < 60) {
                //     timeAgo = \`\${diffMinutes}m ago\`;
                // } else if (diffHours < 24) {
                //     timeAgo = \`\${diffHours}h ago\`;
                // } else {
                //     timeAgo = \`\${diffDays}d ago\`;
                // }
                
                const timeString = date.toLocaleTimeString();
                timestampText.textContent = \`Last loaded: \${timeString}\`;
                // timestampText.textContent = \`Last loaded: \${timeString} (\${timeAgo})\`;
                timestampElement.classList.remove('hidden');
            } else {
                timestampElement.classList.add('hidden');
            }
        }

        function displayDataInfo(data, filePath) {
            if (!data) {
                showError('No data available');
                return;
            }

            if (data.error) {
                showError(data.error);
                return;
            }
            
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
            fileInfo.innerHTML = \`
                <p><strong>Format:</strong> \${data.format || 'Unknown'}</p>
                \${data.fileSize ? \`
                    <p><strong>Size:</strong> \${formatFileSize(data.fileSize)}</p>\` : ''}
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
                            <small>
                                \${variable.dtype} \${variable.shape ? '(' + variable.shape.join(', ') + ')' : ''}<br>
                                \${variable.dimensions && variable.dimensions.length > 0 ? 'Dims: ' + variable.dimensions.join(', ') : ''}<br>
                                \${variable.size_bytes ? 'Size: ' + formatFileSize(variable.size_bytes) : ''}
                            </small>
                        </div>
                    \`)
                    .join('');
                
                // Add click handlers for variable selection
                ${plottingCapabilities ? `
                variablesContainer.querySelectorAll('.variable-item').forEach(item => {
                    item.addEventListener('click', () => {
                        variablesContainer.querySelectorAll('.variable-item').forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        selectedVariable = item.dataset.variable;
                        document.getElementById('variableSelect').value = selectedVariable;
                        document.getElementById('plotButton').disabled = false;
                    });
                });
                ` : ''}
            } else {
                variablesContainer.innerHTML = '<p>No variables found</p>';
            }

            // Request variable list for dropdown
            ${plottingCapabilities ? `
            vscode.postMessage({ command: 'getVariableList' });
            ` : ''}
            
            // Request HTML representation
            vscode.postMessage({ command: 'getHtmlRepresentation' });
            
            // Request text representation
            vscode.postMessage({ command: 'getTextRepresentation' });
            
            // Request show versions
            vscode.postMessage({ command: 'getShowVersions' });

            // Show content
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('content').classList.remove('hidden');
        }

        ${plottingCapabilities ? `
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
        ` : ''}

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
            if (versionsData) {
                container.textContent = versionsData;
            } else {
                container.textContent = 'Failed to load version information';
            }
        }

        function showError(message, details = '') {
            const errorDiv = document.getElementById('error');
            
            // Format message to handle multi-line errors
            const formattedMessage = message.replace(/\\n/g, '<br>');
            const formattedDetails = details ? details.replace(/\\n/g, '<br>') : '';
            
            errorDiv.innerHTML = \`
                <h3>❌ Error</h3>
                <p><strong>Message:</strong> \${formattedMessage}</p>
                \${formattedDetails ? \`<p><strong>Details:</strong> \${formattedDetails}</p>\` : ''}
                <div style="margin-top: 15px;">
                    <h4>💡 Troubleshooting Steps:</h4>
                    <ol>
                        <li>Make sure Python is installed and accessible</li>
                        <li>Install required packages: <code>pip install xarray netCDF4 zarr h5py numpy matplotlib</code></li>
                        <li>Use Command Palette (Ctrl+Shift+P) → "Python: Select Interpreter"</li>
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
            const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
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
