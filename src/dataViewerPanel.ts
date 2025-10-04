import * as vscode from 'vscode';
import * as path from 'path';
import { DataProcessor } from './dataProcessor';
import { Logger } from './logger';
import { UIController } from './ui/UIController';
import { OutlineProvider } from './outline/OutlineProvider';
import { HeaderExtractor } from './outline/HeaderExtractor';

export class DataViewerPanel {
    public static activePanels: Set<DataViewerPanel> = new Set();
    public static panelsWithErrors: Set<DataViewerPanel> = new Set();
    public static createdCount = 0;
    public static readonly viewType = 'scientificDataViewer';
    private static _outlineProvider: OutlineProvider | undefined;

    private readonly _webviewPanel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _uiController: UIController;
    private _isDisposed: boolean = false;
    private _id: number;
    private _fileUri: vscode.Uri;

    public static setOutlineProvider(outlineProvider: OutlineProvider): void {
        DataViewerPanel._outlineProvider = outlineProvider;
    }

    public static getActivePanel(panelId: number): DataViewerPanel | undefined {
        // XXX This is a hot method, called many times (eg by OutlineProvider)
        // It should be optimized, eg having a maps of paneid to pane instead
        // of the current search through the activePanels set...
        if (!panelId) {
            Logger.warn(`🚚 📋 Invalid panelId provided to getActivePanel`);
            return undefined;
        }

        Logger.debug(
            `🚚 📋 Getting active panel for panel with ID: ${panelId}`
        );
        // Find and return the first panel that matches the given file path
        const panel = Array.from(DataViewerPanel.activePanels).find(
            (panel) => panel._id === panelId
        );
        if (panel) {
            Logger.debug(`🚚 📋 Found active panel for file: ${panelId}`);
            return panel;
        }
        Logger.debug(`🚚 📋 No active panel found for file: ${panelId}`);
        return undefined;
    }

    public static async createFromScratchOrShow(
        extensionUri: vscode.Uri,
        fileUri: vscode.Uri,
        dataProcessor: DataProcessor
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Wait for Python initialization to complete before creating the panel
        // This prevents the race condition where file opening happens before Python validation
        try {
            await dataProcessor.pythonManagerInstance.waitForInitialization();
            Logger.info(
                `🚚 🧩 Python initialization complete, creating data viewer panel for: ${fileUri.fsPath}`
            );
        } catch (error) {
            Logger.warn(
                `🚚 ⚠️ Python initialization failed, but proceeding with panel creation: ${error}`
            );
        }

        // Get configuration directly from VSCode
        const config = vscode.workspace.getConfiguration(
            'scientificDataViewer'
        );

        // Check if this file is already open in an existing panel (only if multiple tabs are not allowed)
        if (!config.get('allowMultipleTabsForSameFile', false)) {
            for (const panel of DataViewerPanel.activePanels) {
                Logger.debug(
                    `🚚 📋 Checking if file ${
                        fileUri.fsPath
                    } is already open in panel ${panel.getId()} (${
                        panel.getFileUri().fsPath
                    })`
                );
                if (panel.getFileUri().fsPath === fileUri.fsPath) {
                    Logger.info(
                        `File ${fileUri.fsPath} is already open, focusing existing panel (allowMultipleTabsForSameFile: false)`
                    );
                    panel._webviewPanel.reveal(column);
                    return;
                }
            }
        }
        Logger.info(
            `Creating new panel for ${fileUri.fsPath} (allowMultipleTabsForSameFile: true)`
        );

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
                    vscode.Uri.joinPath(extensionUri, 'out'),
                ],
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

