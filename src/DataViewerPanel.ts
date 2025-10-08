import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from './common/Logger';
import { UIController } from './panel/UIController';
import { OutlineProvider } from './outline/OutlineProvider';
import { HeaderExtractor } from './outline/HeaderExtractor';
import { CMD_OPEN_DEVELOPER_TOOLS, CMD_SHOW_LOGS, DEFAULT_DATA_VIEWER_PANEL_ID, getAllowMultipleTabsForSameFile, getDevMode } from './common/config';

export class DataViewerPanel {
    public static readonly viewType = DEFAULT_DATA_VIEWER_PANEL_ID;

    private static readonly _activePanels: Set<DataViewerPanel> = new Set();
    private static readonly _errorPanels: Set<DataViewerPanel> = new Set();
    private static _outlineProvider: OutlineProvider | undefined;
    private static _createdCount = 0;

    private readonly _uiController: UIController;
    private readonly _webviewPanel: vscode.WebviewPanel;
    private readonly _id: number;
    private readonly _fileUri: vscode.Uri;
    private readonly _disposables: vscode.Disposable[] = [];
    private _isDisposed: boolean = false;


    public static get activePanels(): Set<DataViewerPanel> {
        return DataViewerPanel._activePanels;
    }

    public static get errorPanels(): Set<DataViewerPanel> {
        return DataViewerPanel._errorPanels;
    }
    public static setOutlineProvider(outlineProvider: OutlineProvider): void {
        DataViewerPanel._outlineProvider = outlineProvider;
    }

    public static getPanel(panelId: number): DataViewerPanel | undefined {
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
        const panel = Array.from(DataViewerPanel._activePanels).find(
            (panel) => panel.getId() === panelId
        );
        if (panel) {
            Logger.debug(`🚚 📋 Found active panel for file: ${panelId}`);
            return panel;
        }
        Logger.debug(`🚚 📋 No active panel found for file: ${panelId}`);
        return undefined;
    }

