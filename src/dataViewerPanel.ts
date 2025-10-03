import * as vscode from 'vscode';
import * as path from 'path';
import { DataProcessor } from './dataProcessor';
import { Logger } from './logger';
import { UIController } from './ui/UIController';
import { OutlineProvider } from './outline/OutlineProvider';
import { HeaderExtractor } from './outline/HeaderExtractor';


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
];

export class DataViewerPanel {
    public static activePanels: Set<DataViewerPanel> = new Set();
    public static panelsWithErrors: Set<DataViewerPanel> = new Set();
    public static createdCount = 0;
    public static readonly viewType = 'scientificDataViewer';
    private static outlineProvider: OutlineProvider | undefined;

    private readonly _webviewPanel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _currentFile: vscode.Uri;
    private _uiController: UIController;
    private _isDisposed: boolean = false;

    public static setOutlineProvider(outlineProvider: OutlineProvider): void {
        DataViewerPanel.outlineProvider = outlineProvider;
    }

    /**
     * Notify that this panel has become active
     */
    private notifyPanelActive(): void {
        if (DataViewerPanel.outlineProvider && this._currentFile) {
            Logger.info(`📋 Panel became active for file: ${this._currentFile.fsPath}`);
            
            // Check if we have headers cached for this file
            const cachedHeaders = DataViewerPanel.outlineProvider.getHeadersForFile(this._currentFile);
            if (cachedHeaders) {
                // Switch to the cached headers for this file
                DataViewerPanel.outlineProvider.switchToFile(this._currentFile);
            } else {
                // Update outline for this panel
                this.updateOutline();
            }
        }
    }

    public static getActivePanel(fileUri: vscode.Uri): DataViewerPanel | undefined {
        if (!fileUri || !fileUri.fsPath) {
            Logger.warn(`🚚 📋 Invalid fileUri provided to getActivePanel`);
            return undefined;
        }
        
        Logger.info(`🚚 📋 Getting active panel for file: ${fileUri.fsPath}`);
        // Find and return the first panel that matches the given file path
        const panel = Array.from(DataViewerPanel.activePanels).find(panel => 
            panel._currentFile && panel._currentFile.fsPath === fileUri.fsPath
        );
        if (panel) {
            Logger.info(`🚚 📋 Found active panel for file: ${fileUri.fsPath}`);
            return panel;
        }
        Logger.info(`🚚 📋 No active panel found for file: ${fileUri.fsPath}`);
        return undefined;
    }

    public static async createFromScratchOrShow(extensionUri: vscode.Uri, fileUri: vscode.Uri, dataProcessor: DataProcessor) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Wait for Python initialization to complete before creating the panel
        // This prevents the race condition where file opening happens before Python validation
        try {
            await dataProcessor.pythonManagerInstance.waitForInitialization();
            Logger.info(`🚚 🧩 Python initialization complete, creating data viewer panel for: ${fileUri.fsPath}`);
        } catch (error) {
            Logger.warn(`🚚 ⚠️ Python initialization failed, but proceeding with panel creation: ${error}`);
        }

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
            path.basename(fileUri.fsPath),
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
        
