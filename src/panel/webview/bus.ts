import { CreatePlotResponse } from '../../shared/plotLayout';
import { clampPlotTimeout } from './util';

/**
 * Wire format (unchanged):
 * - webview -> host: `{type:'request', id, timestamp, command, payload}`
 * - host -> webview: `{type:'response', requestId, success, payload?, error?}`
 *   and `{type:'event', event, payload}`
 */
interface VsCodeApi {
    postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
}

export interface RequestOptions {
    /** ms before the request is rejected (default 60 s) */
    timeout?: number;
    /** Called once when the timeout fires (e.g. to abort the backend work) */
    onTimeout?: () => unknown;
    /** Error message used on timeout */
    timeoutMessage?: string;
}

type EventListener = (payload: any) => void;

export class WebviewMessageBus {
    private readonly pendingRequests = new Map<string, PendingRequest>();
    private readonly eventListeners = new Map<string, EventListener[]>();
    readonly isDegradedMode: boolean;

    constructor(private readonly vscode: VsCodeApi | null) {
        this.isDegradedMode = vscode === null;
        window.addEventListener('message', (event: MessageEvent) => {
            const message = event.data;
            if (!message || typeof message !== 'object') {
                return;
            }
            if (message.type === 'response') {
                this.handleResponse(message);
            } else if (message.type === 'event') {
                this.handleEvent(message);
            }
        });
    }

    sendRequest<T = any>(
        command: string,
        payload: unknown,
        options: RequestOptions = {},
    ): Promise<T> {
        const { timeout = 60000, onTimeout, timeoutMessage } = options;
        const vscode = this.vscode;
        if (vscode === null) {
            return Promise.reject(
                new Error(
                    `Command '${command}' not available in degraded mode`,
                ),
            );
        }

        const request = {
            id: this.generateId(),
            timestamp: Date.now(),
            type: 'request',
            command,
            payload,
        };

        return new Promise<T>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(request.id);
                if (onTimeout) {
                    try {
                        Promise.resolve(onTimeout()).catch((error) =>
                            console.error(
                                `onTimeout handler failed for ${command}:`,
                                error,
                            ),
                        );
                    } catch (error) {
                        console.error(
                            `onTimeout handler failed for ${command}:`,
                            error,
                        );
                    }
                }
                reject(
                    new Error(timeoutMessage || `Request timeout: ${command}`),
                );
            }, timeout);

            this.pendingRequests.set(request.id, {
                resolve: (value) => {
                    clearTimeout(timeoutId);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                },
            });

            vscode.postMessage(request);
        });
    }

    onEvent(event: string, listener: EventListener): void {
        const listeners = this.eventListeners.get(event) ?? [];
        listeners.push(listener);
        this.eventListeners.set(event, listeners);
    }

    private generateId(): string {
        return (
            Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
        );
    }

    private handleResponse(message: any): void {
        const pendingRequest = this.pendingRequests.get(message.requestId);
        if (!pendingRequest) {
            // e.g. the response of a request that already timed out
            console.warn(
                `Received response for unknown request: ${message.requestId}`,
            );
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
        for (const listener of this.eventListeners.get(message.event) ?? []) {
            try {
                listener(message.payload);
            } catch (error) {
                console.error(
                    `Error in event listener for ${message.event}:`,
                    error,
                );
            }
        }
    }

    /**
     * Ask the extension to create a plot. On timeout the backend process is
     * aborted (abortPlot) and the promise rejects.
     */
    createPlot(
        payload: { operationId: string } & Record<string, unknown>,
        timeoutMs: number,
    ): Promise<CreatePlotResponse> {
        const timeout = clampPlotTimeout(timeoutMs);
        return this.sendRequest('createPlot', payload, {
            timeout,
            onTimeout: () => this.abortPlot(payload.operationId),
            timeoutMessage: `Plot request timeout: The plot generation took too long (>${timeout / 1000}s). The backend process has been terminated. Try selecting a smaller data subset or a simpler plot type.`,
        });
    }

    abortPlot(operationId: string): Promise<unknown> {
        return this.sendRequest(
            'abortPlot',
            { operationId },
            { timeout: 5000 },
        );
    }

    savePlot(plotData: string, variable: string, fileName: string) {
        return this.sendRequest('savePlot', { plotData, variable, fileName });
    }

    savePlotAs(plotData: string, variable: string) {
        return this.sendRequest('savePlotAs', { plotData, variable });
    }

    openPlot(plotData: string, variable: string, fileName: string) {
        return this.sendRequest('openPlot', { plotData, variable, fileName });
    }

    refresh() {
        return this.sendRequest('refresh', {});
    }

    exportWebview(htmlContent: string | null) {
        return this.sendRequest('exportWebview', { htmlContent });
    }

    showNotification(message: string, type: 'info' | 'warning' | 'error') {
        return this.sendRequest('showNotification', { message, type });
    }

    executeCommand(command: string, args?: unknown[]) {
        return this.sendRequest(
            'executeCommand',
            args === undefined ? { command } : { command, args },
        );
    }
}

function createMessageBus(): WebviewMessageBus {
    try {
        if (typeof acquireVsCodeApi === 'function') {
            return new WebviewMessageBus(acquireVsCodeApi());
        }
    } catch (error) {
        console.warn('⚠️ VSCode API not available:', error);
    }
    // Exported HTML opened in a browser: no extension to talk to.
    return new WebviewMessageBus(null);
}

// Do not use the VS Code API directly; communicate through messageBus.
export const messageBus = createMessageBus();