    public static create(
        extensionUri: vscode.Uri,
        webviewPanel: vscode.WebviewPanel,
        fileUri: vscode.Uri,
        dataProcessor: DataProcessor
    ): DataViewerPanel {
        // Configure the webview panel
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'out'),
            ],
        };

        // Keep track of the number of panels created (used for identifying the panel)
        DataViewerPanel.createdCount++;
        const panelId = DataViewerPanel.createdCount;

        // Create the data viewer panel
        const dataViewerPanel = new DataViewerPanel(
            panelId,
            webviewPanel,
            fileUri,
            dataProcessor
        );
        // Add the data viewer panel to the active panels set
        DataViewerPanel.activePanels.add(dataViewerPanel);
        Logger.debug(
            `[create] Added panel to activePanels - total: ${DataViewerPanel.activePanels.size}`
        );
        // Return the data viewer panel
        return dataViewerPanel;
    }

    public static async refreshPanelsWithErrors() {
        Logger.debug(
            `[refreshPanelsWithErrors] Refreshing ${DataViewerPanel.panelsWithErrors.size} panels with errors`
        );
        const errorPanelCount = DataViewerPanel.panelsWithErrors.size;
        if (errorPanelCount > 0) {
            for (const panel of DataViewerPanel.panelsWithErrors) {
                // Use UI controller to refresh data
                if (panel._uiController && panel.getFileUri()) {
                    Logger.debug(
                        `[refreshPanelsWithErrors] Refreshing panel: ${
                            panel.getFileUri().fsPath
                        }`
                    );
                    await panel._uiController.loadFile(
                        panel.getFileUri().fsPath
                    );
                }
            }
        }
    }

    private static addPanelWithError(panel: DataViewerPanel) {
        Logger.debug(
            `[addPanelWithError]    (before add) ${DataViewerPanel.panelsWithErrors.size} panels with errors`
        );
        DataViewerPanel.panelsWithErrors.add(panel);
        Logger.debug(
            `[addPanelWithError]    (after add) ${DataViewerPanel.panelsWithErrors.size} panels with errors`
        );
    }

    private static removePanelWithError(panel: DataViewerPanel) {
        Logger.debug(
            `[removePanelWithError] (before remove) ${DataViewerPanel.panelsWithErrors.size} panels with errors`
        );
        DataViewerPanel.panelsWithErrors.delete(panel);
        Logger.debug(
            `[removePanelWithError] (after remove) ${DataViewerPanel.panelsWithErrors.size} panels with errors`
        );
    }

    /**
     * Dispose of static resources
     */
    public static dispose(): void {
        DataViewerPanel.activePanels.clear();
        DataViewerPanel.panelsWithErrors.clear();
    }

    private constructor(
        id: number,
        webviewPanel: vscode.WebviewPanel,
        fileUri: vscode.Uri,
        dataProcessor: DataProcessor
    ) {
        this._id = id;
        this._fileUri = fileUri;
        this._webviewPanel = webviewPanel;

        // Update the panel title to reflect the new file
        this._webviewPanel.title = path.basename(fileUri.fsPath);

        // Set the webview's initial html content
        Logger.info(
            `🚚 📖 Initializing data viewer panel for: ${fileUri.fsPath}`
        );

        // Initialize state management and UI controller
        this._uiController = new UIController(
            id,
            webviewPanel.webview,
            dataProcessor,
            (error) => {
                Logger.error(`[UIController] Error: ${error.message}`);
                DataViewerPanel.addPanelWithError(this);
            },
            (success) => {
                Logger.info(`[UIController] Success: ${success}`);
                DataViewerPanel.removePanelWithError(this);
            },
            () => {
                // Also notify that the panel is active to ensure proper outline display
                this.notifyPanelActive();
            }
        );

        // Set initial HTML first
        this._uiController.setHtml();

        // Load the file and handle success/error
        this._uiController.loadFile(fileUri.fsPath);

        // Initialize outline with data viewer headers
        this._initializeOutline();

        // Check if devMode is enabled and run commands automatically after webview is ready
        this._handleDevMode();

        // Listen for when the panel becomes visible to update outline
        this._webviewPanel.onDidChangeViewState(
            (e) => {
                Logger.debug(`[onDidChangeViewState] ${e}`);
                if (e.webviewPanel.visible) {
                    this.notifyPanelActive();
                }
            },
            null,
            this._disposables
        );

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._webviewPanel.onDidDispose(() => this.dispose());
    }

    /**
     * Notify that this panel has become active
     */
    private notifyPanelActive(): void {
        if (DataViewerPanel._outlineProvider && this.getId()) {
            Logger.info(
                `📋 Panel became active for panel with ID: ${this.getId()}`
            );

            // Check if we have headers cached for this file
            const cachedHeaders =
                DataViewerPanel._outlineProvider.getHeadersForPanel(
                    this.getId()
                );
            if (cachedHeaders) {
                // Switch to the cached headers for this file
                DataViewerPanel._outlineProvider.switchToPanel(this.getId());
            } else {
                // Update outline for this panel
                this.updateOutline();
            }
        }
    }

    public dispose() {
        // Prevent multiple disposal calls
        if (this._isDisposed) {
            Logger.debug(
                `[dispose] Panel already disposed, skipping: ${this._fileUri.fsPath}`
            );
            return;
        }

        Logger.info(`[${this.getId()}] 🚚 🗑️ Disposing panel for file: ${this._fileUri.fsPath}`);
        Logger.debug(
            `[dispose] Before cleanup - activePanels: ${DataViewerPanel.activePanels.size}, panelsWithErrors: ${DataViewerPanel.panelsWithErrors.size}`
        );

        // Remove this panel from the active panels set
        const wasInActivePanels = DataViewerPanel.activePanels.delete(this);
        Logger.debug(
            `[dispose] Removed from activePanels: ${wasInActivePanels}`
        );

        // Remove this panel from the error tracking set
        DataViewerPanel.removePanelWithError(this);

        Logger.debug(
            `[dispose] After cleanup - activePanels: ${DataViewerPanel.activePanels.size}, panelsWithErrors: ${DataViewerPanel.panelsWithErrors.size}`
        );

        // Clear outline when panel is disposed
        if (DataViewerPanel._outlineProvider) {
            // Note: this will break if allowMultipleTabsForSameFile is true,
            // as it will clear the outline for all panels with the same file path
            DataViewerPanel._outlineProvider.disposeForPanel(this.getId());
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

        Logger.info(
            `[${this.getId()}] 🚚 ✅ Panel disposal completed for file: ${this._fileUri.fsPath}, remaining activePanels: ${DataViewerPanel.activePanels.size}`
        );

        this._isDisposed = true;
    }

    private async _handleDevMode(): Promise<void> {
        const config = vscode.workspace.getConfiguration(
            'scientificDataViewer'
        );
        const devMode = config.get('devMode', false);

        if (devMode) {
            Logger.info(
                '🔧 DevMode enabled - automatically running development commands...'
            );

            // Run "Show Extension Logs" command immediately
            try {
                await vscode.commands.executeCommand(
                    'scientificDataViewer.showLogs'
                );
                Logger.info('🔧 DevMode: Show Extension Logs command executed');
            } catch (error) {
                Logger.error(
                    `🔧 DevMode: Failed to execute showLogs command: ${error}`
                );
            }

            // Wait 1 second for webview to be fully ready before opening developer tools
            setTimeout(async () => {
                try {
                    await vscode.commands.executeCommand(
                        'scientificDataViewer.openDeveloperTools'
                    );
                    Logger.info(
                        '🔧 DevMode: Open Developer Tools command executed'
                    );
                } catch (error) {
                    Logger.error(
                        `🔧 DevMode: Failed to execute openDeveloperTools command: ${error}`
                    );
                }
            }, 1000);
        }
    }

    private _initializeOutline(): void {
        if (DataViewerPanel._outlineProvider) {
            // Create headers for the data viewer sections
            // const headers = HeaderExtractor.createDataViewerHeaders();
            // DataViewerPanel.outlineProvider.updateHeaders(headers, this._fileUri);
            // Logger.info(`📋 Initialized outline with ${headers.length} headers for file: ${this._fileUri.fsPath}`);
        } else {
            Logger.warn('📋 Outline provider not available');
        }
    }

    /**
     * Update the outline when data is loaded for this panel
     */
    public updateOutline(): void {
        if (DataViewerPanel._outlineProvider) {
            // Get data information from the UI controller's state
            const dataInfo = this._uiController.getDataInfo();

            // Create dynamic headers based on data information
            const headers =
                HeaderExtractor.createDynamicDataViewerHeaders(dataInfo);
            DataViewerPanel._outlineProvider.updateHeaders(
                this.getId(),
                headers
            );
        }
    }

    public async scrollToHeader(
        headerId: string,
        headerLabel: string
    ): Promise<void> {
        this._uiController.scrollToHeader(headerId, headerLabel);
    }

    /**
     * Get the unique ID of this data viewer panel
     */
    public getId(): number {
        return this._id;
    }

    /**
     * Get the file URI of this data viewer panel
     */
    public getFileUri(): vscode.Uri {
        return this._fileUri;
    }
}
