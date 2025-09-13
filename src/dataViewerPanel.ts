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

    public static createOrShow(extensionUri: vscode.Uri, fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Check if this file is already open in an existing panel
        for (const panel of DataViewerPanel.activePanels) {
            if (panel._currentFile.fsPath === fileUri.fsPath) {
                // File is already open, focus on the existing panel without refreshing
                panel._panel.reveal(column);
                return;
            }
        }

        // File is not open, create a new panel
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
                    case 'createAdvancedPlot':
                        await this._handleCreateAdvancedPlot(message.variable, message.plotConfig);
                        break;
                    case 'getVariableList':
                        await this._handleGetVariableList();
                        break;
                    case 'getHtmlRepresentation':
                        await this._handleGetHtmlRepresentation();
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
        
        this._panel.webview.html = this._getHtmlForWebview();
        
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
                data: this._dataInfo,
                filePath: this._currentFile.fsPath
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

    private async _handleCreateAdvancedPlot(variable: string, plotConfig: any) {
        try {
            // Show notification that advanced plotting has started
            vscode.window.showInformationMessage(
                `Creating advanced plot for variable '${variable}'... Check the output panel for progress.`,
                'Show Logs'
            ).then(selection => {
                if (selection === 'Show Logs') {
                    Logger.show();
                }
            });
            
            const plotData = await this.dataProcessor.createAdvancedPlot(this._currentFile, variable, plotConfig);
            if (plotData) {
                this._panel.webview.postMessage({
                    command: 'advancedPlotData',
                    data: plotData
                });
            } else {
                this._panel.webview.postMessage({
                    command: 'error',
                    message: 'Failed to create advanced plot',
                    details: 'Check the output panel for more details'
                });
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to create advanced plot: ${error}`
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
        
        .plot-config {
            display: block;
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .plot-config h4 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }
        
        .dimension-controls {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 15px 0;
        }
        
        .dimension-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .dimension-group label {
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        
        .dimension-selector {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .dimension-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 4px;
        }
        
        .dimension-item input[type="checkbox"] {
            margin: 0;
        }
        
        .dimension-item select {
            flex: 1;
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 8px;
            border-radius: 4px;
        }
        
        .subset-controls {
            margin-top: 15px;
            padding: 10px;
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 4px;
        }
        
        .subset-controls h5 {
            margin-top: 0;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
        }
        
        .subset-input {
            display: flex;
            gap: 10px;
            align-items: center;
            margin: 5px 0;
        }
        
        .subset-input input {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            border-radius: 4px;
            width: 80px;
        }
        
        .subset-input label {
            min-width: 60px;
            font-size: 12px;
        }
        
        .plot-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        }
        
        .plot-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .plot-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }
        
        .secondary-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .secondary-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
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
                <option value="auto" selected>Auto (Recommended)</option>
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
            <h3>Dimensions</h3>
            <div id="dimensions" class="dimensions"></div>
        </div>
        
        <div class="info-section">
            <h3>Variables</h3>
            <div id="variables" class="variables"></div>
        </div>
        
        <div class="info-section">
            <h3>Plot Configuration</h3>
            <div id="plotConfig" class="plot-config">
                <h4>Advanced Plotting Options</h4>
                <p>Configure how to plot the selected variable by choosing which dimensions to use for columns and rows, and optionally subset the data.</p>
                <p><strong>DEBUG:</strong> Plot configuration section is visible!</p>
                
                <div class="dimension-controls">
                    <div class="dimension-group">
                        <label>Column Dimensions (col)</label>
                        <div id="colDimensions" class="dimension-selector">
                            <!-- Will be populated dynamically -->
                        </div>
                    </div>
                    
                    <div class="dimension-group">
                        <label>Row Dimensions (row)</label>
                        <div id="rowDimensions" class="dimension-selector">
                            <!-- Will be populated dynamically -->
                        </div>
                    </div>
                </div>
                
                <div id="subsetControls" class="subset-controls" style="display: none;">
                    <h5>Data Subsetting</h5>
                    <p>Select specific indices or ranges for each dimension:</p>
                    <div id="subsetInputs">
                        <!-- Will be populated dynamically -->
                    </div>
                </div>
                
                <div style="margin-top: 15px;">
                    <button id="advancedPlotButton" class="plot-button" disabled>Create Advanced Plot</button>
                    <button id="resetPlotConfigButton" class="secondary-button">Reset to Auto</button>
                </div>
            </div>
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
            updatePlotConfiguration();
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

        document.getElementById('refreshButton').addEventListener('click', () => {
            vscode.postMessage({ command: 'getDataInfo' });
        });

        // Advanced plotting event listeners
        document.getElementById('advancedPlotButton').addEventListener('click', () => {
            if (selectedVariable) {
                const plotConfig = getPlotConfiguration();
                vscode.postMessage({
                    command: 'createAdvancedPlot',
                    variable: selectedVariable,
                    plotConfig: plotConfig
                });
            }
        });

        document.getElementById('resetPlotConfigButton').addEventListener('click', () => {
            resetPlotConfiguration();
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

        // Plot configuration functions
        function isSpatialDimension(dimName) {
            const spatialPatterns = ['x', 'y', 'lon', 'lat', 'longitude', 'latitude', 'east', 'west', 'north', 'south', 'easting', 'westing', 'northing', 'southing'];
            return spatialPatterns.some(pattern => dimName.toLowerCase().includes(pattern));
        }

        function updatePlotConfiguration() {
            console.log('updatePlotConfiguration called', {
                selectedVariable,
                hasCurrentData: !!currentData,
                hasVariables: !!(currentData && currentData.variables),
                variablesCount: currentData?.variables?.length || 0
            });
            
            if (!selectedVariable || !currentData || !currentData.variables) {
                console.log('Hiding plot config: missing data');
                document.getElementById('plotConfig').style.display = 'none';
                return;
            }

            const variable = currentData.variables.find(v => v.name === selectedVariable);
            console.log('Found variable:', variable);
            
            if (!variable) {
                console.log('Hiding plot config: variable not found');
                document.getElementById('plotConfig').style.display = 'none';
                return;
            }

            // Show plot configuration for multi-dimensional variables
            if (variable.dimensions && variable.dimensions.length >= 2) {
                console.log('Showing plot config for variable with dimensions:', variable.dimensions);
                document.getElementById('plotConfig').style.display = 'block';
                populateDimensionSelectors(variable);
                document.getElementById('advancedPlotButton').disabled = false;
            } else {
                console.log('Hiding plot config: not enough dimensions', variable.dimensions);
                document.getElementById('plotConfig').style.display = 'none';
                document.getElementById('advancedPlotButton').disabled = true;
            }
        }

        function populateDimensionSelectors(variable) {
            const colContainer = document.getElementById('colDimensions');
            const rowContainer = document.getElementById('rowDimensions');
            
            // Clear existing content
            colContainer.innerHTML = '';
            rowContainer.innerHTML = '';

            // Separate spatial and non-spatial dimensions
            const spatialDims = variable.dimensions.filter(dim => isSpatialDimension(dim));
            const nonSpatialDims = variable.dimensions.filter(dim => !isSpatialDimension(dim));

            // Add spatial dimensions (these should be plotted directly)
            spatialDims.forEach(dim => {
                const item = document.createElement('div');
                item.className = 'dimension-item';
                item.innerHTML = '<input type="checkbox" id="col-' + dim + '" value="' + dim + '" checked disabled>' +
                                '<label for="col-' + dim + '">' + dim + ' (spatial)</label>';
                colContainer.appendChild(item);
            });

            // Add non-spatial dimensions for col selection
            nonSpatialDims.forEach(dim => {
                const item = document.createElement('div');
                item.className = 'dimension-item';
                item.innerHTML = '<input type="checkbox" id="col-' + dim + '" value="' + dim + '">' +
                                '<label for="col-' + dim + '">' + dim + '</label>';
                colContainer.appendChild(item);
            });

            // Add non-spatial dimensions for row selection
            nonSpatialDims.forEach(dim => {
                const item = document.createElement('div');
                item.className = 'dimension-item';
                item.innerHTML = '<input type="checkbox" id="row-' + dim + '" value="' + dim + '">' +
                                '<label for="row-' + dim + '">' + dim + '</label>';
                rowContainer.appendChild(item);
            });

            // Add event listeners for subset controls
            addDimensionChangeListeners(variable);
        }

        function addDimensionChangeListeners(variable) {
            const checkboxes = document.querySelectorAll('#colDimensions input[type="checkbox"], #rowDimensions input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    updateSubsetControls(variable);
                });
            });
        }

        function updateSubsetControls(variable) {
            const subsetControls = document.getElementById('subsetControls');
            const subsetInputs = document.getElementById('subsetInputs');
            
            // Get selected dimensions
            const selectedColDims = Array.from(document.querySelectorAll('#colDimensions input[type="checkbox"]:checked')).map(cb => cb.value);
            const selectedRowDims = Array.from(document.querySelectorAll('#rowDimensions input[type="checkbox"]:checked')).map(cb => cb.value);
            const allSelectedDims = [...new Set([...selectedColDims, ...selectedRowDims])];
            
            // Filter out spatial dimensions (they don't need subsetting)
            const nonSpatialSelectedDims = allSelectedDims.filter(dim => !isSpatialDimension(dim));
            
            if (nonSpatialSelectedDims.length > 0) {
                subsetControls.style.display = 'block';
                subsetInputs.innerHTML = '';
                
                nonSpatialSelectedDims.forEach(dim => {
                    const dimInfo = currentData.dimensions[dim];
                    if (dimInfo) {
                        const subsetDiv = document.createElement('div');
                        subsetDiv.className = 'subset-input';
                        subsetDiv.innerHTML = '<label>' + dim + ':</label>' +
                                            '<input type="number" id="start-' + dim + '" placeholder="Start" min="0" max="' + (dimInfo - 1) + '" value="0">' +
                                            '<span>to</span>' +
                                            '<input type="number" id="end-' + dim + '" placeholder="End" min="0" max="' + (dimInfo - 1) + '" value="' + (dimInfo - 1) + '">' +
                                            '<span>(' + dimInfo + ' total)</span>';
                        subsetInputs.appendChild(subsetDiv);
                    }
                });
            } else {
                subsetControls.style.display = 'none';
            }
        }

        function getPlotConfiguration() {
            const colDims = Array.from(document.querySelectorAll('#colDimensions input[type="checkbox"]:checked')).map(cb => cb.value);
            const rowDims = Array.from(document.querySelectorAll('#rowDimensions input[type="checkbox"]:checked')).map(cb => cb.value);
            
            const subset = {};
            const subsetInputs = document.querySelectorAll('#subsetInputs .subset-input');
            subsetInputs.forEach(input => {
                const dim = input.querySelector('label').textContent.replace(':', '');
                const start = parseInt(input.querySelector('input[placeholder="Start"]').value) || 0;
                const end = parseInt(input.querySelector('input[placeholder="End"]').value) || currentData.dimensions[dim] - 1;
                subset[dim] = { start, end };
            });

            return {
                col: colDims,
                row: rowDims,
                subset: subset
            };
        }

        function resetPlotConfiguration() {
            // Reset all checkboxes
            document.querySelectorAll('#colDimensions input[type="checkbox"]').forEach(cb => {
                cb.checked = isSpatialDimension(cb.value);
            });
            document.querySelectorAll('#rowDimensions input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            
            // Hide subset controls
            document.getElementById('subsetControls').style.display = 'none';
        }

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'dataInfo':
                    currentData = message.data;
                    displayDataInfo(message.data, message.filePath);
                    break;
                case 'variableList':
                    populateVariableSelect(message.data);
                    break;
                case 'plotData':
                    displayPlot(message.data);
                    break;
                case 'advancedPlotData':
                    displayPlot(message.data);
                    break;
                case 'htmlRepresentation':
                    displayHtmlRepresentation(message.data);
                    break;
                case 'error':
                    showError(message.message, message.details);
                    break;
            }
        });

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
            fileInfo.innerHTML = '<p><strong>Format:</strong> ' + (data.format || 'Unknown') + '</p>' +
                                (data.fileSize ? '<p><strong>Size:</strong> ' + formatFileSize(data.fileSize) + '</p>' : '');


            // Display dimensions
            const dimensionsContainer = document.getElementById('dimensions');
            if (data.dimensions) {
                dimensionsContainer.innerHTML = Object.entries(data.dimensions)
                    .map(([name, size]) => '<div class="dimension-item">' + name + ': ' + size + '</div>')
                    .join('');
            } else {
                dimensionsContainer.innerHTML = '<p>No dimensions found</p>';
            }

            // Display variables
            const variablesContainer = document.getElementById('variables');
            if (data.variables && data.variables.length > 0) {
                variablesContainer.innerHTML = data.variables
                    .map(variable => {
                        const shapeStr = variable.shape ? '(' + variable.shape.join(', ') + ')' : '';
                        const dimsStr = variable.dimensions && variable.dimensions.length > 0 ? 'Dims: ' + variable.dimensions.join(', ') : '';
                        const sizeStr = variable.size_bytes ? 'Size: ' + formatFileSize(variable.size_bytes) : '';
                        return '<div class="variable-item" data-variable="' + variable.name + '">' +
                               '<strong>' + variable.name + '</strong><br>' +
                               '<small>' + variable.dtype + ' ' + shapeStr + '<br>' +
                               dimsStr + '<br>' + sizeStr + '</small></div>';
                    })
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
            
            // Request HTML representation
            vscode.postMessage({ command: 'getHtmlRepresentation' });

            // Show content
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('content').classList.remove('hidden');
            
            // Update plot configuration for the currently selected variable
            updatePlotConfiguration();
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
                container.innerHTML = '<img src="data:image/png;base64,' + plotData + '" alt="Plot">';
            } else {
                container.innerHTML = '<p>Failed to generate plot</p>';
            }
        }

        function displayHtmlRepresentation(htmlData) {
            const container = document.getElementById('htmlRepresentation');
            if (htmlData) {
                container.innerHTML = htmlData;
            } else {
                container.innerHTML = '<p>Failed to load HTML representation</p>';
            }
        }

        function showError(message, details = '') {
            const errorDiv = document.getElementById('error');
            
            // Format message to handle multi-line errors
            const formattedMessage = message.replace(/\\n/g, '<br>');
            const formattedDetails = details ? details.replace(/\\n/g, '<br>') : '';
            
            errorDiv.innerHTML = '<h3>❌ Error</h3>' +
                                '<p><strong>Message:</strong> ' + formattedMessage + '</p>' +
                                (formattedDetails ? '<p><strong>Details:</strong> ' + formattedDetails + '</p>' : '') +
                                '<div style="margin-top: 15px;">' +
                                '<h4>💡 Troubleshooting Steps:</h4>' +
                                '<ol>' +
                                '<li>Make sure Python is installed and accessible</li>' +
                                '<li>Install required packages: <code>pip install xarray netCDF4 zarr h5py numpy matplotlib</code></li>' +
                                '<li>Use Command Palette (Ctrl+Shift+P) → "Select Python Interpreter"</li>' +
                                '<li>Check file format is supported (.nc, .netcdf, .zarr, .h5, .hdf5)</li>' +
                                '<li>Check VSCode Output panel for more details</li>' +
                                '</ol>' +
                                '</div>';
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
        console.log('Page loaded, checking plot config element...');
        const plotConfig = document.getElementById('plotConfig');
        console.log('Plot config element found:', !!plotConfig);
        if (plotConfig) {
            console.log('Plot config display style:', plotConfig.style.display);
            console.log('Plot config computed style:', window.getComputedStyle(plotConfig).display);
        }
        
        vscode.postMessage({ command: 'getDataInfo' });
    </script>
</body>
</html>`;
    }
}
