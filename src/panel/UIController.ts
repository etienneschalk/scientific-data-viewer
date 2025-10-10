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
import { getVersion, showErrorMessage } from '../common/vscodeutils';
import { getDevMode, getMaxSize, getWorkspaceConfig } from '../common/config';
import { ErrorContext } from '../types';

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

        this.messageBus.registerRequestHandler('exportHtml', async () => {
            return this.handleExportHtml();
        });

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

                // Get data info
                const dataInfo = await this.dataProcessor.getDataInfo(fileUri);

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
    ): Promise<string | null> {
        try {
            const state = this.stateManager.getState();

            if (!state.data.currentFile) {
                throw new Error('No file loaded');
            }

            const fileUri = vscode.Uri.file(state.data.currentFile);

            const plotData = await this.dataProcessor.createPlot(
                fileUri,
                variable,
                plotType
            );

            if (!plotData) {
                throw new Error('Failed to create plot');
            }

            return plotData;
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
                const action = vscode.window
                    .showInformationMessage(
                        `Plot saved successfully: ${fileName}`,
                        'Open File',
                        'Reveal in Explorer'
                    )
                    .then(async (action) => {
                        // Handle user action
                        if (action === 'Open File') {
                            // Open the file in VSCode (this will work for images in newer VSCode versions)
                            try {
                                await vscode.commands.executeCommand(
                                    'vscode.open',
                                    savePath,
                                    vscode.ViewColumn.Beside
                                );
                            } catch (error) {
                                // If opening in VSCode fails, open with external application
                                await vscode.env.openExternal(savePath);
                            }
                        } else if (action === 'Reveal in Explorer') {
                            // Reveal the file in file explorer
                            await vscode.commands.executeCommand(
                                'revealFileInOS',
                                savePath
                            );
                        }
                    });

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
                    return { success: false, error: 'Save cancelled by user' };
                }

                // Write the file
                await vscode.workspace.fs.writeFile(saveUri, buffer);

                // Show success notification
                const action = await vscode.window.showInformationMessage(
                    `Plot saved successfully: ${saveUri.fsPath
                        .split('/')
                        .pop()}`,
                    'Open File',
                    'Reveal in Explorer'
                );

                // Handle user action
                if (action === 'Open File') {
                    try {
                        await vscode.commands.executeCommand(
                            'vscode.open',
                            saveUri,
                            vscode.ViewColumn.Beside
                        );
                    } catch (error) {
                        await vscode.env.openExternal(saveUri);
                    }
                } else if (action === 'Reveal in Explorer') {
                    await vscode.commands.executeCommand(
                        'revealFileInOS',
                        saveUri
                    );
                }

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

    private async handleExportHtml(): Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
    }> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'exportHtml',
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
                const defaultFileName = `${fileName}_report_${new Date()
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
                    title: 'Export HTML Report',
                });

                if (!saveUri) {
                    return {
                        success: false,
                        error: 'Export cancelled by user',
                    };
                }

                // Generate the HTML report
                const htmlReport = this.generateHtmlReport(state);

                // Write the file
                await vscode.workspace.fs.writeFile(
                    saveUri,
                    Buffer.from(htmlReport, 'utf8')
                );

                // Show success notification
                const action = await vscode.window.showInformationMessage(
                    `HTML report exported successfully: ${saveUri.fsPath
                        .split('/')
                        .pop()}`,
                    'Open File',
                    'Reveal in Explorer'
                );

                // Handle user action
                if (action === 'Open File') {
                    try {
                        await vscode.commands.executeCommand(
                            'vscode.open',
                            saveUri,
                            vscode.ViewColumn.Beside
                        );
                    } catch (error) {
                        await vscode.env.openExternal(saveUri);
                    }
                } else if (action === 'Reveal in Explorer') {
                    await vscode.commands.executeCommand(
                        'revealFileInOS',
                        saveUri
                    );
                }

                Logger.info(
                    `[UIController] HTML report exported: ${saveUri.fsPath}`
                );
                return { success: true, filePath: saveUri.fsPath };
            } catch (error) {
                Logger.error(
                    `[UIController] Error exporting HTML report: ${error}`
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
                        success: false,
                        error: 'Export cancelled by user',
                    };
                }

                // Write the file
                await vscode.workspace.fs.writeFile(
                    saveUri,
                    Buffer.from(htmlContent, 'utf8')
                );

                // Show success notification
                const action = await vscode.window.showInformationMessage(
                    `Webview content exported successfully: ${saveUri.fsPath
                        .split('/')
                        .pop()}`,
                    'Open File',
                    'Reveal in Explorer'
                );

                // Handle user action
                if (action === 'Open File') {
                    try {
                        await vscode.commands.executeCommand(
                            'vscode.open',
                            saveUri,
                            vscode.ViewColumn.Beside
                        );
                    } catch (error) {
                        await vscode.env.openExternal(saveUri);
                    }
                } else if (action === 'Reveal in Explorer') {
                    await vscode.commands.executeCommand(
                        'revealFileInOS',
                        saveUri
                    );
                }

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

    // private async captureWebviewContent(): Promise<string> {
    //     return new Promise((resolve, reject) => {
    //         // Generate a unique ID for this request
    //         const requestId = Date.now().toString();

    //         // Set up a timeout
    //         const timeout = setTimeout(() => {
    //             reject(new Error('Webview content capture timeout'));
    //         }, 10000); // 10 second timeout

    //         // Listen for the response
    //         const messageListener = (message: any) => {
    //             if (message.command === 'captureContentResponse' && message.id === requestId) {
    //                 clearTimeout(timeout);
    //                 this.webview.onDidReceiveMessage(messageListener).dispose();
    //                 resolve(message.content || '');
    //             }
    //         };

    //         // Set up the listener
    //         this.webview.onDidReceiveMessage(messageListener);

    //         // Send message to webview to capture its content
    //         this.webview.postMessage({
    //             command: 'captureContent',
    //             id: requestId
    //         });
    //     });
    // }

    private generateHtmlReport(state: AppState): string {
        const dataInfo = state.data.dataInfo;
        const currentFile = state.data.currentFile;
        const lastLoadTime = state.data.lastLoadTime;
        const pythonPath = state.python.pythonPath;
        const extensionConfig = state.extension.extensionConfig;

        if (!dataInfo || !currentFile) {
            throw new Error('No data available for export');
        }

        // Get the CSS and JavaScript from the generators
        const css = this.getCSSForReport();
        const js = this.getJavaScriptForReport();

        // Generate the HTML report
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scientific Data Viewer Report - ${currentFile
        .split('/')
        .pop()}</title>
    <style>
        ${css}
    </style>
</head>
<body>
    <div class="header">
        <div class="title">Scientific Data Viewer Report <small>v${getVersion()}</small></div>
        <div class="controls">
            <div class="timestamp">
                <span>Generated: ${new Date().toISOString()}</span>
                <span class="timestamp-icon">🕒</span>
            </div>
        </div>
    </div>
    
    <div id="content">
        ${this.generateFileInfoForReport(dataInfo, currentFile)}
        ${this.generateHtmlRepresentationForReport(dataInfo)}
        ${this.generateTextRepresentationForReport(dataInfo)}
        ${this.generateHtmlRepresentationForGroupsForReport(dataInfo)}
        ${this.generateTextRepresentationForGroupsForReport(dataInfo)}
        ${this.generateDimensionsAndVariablesForReport(dataInfo)}
        ${this.generateTroubleshootingForReport(
            pythonPath || '',
            extensionConfig,
            dataInfo
        )}
    </div>
    
    <script>
        ${js}
    </script>
</body>
</html>`;
    }

    private getCSSForReport(): string {
        // Get the CSS from CSSGenerator but modify it for standalone use
        const { CSSGenerator } = require('./CSSGenerator');
        return CSSGenerator.get(false); // Use non-dev mode CSS
    }

    private getJavaScriptForReport(): string {
        // Return minimal JavaScript for the report (no VSCode API calls)
        return `
// Minimal JavaScript for HTML report
function initializeReport() {
    console.log('Scientific Data Viewer Report loaded');
    
    // Set up copy buttons
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('text-copy-button')) {
            const button = e.target;
            const text = document.getElementById(button.dataset.targetId)?.textContent;
            try {
                await navigator.clipboard.writeText(text);
                button.textContent = '✓ Copied!';
                button.classList.add('copied');
                setTimeout(() => {
                    button.textContent = '📋 Copy';
                    button.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text:', err);
                button.textContent = '❌ Failed';
                setTimeout(() => {
                    button.textContent = '📋 Copy';
                }, 2000);
            }
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReport);
} else {
    initializeReport();
}
        `;
    }

    private generateFileInfoForReport(
        dataInfo: any,
        currentFile: string
    ): string {
        const formatFileSize = (bytes: number): string => {
            const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
            if (bytes === 0) return '0 B';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return (
                Math.round((bytes / Math.pow(1024, i)) * 100) / 100 +
                ' ' +
                sizes[i]
            );
        };

        let formatInfo = '<p>';
        if (dataInfo.fileSize) {
            formatInfo += `<strong>Size:</strong> ${formatFileSize(
                dataInfo.fileSize
            )} · `;
        }
        formatInfo += `<strong>Format:</strong> ${
            dataInfo.format || 'Unknown'
        } · `;
        if (dataInfo.format_info) {
            formatInfo += `<strong>Available Engines:</strong> ${
                dataInfo.format_info.available_engines.join(', ') || 'None'
            } · `;
            if (dataInfo.used_engine) {
                formatInfo += `<strong>Used Engine:</strong> ${dataInfo.used_engine}`;
            }
        }
        formatInfo += '</p>';

        return `
        <div class="info-section">
            <details class="sticky-group-details" open>
                <summary><h3>File Information</h3></summary>
                <div class="file-path-container">
                    <p><strong>File Path:</strong></p>
                    <button data-target-id="filePathCode" class="text-copy-button">📋 Copy</button>
                    <code id="filePathCode" class="file-path-code">${currentFile}</code>
                </div>
                <div>${formatInfo}</div>
            </details>
        </div>`;
    }

    private generateHtmlRepresentationForReport(dataInfo: any): string {
        if (!dataInfo.xarray_html_repr) {
            return '';
        }
        return `
        <div class="info-section">
            <details class="sticky-group-details" open>
                <summary><h3>Xarray HTML Representation</h3></summary>
                <div class="html-representation">${dataInfo.xarray_html_repr}</div>
            </details>
        </div>`;
    }

    private generateTextRepresentationForReport(dataInfo: any): string {
        if (!dataInfo.xarray_text_repr) {
            return '';
        }
        return `
        <div class="info-section">
            <details class="sticky-group-details">
                <summary><h3>Xarray Text Representation</h3></summary>
                <div class="text-representation-container">
                    <button data-target-id="textRepresentation" class="text-copy-button">📋 Copy</button>
                        <pre id="textRepresentation" class="text-representation">${this.escapeHtml(
                            dataInfo.xarray_text_repr || ''
                        )}</pre>
                </div>
            </details>
        </div>`;
    }

    private generateHtmlRepresentationForGroupsForReport(
        dataInfo: any
    ): string {
        if (!dataInfo.xarray_html_repr_flattened) {
            return '';
        }
        const groups = Object.entries(dataInfo.xarray_html_repr_flattened)
            .map(
                ([name, value]) => `
                <div class="info-section">
                    <details>
                        <summary>${name}</summary>
                        <div class="html-representation">${
                            value || '<p>No HTML representation available</p>'
                        }</div>
                    </details>
                </div>
            `
            )
            .join('');

        return `
        <div class="info-section">
            <details class="sticky-group-details">
                <summary><h3>Xarray HTML Representation (for each group)</h3></summary>
                <div class="html-representation-for-groups">${groups}</div>
            </details>
        </div>`;
    }

    private generateTextRepresentationForGroupsForReport(
        dataInfo: any
    ): string {
        if (!dataInfo.xarray_text_repr_flattened) {
            return '';
        }
        const groups = Object.entries(dataInfo.xarray_text_repr_flattened)
            .map(
                ([name, value]) => `
                <div class="info-section">
                    <details>
                        <summary>${name}</summary>
                        <div class="text-representation-container">
                            <button data-target-id="groupTextRepresentation_${name}" class="text-copy-button">📋 Copy</button>
                            <pre id="groupTextRepresentation_${name}">${this.escapeHtml(
                    String(value)
                )}</pre>
                        </div>
                    </details>
                </div>
            `
            )
            .join('');

        return `
        <div class="info-section">
            <details class="sticky-group-details">
                <summary><h3>Xarray Text Representation (for each group)</h3></summary>
                <div class="text-representation-for-groups">${groups}</div>
            </details>
        </div>`;
    }

    private generateDimensionsAndVariablesForReport(dataInfo: any): string {
        if (
            !dataInfo.dimensions_flattened ||
            !dataInfo.coordinates_flattened ||
            !dataInfo.variables_flattened
        ) {
            return '';
        }

        const groups = Object.keys(dataInfo.dimensions_flattened);
        const groupHtml = groups
            .map((groupName) => this.renderGroupForReport(dataInfo, groupName))
            .join('');

        return `
        <div class="info-section">
            <details class="sticky-group-details" open>
                <summary><h3>Data Structure</h3></summary>
                <div class="group-info-container">${groupHtml}</div>
            </details>
        </div>`;
    }

    private generateTroubleshootingForReport(
        pythonPath: string,
        extensionConfig: any,
        dataInfo: any
    ): string {
        return `
        <div class="info-section">
            <details class="sticky-group-details">
                <summary><h3>Technical Information</h3></summary>
                <div class="info-section">
                    <details open>
                        <summary>Python Interpreter Path</summary>
                        <button data-target-id="pythonPath" class="text-copy-button">📋 Copy</button>
                        <pre id="pythonPath">${
                            pythonPath || 'No Python interpreter configured'
                        }</pre>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Extension Configuration</summary>
                        <button data-target-id="extensionConfig" class="text-copy-button">📋 Copy</button>
                        <pre id="extensionConfig">${JSON.stringify(
                            extensionConfig,
                            null,
                            2
                        )}</pre>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Xarray Version Information</summary>
                        <button data-target-id="showVersions" class="text-copy-button">📋 Copy</button>
                        <pre id="showVersions">${
                            dataInfo.xarray_show_versions ||
                            'Version information not available'
                        }</pre>
                    </details>
                </div>
            </details>
        </div>`;
    }

    private renderGroupForReport(dataInfo: any, groupName: string): string {
        const dimensions = dataInfo.dimensions_flattened[groupName];
        const coordinates = dataInfo.coordinates_flattened[groupName];
        const variables = dataInfo.variables_flattened[groupName];
        const attributes = dataInfo.attributes_flattened[groupName];

        const dimensionsHtml =
            dimensions && Object.keys(dimensions).length > 0
                ? this.renderGroupDimensionsForReport(dimensions, groupName)
                : '<p class="muted-text">No dimensions found in this group.</p>';

        const coordinatesHtml =
            coordinates && coordinates.length > 0
                ? coordinates
                      .map((variable: any) =>
                          this.renderCoordinateVariableForReport(
                              variable,
                              groupName
                          )
                      )
                      .join('')
                : '<p class="muted-text">No coordinates found in this group.</p>';

        const variablesHtml =
            variables && variables.length > 0
                ? variables
                      .map((variable: any) =>
                          this.renderDataVariableForReport(variable, groupName)
                      )
                      .join('')
                : '<p class="muted-text">No variables found in this group.</p>';

        const attributesHtml =
            attributes && Object.keys(attributes).length > 0
                ? Object.entries(attributes)
                      .map(([attrName, value]) =>
                          this.renderGroupAttributeForReport(
                              groupName,
                              attrName,
                              value
                          )
                      )
                      .join('')
                : '<p class="muted-text">No attributes found in this group.</p>';

        return `
        <div class="info-section">
            <details class="sticky-group-details">
                <summary><h3>Group: ${groupName}</h3></summary>
                <div class="info-section">
                    <details open>
                        <summary><h4>Dimensions</h4></summary>
                        <div class="dimensions">${dimensionsHtml}</div>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary><h4>Coordinates</h4></summary>
                        <div class="coordinates">${coordinatesHtml}</div>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary><h4>Variables</h4></summary>
                        <div class="variables">${variablesHtml}</div>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary><h4>Attributes</h4></summary>
                        <div class="attributes">${attributesHtml}</div>
                    </details>
                </div>
            </details>
        </div>`;
    }

    private renderGroupDimensionsForReport(
        dimensions: any,
        groupName: string
    ): string {
        return `
        <div class="dimensions-compact">
            (${Object.entries(dimensions)
                .map(([name, size]) => `<strong>${name}</strong>: ${size}`)
                .join(', ')})
        </div>`;
    }

    private renderCoordinateVariableForReport(
        variable: any,
        groupName: string
    ): string {
        const shapeStr = variable.shape ? `(${variable.shape.join(', ')})` : '';
        const dimsStr = variable.dimensions
            ? `(${variable.dimensions.join(', ')})`
            : '';
        const sizeStr = variable.size_bytes
            ? this.formatFileSize(variable.size_bytes)
            : '';
        const hasAttributes =
            variable.attributes && Object.keys(variable.attributes).length > 0;

        const attributesContent = hasAttributes
            ? this.renderVariableAttributesForReport(variable.attributes)
            : '';

        return `
        <details class="variable-details">
            <summary class="variable-summary ${
                hasAttributes ? '' : 'not-clickable'
            }">
                <span class="variable-name">${variable.name}</span>
                <span class="dims">${dimsStr}</span>
                <span class="dtype-shape"><code>${this.escapeHtml(
                    variable.dtype
                )}</code></span>
                <span class="dtype-shape">${shapeStr}</span>
                ${sizeStr ? `<span class="size">${sizeStr}</span>` : ''}
            </summary>
            <div>${attributesContent}</div>
        </details>`;
    }

    private renderDataVariableForReport(
        variable: any,
        groupName: string
    ): string {
        const shapeStr = variable.shape ? `(${variable.shape.join(', ')})` : '';
        const dimsStr = variable.dimensions
            ? `(${variable.dimensions.join(', ')})`
            : '';
        const sizeStr = variable.size_bytes
            ? this.formatFileSize(variable.size_bytes)
            : '';
        const hasAttributes =
            variable.attributes && Object.keys(variable.attributes).length > 0;

        const attributesContent = hasAttributes
            ? this.renderVariableAttributesForReport(variable.attributes)
            : '';

        return `
        <details class="variable-details">
            <summary class="variable-summary ${
                hasAttributes ? '' : 'not-clickable'
            }">
                <span class="variable-name">${variable.name}</span>
                <span class="dims">${dimsStr}</span>
                <span class="dtype-shape"><code>${this.escapeHtml(
                    variable.dtype
                )}</code></span>
                <span class="dtype-shape">${shapeStr}</span>
                ${sizeStr ? `<span class="size">${sizeStr}</span>` : ''}
            </summary>
            <div>${attributesContent}</div>
        </details>`;
    }

    private renderGroupAttributeForReport(
        groupName: string,
        attrName: string,
        value: any
    ): string {
        const valueStr =
            typeof value === 'string' ? value : JSON.stringify(value);
        return `
        <div class="attribute-item">
            <span class="attribute-name">${attrName} : </span>
            <span class="attribute-value">${this.escapeHtml(valueStr)}</span>
        </div>`;
    }

    private renderVariableAttributesForReport(attributes: any): string {
        if (!attributes || Object.keys(attributes).length === 0) {
            return '';
        }

        const attributesList = Object.entries(attributes)
            .map(([attrName, value]) => {
                const valueStr =
                    typeof value === 'string' ? value : JSON.stringify(value);
                return `
                <div class="attribute-item">
                    <span class="attribute-name">${attrName} : </span>
                    <span class="attribute-value">${this.escapeHtml(
                        valueStr
                    )}</span>
                </div>`;
            })
            .join('');

        return `
        <div class="attributes-container">
            ${attributesList}
        </div>`;
    }

    private formatFileSize(bytes: number): string {
        const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (
            Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
        );
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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

    /**
     * Export HTML report
     */
    public async emitExportHtml(): Promise<void> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'exportHtml',
        };

        await this.errorBoundary.wrapAsync(async () => {
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
            const defaultFileName = `${fileName}_report_${new Date()
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
                title: 'Export HTML Report',
            });

            if (!saveUri) {
                throw new Error('Export cancelled by user');
            }

            // Generate the HTML report
            const htmlReport = this.generateHtmlReport(state);

            // Write the file
            await vscode.workspace.fs.writeFile(
                saveUri,
                Buffer.from(htmlReport, 'utf8')
            );

            // Show success notification
            const action = await vscode.window.showInformationMessage(
                `HTML report exported successfully: ${saveUri.fsPath
                    .split('/')
                    .pop()}`,
                'Open File',
                'Reveal in Explorer'
            );

            // Handle user action
            if (action === 'Open File') {
                try {
                    await vscode.commands.executeCommand(
                        'vscode.open',
                        saveUri,
                        vscode.ViewColumn.Beside
                    );
                } catch (error) {
                    await vscode.env.openExternal(saveUri);
                }
            } else if (action === 'Reveal in Explorer') {
                await vscode.commands.executeCommand('revealFileInOS', saveUri);
            }

            Logger.info(
                `[UIController] HTML report exported: ${saveUri.fsPath}`
            );
        }, context);
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
}
