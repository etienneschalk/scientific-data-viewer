/**
 * Type-safe communication system for VSCode extension
 */

export interface BaseMessage {
    id: string;
    timestamp: number;
}

export interface RequestMessage<T = any> extends BaseMessage {
    type: 'request';
    command: string;
    payload: T;
}

export interface ResponseMessage<T = any> extends BaseMessage {
    type: 'response';
    requestId: string;
    success: boolean;
    payload?: T;
    error?: string;
}

export interface EventMessage<T = any> extends BaseMessage {
    type: 'event';
    event: string;
    payload: T;
}

export type Message<T = any> = RequestMessage<T> | ResponseMessage<T> | EventMessage<T>;

// Specific message types
export interface DataInfoRequest {
    filePath: string;
}

export interface DataInfoResponse {
    data: any;
    filePath: string;
    lastLoadTime: string;
}

export interface CreatePlotRequest {
    variable: string;
    plotType: string;
}

export interface CreatePlotResponse {
    plotData: string; // Base64 encoded image
}

export interface SavePlotRequest {
    plotData: string; // Base64 encoded image
    variable: string;
    fileName: string;
}

export interface SavePlotResponse {
    success: boolean;
    filePath?: string;
    error?: string;
}

export interface OpenPlotRequest {
    plotData: string; // Base64 encoded image
    variable: string;
    fileName: string;
}

export interface SavePlotAsRequest {
    plotData: string; // Base64 encoded image
    variable: string;
}

export interface PythonPathResponse {
    pythonPath: string;
}

export interface ExtensionConfigResponse {
    config: Record<string, any>;
}

export interface ShowNotificationRequest {
    message: string;
    type: 'info' | 'warning' | 'error';
}

export interface HeaderUpdateRequest {
    headers: Array<{
        label: string;
        level: number;
        id?: string;
        line?: number;
        children: any[];
    }>;
}

export interface ScrollToHeaderRequest {
    headerId: string;
    headerLabel: string;
}

export interface ErrorResponse {
    message: string;
    details?: string;
    errorType?: string;
    formatInfo?: any;
}

// Event types
export interface DataLoadedEvent {
    state: any;
}

export interface ErrorEvent {
    message: string;
    details?: string;
    errorType?: string;
    formatInfo?: any;
}

export interface PythonEnvironmentChangedEvent {
    isReady: boolean;
    pythonPath: string | null;
}

// Message factory functions
export class MessageFactory {
    private static generateId(): string {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    static createRequest<T>(command: string, payload: T): RequestMessage<T> {
        return {
            id: this.generateId(),
            timestamp: Date.now(),
            type: 'request',
            command,
            payload
        };
    }

    static createResponse<T>(requestId: string, success: boolean, payload?: T, error?: string): ResponseMessage<T> {
        return {
            id: this.generateId(),
            timestamp: Date.now(),
            type: 'response',
            requestId,
            success,
            payload,
            error
        };
    }

    static createEvent<T>(event: string, payload: T): EventMessage<T> {
        return {
            id: this.generateId(),
            timestamp: Date.now(),
            type: 'event',
            event,
            payload
        };
    }
}

// Message type guards
export function isRequestMessage(message: Message): message is RequestMessage {
    return message.type === 'request';
}

export function isResponseMessage(message: Message): message is ResponseMessage {
    return message.type === 'response';
}

export function isEventMessage(message: Message): message is EventMessage {
    return message.type === 'event';
}

// Command constants
export const COMMANDS = {
    GET_DATA_INFO: 'getDataInfo',
    CREATE_PLOT: 'createPlot',
    SAVE_PLOT: 'savePlot',
    SAVE_PLOT_AS: 'savePlotAs',
    OPEN_PLOT: 'openPlot',
    REFRESH: 'refresh',
    SHOW_NOTIFICATION: 'showNotification',
    UPDATE_HEADERS: 'updateHeaders',
} as const;

export const EVENTS = {
    DATA_LOADED: 'dataLoaded',
    ERROR: 'error',
    PYTHON_ENVIRONMENT_CHANGED: 'pythonEnvironmentChanged',
    UI_STATE_CHANGED: 'uiStateChanged',
    SCROLL_TO_HEADER: 'scrollToHeader',
} as const;

export type Command = typeof COMMANDS[keyof typeof COMMANDS];
export type Event = typeof EVENTS[keyof typeof EVENTS];
