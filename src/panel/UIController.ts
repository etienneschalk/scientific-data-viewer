/**
 * UI Controller - Separates UI logic from DataViewerPanel
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { StateManager, AppState } from './state/AppState';
import { MessageBus } from './communication/MessageBus';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { DataProcessor } from '../python/DataProcessor';
import { Logger } from '../common/Logger';
import { HTMLGenerator } from './HTMLGenerator';
import { showErrorMessage } from '../common/vscodeutils';
import {
    getDevMode,
    getMaxSize,
    getWorkspaceConfig,
    getWebviewExportTheme,
    getConvertBandsToVariables,
} from '../common/config';
import { DataInfoPythonResponse, ErrorContext } from '../types';
import { ThemeManager } from './ThemeManager';

export class UIController {
    private id: number;
    private stateManager: StateManager;
    private messageBus: MessageBus;
    private errorBoundary: ErrorBoundary;
    private dataProcessor: DataProcessor;
    private webview: vscode.Webview;
    private unsubscribeState?: () => void;
    private onErrorPanelCallback: (error: Error) => void;
    private onSuccessPanelCallback: (success: string) => void;
    private onOutlineUpdateCallback?: () => void;

    constructor(
        id: number,
        webview: vscode.Webview,
        onErrorCallback: (error: Error) => void,
        onSuccessCallback: (success: string) => void,
        onOutlineUpdateCallback?: () => void
    ) {
        this.id = id;
        this.webview = webview;
        this.dataProcessor = DataProcessor.getInstance();
        this.onErrorPanelCallback = onErrorCallback;
        this.onSuccessPanelCallback = onSuccessCallback;
        this.onOutlineUpdateCallback = onOutlineUpdateCallback;

        this.stateManager = new StateManager();
        this.messageBus = new MessageBus(webview);
        this.errorBoundary = ErrorBoundary.getInstance();

        this.setupErrorHandling();
        this.setupMessageHandlers();
        this.setupStateSubscription();
    }

    private setupErrorHandling(): void {
        this.errorBoundary.registerHandler(
            `ui-${this.id}`,
            (error, context) => {
                this.messageBus.emitError(
                    error.message,
                    'An error occurred in the UI. Please check the output panel for details.',
                    'UIError'
                );
            }
        );
    }

    private setupMessageHandlers(): void {
        // Register request handlers
        this.messageBus.registerRequestHandler(
            'getDataInfo',
            async (payload) => {
                return this.handleGetDataInfo(payload.filePath);
            }
        );

        this.messageBus.registerRequestHandler(
            'createPlot',
            async (payload) => {
                return this.handleCreatePlot(
                    payload.variable,
                    payload.plotType
                );
            }
        );

        this.messageBus.registerRequestHandler('savePlot', async (payload) => {
            return this.handleSavePlot(
                payload.plotData,
                payload.variable,
                payload.fileName
            );
        });

        this.messageBus.registerRequestHandler(
            'savePlotAs',
            async (payload) => {
                return this.handleSavePlotAs(
                    payload.plotData,
                    payload.variable
                );
            }
        );

        this.messageBus.registerRequestHandler('openPlot', async (payload) => {
            return this.handleOpenPlot(
                payload.plotData,
                payload.variable,
                payload.fileName
            );
        });

        this.messageBus.registerRequestHandler('refresh', async () => {
            return this.handleRefresh();
        });

        this.messageBus.registerRequestHandler(
            'getCurrentFilePath',
            async () => {
                return this.handleGetCurrentFilePath();
            }
        );

        this.messageBus.registerRequestHandler(
            'showNotification',
            async (payload) => {
                return this.handleShowNotification(
                    payload.message,
                    payload.type
                );
            }
        );

        this.messageBus.registerRequestHandler(
            'executeCommand',
            async (payload) => {
                return this.handleExecuteCommand(payload.command, payload.args);
            }
        );

        this.messageBus.registerRequestHandler(
            'updateHeaders',
            async (payload) => {
                return this.handleUpdateHeaders(payload.headers);
            }
        );

        this.messageBus.registerRequestHandler(
            'exportWebview',
            async (payload) => {
                return this.handleExportWebview(payload.htmlContent);
            }
        );
    }

    private setupStateSubscription(): void {
        this.unsubscribeState = this.stateManager.subscribe((state) => {
            Logger.debug(
                `[UIController] [setupStateSubscription] State changed`
            );
            this.updateUI(state);
        });
    }

    /**
     * Shows a file action dialog with options to open file, open in browser, or reveal in explorer
     * @param message The success message to display
     * @param fileUri The URI of the file to perform actions on
     */
    private async showFileActionDialog(
        message: string,
        fileUri: vscode.Uri
    ): Promise<void> {
        const action = await vscode.window.showInformationMessage(
            message,
            'Open File',
            'Open in Browser',
            'Reveal in Explorer'
        );

        // Handle user action
        if (action === 'Open File') {
            try {
                await vscode.commands.executeCommand(
                    'vscode.open',
                    fileUri,
                    vscode.ViewColumn.Beside
                );
            } catch (error) {
                await vscode.env.openExternal(fileUri);
            }
        } else if (action === 'Open in Browser') {
            // Open the file in the default web browser
            await vscode.env.openExternal(fileUri);
        } else if (action === 'Reveal in Explorer') {
            await vscode.commands.executeCommand('revealFileInOS', fileUri);
        }
    }

    private async handleGetDataInfo(filePath: string): Promise<any> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'getDataInfo',
            data: { filePath },
        };

        return this.errorBoundary.wrapAsync(async () => {
            this.stateManager.setLoading(true);
            this.stateManager.setError(null);

            try {
                // Wait for Python initialization to complete first
                // This ensures we don't check Python environment before it's ready
                await this.dataProcessor.pythonManagerInstance.waitForInitialization();

                // Check Python environment
                if (!this.dataProcessor.pythonManagerInstance.pythonPath) {
                    throw new Error(
                        'Python path not found. Please configure Python interpreter first.'
                    );
                }

                // Check file size
                const fileUri = vscode.Uri.file(filePath);
                const stat = await vscode.workspace.fs.stat(fileUri);
                const maxSize = getMaxSize() * 1024 * 1024;

                if (stat.size > maxSize) {
                    throw new Error(
                        `File too large (${Math.round(
                            stat.size / 1024 / 1024
                        )}MB). Maximum allowed: ${maxSize}MB`
                    );
                }

                // Get data info with band conversion configuration
                const convertBandsToVariables =
                    this.shouldConvertBandsToVariables(filePath);
                const dataInfo = await this.dataProcessor.getDataInfo(
                    fileUri,
                    convertBandsToVariables
                );

                if (!dataInfo) {
                    throw new Error(
                        'Failed to load data file. The file might be corrupted or in an unsupported format.'
                    );
                }

                if (dataInfo.error) {
                    throw new Error(
                        `Data processing error: ${dataInfo.error.error}`
                    );
                }

                // Update state
                this.stateManager.setCurrentFile(filePath);
                this.stateManager.setLastLoadTime(new Date());
                this.stateManager.setLoading(false);
                this.stateManager.setError(null);
                this.stateManager.setPythonPath(
                    this.dataProcessor.pythonManagerInstance.pythonPath || null
                );
                this.stateManager.setPythonReady(
                    this.dataProcessor.pythonManagerInstance.ready
                );
                this.stateManager.setExtension(
                    await this.handleGetExtensionConfig()
                );
                this.stateManager.setDataInfo(dataInfo.result);

                // Emit data loaded event to webview
                this.messageBus.emitDataLoaded(this.stateManager.getState());

                // Notify the panel about the success
                this.onSuccessPanelCallback('Data loaded successfully');

                // Update outline if callback is provided
                if (this.onOutlineUpdateCallback) {
                    this.onOutlineUpdateCallback();
                }

                return {
                    data: dataInfo.result,
                };
            } catch (error) {
                if (error instanceof Error) {
                    this.stateManager.setLoading(false);
                    this.stateManager.setError(
                        error instanceof Error ? error.message : String(error)
                    );

                    // Notify the panel about the error so it can be added to error state
                    this.onErrorPanelCallback(error);

                    this.webview.postMessage({
                        command: 'error',
                        message: error.message,
                        details:
                            'An error occurred in the data viewer panel. Please check the output panel for more details.',
                    });

                    throw error;
                }
            }
        }, context);
    }

    private async handleCreatePlot(
        variable: string,
        plotType: string
    ): Promise<string | undefined> {
        try {
            const state = this.stateManager.getState();

            if (!state.data.currentFile) {
                throw new Error('No file loaded');
            }

            const fileUri = vscode.Uri.file(state.data.currentFile);

            const convertBandsToVariables = this.shouldConvertBandsToVariables(
                state.data.currentFile
            );
            const plotData = await this.dataProcessor.createPlot(
                fileUri,
                variable,
                plotType,
                convertBandsToVariables
            );

            if (!plotData) {
                throw new Error('Failed to create plot');
            }

            if (plotData.error) {
                throw new Error(
                    `Data processing error: ${plotData.error.error}`
                );
            }

            return plotData?.result?.plot_data;
        } catch (error) {
            // For plot creation errors, we want to let the webview handle them locally
            // instead of sending a global error. We'll re-throw the error so the MessageBus
            // can send it as a failed response that the webview can catch.
            throw error;
        }
    }

    private async handleSavePlot(
        plotData: string,
        variable: string,
        fileName: string
    ): Promise<{ success: boolean; filePath?: string; error?: string }> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'savePlot',
            data: { variable, fileName },
        };

        const result = await this.errorBoundary.wrapAsync(async () => {
            try {
                // Convert base64 to buffer
                const buffer = Buffer.from(plotData, 'base64');

                // Get the current file path to determine save location
                const state = this.stateManager.getState();
                if (!state.data.currentFile) {
                    throw new Error('No current file available');
                }

                const currentFileDir = vscode.Uri.file(state.data.currentFile)
                    .fsPath.split('/')
                    .slice(0, -1)
                    .join('/');
                const savePath = vscode.Uri.file(
                    `${currentFileDir}/${fileName}`
                );

                // Write the file
                await vscode.workspace.fs.writeFile(savePath, buffer);

                // Show success notification
                await this.showFileActionDialog(
                    `Plot saved successfully: ${fileName}`,
                    savePath
                );

                Logger.info(
                    `[UIController] Plot saved successfully: ${savePath.fsPath}`
                );
                return { success: true, filePath: savePath.fsPath };
            } catch (error) {
                Logger.error(`[UIController] Error saving plot: ${error}`);
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        }, context);

        return result ?? { success: false, error: 'Unknown error' };
    }

    private async handleSavePlotAs(
        plotData: string,
        variable: string
    ): Promise<{ success: boolean; filePath?: string; error?: string }> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'savePlotAs',
            data: { variable },
        };

        const result = await this.errorBoundary.wrapAsync(async () => {
            try {
                // Convert base64 to buffer
                const buffer = Buffer.from(plotData, 'base64');

                // Generate default filename
                const state = this.stateManager.getState();
                const currentFile = state.data.currentFile || 'unknown_file';
                const fileName = currentFile.split('/').pop() || 'plot';
                let defaultFileName: string;
                if (variable.includes('/')) {
                    // Variable is a full path starting with /
                    defaultFileName = `sdv-plots/${fileName}${variable}_${new Date()
                        .toISOString()
                        .slice(0, 19)
                        .replace(/:/g, '-')}.png`;
                } else {
                    defaultFileName = `sdv-plots/${fileName}/${variable}_${new Date()
                        .toISOString()
                        .slice(0, 19)
                        .replace(/:/g, '-')}.png`;
                }

                // Show save dialog
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(defaultFileName),
                    filters: {
                        'PNG Images': ['png'],
                        'All Files': ['*'],
                    },
                    title: 'Save Plot As',
                });

                if (!saveUri) {
                    return { success: true, error: 'Save cancelled by user' };
                }

                // Write the file
                await vscode.workspace.fs.writeFile(saveUri, buffer);

                // Show success notification
                await this.showFileActionDialog(
                    `Plot saved successfully: ${saveUri.fsPath
                        .split('/')
                        .pop()}`,
                    saveUri
                );

                Logger.info(`[UIController] Plot saved as: ${saveUri.fsPath}`);
                return { success: true, filePath: saveUri.fsPath };
            } catch (error) {
                Logger.error(`[UIController] Error saving plot as: ${error}`);
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        }, context);

        return result ?? { success: false, error: 'Unknown error' };
    }

    private async handleOpenPlot(
        plotData: string,
        variable: string,
        fileName: string
    ): Promise<void> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'openPlot',
            data: { variable, fileName },
        };

        const result = await this.errorBoundary.wrapAsync(async () => {
            // Convert base64 to buffer
            const buffer = Buffer.from(plotData, 'base64');

            // Create a temporary file
            const tempDir = vscode.Uri.file(os.tmpdir());
            const tempFile = vscode.Uri.joinPath(tempDir, fileName);

            // Write the temporary file
            await vscode.workspace.fs.writeFile(tempFile, buffer);

            // Immediately try to open in VSCode first, fallback to external app
            try {
                await vscode.commands.executeCommand(
                    'vscode.open',
                    tempFile,
                    vscode.ViewColumn.Beside
                );
                Logger.info(
                    `[UIController] Plot opened in VSCode: ${tempFile.fsPath}`
                );
            } catch (vscodeError) {
                // If opening in VSCode fails, open with external application
                try {
                    await vscode.env.openExternal(tempFile);
                    Logger.info(
                        `[UIController] Plot opened with external app: ${tempFile.fsPath}`
                    );
                } catch (externalError) {
                    Logger.error(
                        `[UIController] Failed to open plot with both VSCode and external app: ${externalError}`
                    );
                    throw new Error(
                        `Failed to open plot: ${
                            externalError instanceof Error
                                ? externalError.message
                                : String(externalError)
                        }`
                    );
                }
            }
        }, context);
    }

    private async handleGetExtensionConfig(): Promise<Record<
        string,
        any
    > | null> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'getExtensionConfig',
        };

        return (
            this.errorBoundary.wrapAsync(async () => {
                const config = getWorkspaceConfig();
                return config;
            }, context) || {}
        );
    }

    private async handleRefresh(): Promise<void | null> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'refresh',
        };

        return (
            this.errorBoundary.wrapAsync(async () => {
                const state = this.stateManager.getState();
                if (state.data.currentFile) {
                    await this.handleGetDataInfo(state.data.currentFile);
                }
            }, context) || undefined
        );
    }

    private async handleGetCurrentFilePath(): Promise<{ filePath: string }> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'getCurrentFilePath',
        };

        const result = await this.errorBoundary.wrapAsync(async () => {
            const state = this.stateManager.getState();
            if (!state.data.currentFile) {
                throw new Error('No current file available');
            }
            return { filePath: state.data.currentFile };
        }, context);

        return result || { filePath: '' };
    }

    private async handleShowNotification(
        message: string,
        type: 'info' | 'warning' | 'error'
    ): Promise<void> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'showNotification',
        };

        await this.errorBoundary.wrapAsync(async () => {
            switch (type) {
                case 'info':
                    vscode.window.showInformationMessage(message);
                    break;
                case 'warning':
                    vscode.window.showWarningMessage(message);
                    break;
                case 'error':
                    showErrorMessage(message);
                    break;
            }
        }, context);
    }

    private async handleUpdateHeaders(headers: any[]): Promise<void> {
        try {
            // This will be handled by the outline provider when we register it
            Logger.info(
                `[UIController] 📋 Received header update with ${headers.length} headers`
            );
            // The actual outline update will be handled by the DataViewerPanel
        } catch (error) {
            Logger.error(
                `[UIController] ❌ Error handling header update: ${error}`
            );
            throw error;
        }
    }

    private async handleExportWebview(
        htmlContent: string
    ): Promise<{ success: boolean; filePath?: string; error?: string }> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'exportWebview',
        };

        const result = await this.errorBoundary.wrapAsync(async () => {
            try {
                const state = this.stateManager.getState();
                if (!state.data.currentFile) {
                    throw new Error('No current file available');
                }

                // Get the current file path to determine save location
                const currentFileDir = vscode.Uri.file(state.data.currentFile)
                    .fsPath.split('/')
                    .slice(0, -1)
                    .join('/');
                const fileName =
                    vscode.Uri.file(state.data.currentFile)
                        .fsPath.split('/')
                        .pop() || 'data';
                const defaultFileName = `${fileName}_webview_${new Date()
                    .toISOString()
                    .slice(0, 19)
                    .replace(/:/g, '-')}.html`;

                // Show save dialog
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(
                        `${currentFileDir}/${defaultFileName}`
                    ),
                    filters: {
                        'HTML Files': ['html'],
                        'All Files': ['*'],
                    },
                    title: 'Export Webview Content',
                });

                if (!saveUri) {
                    return {
                        success: true,
                        error: 'Export cancelled by user',
                    };
                }

                // Apply theme overrides to the HTML content if configured
                const processedHtmlContent =
                    ThemeManager.applyThemeToWebviewContent(
                        htmlContent,
                        getWebviewExportTheme()
                    );

                // Write the file
                await vscode.workspace.fs.writeFile(
                    saveUri,
                    Buffer.from(processedHtmlContent, 'utf8')
                );

                // Show success notification
                await this.showFileActionDialog(
                    `Webview content exported successfully: ${saveUri.fsPath
                        .split('/')
                        .pop()}`,
                    saveUri
                );

                Logger.info(
                    `[UIController] Webview content exported: ${saveUri.fsPath}`
                );
                return { success: true, filePath: saveUri.fsPath };
            } catch (error) {
                Logger.error(
                    `[UIController] Error exporting webview content: ${error}`
                );
                return {
                    success: false,
                    error:
                        error instanceof Error ? error.message : String(error),
                };
            }
        }, context);

        return result || { success: false, error: 'Unknown error' };
    }

    private updateUI(state: AppState): void {
        // Always emit state change event for content updates
        this.messageBus.emitUIStateChanged(state);
    }

    public emitScrollToHeader(headerId: string, headerLabel: string): void {
        this.messageBus.emitScrollToHeader(headerId, headerLabel);
    }

    /**
     * Export webview content (what the user currently sees)
     */
    public emitExportWebview(): void {
        this.messageBus.emitExportWebviewCommand();
    }

    // Public methods for external control
    public async loadFile(filePath: string): Promise<void> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'loadFile',
            data: { filePath },
        };

        await this.errorBoundary.wrapAsync(async () => {
            await this.handleGetDataInfo(filePath);
        }, context);
    }

    public getState(): AppState {
        return this.stateManager.getState();
    }

    /**
     * Get the unique ID of this UI controller
     */
    public getId(): number {
        return this.id;
    }

    /**
     * Get the current data information
     */
    public getDataInfo(): any | null {
        return this.stateManager.getState().data.dataInfo;
    }

    private async handleExecuteCommand(
        command: string,
        args?: any[]
    ): Promise<any> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'executeCommand',
            data: { command, args },
        };

        return this.errorBoundary.wrapAsync(async () => {
            Logger.info(`[UIController] 🔧 Executing command: ${command}`);
            const result = await vscode.commands.executeCommand(
                command,
                ...(args || [])
            );
            Logger.info(
                `[UIController] 🔧 Command executed successfully: ${command}`
            );
            return result;
        }, context);
    }

    // Cleanup
    public dispose(): void {
        if (this.unsubscribeState) {
            this.unsubscribeState();
        }
        this.messageBus.dispose();
    }

    public setHtml(): void {
        this.webview.html = this.getHtmlForWebview();
    }

    private getHtmlForWebview() {
        const devMode = getDevMode();
        const lastLoadTime =
            this.stateManager.getState().data.lastLoadTime?.toISOString() ||
            null;
        return HTMLGenerator.generateMainHTML(
            devMode,
            lastLoadTime,
            this.getId()
        );
    }

    private shouldConvertBandsToVariables(filePath: string): boolean {
        const config = getConvertBandsToVariables();
        const extension = filePath
            .toLowerCase()
            .substring(filePath.lastIndexOf('.'));
        // Only apply to GeoTIFF formats
        const geotiffExtensions = ['.tif', '.tiff', '.geotiff'];
        return config && geotiffExtensions.includes(extension);
    }
}
