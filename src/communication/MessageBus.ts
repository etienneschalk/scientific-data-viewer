/**
 * Type-safe message bus for VSCode extension communication
 */

import * as vscode from 'vscode';
import { 
    Message, 
    RequestMessage, 
    ResponseMessage, 
    EventMessage, 
    MessageFactory, 
    isRequestMessage, 
    isResponseMessage, 
    isEventMessage,
    COMMANDS,
    EVENTS
} from './MessageTypes';

export class MessageBus {
    private webview: vscode.Webview;
    private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
    private eventListeners: Map<string, Array<(payload: any) => void>> = new Map();
    private requestHandlers: Map<string, (payload: any) => Promise<any>> = new Map();

    constructor(webview: vscode.Webview) {
        this.webview = webview;
        this.setupMessageListener();
    }

    private setupMessageListener(): void {
        this.webview.onDidReceiveMessage((message: Message) => {
            try {
                if (isRequestMessage(message)) {
                    this.handleRequest(message);
                } else if (isResponseMessage(message)) {
                    this.handleResponse(message);
                } else if (isEventMessage(message)) {
                    this.handleEvent(message);
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });
    }

    // Send a request and wait for response
    async sendRequest<T, R>(command: string, payload: T, timeout: number = 10000): Promise<R> {
        const request = MessageFactory.createRequest(command, payload);
        
        return new Promise<R>((resolve, reject) => {
            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(request.id);
                reject(new Error(`Request timeout: ${command}`));
            }, timeout);

            // Store the request
            this.pendingRequests.set(request.id, {
                resolve: (value: R) => {
                    clearTimeout(timeoutId);
                    resolve(value);
                },
                reject: (error: Error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            // Send the request
            this.webview.postMessage(request);
        });
    }

    // Send a response to a request
    sendResponse<T>(requestId: string, success: boolean, payload?: T, error?: string): void {
        const response = MessageFactory.createResponse(requestId, success, payload, error);
        this.webview.postMessage(response);
    }

    // Send an event
    sendEvent<T>(event: string, payload: T): void {
        const eventMessage = MessageFactory.createEvent(event, payload);
        this.webview.postMessage(eventMessage);
    }

    // Register a request handler
    registerRequestHandler(command: string, handler: (payload: any) => Promise<any>): void {
        this.requestHandlers.set(command, handler);
    }

    // Register an event listener
    onEvent<T>(event: string, listener: (payload: T) => void): () => void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        
        this.eventListeners.get(event)!.push(listener);
        
        // Return unsubscribe function
        return () => {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }

    private async handleRequest(message: RequestMessage): Promise<void> {
        const handler = this.requestHandlers.get(message.command);
        
        if (!handler) {
            this.sendResponse(message.id, false, undefined, `Unknown command: ${message.command}`);
            return;
        }

        try {
            const result = await handler(message.payload);
            this.sendResponse(message.id, true, result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.sendResponse(message.id, false, undefined, errorMessage);
        }
    }

    private handleResponse(message: ResponseMessage): void {
        const pendingRequest = this.pendingRequests.get(message.requestId);
        
        if (!pendingRequest) {
            console.warn(`Received response for unknown request: ${message.requestId}`);
            return;
        }

        this.pendingRequests.delete(message.requestId);

        if (message.success) {
            pendingRequest.resolve(message.payload);
        } else {
            pendingRequest.reject(new Error(message.error || 'Unknown error'));
        }
    }

    private handleEvent(message: EventMessage): void {
        const listeners = this.eventListeners.get(message.event);
        
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(message.payload);
                } catch (error) {
                    console.error(`Error in event listener for ${message.event}:`, error);
                }
            });
        }
    }

    // Convenience methods for common operations
    async getDataInfo(filePath: string): Promise<any> {
        return this.sendRequest(COMMANDS.GET_DATA_INFO, { filePath });
    }

    async createPlot(variable: string, plotType: string): Promise<string> {
        return this.sendRequest(COMMANDS.CREATE_PLOT, { variable, plotType });
    }

    async savePlot(plotData: string, variable: string, fileName: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
        return this.sendRequest(COMMANDS.SAVE_PLOT, { plotData, variable, fileName });
    }

    async savePlotAs(plotData: string, variable: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
        return this.sendRequest(COMMANDS.SAVE_PLOT_AS, { plotData, variable });
    }

    async openPlot(plotData: string, variable: string, fileName: string): Promise<void> {
        return this.sendRequest(COMMANDS.OPEN_PLOT, { plotData, variable, fileName });
    }

    // Event emission methods
    emitDataLoaded(state: any): void {
        this.sendEvent(EVENTS.DATA_LOADED, state);
        this.triggerLocalEvent(EVENTS.DATA_LOADED, state);
    }

    emitError(message: string, details?: string, errorType?: string, formatInfo?: any): void {
        const errorData = { message, details, errorType, formatInfo };
        this.sendEvent(EVENTS.ERROR, errorData);
        this.triggerLocalEvent(EVENTS.ERROR, errorData);
    }

    emitPythonEnvironmentChanged(isReady: boolean, pythonPath: string | null): void {
        const envData = { isReady, pythonPath };
        this.sendEvent(EVENTS.PYTHON_ENVIRONMENT_CHANGED, envData);
        this.triggerLocalEvent(EVENTS.PYTHON_ENVIRONMENT_CHANGED, envData);
    }

    emitUIStateChanged(state: any): void {
        this.sendEvent(EVENTS.UI_STATE_CHANGED, state);
        this.triggerLocalEvent(EVENTS.UI_STATE_CHANGED, state);
    }

    // Helper method to trigger local event listeners
    private triggerLocalEvent(event: string, payload: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(payload);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    // Cleanup
    dispose(): void {
        this.pendingRequests.clear();
        this.eventListeners.clear();
        this.requestHandlers.clear();
    }
}
