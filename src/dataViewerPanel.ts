import * as vscode from 'vscode';
import * as path from 'path';
import { DataProcessor } from './dataProcessor';
import { Logger } from './logger';
import { UIController } from './ui/UIController';


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
    public static createdCount = 0;
    public static readonly viewType = 'scientificDataViewer';

    private readonly _webviewPanel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _currentFile: vscode.Uri;
    private _uiController: UIController;

    public static createOrShow(extensionUri: vscode.Uri, fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Get configuration directly from VSCode
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        
        // Check if this file is already open in an existing panel (only if multiple tabs are not allowed)
        if (!config.get('allowMultipleTabsForSameFile', false)) {
            for (const panel of DataViewerPanel.activePanels) {
                if (panel._currentFile.fsPath === fileUri.fsPath) {
                    // File is already open, focus on the existing panel without refreshing
                    Logger.info(`File ${fileUri.fsPath} is already open, focusing existing panel (allowMultipleTabsForSameFile: false)`);
                    panel._webviewPanel.reveal(column);
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
        DataViewerPanel.create(panel, fileUri, dataProcessor);
    }

    public static create(panel: vscode.WebviewPanel, fileUri: vscode.Uri, dataProcessor: DataProcessor): DataViewerPanel {
        DataViewerPanel.createdCount++;
        const dataViewerPanel = new DataViewerPanel(panel, fileUri, dataProcessor);
        DataViewerPanel.activePanels.add(dataViewerPanel);
        return dataViewerPanel;
    }

    public static async refreshPanelsWithErrors() {
        Logger.debug(`[refreshPanelsWithErrors] Refreshing ${DataViewerPanel.panelsWithErrors.size} panels with errors`);
        const errorPanelCount = DataViewerPanel.panelsWithErrors.size;
        if (errorPanelCount > 0) {
            for (const panel of DataViewerPanel.panelsWithErrors) {
                // Use UI controller to refresh data
                if (panel._uiController && panel._currentFile) {
                    Logger.debug(`[refreshPanelsWithErrors] Refreshing panel: ${panel._currentFile.fsPath}`);
                    await panel._uiController.loadFile(panel._currentFile.fsPath);
                }
            }
        }
    }

    private static addPanelWithError(panel: DataViewerPanel) {
        Logger.debug(`[addPanelWithError]    ${DataViewerPanel.panelsWithErrors.size} panels with errors`);
        DataViewerPanel.panelsWithErrors.add(panel);
        Logger.debug(`[addPanelWithError]    ${DataViewerPanel.panelsWithErrors.size} panels with errors`);
    }

    private static removePanelWithError(panel: DataViewerPanel) {
        Logger.debug(`[removePanelWithError] ${DataViewerPanel.panelsWithErrors.size} panels with errors`);
        DataViewerPanel.panelsWithErrors.delete(panel);
        Logger.debug(`[removePanelWithError] ${DataViewerPanel.panelsWithErrors.size} panels with errors`);
    }

    /**
     * Dispose of static resources
     */
    public static dispose(): void {
        // Static resources are now managed by the main extension
    }

    private constructor(webviewPanel: vscode.WebviewPanel, fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        this._webviewPanel = webviewPanel;
        this._webviewPanel.title = `Scientific Data Viewer: ${path.basename(fileUri.fsPath)}`;
        this._currentFile = fileUri;

        // Set the webview's initial html content
        Logger.info(`🚚 📖 Initializing data viewer panel for: ${fileUri.fsPath}`);

        // Initialize state management and UI controller
        this._uiController = new UIController(DataViewerPanel.createdCount, webviewPanel.webview, dataProcessor, (error) => {
            Logger.error(`[UIController] Error: ${error.message}`);
            DataViewerPanel.addPanelWithError(this);
        }, (success) => {
            Logger.info(`[UIController] Success: ${success}`);
            DataViewerPanel.removePanelWithError(this);
        });

        // Update the panel title to reflect the new file

        // Get configuration for plotting capabilities
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        const plottingCapabilities = config.get('plottingCapabilities', false);

        // Set initial HTML first

        // Update UI controller with new configuration
        this._uiController.setHtml(plottingCapabilities);
        this._uiController.setPlottingCapabilities(plottingCapabilities);
        
        // Load the file and handle success/error
        this._uiController.loadFile(fileUri.fsPath)

        // Check if devMode is enabled and run commands automatically after webview is ready
        this._handleDevMode();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._webviewPanel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public dispose() {
        // Remove this panel from the active panels set
        DataViewerPanel.activePanels.delete(this);

        // Remove this panel from the error tracking set
        DataViewerPanel.removePanelWithError(this);

        // Clean up UI controller
        if (this._uiController) {
            this._uiController.dispose();
        }

        // Clean up our resources
        this._webviewPanel.dispose();

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

    // Test compatibility methods - these delegate to UIController
    public async _handleGetDataInfo(): Promise<void> {
        if (this._uiController) {
            await this._uiController.loadFile(this._currentFile.fsPath);
        }
    }

    public async _handleCreatePlot(variable: string, plotType: string): Promise<void> {
        if (this._uiController) {
            try {
                const result = await (this._uiController as any).handleCreatePlot(variable, plotType);
                this._webviewPanel.webview.postMessage({
                    command: 'plotData',
                    data: result
                });
            } catch (error) {
                this._webviewPanel.webview.postMessage({
                    command: 'error',
                    data: { message: error instanceof Error ? error.message : 'Unknown error' }
                });
            }
        }
    }

    public async _handleGetPythonPath(): Promise<void> {
        if (this._uiController) {
            const result = await (this._uiController as any).handleGetPythonPath();
            this._webviewPanel.webview.postMessage({
                command: 'pythonPath',
                data: result
            });
        }
    }

    public async _handleGetExtensionConfig(): Promise<void> {
        if (this._uiController) {
            const result = await (this._uiController as any).handleGetExtensionConfig();
            this._webviewPanel.webview.postMessage({
                command: 'extensionConfig',
                data: result
            });
        }
    }

    public _getHtmlForWebview(plottingCapabilities: boolean): string {
        if (this._uiController) {
            return (this._uiController as any).getHtmlForWebview(plottingCapabilities);
        }
        return '<div>Scientific Data Viewer</div>';
    }


}