/**
 * UI Controller - Separates UI logic from DataViewerPanel
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { MessageBus } from './communication/MessageBus';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { DataProcessor } from '../python/DataProcessor';
import { Logger } from '../common/Logger';
import { HTMLGenerator } from './HTMLGenerator';
import { showErrorMessage } from '../common/vscodeutils';
import {
    CMD_PYTHON_INSTALL_PACKAGES,
    CMD_SHOW_LOGS,
    CMD_SHOW_SETTINGS,
    getDevMode,
    getMaxSize,
    getExtensionConfigForWebview,
    getWebviewExportTheme,
    getConvertBandsToVariables,
    getOutlineEnabled,
    getShowLoadTimeInLocalTime,
} from '../common/config';
import { DataInfoResult, PlotOptions } from '../types';
import { SaveResult } from './communication/MessageTypes';
import { CreatePlotResponse } from '../shared/plotLayout';
import { ThemeManager } from './ThemeManager';
import { PerformanceTimer } from '../common/PerformanceTimer';

/** Commands the webview may run through `executeCommand`. */
export const WEBVIEW_ALLOWED_COMMANDS: ReadonlySet<string> = new Set([
    CMD_SHOW_LOGS,
    CMD_SHOW_SETTINGS,
    CMD_PYTHON_INSTALL_PACKAGES,
]);

const GEOTIFF_EXTENSIONS = ['.tif', '.tiff', '.geotiff'];

/**
 * Resolve a file name sent by the webview below `baseDir`. Only relative paths
 * without `..` segments are accepted, so the webview cannot write elsewhere.
 */
export function resolveWebviewFileName(
    baseDir: string,
    fileName: string,
): string {
    if (
        !fileName ||
        path.isAbsolute(fileName) ||
        path.win32.isAbsolute(fileName) ||
        fileName.split(/[\\/]/).includes('..')
    ) {
        throw new Error(`Invalid plot file name: ${fileName}`);
    }
    return path.join(baseDir, fileName);
}

/** Backend error with the suggestion and type reported by `get_data_info.py`. */
class BackendLoadError extends Error {
    constructor(
        message: string,
        readonly details?: string,
        readonly errorType?: string,
    ) {
        super(message);
    }
}

function timestampForFileName(): string {
    return new Date().toISOString().slice(0, 19).replace(/:/g, '-');
}

export class UIController {
    private readonly id: number;
    private readonly messageBus: MessageBus;
    private readonly errorBoundary: ErrorBoundary;
    private readonly dataProcessor: DataProcessor;
    private readonly webview: vscode.Webview;
    private readonly extensionUri?: vscode.Uri;
    private readonly onErrorPanelCallback: (error: Error) => void;
    private readonly onSuccessPanelCallback: (success: string) => void;
    private readonly onOutlineUpdateCallback?: () => void;

    /** File shown by this panel; may carry a query such as `openAs=kerchunk`. */
    private fileUri?: vscode.Uri;
    private dataInfo: DataInfoResult | null = null;
    private lastLoadTime: Date | null = null;
    private disposed = false;
    /** Incremented by each load: only the latest one may update the panel. */
    private loadSequence = 0;
    /** Operation ids of the plots this panel is running (aborted on dispose). */
    private readonly runningPlotOperations = new Set<string>();

    constructor(
        id: number,
        webview: vscode.Webview,
        onErrorCallback: (error: Error) => void,
        onSuccessCallback: (success: string) => void,
        dataProcessor: DataProcessor,
        onOutlineUpdateCallback?: () => void,
        extensionUri?: vscode.Uri,
    ) {
        this.id = id;
        this.webview = webview;
        this.extensionUri = extensionUri;
        this.dataProcessor = dataProcessor;
        this.onErrorPanelCallback = onErrorCallback;
        this.onSuccessPanelCallback = onSuccessCallback;
        this.onOutlineUpdateCallback = onOutlineUpdateCallback;

        this.messageBus = new MessageBus(webview);
        this.errorBoundary = ErrorBoundary.getInstance();

        this.errorBoundary.registerHandler(this.getComponentName(), (error) => {
            this.messageBus.emit('error', {
                message: error.message,
                details:
                    error instanceof BackendLoadError
                        ? error.details
                        : 'An error occurred in the data viewer panel. Please check the output panel for details.',
                errorType:
                    error instanceof BackendLoadError
                        ? error.errorType
                        : undefined,
            });
        });
        this.setupMessageHandlers();
    }

    private getComponentName(): string {
        return `${this.constructor.name}-<${this.id}>`;
    }

