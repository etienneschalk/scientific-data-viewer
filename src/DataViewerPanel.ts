import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from './common/Logger';
import { UIController } from './panel/UIController';
import { OutlineProvider } from './outline/OutlineProvider';
import { HeaderExtractor } from './outline/HeaderExtractor';
import {
    CMD_OPEN_DEVELOPER_TOOLS,
    CMD_SHOW_LOGS,
    DEFAULT_DATA_VIEWER_PANEL_ID,
    getAllowMultipleTabsForSameFile,
    getDevMode,
} from './common/config';

export class DataViewerPanel {
    public static readonly viewType = DEFAULT_DATA_VIEWER_PANEL_ID;

    // Map of id to panel
    private static _outlineProvider?: OutlineProvider;
    private static readonly _panels: Map<number, DataViewerPanel> = new Map();
    private static _createdCount = 0; // Used for identifying the panel

    private readonly _uiController: UIController;
    private readonly _webviewPanel: vscode.WebviewPanel;
    private readonly _id: number;
    private readonly _fileUri: vscode.Uri;
    private readonly _disposables: vscode.Disposable[] = [];
    private _isDisposed: boolean = false;
    private _hasError: boolean = false;

    public static setOutlineProvider(outlineProvider: OutlineProvider): void {
        DataViewerPanel._outlineProvider = outlineProvider;
    }

    public static getPanel(panelId: number): DataViewerPanel | undefined {
        Logger.debug(`🚚 🗂️ Getting panel for panel with ID: ${panelId}`);
        // Find and return the first panel that matches the given file path
        const panel = DataViewerPanel._panels.get(panelId);
        if (panel) {
            Logger.debug(`🚚 🗂️ Found panel for file: ${panelId}`);
        } else {
            Logger.debug(`🚚 🗂️ No panel found for file: ${panelId}`);
        }
        return panel;
    }

    public static getActivePanel(): DataViewerPanel | undefined {
        Logger.debug(`🚚 🗂️ Getting active panel`);
        // Find the panel that is currently visible
        const activePanel = Array.from(DataViewerPanel._panels.values()).find(
            (panel) => panel._webviewPanel.visible
        );
        if (activePanel) {
            Logger.debug(`🚚 🗂️ Found active panel: ${activePanel.getId()}`);
        } else {
            Logger.debug(`🚚 🗂️ No active panel found`);
        }
        return activePanel;
    }

