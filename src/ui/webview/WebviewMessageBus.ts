/**
 * MessageBus implementation for webview side
 */

export class WebviewMessageBus {
    private vscode: any;
    private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
    private eventListeners: Map<string, Array<(payload: any) => void>> = new Map();

    constructor(vscode: any) {
        this.vscode = vscode;
        this.setupMessageListener();
    }

    private setupMessageListener(): void {
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            if (message.type === 'response') {
                this.handleResponse(message);
            } else if (message.type === 'event') {
                this.handleEvent(message);
            }
        });
    }

    // Send a request and wait for response
    async sendRequest<T, R>(command: string, payload: T, timeout: number = 10000): Promise<R> {
        const request = this.createRequest(command, payload);
        
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
            this.vscode.postMessage(request);
        });
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

    private createRequest<T>(command: string, payload: T): any {
        return {
            id: this.generateId(),
            timestamp: Date.now(),
            type: 'request',
            command,
            payload
        };
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    private handleResponse(message: any): void {
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

    private handleEvent(message: any): void {
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
        return this.sendRequest('getDataInfo', { filePath });
    }

    async createPlot(variable: string, plotType: string): Promise<string> {
        return this.sendRequest('createPlot', { variable, plotType });
    }

    async getPythonPath(): Promise<string> {
        return this.sendRequest('getPythonPath', {});
    }

    async getExtensionConfig(): Promise<Record<string, any>> {
        return this.sendRequest('getExtensionConfig', {});
    }

    async refresh(): Promise<void> {
        return this.sendRequest('refresh', {});
    }

    // Event emission methods
    onDataLoaded(callback: (data: any) => void): () => void {
        return this.onEvent('dataLoaded', callback);
    }

    onError(callback: (error: any) => void): () => void {
        return this.onEvent('error', callback);
    }

    onPythonEnvironmentChanged(callback: (data: any) => void): () => void {
        return this.onEvent('pythonEnvironmentChanged', callback);
    }

    onUIStateChanged(callback: (state: any) => void): () => void {
        return this.onEvent('uiStateChanged', callback);
    }
}