    private setupMessageHandlers(): void {
        const bus = this.messageBus;
        bus.handle('createPlot', (plot) => this.handleCreatePlot(plot));
        bus.handle('abortPlot', async ({ operationId }) =>
            this.handleAbortPlot(operationId),
        );
        bus.handle('savePlot', (payload) =>
            this.handleSavePlot(
                payload.plotData,
                payload.variable,
                payload.fileName,
            ),
        );
        bus.handle('savePlotAs', (payload) =>
            this.handleSavePlotAs(payload.plotData, payload.variable),
        );
        bus.handle('openPlot', (payload) =>
            this.handleOpenPlot(payload.plotData, payload.fileName),
        );
        bus.handle('refresh', () => this.refresh());
        bus.handle('showNotification', async ({ message, type }) =>
            this.handleShowNotification(message, type),
        );
        bus.handle('executeCommand', ({ command, args }) =>
            this.handleExecuteCommand(command, args),
        );
        bus.handle('exportWebview', ({ htmlContent }) =>
            this.handleExportWebview(htmlContent),
        );
    }

    private requireCurrentFile(): string {
        if (!this.fileUri) {
            throw new Error('No file loaded');
        }
        return this.fileUri.fsPath;
    }

    /**
     * Shows a file action dialog with options to open file, open in browser,
     * or reveal in explorer. Not awaited by request handlers: the notification
     * stays open until the user acts, longer than the webview request timeout
     * (Issue #101).
     */
    private showFileActionDialog(message: string, fileUri: vscode.Uri): void {
        const run = async () => {
            const action = await vscode.window.showInformationMessage(
                message,
                'Open File',
                'Open in Browser',
                'Reveal in Explorer',
            );
            if (action === 'Open File') {
                try {
                    await vscode.commands.executeCommand(
                        'vscode.open',
                        fileUri,
                        vscode.ViewColumn.Beside,
                    );
                } catch {
                    await vscode.env.openExternal(fileUri);
                }
            } else if (action === 'Open in Browser') {
                await vscode.env.openExternal(fileUri);
            } else if (action === 'Reveal in Explorer') {
                await vscode.commands.executeCommand('revealFileInOS', fileUri);
            }
        };
        run().catch((error) => {
            Logger.error(`[UIController] File action failed: ${error}`);
        });
    }

    /** Run the `info` backend for `fileUri`; throws with a user-facing message. */
    private async fetchDataInfo(fileUri: vscode.Uri): Promise<DataInfoResult> {
        const pythonManager = this.dataProcessor.pythonManagerInstance;
        await pythonManager.waitForInitialization();
        if (!pythonManager.pythonPath) {
            throw new Error(
                'Python path not found. Please configure Python interpreter first.',
            );
        }

        const stat = await vscode.workspace.fs.stat(
            vscode.Uri.file(fileUri.fsPath),
        );
        const maxSizeMB = getMaxSize();
        // A directory (Zarr store) reports the size of its entry, not of its
        // data: the limit is for files only (see the setting's description)
        const isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
        if (!isDirectory && stat.size > maxSizeMB * 1024 * 1024) {
            throw new Error(
                `File too large (${Math.round(
                    stat.size / 1024 / 1024,
                )}MB). Maximum allowed: ${maxSizeMB}MB`,
            );
        }

        const response = await this.dataProcessor.getDataInfo(
            fileUri,
            this.shouldConvertBandsToVariables(fileUri.fsPath),
        );
        if (response.error) {
            throw new BackendLoadError(
                response.error.error,
                response.error.suggestion,
                response.error.error_type,
            );
        }
        if (!response.result) {
            throw new Error(
                `Failed to load data file. The file might be corrupted or in an unsupported format. File: ${fileUri.fsPath}`,
            );
        }
        return response.result;
    }

    private async handleCreatePlot(
        plot: PlotOptions,
    ): Promise<CreatePlotResponse> {
        if (!this.fileUri) {
            throw new Error('No file loaded');
        }
        const operationId = plot.operationId;
        if (operationId) {
            this.runningPlotOperations.add(operationId);
        }
        let response;
        try {
            response = await this.dataProcessor.createPlot(
                this.fileUri,
                plot,
                this.shouldConvertBandsToVariables(this.fileUri.fsPath),
            );
        } finally {
            if (operationId) {
                this.runningPlotOperations.delete(operationId);
            }
        }
        if (response.error) {
            const msg = `Data processing error: ${response.error.error}`;
            Logger.error(`[UIController] [createPlot] ${msg}`);
            throw new Error(msg);
        }
        if (!response.result) {
            throw new Error('Failed to create plot');
        }
        return {
            plotData: response.result.plot_data,
            layout: response.result.plot_layout,
            appliedSlices: response.result.applied_isel_kwargs,
        };
    }

