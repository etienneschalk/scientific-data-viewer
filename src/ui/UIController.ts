/**
 * UI Controller - Separates UI logic from DataViewerPanel
 */

import * as vscode from 'vscode';
import { StateManager, AppState } from '../state/AppState';
import { MessageBus } from '../communication/MessageBus';
import { ErrorBoundary, ErrorContext } from '../error/ErrorBoundary';
import { DataProcessor } from '../dataProcessor';
import { Logger } from '../logger';
import { HTMLGenerator } from './HTMLGenerator';

export class UIController {
    private id: number;
    private stateManager: StateManager;
    private messageBus: MessageBus;
    private errorBoundary: ErrorBoundary;
    private dataProcessor: DataProcessor;
    private webview: vscode.Webview;
    private unsubscribeState?: () => void;
    private lastLoadTime: Date | null = null;
    private onErrorPanelCallback: (error: Error) => void;
    private onSuccessPanelCallback: (success: string) => void;

    constructor(
        id: number,
        webview: vscode.Webview,
        dataProcessor: DataProcessor,
        onErrorCallback: (error: Error) => void,
        onSuccessCallback: (success: string) => void
    ) {
        this.id = id;
        this.webview = webview;
        this.dataProcessor = dataProcessor;
        this.onErrorPanelCallback = onErrorCallback;
        this.onSuccessPanelCallback = onSuccessCallback;

        this.stateManager = new StateManager();
        this.messageBus = new MessageBus(webview);
        this.errorBoundary = ErrorBoundary.getInstance();
        
        this.setupErrorHandling();
        this.setupMessageHandlers();
        this.setupStateSubscription();
    }

    private setupErrorHandling(): void {
        this.errorBoundary.registerHandler(`ui-${this.id}`, (error, context) => {
            this.messageBus.emitError(
                error.message,
                'An error occurred in the UI. Please check the output panel for details.',
                'UIError'
            );
        });
    }

    private setupMessageHandlers(): void {
        // Register request handlers
        this.messageBus.registerRequestHandler('getDataInfo', async (payload) => {
            return this.handleGetDataInfo(payload.filePath);
        });

        this.messageBus.registerRequestHandler('createPlot', async (payload) => {
            return this.handleCreatePlot(payload.variable, payload.plotType);
        });


        this.messageBus.registerRequestHandler('refresh', async () => {
            return this.handleRefresh();
        });

        this.messageBus.registerRequestHandler('getCurrentFilePath', async () => {
            return this.handleGetCurrentFilePath();
        });
    }

    private setupStateSubscription(): void {
        this.unsubscribeState = this.stateManager.subscribe((state) => {
            Logger.debug(`[setupStateSubscription] State changed`);
            this.updateUI(state);
        });
    }

