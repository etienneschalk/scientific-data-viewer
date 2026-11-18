/**
 * Extension-host side of the webview channel: answers webview requests and
 * emits events to the webview (see `MessageTypes.ts` for the protocol).
 */

import * as vscode from 'vscode';
import { Logger } from '../../common/Logger';
import {
    Events,
    EventMessage,
    isRequestMessage,
    RequestCommand,
    RequestMessage,
    Requests,
    ResponseMessage,
} from './MessageTypes';

type RequestHandler<C extends RequestCommand> = (
    payload: Requests[C][0],
) => Promise<Requests[C][1]>;

export class MessageBus implements vscode.Disposable {
    private readonly handlers = new Map<
        string,
        (payload: unknown) => Promise<unknown>
    >();
    private readonly listener: vscode.Disposable;
    private disposed = false;

    constructor(private readonly webview: vscode.Webview) {
        this.listener = webview.onDidReceiveMessage((message: unknown) => {
            if (isRequestMessage(message)) {
                void this.handleRequest(message);
            }
        });
    }

    handle<C extends RequestCommand>(
        command: C,
        handler: RequestHandler<C>,
    ): void {
        this.handlers.set(
            command,
            handler as (payload: unknown) => Promise<unknown>,
        );
    }

    emit<E extends keyof Events>(event: E, payload: Events[E]): void {
        const message: EventMessage = { type: 'event', event, payload };
        this.post(message);
    }

    dispose(): void {
        this.disposed = true;
        this.listener.dispose();
        this.handlers.clear();
    }

    private async handleRequest(message: RequestMessage): Promise<void> {
        const handler = this.handlers.get(message.command);
        if (!handler) {
            this.respond({
                requestId: message.id,
                success: false,
                error: `Unknown command: ${message.command}`,
            });
            return;
        }
        try {
            const payload = await handler(message.payload);
            this.respond({ requestId: message.id, success: true, payload });
        } catch (error) {
            this.respond({
                requestId: message.id,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private respond(response: Omit<ResponseMessage, 'type'>): void {
        this.post({ type: 'response', ...response });
    }

    private post(message: ResponseMessage | EventMessage): void {
        // The webview may be closed while a request (e.g. a plot) is running.
        if (this.disposed) {
            return;
        }
        try {
            this.webview.postMessage(message).then(undefined, (error) => {
                Logger.debug(`[MessageBus] postMessage failed: ${error}`);
            });
        } catch (error) {
            Logger.debug(`[MessageBus] postMessage failed: ${error}`);
        }
    }
}