    private handleAbortPlot(operationId: string): {
        success: boolean;
        message: string;
    } {
        Logger.info(
            `[UIController] [handleAbortPlot] Aborting plot operation: ${operationId}`,
        );
        return this.dataProcessor.abortPlot(operationId)
            ? {
                  success: true,
                  message: `Plot operation ${operationId} was aborted successfully`,
              }
            : {
                  success: false,
                  message: `No active plot operation found with ID: ${operationId}`,
              };
    }

    private async handleSavePlot(
        plotData: string,
        variable: string,
        fileName: string,
    ): Promise<SaveResult> {
        try {
            const savePath = vscode.Uri.file(
                resolveWebviewFileName(
                    path.dirname(this.requireCurrentFile()),
                    fileName,
                ),
            );
            await vscode.workspace.fs.writeFile(
                savePath,
                Buffer.from(plotData, 'base64'),
            );
            this.showFileActionDialog(
                `Plot saved successfully: ${fileName}`,
                savePath,
            );
            Logger.info(
                `[UIController] Plot of ${variable} saved: ${savePath.fsPath}`,
            );
            return { success: true, filePath: savePath.fsPath };
        } catch (error) {
            Logger.error(`[UIController] Error saving plot: ${error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async handleSavePlotAs(
        plotData: string,
        variable: string,
    ): Promise<SaveResult> {
        try {
            const currentFile = this.requireCurrentFile();
            const variableParts = variable.split('/').filter(Boolean);
            const lastPart = variableParts.pop() ?? 'plot';
            const defaultPath = path.join(
                path.dirname(currentFile),
                'sdv-plots',
                path.basename(currentFile),
                ...variableParts,
                `${lastPart}_${timestampForFileName()}.png`,
            );

            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultPath),
                filters: {
                    'PNG Images': ['png'],
                    'All Files': ['*'],
                },
                title: 'Save Plot As',
            });
            if (!saveUri) {
                return { success: false, error: 'Save cancelled by user' };
            }

            await vscode.workspace.fs.writeFile(
                saveUri,
                Buffer.from(plotData, 'base64'),
            );
            this.showFileActionDialog(
                `Plot saved successfully: ${path.basename(saveUri.fsPath)}`,
                saveUri,
            );
            Logger.info(`[UIController] Plot saved as: ${saveUri.fsPath}`);
            return { success: true, filePath: saveUri.fsPath };
        } catch (error) {
            Logger.error(`[UIController] Error saving plot as: ${error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async handleOpenPlot(
        plotData: string,
        fileName: string,
    ): Promise<void> {
        const tempFile = vscode.Uri.file(
            resolveWebviewFileName(os.tmpdir(), fileName),
        );
        await vscode.workspace.fs.writeFile(
            tempFile,
            Buffer.from(plotData, 'base64'),
        );
        try {
            await vscode.commands.executeCommand(
                'vscode.open',
                tempFile,
                vscode.ViewColumn.Beside,
            );
            Logger.info(
                `[UIController] Plot opened in VSCode: ${tempFile.fsPath}`,
            );
        } catch {
            await vscode.env.openExternal(tempFile);
            Logger.info(
                `[UIController] Plot opened with external app: ${tempFile.fsPath}`,
            );
        }
    }

    private handleShowNotification(
        message: string,
        type: 'info' | 'warning' | 'error',
    ): void {
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
    }

    private async handleExecuteCommand(
        command: string,
        args?: unknown[],
    ): Promise<unknown> {
        if (!WEBVIEW_ALLOWED_COMMANDS.has(command)) {
            throw new Error(`Command not allowed from the webview: ${command}`);
        }
        Logger.info(`[UIController] 🔧 Executing command: ${command}`);
        return vscode.commands.executeCommand(command, ...(args ?? []));
    }

    private async handleExportWebview(
        htmlContent: string,
    ): Promise<SaveResult> {
        try {
            const currentFile = this.requireCurrentFile();
            // Checked before the save dialog, so the user does not pick a file for nothing
            if (typeof htmlContent !== 'string' || htmlContent === '') {
                throw new Error('The page content could not be captured');
            }
            const defaultFileName = `${path.basename(
                currentFile,
            )}_webview_${timestampForFileName()}.html`;

            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(
                    path.join(path.dirname(currentFile), defaultFileName),
                ),
                filters: {
                    'HTML Files': ['html'],
                    'All Files': ['*'],
                },
                title: 'Export Webview Content',
            });
            if (!saveUri) {
                return { success: true, error: 'Export cancelled by user' };
            }

            // The live webview loads its CSS/JS over vscode-resource URIs,
            // which resolve to nothing in a browser. Inline them so the
            // exported file is self-contained, then apply theme overrides.
            const processedHtmlContent = HTMLGenerator.inlineWebviewAssets(
                ThemeManager.applyThemeToWebviewContent(
                    htmlContent,
                    getWebviewExportTheme(),
                ),
                getDevMode(),
            );
            await vscode.workspace.fs.writeFile(
                saveUri,
                Buffer.from(processedHtmlContent, 'utf8'),
            );

            this.showFileActionDialog(
                `Webview content exported successfully: ${path.basename(
                    saveUri.fsPath,
                )}`,
                saveUri,
            );
            Logger.info(
                `[UIController] Webview content exported: ${saveUri.fsPath}`,
            );
            return { success: true, filePath: saveUri.fsPath };
        } catch (error) {
            Logger.error(
                `[UIController] Error exporting webview content: ${error}`,
            );
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    public emitCommandScrollToHeader(
        headerId: string,
        headerLabel: string,
    ): void {
        this.messageBus.emit('scrollToHeaderCommandEvent', {
            headerId,
            headerLabel,
        });
    }

    /**
     * Export webview content (what the user currently sees)
     */
    public emitCommandExportWebview(): void {
        this.messageBus.emit('exportWebviewCommandEvent', {});
    }

    /**
     * Load `fileUri` and send its data to the webview. Errors are shown in the
     * webview (through the ErrorBoundary handler) and never rethrown.
     */
    public async loadFile(fileUri: vscode.Uri): Promise<void> {
        const timer = new PerformanceTimer(
            `load:${path.basename(fileUri.fsPath)}`,
        );
        this.fileUri = fileUri;
        const sequence = ++this.loadSequence;
        // A closed panel, or a load superseded by a later one (refresh after a
        // settings change), must not update the webview, outline or notifications.
        const isStale = () => this.disposed || sequence !== this.loadSequence;
        try {
            const dataInfo = await this.fetchDataInfo(fileUri);
            timer.mark('getDataInfo');
            if (isStale()) {
                Logger.debug(
                    `[UIController] <${this.id}> Ignoring a stale load of ${fileUri.fsPath}`,
                );
                return;
            }

            this.dataInfo = dataInfo;
            this.lastLoadTime = new Date();
            this.messageBus.emit('dataLoaded', {
                data: {
                    currentFile: fileUri.fsPath,
                    dataInfo,
                    lastLoadTime: this.lastLoadTime.toISOString(),
                },
                python: {
                    pythonPath:
                        this.dataProcessor.pythonManagerInstance.pythonPath ??
                        null,
                },
                extension: { extensionConfig: getExtensionConfigForWebview() },
            });
            timer.mark('postMessage');

            this.onSuccessPanelCallback('Data loaded successfully');
            if (this.onOutlineUpdateCallback && getOutlineEnabled()) {
                this.onOutlineUpdateCallback();
            }
            timer.finish('load complete');
        } catch (caught) {
            const error =
                caught instanceof Error ? caught : new Error(String(caught));
            if (isStale()) {
                Logger.debug(
                    `[UIController] <${this.id}> Ignoring the error of a stale load: ${error.message}`,
                );
                return;
            }
            this.onErrorPanelCallback(error);
            this.errorBoundary.handleError(error, {
                component: this.getComponentName(),
                operation: 'loadFile',
                data: { filePath: fileUri.fsPath },
            });
        }
    }

    public async refresh(): Promise<void> {
        if (this.fileUri) {
            await this.loadFile(this.fileUri);
        }
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
    public getDataInfo(): DataInfoResult | null {
        return this.dataInfo;
    }

    public dispose(): void {
        this.disposed = true;
        // Nobody can see their result any more
        for (const operationId of this.runningPlotOperations) {
            this.dataProcessor.abortPlot(operationId);
        }
        this.runningPlotOperations.clear();
        this.errorBoundary.unregisterHandler(this.getComponentName());
        this.messageBus.dispose();
    }

    public setHtml(): void {
        const timer = new PerformanceTimer(`setHtml:<${this.getId()}>`);
        const extensionUri = this.extensionUri;
        this.webview.html = HTMLGenerator.generateMainHTML(
            getDevMode(),
            this.lastLoadTime?.toISOString() ?? null,
            this.getId(),
            extensionUri ? { webview: this.webview, extensionUri } : undefined,
            getShowLoadTimeInLocalTime(),
        );
        timer.finish('setHtml');
    }

    private shouldConvertBandsToVariables(filePath: string): boolean {
        return (
            getConvertBandsToVariables() &&
            GEOTIFF_EXTENSIONS.includes(path.extname(filePath).toLowerCase())
        );
    }
}
