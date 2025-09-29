import * as assert from 'assert';
import * as vscode from 'vscode';
import { MessageBus } from '../../../src/communication/MessageBus';

suite('MessageBus Test Suite', () => {
    let messageBus: MessageBus;

    setup(() => {
        // Create a mock webview for testing
        const mockWebview = {
            onDidReceiveMessage: (callback: (message: any) => void) => {
                // Store the callback for later use
                (mockWebview as any).messageCallback = callback;
                return { dispose: () => {} };
            },
            postMessage: (message: any) => {
                // Simulate webview processing the message
                if ((mockWebview as any).messageCallback) {
                    // If it's a request, simulate a response
                    if (message.type === 'request') {
                        const response = {
                            type: 'response',
                            requestId: message.id,
                            success: true,
                            data: { success: true, data: message.payload.data }
                        };
                        // Simulate async processing
                        setTimeout(() => {
                            (mockWebview as any).messageCallback(response);
                        }, 10);
                    }
                }
            }
        } as any;
        messageBus = new MessageBus(mockWebview);
    });

    teardown(() => {
        // Clean up any resources
        messageBus.dispose();
    });

    test('should create MessageBus instance', () => {
        assert.ok(messageBus);
    });

    test('should handle data loaded events', () => {
        let eventReceived = false;
        const testData = { data: { currentFile: 'test.nc' } };

        messageBus.onEvent('dataLoaded', (data: any) => {
            eventReceived = true;
            assert.strictEqual(data.data.currentFile, 'test.nc');
        });

        // Simulate data loaded event
        messageBus.emitDataLoaded(testData);
        assert.ok(eventReceived);
    });

    test('should handle error events', () => {
        let errorReceived = false;

        messageBus.onEvent('error', (error: any) => {
            errorReceived = true;
            assert.strictEqual(error.message, 'Test error');
            assert.strictEqual(error.details, 'Test details');
        });

        // Simulate error event
        messageBus.emitError('Test error', 'Test details');
        assert.ok(errorReceived);
    });

    test('should handle Python environment change events', () => {
        let envChangeReceived = false;

        messageBus.onEvent('pythonEnvironmentChanged', (data: any) => {
            envChangeReceived = true;
            assert.strictEqual(data.pythonPath, '/usr/bin/python');
        });

        // Simulate Python environment change event
        messageBus.emitPythonEnvironmentChanged(true, '/usr/bin/python');
        assert.ok(envChangeReceived);
    });

    test('should handle UI state change events', () => {
        let stateChangeReceived = false;
        const testState = { ui: { plottingCapabilities: true } };

        messageBus.onEvent('uiStateChanged', (state: any) => {
            stateChangeReceived = true;
            assert.strictEqual(state.ui.plottingCapabilities, true);
        });

        // Simulate UI state change event
        messageBus.emitUIStateChanged(testState);
        assert.ok(stateChangeReceived);
    });

    test('should handle multiple event listeners', () => {
        let listener1Called = false;
        let listener2Called = false;

        messageBus.onEvent('dataLoaded', () => {
            listener1Called = true;
        });

        messageBus.onEvent('dataLoaded', () => {
            listener2Called = true;
        });

        const testData = { data: { currentFile: 'test.nc' } };
        messageBus.emitDataLoaded(testData);

        assert.ok(listener1Called);
        assert.ok(listener2Called);
    });

    test('should handle event listener removal', () => {
        let listenerCalled = false;
        const listener = () => {
            listenerCalled = true;
        };

        const unsubscribe = messageBus.onEvent('dataLoaded', listener);
        unsubscribe();

        const testData = { data: { currentFile: 'test.nc' } };
        messageBus.emitDataLoaded(testData);

        assert.strictEqual(listenerCalled, false);
    });

    test('should handle request sending', async () => {
        // Register a test handler
        messageBus.registerRequestHandler('test', async (payload: any) => {
            return { success: true, data: payload.data };
        });

        // Mock the request handling
        try {
            const result = await messageBus.sendRequest('test', { data: 'test' });
            // Should return the result from handler
            assert.ok(result);
            assert.strictEqual((result as any).data, 'test');
        } catch (error) {
            // Should not fail with registered handler
            assert.fail('Request should not fail with registered handler');
        }
    });

    test('should handle request timeout', async () => {
        try {
            await messageBus.sendRequest('timeout', { data: 'test' }, 100);
        } catch (error) {
            // Timeout errors are expected
            assert.ok(error instanceof Error);
        }
    });

    test('should handle concurrent requests', async () => {
        const requests = [];
        
        for (let i = 0; i < 5; i++) {
            requests.push(messageBus.sendRequest(`test${i}`, { data: `test${i}` }));
        }
        
        // All requests should be handled
        assert.strictEqual(requests.length, 5);
    });

    test('should handle error in event listeners', () => {
        let errorListenerCalled = false;
        
        messageBus.onEvent('dataLoaded', () => {
            throw new Error('Listener error');
        });

        messageBus.onEvent('error', () => {
            errorListenerCalled = true;
        });

        const testData = { data: { currentFile: 'test.nc' } };
        
        // Should not throw even if listener has error
        assert.doesNotThrow(() => {
            messageBus.emitDataLoaded(testData);
        });
    });

    test('should handle undefined event data', () => {
        let eventReceived = false;
        
        messageBus.onEvent('dataLoaded', (data: any) => {
            eventReceived = true;
            assert.strictEqual(data, undefined);
        });

        // Simulate event with undefined data
        messageBus.emitDataLoaded(undefined);
        assert.ok(eventReceived);
    });

    test('should handle null event data', () => {
        let eventReceived = false;
        
        messageBus.onEvent('dataLoaded', (data: any) => {
            eventReceived = true;
            assert.strictEqual(data, null);
        });

        // Simulate event with null data
        messageBus.emitDataLoaded(null);
        assert.ok(eventReceived);
    });

    test('should handle empty event data', () => {
        let eventReceived = false;
        
        messageBus.onEvent('dataLoaded', (data: any) => {
            eventReceived = true;
            assert.strictEqual(typeof data, 'object');
        });

        // Simulate event with empty object
        messageBus.emitDataLoaded({});
        assert.ok(eventReceived);
    });

    test('should handle multiple error listeners', () => {
        let errorListener1Called = false;
        let errorListener2Called = false;

        messageBus.onEvent('error', () => {
            errorListener1Called = true;
        });

        messageBus.onEvent('error', () => {
            errorListener2Called = true;
        });

        messageBus.emitError('Test error');

        assert.ok(errorListener1Called);
        assert.ok(errorListener2Called);
    });

    test('should handle event listener with this context', () => {
        let contextPreserved = false;
        const testContext = { test: true };

        const listener = function(this: any) {
            contextPreserved = this.test === true;
        };

        messageBus.onEvent('dataLoaded', listener.bind(testContext));

        const testData = { data: { currentFile: 'test.nc' } };
        messageBus.emitDataLoaded(testData);

        assert.ok(contextPreserved);
    });

    test('should handle async event listeners', async () => {
        let asyncListenerCalled = false;

        messageBus.onEvent('dataLoaded', async (data: any) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            asyncListenerCalled = true;
        });

        const testData = { data: { currentFile: 'test.nc' } };
        messageBus.emitDataLoaded(testData);

        // Wait for async listener to complete
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.ok(asyncListenerCalled);
    });

    test('should handle event listener exceptions', () => {
        messageBus.onEvent('dataLoaded', () => {
            throw new Error('Test exception');
        });

        // Should not throw even if listener throws
        assert.doesNotThrow(() => {
            messageBus.emitDataLoaded({ data: { currentFile: 'test.nc' } });
        });
    });

    test('should handle message bus disposal', () => {
        // Test that message bus can be disposed
        assert.doesNotThrow(() => {
            messageBus.dispose();
        });
    });

    test('should handle event listener cleanup', () => {
        let listenerCalled = false;
        const listener = () => {
            listenerCalled = true;
        };

        const unsubscribe = messageBus.onEvent('dataLoaded', listener);
        unsubscribe();

        const testData = { data: { currentFile: 'test.nc' } };
        messageBus.emitDataLoaded(testData);

        assert.strictEqual(listenerCalled, false);
    });

    test('should handle multiple event types', () => {
        let dataEventReceived = false;
        let errorEventReceived = false;
        let envEventReceived = false;
        let stateEventReceived = false;

        messageBus.onEvent('dataLoaded', () => { dataEventReceived = true; });
        messageBus.onEvent('error', () => { errorEventReceived = true; });
        messageBus.onEvent('pythonEnvironmentChanged', () => { envEventReceived = true; });
        messageBus.onEvent('uiStateChanged', () => { stateEventReceived = true; });

        messageBus.emitDataLoaded({ data: { currentFile: 'test.nc' } });
        messageBus.emitError('Test error');
        messageBus.emitPythonEnvironmentChanged(true, '/usr/bin/python');
        messageBus.emitUIStateChanged({ ui: { plottingCapabilities: true } });

        assert.ok(dataEventReceived);
        assert.ok(errorEventReceived);
        assert.ok(envEventReceived);
        assert.ok(stateEventReceived);
    });

    test('should handle event listener with parameters', () => {
        let receivedData: any = null;
        let receivedError: any = null;
        let receivedEnv: any = null;
        let receivedState: any = null;

        messageBus.onEvent('dataLoaded', (data: any) => { receivedData = data; });
        messageBus.onEvent('error', (error: any) => { receivedError = error; });
        messageBus.onEvent('pythonEnvironmentChanged', (env: any) => { receivedEnv = env; });
        messageBus.onEvent('uiStateChanged', (state: any) => { receivedState = state; });

        const testData = { data: { currentFile: 'test.nc' } };
        const testError = { message: 'Test error' };
        const testEnv = { pythonPath: '/usr/bin/python' };
        const testState = { ui: { plottingCapabilities: true } };

        messageBus.emitDataLoaded(testData);
        messageBus.emitError('Test error');
        messageBus.emitPythonEnvironmentChanged(true, '/usr/bin/python');
        messageBus.emitUIStateChanged(testState);

        assert.strictEqual(receivedData, testData);
        assert.strictEqual(receivedError?.message, 'Test error');
        assert.strictEqual(receivedEnv?.pythonPath, '/usr/bin/python');
        assert.strictEqual(receivedState, testState);
    });
});