import * as assert from 'assert';
import * as vscode from 'vscode';
import { MessageBus } from '../../../src/panel/communication/MessageBus';

suite('MessageBus Test Suite', () => {
    let messageBus: MessageBus;
    let mockWebview: vscode.Webview;
    let receive: (message: unknown) => void;
    let posted: any[];
    let listenerDisposed: boolean;

    /** Deliver a webview message and wait for the bus to answer. */
    async function request(command: string, payload: unknown = {}) {
        const id = `req-${posted.length}-${Math.random()}`;
        receive({ type: 'request', id, command, payload });
        for (let i = 0; i < 50; i++) {
            const response = posted.find(
                (m) => m.type === 'response' && m.requestId === id,
            );
            if (response) {
                return response;
            }
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        throw new Error(`No response for ${command}`);
    }

    setup(() => {
        posted = [];
        listenerDisposed = false;
        mockWebview = {
            onDidReceiveMessage: (callback: (message: unknown) => void) => {
                receive = callback;
                return {
                    dispose: () => {
                        listenerDisposed = true;
                    },
                };
            },
            postMessage: (message: unknown) => {
                posted.push(message);
                return Promise.resolve(true);
            },
        } as any;
        messageBus = new MessageBus(mockWebview);
    });

    teardown(() => {
        messageBus.dispose();
    });

    test('answers a request with the handler result', async () => {
        messageBus.handle('createPlot', async (plot) => `png:${plot.variable}`);

        const response = await request('createPlot', { variable: 'temp' });

        assert.deepStrictEqual(response, {
            type: 'response',
            requestId: response.requestId,
            success: true,
            payload: 'png:temp',
        });
    });

    test('answers a failed request with the error message', async () => {
        messageBus.handle('createPlot', async () => {
            throw new Error('Plot failed');
        });

        const response = await request('createPlot', { variable: 'temp' });

        assert.strictEqual(response.success, false);
        assert.strictEqual(response.error, 'Plot failed');
    });

    test('answers an unknown command with an error', async () => {
        const response = await request('doesNotExist');

        assert.strictEqual(response.success, false);
        assert.strictEqual(response.error, 'Unknown command: doesNotExist');
    });

    test('ignores messages that are not requests', async () => {
        let called = false;
        messageBus.handle('refresh', async () => {
            called = true;
        });

        receive({ type: 'event', event: 'refresh', payload: {} });
        receive({ command: 'refresh' });
        receive(null);
        await new Promise((resolve) => setTimeout(resolve, 5));

        assert.strictEqual(called, false);
        assert.deepStrictEqual(posted, []);
    });

    test('emits events to the webview', () => {
        messageBus.emit('scrollToHeaderCommandEvent', {
            headerId: 'h1',
            headerLabel: 'Header',
        });

        assert.deepStrictEqual(posted, [
            {
                type: 'event',
                event: 'scrollToHeaderCommandEvent',
                payload: { headerId: 'h1', headerLabel: 'Header' },
            },
        ]);
    });

    test('stops posting and listening after dispose', async () => {
        let called = false;
        messageBus.handle('refresh', async () => {
            called = true;
        });

        messageBus.dispose();
        messageBus.emit('exportWebviewCommandEvent', {});

        assert.strictEqual(listenerDisposed, true);
        assert.strictEqual(called, false);
        assert.deepStrictEqual(posted, []);
    });

    test('does not throw when the webview is already disposed', () => {
        (mockWebview as any).postMessage = () => {
            throw new Error('Webview is disposed');
        };

        assert.doesNotThrow(() =>
            messageBus.emit('error', { message: 'late error' }),
        );
    });
});