        // Set the icon for the panel
        // Only needed when creating a new panel from scratch, eg via 
        // Scientific Data Viewer: Open Scientific Data Viewer command.
        // When clicking on a file in the explorer, the icon is set automatically,
        // as configured in package.json (section contributes -> languages -> icon)
        panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'icon.svg');

        DataViewerPanel.create(extensionUri, panel, fileUri, dataProcessor);
    }

    public static create(extensionUri: vscode.Uri, panel: vscode.WebviewPanel, fileUri: vscode.Uri, dataProcessor: DataProcessor): DataViewerPanel {
        // Configure the webview panel
        panel.webview.options = {
			enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'out')
            ]
		};

        // Keep track of the number of panels created (used for identifying the panel)
        DataViewerPanel.createdCount++;
        // Create the data viewer panel
        const dataViewerPanel = new DataViewerPanel(panel, fileUri, dataProcessor);
        // Add the data viewer panel to the active panels set
        DataViewerPanel.activePanels.add(dataViewerPanel);
        Logger.debug(`[create] Added panel to activePanels - total: ${DataViewerPanel.activePanels.size}`);
        // Return the data viewer panel
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
        this._webviewPanel.title = path.basename(fileUri.fsPath)
        this._currentFile = fileUri;

        // Configure webview panel properties for optimal experience
        // Note: Some properties like retainContextWhenHidden might not be settable on existing panels
        // but we can set other properties that are available

        // Set the webview's initial html content
        Logger.info(`🚚 📖 Initializing data viewer panel for: ${fileUri.fsPath}`);

        // Note: Panel is already added to activePanels in the create() method

        // Initialize state management and UI controller
        this._uiController = new UIController(DataViewerPanel.createdCount, webviewPanel.webview, dataProcessor, (error) => {
            Logger.error(`[UIController] Error: ${error.message}`);
            DataViewerPanel.addPanelWithError(this);
        }, (success) => {
            Logger.info(`[UIController] Success: ${success}`);
            DataViewerPanel.removePanelWithError(this);
        }, () => {
            // // Update outline when data is loaded
            // this.updateOutline();
            // Also notify that the panel is active to ensure proper outline display
            this.notifyPanelActive();
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
        this._uiController.loadFile(fileUri.fsPath);

        // Initialize outline with data viewer headers
        this._initializeOutline();

        // // Notify that this panel is active to ensure outline is displayed
        // this.notifyPanelActive();

        // Check if devMode is enabled and run commands automatically after webview is ready
        this._handleDevMode();

        // Listen for when the panel becomes visible to update outline
        this._webviewPanel.onDidChangeViewState((e) => {
            if (e.webviewPanel.visible) {
                this.notifyPanelActive();
            }
        }, null, this._disposables);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._webviewPanel.onDidDispose(() => this.dispose());
    }

    public dispose() {
        // Prevent multiple disposal calls
        if (this._isDisposed) {
            Logger.debug(`[dispose] Panel already disposed, skipping: ${this._currentFile.fsPath}`);
            return;
        }
        
        this._isDisposed = true;
        Logger.info(`🚚 🗑️ Disposing panel for file: ${this._currentFile.fsPath}`);
        Logger.debug(`[dispose] Before cleanup - activePanels: ${DataViewerPanel.activePanels.size}, panelsWithErrors: ${DataViewerPanel.panelsWithErrors.size}`);
        
        // Remove this panel from the active panels set
        const wasInActivePanels = DataViewerPanel.activePanels.delete(this);
        Logger.debug(`[dispose] Removed from activePanels: ${wasInActivePanels}`);

        // Remove this panel from the error tracking set
        DataViewerPanel.removePanelWithError(this);

        Logger.debug(`[dispose] After cleanup - activePanels: ${DataViewerPanel.activePanels.size}, panelsWithErrors: ${DataViewerPanel.panelsWithErrors.size}`);

        // Clear outline when panel is disposed
        if (DataViewerPanel.outlineProvider) {
            DataViewerPanel.outlineProvider.clear(this._currentFile);
        }

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
        
        Logger.info(`🚚 ✅ Panel disposal completed for file: ${this._currentFile.fsPath}`);
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

    private _initializeOutline(): void {
        if (DataViewerPanel.outlineProvider) {
            // Create headers for the data viewer sections
            // const headers = HeaderExtractor.createDataViewerHeaders();
            // DataViewerPanel.outlineProvider.updateHeaders(headers, this._currentFile);
            // Logger.info(`📋 Initialized outline with ${headers.length} headers for file: ${this._currentFile.fsPath}`);
        } else {
            Logger.warn('📋 Outline provider not available');
        }
    }

    /**
     * Update the outline when data is loaded for this panel
     */
    public updateOutline(): void {
        if (DataViewerPanel.outlineProvider) {
            // Get data information from the UI controller's state
            const dataInfo = this._uiController.getDataInfo();
            
            // Create dynamic headers based on data information
            const headers = HeaderExtractor.createDynamicDataViewerHeaders(dataInfo);
            DataViewerPanel.outlineProvider.updateHeaders(headers, this._currentFile);
        }
    }

    public async scrollToHeader(headerId: string, headerLabel: string): Promise<void> {
        try {
            // Send message to webview to scroll to the header
            this._webviewPanel.webview.postMessage({
                command: 'scrollToHeader',
                headerId: headerId,
                headerLabel: headerLabel
            });
            Logger.info(`📋 Scrolling to header: ${headerLabel} (${headerId})`);
        } catch (error) {
            Logger.error(`❌ Error scrolling to header: ${error}`);
            throw error;
        }
    }

    /**
     * Get the unique ID of this data viewer panel
     */
    public getId(): number {
        return this._uiController.getId();
    }

}