    private async handleGetDataInfo(filePath: string): Promise<any> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'getDataInfo',
            data: { filePath }
        };

        return this.errorBoundary.wrapAsync(async () => {
            this.stateManager.setLoading(true);
            this.stateManager.setError(null);

            try {
                // Check Python environment
                if (!this.dataProcessor.pythonManagerInstance.hasPythonPath()) {
                    throw new Error('Python path not found. Please configure Python interpreter first.');
                }

                if (!this.dataProcessor.pythonManagerInstance.isReady()) {
                    throw new Error('Python environment not ready. Please install core dependencies first.');
                }

                // Check file size
                const fileUri = vscode.Uri.file(filePath);
                const stat = await vscode.workspace.fs.stat(fileUri);
                const maxSize = vscode.workspace.getConfiguration('scientificDataViewer').get('maxFileSize', 100) * 1024 * 1024;

                if (stat.size > maxSize) {
                    throw new Error(`File too large (${Math.round(stat.size / 1024 / 1024)}MB). Maximum allowed: ${maxSize}MB`);
                }

                // Get data info
                const dataInfo = await this.dataProcessor.getDataInfo(fileUri);
                
                
                if (!dataInfo) {
                    throw new Error('Failed to load data file. The file might be corrupted or in an unsupported format.');
                }

                if (dataInfo.error) {
                    throw new Error(`Data processing error: ${dataInfo.error.error}`);
                }

                // Update state
                this.stateManager.setCurrentFile(filePath);
                this.stateManager.setLastLoadTime(new Date());
                this.stateManager.setLoading(false);
                this.stateManager.setError(null);
                this.stateManager.setPythonPath(this.dataProcessor.pythonManagerInstance.getCurrentPythonPath() || null);
                this.stateManager.setPythonReady(this.dataProcessor.pythonManagerInstance.isReady());
                this.stateManager.setExtension(await this.handleGetExtensionConfig());
                this.stateManager.setDataInfo(dataInfo.result);

                // Emit data loaded event to webview
                this.messageBus.emitDataLoaded(this.stateManager.getState());

                // Notify the panel about the success
                this.onSuccessPanelCallback('Data loaded successfully');

                return {
                    data: dataInfo.result,
                };

            } catch (error) {
                if (error instanceof Error) {
                    this.stateManager.setLoading(false);
                    this.stateManager.setError(error instanceof Error ? error.message : String(error));
                    
                    // Notify the panel about the error so it can be added to error state
                    this.onErrorPanelCallback(error);

                    this.webview.postMessage({
                        command: 'error',
                        message: error.message,
                        details: 'An error occurred in the data viewer panel. Please check the output panel for more details.'
                    });
                    
                    throw error;
                }
  
            }
        }, context);
    }

    private async handleCreatePlot(variable: string, plotType: string): Promise<string | null> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'createPlot',
            data: { variable, plotType }
        };

        return this.errorBoundary.wrapAsync(async () => {
            const state = this.stateManager.getState();
            
            if (!state.data.currentFile) {
                throw new Error('No file loaded');
            }

            const fileUri = vscode.Uri.file(state.data.currentFile);
            const plotData = await this.dataProcessor.createPlot(fileUri, variable, plotType);
            
            if (!plotData) {
                throw new Error('Failed to create plot');
            }

            return plotData;
        }, context);
    }


    private async handleGetExtensionConfig(): Promise<Record<string, any> | null> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'getExtensionConfig'
        };

        return this.errorBoundary.wrapAsync(async () => {
            const config = vscode.workspace.getConfiguration('scientificDataViewer');
            return {
                'scientificDataViewer.allowMultipleTabsForSameFile': config.get('allowMultipleTabsForSameFile'),
                'scientificDataViewer.plottingCapabilities': config.get('plottingCapabilities'),
                'scientificDataViewer.maxFileSize': config.get('maxFileSize'),
                'scientificDataViewer.autoRefresh': config.get('autoRefresh'),
                'scientificDataViewer.devMode': config.get('devMode')
            };
        }, context) || {};
    }

    private async handleRefresh(): Promise<void | null> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'refresh'
        };

        return this.errorBoundary.wrapAsync(async () => {
            const state = this.stateManager.getState();
            if (state.data.currentFile) {
                await this.handleGetDataInfo(state.data.currentFile);
            }
        }, context) || undefined;
    }

    private async handleGetCurrentFilePath(): Promise<{ filePath: string }> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'getCurrentFilePath'
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

    private updateUI(state: AppState): void {
        // Only regenerate HTML if plotting capabilities changed or this is the first load
        // For other state changes, just emit the state change event to update the webview content
        const plottingCapabilities = state.ui.plottingCapabilities;
        const lastLoadTime = state.data.lastLoadTime?.toISOString() || null;
        
        // Check if we need to regenerate the HTML structure
        const needsHTMLRegeneration = this.shouldRegenerateHTML(state);
        
        if (needsHTMLRegeneration) {
            this.setHtml(plottingCapabilities);
        }

        // Always emit state change event for content updates
        this.messageBus.emitUIStateChanged(state);
    }

    private shouldRegenerateHTML(state: AppState): boolean {
        // Only regenerate HTML when plotting capabilities change
        // Other state changes (data loading, errors, etc.) should only update content via events
        // This prevents unnecessary webview reinitialization that causes duplicate console logs
        return false;
    }

    // Public methods for external control
    public async loadFile(filePath: string): Promise<void> {
        const context: ErrorContext = {
            component: `ui-${this.id}`,
            operation: 'loadFile',
            data: { filePath }
        };

        await this.errorBoundary.wrapAsync(async () => {
            await this.handleGetDataInfo(filePath);
        }, context);
    }

    public getState(): AppState {
        return this.stateManager.getState();
    }

    public setPlottingCapabilities(enabled: boolean): void {
        this.stateManager.dispatch({ type: 'SET_PLOTTING_CAPABILITIES', payload: enabled });
    }

    // Cleanup
    public dispose(): void {
        if (this.unsubscribeState) {
            this.unsubscribeState();
        }
        this.messageBus.dispose();
    }

    public setHtml(plottingCapabilities: boolean): void {
        this.webview.html = this.getHtmlForWebview(plottingCapabilities);
    }

    private getHtmlForWebview(plottingCapabilities: boolean = false) {
        const header = HTMLGenerator.generateHeader(plottingCapabilities, this.lastLoadTime?.toISOString() || null);
        const loadingAndError = HTMLGenerator.generateLoadingAndError();
        const content = HTMLGenerator.generateContent(plottingCapabilities);
        
        return HTMLGenerator.generateMainHTML(plottingCapabilities, header + loadingAndError + content);
    }
}
