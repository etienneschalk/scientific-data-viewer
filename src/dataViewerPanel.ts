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
                enableFindWidget: true,
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
                // Use UI controller to refresh data
                if (panel._uiController && panel._currentFile) {
                    await panel._uiController.loadFile(panel._currentFile.fsPath);
                }
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
        this._uiController = new UIController(panel.webview, extensionUri, dataProcessor, (error) => {
            this._handleError(error);
        });

        // Set the webview's initial html content
        this._update(fileUri, dataProcessor);

        // Check if devMode is enabled and run commands automatically after webview is ready
        this._handleDevMode();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Legacy message handling removed - now using new MessageBus system

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
            
            // Load the file and handle success/error
            this._uiController.loadFile(fileUri.fsPath).then(() => {
                // Remove from error state on successful load
                DataViewerPanel.removePanelWithError(this);
            }).catch((error) => {
                // Error handling is already done in UIController
                Logger.debug(`Error loading file in update: ${error.message}`);
            });
        }
    }

    // Legacy _handleGetDataInfo method removed - now handled by UIController

    // Legacy message handling methods removed - now handled by UIController

    private _handleError(error: Error): void {
        Logger.error(`Panel error: ${error.message}`);
        
        // Add this panel to the error state so it can be refreshed later
        DataViewerPanel.addPanelWithError(this);
        
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

    private async _handleDevMode(): Promise<void> {
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        const devMode = config.get('devMode', false);
        
        if (devMode) {
            Logger.info('🔧 DevMode enabled - automatically running development commands...');
            
            // Run "Show Extension Logs" command immediately
            try {
                await vscode.commands.executeCommand('scientificDataViewer.showLogs');
                Logger.info('🔧 DevMode: Show Extension Logs command executed');
            } catch (error) {
                Logger.error(`🔧 DevMode: Failed to execute showLogs command: ${error}`);
            }
            
            // Wait 1 second for webview to be fully ready before opening developer tools
            setTimeout(async () => {
                try {
                    await vscode.commands.executeCommand('scientificDataViewer.openDeveloperTools');
                    Logger.info('🔧 DevMode: Open Developer Tools command executed');
                } catch (error) {
                    Logger.error(`🔧 DevMode: Failed to execute openDeveloperTools command: ${error}`);
                }
            }, 1000);
        }
    }

    private _getHtmlForWebview(plottingCapabilities: boolean = false) {
        const header = HTMLGenerator.generateHeader(plottingCapabilities, this._lastLoadTime?.toISOString() || null);
        const loadingAndError = HTMLGenerator.generateLoadingAndError();
        const content = HTMLGenerator.generateContent(plottingCapabilities);
        
        return HTMLGenerator.generateMainHTML(plottingCapabilities, header + loadingAndError + content);
    }
}
