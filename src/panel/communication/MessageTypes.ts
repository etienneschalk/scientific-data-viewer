/**
 * Wire protocol between the webview script and the extension host.
 *
 * The webview sends requests and receives responses; the extension host only
 * emits events. Keep these maps in sync with `src/panel/webview/`.
 */

import { CreatePlotResponse } from '../../shared/plotLayout';
import { DataInfoResult, PlotOptions } from '../../types';

export interface RequestMessage {
    type: 'request';
    id: string;
    command: string;
    payload: unknown;
}

export interface ResponseMessage {
    type: 'response';
    requestId: string;
    success: boolean;
    payload?: unknown;
    error?: string;
}

export interface EventMessage {
    type: 'event';
    event: string;
    payload: unknown;
}

export interface SaveResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

export interface PlotFilePayload {
    /** Base64 encoded PNG */
    plotData: string;
    variable: string;
    /** Path relative to the data file's folder (save) or the temp folder (open) */
    fileName: string;
}

/** Requests sent by the webview: command → [payload, result]. */
export interface Requests {
    createPlot: [PlotOptions, CreatePlotResponse];
    abortPlot: [{ operationId: string }, { success: boolean; message: string }];
    savePlot: [PlotFilePayload, SaveResult];
    savePlotAs: [{ plotData: string; variable: string }, SaveResult];
    openPlot: [PlotFilePayload, void];
    refresh: [unknown, void];
    showNotification: [
        { message: string; type: 'info' | 'warning' | 'error' },
        void,
    ];
    executeCommand: [{ command: string; args?: unknown[] }, unknown];
    exportWebview: [{ htmlContent: string }, SaveResult];
}

export type RequestCommand = keyof Requests;

export interface DataLoadedPayload {
    data: {
        currentFile: string;
        dataInfo: DataInfoResult;
        lastLoadTime: string;
    };
    python: { pythonPath: string | null };
    extension: { extensionConfig: Record<string, unknown> };
}

/** Events emitted by the extension host: event → payload. */
export interface Events {
    dataLoaded: DataLoadedPayload;
    error: { message: string; details?: string; errorType?: string };
    scrollToHeaderCommandEvent: { headerId: string; headerLabel: string };
    exportWebviewCommandEvent: Record<string, never>;
}

export function isRequestMessage(message: unknown): message is RequestMessage {
    return (
        typeof message === 'object' &&
        message !== null &&
        (message as RequestMessage).type === 'request' &&
        typeof (message as RequestMessage).id === 'string' &&
        typeof (message as RequestMessage).command === 'string'
    );
}