    public static async createOrReveal(
        fileUri: vscode.Uri,
        iconPath: vscode.Uri,
        webviewOptions: vscode.WebviewOptions,
        webviewPanelOptions: vscode.WebviewPanelOptions
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Check if this file is already open in an existing panel (only if multiple tabs are not allowed)
        if (!getAllowMultipleTabsForSameFile()) {
            for (const panel of DataViewerPanel._activePanels) {
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

        // WebviewPanelOptions & WebviewOptions

        // File is not opened or multiple tabs are allowed, create a new panel

        const webviewPanel = vscode.window.createWebviewPanel(
            DataViewerPanel.viewType,
            path.basename(fileUri.fsPath), // TODO eschalk add [counter] if dev mode !
            column || vscode.ViewColumn.One,
            {
                ...webviewOptions,
                ...webviewPanelOptions,
            }
        );

        // Set the icon for the panel
        // Only needed when creating a new panel from scratch, eg via
        // the command palette or the file selection dialog.
        // When clicking on a file in the explorer, the icon is set automatically,
        // as configured in package.json (section contributes -> languages -> icon)
        webviewPanel.iconPath = iconPath;

        DataViewerPanel.createFromWebviewPanel(
            fileUri,
            webviewPanel,
            webviewOptions
        );
    }

    public static createFromWebviewPanel(
        fileUri: vscode.Uri,
        webviewPanel: vscode.WebviewPanel,
        webviewOptions: vscode.WebviewOptions
    ): DataViewerPanel {
        // Configure the webview panel
        webviewPanel.webview.options = webviewOptions;

        // Keep track of the number of panels created (used for identifying the panel)
        DataViewerPanel.increaseCreatedCount();

        // Create the data viewer panel
        const dataViewerPanel = new DataViewerPanel(
            DataViewerPanel._createdCount,
            fileUri,
            webviewPanel
        );
        // Add the data viewer panel to the active panels set
        DataViewerPanel._activePanels.add(dataViewerPanel);
        Logger.debug(
            `[create] Added panel to activePanels - total: ${DataViewerPanel._activePanels.size}`
        );
        // Return the data viewer panel
        return dataViewerPanel;
    }

    public static async refreshPanelsWithErrors() {
        Logger.debug(
            `[refreshPanelsWithErrors] Refreshing ${DataViewerPanel._errorPanels.size} panels with errors`
        );
        const errorPanelCount = DataViewerPanel._errorPanels.size;
        if (errorPanelCount > 0) {
            for (const panel of DataViewerPanel._errorPanels) {
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

    private static increaseCreatedCount() {
        DataViewerPanel._createdCount++;
    }

    private static addPanelWithError(panel: DataViewerPanel) {
        Logger.debug(
            `[addPanelWithError]    (before add) ${DataViewerPanel._errorPanels.size} panels with errors`
        );
        DataViewerPanel._errorPanels.add(panel);
        Logger.debug(
            `[addPanelWithError]    (after add) ${DataViewerPanel._errorPanels.size} panels with errors`
        );
    }

    private static removePanelWithError(panel: DataViewerPanel) {
        Logger.debug(
            `[removePanelWithError] (before remove) ${DataViewerPanel._errorPanels.size} panels with errors`
        );
        DataViewerPanel._errorPanels.delete(panel);
        Logger.debug(
            `[removePanelWithError] (after remove) ${DataViewerPanel._errorPanels.size} panels with errors`
        );
    }

    /**
     * Dispose of static resources
     */
    public static dispose(): void {
        DataViewerPanel._activePanels.clear();
        DataViewerPanel._errorPanels.clear();
    }

    private constructor(
        id: number,
        fileUri: vscode.Uri,
        webviewPanel: vscode.WebviewPanel
    ) {
        this._id = id;
        this._fileUri = fileUri;
        this._webviewPanel = webviewPanel;

        // Set the webview's initial html content
        Logger.info(
            `🚚 📖 Initializing data viewer panel for: ${fileUri.fsPath}`
        );

        // Initialize state management and UI controller
        this._uiController = new UIController(
            id,
            webviewPanel.webview,
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

        // Check if devMode is enabled and run commands automatically after webview is ready
        this.handleDevMode();

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
        this._webviewPanel.onDidDispose(() => this.disposePanel());
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

    /**
     * Update the outline when data is loaded for this panel
     */
    private updateOutline(): void {
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

    private disposePanel() {
        // Prevent multiple disposal calls
        if (this._isDisposed) {
            Logger.debug(
                `[dispose] Panel already disposed, skipping: ${
                    this.getFileUri().fsPath
                }`
            );
            return;
        }

        Logger.info(
            `[${this.getId()}] 🚚 🗑️ Disposing panel for file: ${
                this.getFileUri().fsPath
            }`
        );
        Logger.debug(
            `[dispose] Before cleanup - activePanels: ${DataViewerPanel._activePanels.size}, panelsWithErrors: ${DataViewerPanel._errorPanels.size}`
        );

        // Remove this panel from the active panels set
        const wasInActivePanels = DataViewerPanel._activePanels.delete(this);
        Logger.debug(
            `[dispose] Removed from activePanels: ${wasInActivePanels}`
        );

        // Remove this panel from the error tracking set
        DataViewerPanel.removePanelWithError(this);

        Logger.debug(
            `[dispose] After cleanup - activePanels: ${DataViewerPanel._activePanels.size}, panelsWithErrors: ${DataViewerPanel._errorPanels.size}`
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
            `[${this.getId()}] 🚚 ✅ Panel disposal completed for file: ${
                this.getFileUri().fsPath
            }, remaining activePanels: ${DataViewerPanel._activePanels.size}`
        );

        this._isDisposed = true;
    }

    private async handleDevMode(): Promise<void> {
        const devMode = getDevMode();

        if (devMode) {
            Logger.info(
                '🔧 DevMode enabled - automatically running development commands...'
            );

            // Run "Show Extension Logs" command immediately
            try {
                await vscode.commands.executeCommand(
                    CMD_SHOW_LOGS
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
                        CMD_OPEN_DEVELOPER_TOOLS
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
