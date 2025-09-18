import * as vscode from 'vscode';
import * as path from 'path';
import { DataProcessor, DataInfo, DataInfoResult } from './dataProcessor';
import { Logger } from './logger';
import { HTMLGenerator } from './ui/HTMLGenerator';
import { UIController } from './ui/UIController';
import { StateManager } from './state/AppState';
import { ErrorBoundary } from './error/ErrorBoundary';


// Taken from python/get_data_info.py
// TODO eschalk: Ideally, a nice formatting display should be placed in the errors,
// relying solely on the already present info in package.json
const SUPPORTED_EXTENSIONS = [
    ".nc",
    ".netcdf",
    ".zarr",
    ".h5",
    ".hdf5",
    ".grib",
    ".grib2",
    ".tif",
    ".tiff",
    ".geotiff",
    ".jp2",
    ".jpeg2000",
    ".safe",
    ".nc4",
    ".cdf",
]
export class DataViewerPanel {
    public static activePanels: Set<DataViewerPanel> = new Set();
    public static panelsWithErrors: Set<DataViewerPanel> = new Set();
    public static readonly viewType = 'scientificDataViewer';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _dataInfo: DataInfo | null = null;
    private _currentFile: vscode.Uri;
    private _lastLoadTime: Date | null = null;
    private _uiController: UIController | null = null;
    private _stateManager: StateManager | null = null;
    private _errorBoundary: ErrorBoundary;

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
            `Scientific Data Viewer: ${path.basename(fileUri.fsPath)}`,
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

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, fileUri: vscode.Uri, dataProcessor: DataProcessor): DataViewerPanel {
        const dataViewerPanel = new DataViewerPanel(panel, extensionUri, fileUri, dataProcessor);
        DataViewerPanel.activePanels.add(dataViewerPanel);
        return dataViewerPanel;
    }

    public static async refreshPanelsWithErrors(dataProcessor: DataProcessor) {
        Logger.debug(`[_refreshPanelsWithErrors] Refreshing ${DataViewerPanel.panelsWithErrors.size} panels with errors`);
        const errorPanelCount = DataViewerPanel.panelsWithErrors.size;
        if (errorPanelCount > 0) {
            Logger.info(`Refreshing ${errorPanelCount} panels with errors due to Python environment initialization...`);
            for (const panel of DataViewerPanel.panelsWithErrors) {
                await panel._handleGetDataInfo();
            }
        }
    }

    private static addPanelWithError(panel: DataViewerPanel) {
        DataViewerPanel.panelsWithErrors.add(panel);
    }

    private static removePanelWithError(panel: DataViewerPanel) {
        DataViewerPanel.panelsWithErrors.delete(panel);
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
        this._errorBoundary = ErrorBoundary.getInstance();

        // Initialize state management and UI controller
        this._stateManager = new StateManager();
        this._uiController = new UIController(panel.webview, extensionUri, dataProcessor);

        // Set the webview's initial html content
        this._update(fileUri, dataProcessor);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview (legacy support)
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                Logger.debug(`[DataViewerPanel] Received message: ${message.command}`);
                switch (message.command) {
                    case 'getDataInfo':
                        await this._handleGetDataInfo();
                        break;
                    case 'createPlot':
                        if (vscode.workspace.getConfiguration('scientificDataViewer').get('plottingCapabilities', false)) {
                            await this._handleCreatePlot(message.variable, message.plotType);
                        }
                        break;
                    case 'getPythonPath':
                        await this._handleGetPythonPath();
                        break;
                    case 'getExtensionConfig':
                        await this._handleGetExtensionConfig();
                        break;
                }
            },
            null,
            this._disposables
        );

        // Register error handler for this panel
        this._errorBoundary.registerHandler(`panel-${panel.viewColumn}`, (error, context) => {
            Logger.error(`Panel error: ${error.message}`);
            this._handleError(error);
        });
    }

    public async _update(fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        Logger.info(`🚚 📖 Updating data viewer panel for: ${fileUri.fsPath}`);
        this._currentFile = fileUri;
        this.dataProcessor = dataProcessor;

        // Update the panel title to reflect the new file
        this._panel.title = `Scientific Data Viewer: ${path.basename(fileUri.fsPath)}`;

        // Get configuration for plotting capabilities
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        const plottingCapabilities = config.get('plottingCapabilities', false);

        // Set initial HTML first
        this._panel.webview.html = this._getHtmlForWebview(plottingCapabilities);

        // Update UI controller with new configuration
        if (this._uiController) {
            this._uiController.setPlottingCapabilities(plottingCapabilities);
        }

        // The webview will request data via the message handler
    }

    private async _handleGetDataInfo() {
        Logger.debug(`[_handleGetDataInfo] Handling get data info for: ${this._currentFile.fsPath}`);
        try {
            // Check if a Python interpreter is configured
            if (!this.dataProcessor.pythonManagerInstance.hasPythonPath()) {
                Logger.error('🐍 ❌ Python path not found. Please configure Python interpreter first.');
                this._panel.webview.postMessage({
                    command: 'error',
                    message: 'Python path not found. Please configure Python interpreter first.',
                    details: 'Use Command Palette (Ctrl+Shift+P) and run "Python: Select Interpreter" to set up Python environment.'
                });
                // Track this panel as having an error
                DataViewerPanel.addPanelWithError(this);
                return;
            }

            // Check if Python environment is ready
            if (!this.dataProcessor.pythonManagerInstance.isReady()) {
                Logger.error('🐍 ❌ Python environment not ready. Please install core dependencies first.');
                Logger.error(`🐍 ❌ Python path: ${this.dataProcessor.pythonManagerInstance.getPythonPath()}`);
                Logger.error(`🐍 ❌ Python ready: ${this.dataProcessor.pythonManagerInstance.isReady()}`);
                this._panel.webview.postMessage({
                    command: 'error',
                    message: 'Python environment not ready. Please install core dependencies first.',
                    details: 'Install core dependencies: `pip install xarray`'
                });
                // Track this panel as having an error
                DataViewerPanel.addPanelWithError(this);
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
                // Track this panel as having an error
                DataViewerPanel.addPanelWithError(this);
                return;
            }

            this._dataInfo = (await this.dataProcessor.getDataInfo(this._currentFile))

            if (!this._dataInfo) {
                this._panel.webview.postMessage({
                    command: 'error',
                    message: 'Failed to load data file. The file might be corrupted or in an unsupported format.',
                    details: `Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`
                });
                // Track this panel as having an error
                DataViewerPanel.addPanelWithError(this);
                return;
            }

            // Logger.info(`Data info: ${JSON.stringify(this._dataInfo, null, 2)}`);

            let proposeToInstallMissingPackages = false;
            if (this._dataInfo.error) {
                let errorInfo = this._dataInfo.error;
                let errorMessage = `Data processing error: ${errorInfo.error}`;
                let errorDetails = 'This might be due to missing Python packages or file format issues.';
                // Check for missing packages regardless of error type
                if (errorInfo.format_info?.missing_packages && errorInfo.format_info.missing_packages.length > 0) {
                    errorMessage = `Missing dependencies for ${errorInfo.format_info.display_name} files: ${errorInfo.format_info.missing_packages.join(', ')}`;
                    errorDetails = errorInfo.suggestion || `Install required packages: pip install ${errorInfo.format_info.missing_packages.join(' ')}`;
                    proposeToInstallMissingPackages = true;
                } else if (errorInfo.error_type === 'ImportError') {
                    errorMessage = `Missing dependencies: ${errorInfo.error}`;
                    errorDetails = errorInfo.suggestion || 'Install required packages using pip install <package_name>';
                } else if (errorInfo.suggestion) {
                    errorDetails = errorInfo.suggestion;
                }

                this._panel.webview.postMessage({
                    command: 'error',
                    message: errorMessage,
                    details: errorDetails,
                    error_type: errorInfo.error_type,
                    format_info: errorInfo.format_info
                });
                // Track this panel as having an error
                DataViewerPanel.addPanelWithError(this);


                if (proposeToInstallMissingPackages) {
                    // Show installation prompt for missing packages
                      const installAction = await vscode.window.showWarningMessage(
                        `Missing packages for ${errorInfo.format_info.display_name} files: ${errorInfo.format_info.missing_packages.join(', ')}`,
                        'Install Packages',
                        'Show Details'
                    );
                    
                    if (installAction === 'Install Packages') {
                        try {
                            await this.dataProcessor.pythonManagerInstance.installPackagesForFormat(
                                errorInfo.format_info.missing_packages
                            );
                            // Refresh the data after successful installation
                            await this._handleGetDataInfo();
                        } catch (error) {
                            vscode.window.showErrorMessage(
                                `Failed to install packages: ${error}. Please install manually: pip install ${errorInfo.format_info.missing_packages.join(' ')}`
                            );
                        }
                    }
                }
                return;
            }

            // Update last load time
            this._lastLoadTime = new Date();

            this._panel.webview.postMessage({
                command: 'dataInfo',
                data: this._dataInfo?.result,
                filePath: this._currentFile.fsPath,
                lastLoadTime: this._lastLoadTime.toISOString()
            });
            this._panel.webview.postMessage({
                command: 'htmlRepresentation',
                data: this._dataInfo.result?.xarray_html_repr
            });
            this._panel.webview.postMessage({
                command: 'textRepresentation',
                data: this._dataInfo.result?.xarray_text_repr
            });
            this._panel.webview.postMessage({
                command: 'showVersions',
                data: this._dataInfo.result?.xarray_show_versions
            });

            // Remove this panel from error tracking since data loaded successfully
            DataViewerPanel.removePanelWithError(this);
        } catch (error) {
            Logger.error(`Error in _handleGetDataInfo: ${error}`);
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to load data info: ${error}`,
                details: 'Check the VSCode Output panel (View → Output → "Scientific Data Viewer") for more details.'
            });
            // Track this panel as having an error
            DataViewerPanel.addPanelWithError(this);
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

    private async _handleGetPythonPath() {
        try {
            const pythonPath = this.dataProcessor.pythonManagerInstance.getCurrentPythonPath();
            this._panel.webview.postMessage({
                command: 'pythonPath',
                data: pythonPath || 'No Python interpreter configured'
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to get Python path: ${error}`
            });
        }
    }

    private async _handleGetExtensionConfig() {
        try {
            const config = vscode.workspace.getConfiguration('scientificDataViewer');
            const configData = {
                'scientificDataViewer.allowMultipleTabsForSameFile': config.get('allowMultipleTabsForSameFile'),
                'scientificDataViewer.plottingCapabilities': config.get('plottingCapabilities'),
                'scientificDataViewer.maxFileSize': config.get('maxFileSize'),
                'scientificDataViewer.autoRefresh': config.get('autoRefresh')
            };

            this._panel.webview.postMessage({
                command: 'extensionConfig',
                data: JSON.stringify(configData, null, 2)
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                message: `Failed to get extension configuration: ${error}`
            });
        }
    }

    private _handleError(error: Error): void {
        Logger.error(`Panel error: ${error.message}`);
        this._panel.webview.postMessage({
            command: 'error',
            message: error.message,
            details: 'An error occurred in the data viewer panel. Please check the output panel for more details.'
        });
    }

    public dispose() {
        // Remove this panel from the active panels set
        DataViewerPanel.activePanels.delete(this);

        // Remove this panel from the error tracking set
        DataViewerPanel.removePanelWithError(this);

        // Clean up UI controller
        if (this._uiController) {
            this._uiController.dispose();
            this._uiController = null;
        }

        // Clean up state manager
        if (this._stateManager) {
            this._stateManager = null;
        }

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
        const header = HTMLGenerator.generateHeader(plottingCapabilities, this._lastLoadTime?.toISOString() || null);
        const loadingAndError = HTMLGenerator.generateLoadingAndError();
        const content = HTMLGenerator.generateContent(plottingCapabilities);
        
        return HTMLGenerator.generateMainHTML(plottingCapabilities, header + loadingAndError + content);
    }
}