    public static async createOrReveal(
        fileUri: vscode.Uri,
        iconPath: vscode.Uri,
        webviewOptions: vscode.WebviewOptions,
        webviewPanelOptions: vscode.WebviewPanelOptions
    ) {
        // Check if this file is already open in an existing panel (only if multiple tabs are not allowed)
        if (!getAllowMultipleTabsForSameFile()) {
            for (const panel of DataViewerPanel._panels.values()) {
                Logger.debug(
                    `🚚 🗂️ Checking if file ${
                        fileUri.fsPath
                    } is already opened in panel ${panel.getId()} (${
                        panel.getFileUri().fsPath
                    })`
                );
                if (panel.getFileUri().fsPath === fileUri.fsPath) {
                    Logger.info(
                        `File ${fileUri.fsPath} is already open, focusing existing panel (allowMultipleTabsForSameFile: false)`
                    );
                    panel._webviewPanel.reveal(
                        vscode.window.activeTextEditor?.viewColumn
                    );
                    return;
                }
            }
        }
        Logger.info(
            `Creating new panel for ${fileUri.fsPath} (allowMultipleTabsForSameFile: true)`
        );

        // File is not opened or multiple tabs are allowed, create a new panel
        const webviewPanel = vscode.window.createWebviewPanel(
            DataViewerPanel.viewType,
            path.basename(fileUri.fsPath), // TODO eschalk add [counter] if dev mode !
            vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One,
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
        DataViewerPanel.addPanel(dataViewerPanel);
        Logger.debug(
            `[create] Added panel to activePanels - total: ${DataViewerPanel._panels.size}`
        );
        // Return the data viewer panel
        return dataViewerPanel;
    }

    public static async refreshPanelsWithErrors() {
        Logger.debug(
            `[DataViewerPanel.refreshPanelsWithErrors] Refreshing panels with errors`
        );
        Array.from(DataViewerPanel._panels.values())
            .filter((panel) => panel._hasError)
            .forEach(async (panel) => {
                await panel.refresh();
            });
    }

    private static increaseCreatedCount() {
        DataViewerPanel._createdCount++;
    }

    private static addPanel(panel: DataViewerPanel) {
        Logger.debug(
            `[DataViewerPanel.addPanel]    (before add) ${DataViewerPanel._panels.size} panels ok`
        );
        DataViewerPanel._panels.set(panel.getId(), panel);
        Logger.debug(
            `[DataViewerPanel.addPanel]    (after add) ${DataViewerPanel._panels.size} panels ok`
        );
    }

    private static removePanel(panel: DataViewerPanel) {
        Logger.debug(
            `[DataViewerPanel.removePanel]    (before remove) ${DataViewerPanel._panels.size} panels ok`
        );
        DataViewerPanel._panels.delete(panel.getId());
        Logger.debug(
            `[DataViewerPanel.removePanel]    (after remove) ${DataViewerPanel._panels.size} panels ok`
        );
    }

    /**
     * Get the total number of panels
     */
    public static getPanelCount(): number {
        return DataViewerPanel._panels.size;
    }

    /**
     * Get the number of active panels
     */
    public static getActivePanelCount(): number {
        return Array.from(DataViewerPanel._panels.values()).filter(
            (panel) => panel._webviewPanel.visible
        ).length;
    }

    /**
     * Get the number of panels with errors
     */
    public static getPanelsWithErrorsCount(): number {
        return Array.from(DataViewerPanel._panels.values()).filter(
            (panel) => panel._hasError
        ).length;
    }

    /**
     * Get all panels with errors
     */
    public static getPanelsWithErrors(): DataViewerPanel[] {
        return Array.from(DataViewerPanel._panels.values()).filter(
            (panel) => panel._hasError
        );
    }

    /**
     * Dispose of static resources
     */
    public static dispose(): void {
        DataViewerPanel._panels.clear();
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
            `[DataViewerPanel] 🚚 📖 Initializing data viewer panel for: ${fileUri.fsPath}`
        );

        // Initialize state management and UI controller
        this._uiController = new UIController(
            id,
            webviewPanel.webview,
            (error) => {
                Logger.error(`[UIController] Error: ${error.message}`);
                this._hasError = true;
            },
            (success) => {
                Logger.info(`[UIController] Success: ${success}`);
                this._hasError = false;
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
                Logger.debug(
                    `<${this.getId()}> WebView Panel Event: [onDidChangeViewState] ${e}`
                );
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
                `[DataViewerPanel] <${this.getId()}> 🗂️ Panel became active`
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
        if (DataViewerPanel._outlineProvider === undefined) {
            return;
        }

        // Get data information from the UI controller's state
        const dataInfo = this._uiController.getDataInfo();

        // Create dynamic headers based on data information
        const headers =
            HeaderExtractor.createDynamicDataViewerHeaders(dataInfo);
        DataViewerPanel._outlineProvider.updateHeaders(this.getId(), headers);
    }

    private async refresh() {
        // Use UI controller to refresh data
        Logger.debug(
            `[DataViewerPanel.refreshPanelsWithErrors] Refreshing panel: ${
                this.getFileUri().fsPath
            }`
        );
        await this._uiController.loadFile(this.getFileUri().fsPath);
    }

    private disposePanel() {
        // Prevent multiple disposal calls
        if (this._isDisposed) {
            Logger.debug(
                `[dispose] <${this.getId()}> Panel already disposed, skipping: ${
                    this.getFileUri().fsPath
                }`
            );
            return;
        }

        Logger.info(
            `[dispose] <${this.getId()}> 🚚 🗑️ Disposing panel for file: ${
                this.getFileUri().fsPath
            }`
        );

        // Remove this panel from the active panels set
        DataViewerPanel.removePanel(this);

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
            `<${this.getId()}> 🚚 ✅ Panel disposal completed for file: ${
                this.getFileUri().fsPath
            }`
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
                await vscode.commands.executeCommand(CMD_SHOW_LOGS);
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

    /**
     * Scroll to a header in the data viewer panel
     * @param headerId
     * @param headerLabel
     */
    public emitCommandScrollToHeader(headerId: string, headerLabel: string): void {
        this._uiController.emitCommandScrollToHeader(headerId, headerLabel);
    }

    /**
     * Export webview content for this panel
     */
    public async emitCommandExportWebview(): Promise<void> {
        return this._uiController.emitCommandExportWebview();
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
