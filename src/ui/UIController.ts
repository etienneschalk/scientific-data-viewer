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
    private stateManager: StateManager;
    private messageBus: MessageBus;
    private errorBoundary: ErrorBoundary;
    private dataProcessor: DataProcessor;
    private webview: vscode.Webview;
    private extensionUri: vscode.Uri;
    private unsubscribeState?: () => void;

    constructor(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
        dataProcessor: DataProcessor
    ) {
        this.webview = webview;
        this.extensionUri = extensionUri;
        this.dataProcessor = dataProcessor;
        this.stateManager = new StateManager();
        this.messageBus = new MessageBus(webview);
        this.errorBoundary = ErrorBoundary.getInstance();
        
        this.setupErrorHandling();
        this.setupMessageHandlers();
        this.setupStateSubscription();
    }

    private setupErrorHandling(): void {
        this.errorBoundary.registerHandler('ui', (error, context) => {
            Logger.error(`UI Error: ${error.message}`);
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

        this.messageBus.registerRequestHandler('getPythonPath', async () => {
            return this.handleGetPythonPath();
        });

        this.messageBus.registerRequestHandler('getExtensionConfig', async () => {
            return this.handleGetExtensionConfig();
        });

        this.messageBus.registerRequestHandler('refresh', async () => {
            return this.handleRefresh();
        });
    }

    private setupStateSubscription(): void {
        this.unsubscribeState = this.stateManager.subscribe((state) => {
            this.updateUI(state);
        });
    }

    private async handleGetDataInfo(filePath: string): Promise<any> {
        const context: ErrorContext = {
            component: 'ui',
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
                    throw new Error(`File too large (${Math.round(stat.size / 1024 / 1024)}MB). Maximum allowed: ${vscode.workspace.getConfiguration('scientificDataViewer').get('maxFileSize', 100)}MB`);
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
                this.stateManager.setDataInfo(dataInfo.result);
                this.stateManager.setLastLoadTime(new Date());
                this.stateManager.setLoading(false);

                return {
                    data: dataInfo.result,
                    filePath: filePath,
                    lastLoadTime: new Date().toISOString()
                };

            } catch (error) {
                this.stateManager.setLoading(false);
                this.stateManager.setError(error instanceof Error ? error.message : String(error));
                throw error;
            }
        }, context);
    }

    private async handleCreatePlot(variable: string, plotType: string): Promise<string | null> {
        const context: ErrorContext = {
            component: 'ui',
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

    private async handleGetPythonPath(): Promise<string | null> {
        const context: ErrorContext = {
            component: 'ui',
            operation: 'getPythonPath'
        };

        return this.errorBoundary.wrapAsync(async () => {
            const pythonPath = this.dataProcessor.pythonManagerInstance.getCurrentPythonPath();
            return pythonPath || 'No Python interpreter configured';
        }, context) || 'No Python interpreter configured';
    }

    private async handleGetExtensionConfig(): Promise<Record<string, any> | null> {
        const context: ErrorContext = {
            component: 'ui',
            operation: 'getExtensionConfig'
        };

        return this.errorBoundary.wrapAsync(async () => {
            const config = vscode.workspace.getConfiguration('scientificDataViewer');
            return {
                'scientificDataViewer.allowMultipleTabsForSameFile': config.get('allowMultipleTabsForSameFile'),
                'scientificDataViewer.plottingCapabilities': config.get('plottingCapabilities'),
                'scientificDataViewer.maxFileSize': config.get('maxFileSize'),
                'scientificDataViewer.autoRefresh': config.get('autoRefresh')
            };
        }, context) || {};
    }

    private async handleRefresh(): Promise<void | null> {
        const context: ErrorContext = {
            component: 'ui',
            operation: 'refresh'
        };

        return this.errorBoundary.wrapAsync(async () => {
            const state = this.stateManager.getState();
            if (state.data.currentFile) {
                await this.handleGetDataInfo(state.data.currentFile);
            }
        }, context) || undefined;
    }

    private updateUI(state: AppState): void {
        // Update webview HTML based on state
        const plottingCapabilities = state.ui.plottingCapabilities;
        const lastLoadTime = state.data.lastLoadTime?.toISOString() || null;
        
        const header = HTMLGenerator.generateHeader(plottingCapabilities, lastLoadTime);
        const loadingAndError = HTMLGenerator.generateLoadingAndError();
        const content = HTMLGenerator.generateContent(plottingCapabilities);
        
        const html = HTMLGenerator.generateMainHTML(plottingCapabilities, header + loadingAndError + content);
        
        this.webview.html = html;

        // Emit state change event
        this.messageBus.emitUIStateChanged(state);
    }

    // Public methods for external control
    public async loadFile(filePath: string): Promise<void> {
        const context: ErrorContext = {
            component: 'ui',
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

    public setPythonState(isReady: boolean, pythonPath: string | null): void {
        this.stateManager.setPythonReady(isReady);
        this.stateManager.setPythonPath(pythonPath);
    }

    public updatePythonPackages(packages: string[]): void {
        this.stateManager.dispatch({ type: 'SET_AVAILABLE_PACKAGES', payload: packages });
    }

    // Cleanup
    public dispose(): void {
        if (this.unsubscribeState) {
            this.unsubscribeState();
        }
        this.messageBus.dispose();
    }
}
