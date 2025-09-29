import * as assert from 'assert';
import * as vscode from 'vscode';
import { MessageBus } from '../../../src/communication/MessageBus';

suite('MessageBus Test Suite', () => {
    let messageBus: MessageBus;
    let mockWebview: vscode.Webview;

    setup(() => {
        // Create a mock webview for testing
        mockWebview = {
            onDidReceiveMessage: (callback: (message: any) => void) => {
                // Store the callback for later use
                (mockWebview as any).messageCallback = callback;
                return { dispose: () => { } };
            },
            postMessage: (message: any) => {
                // Simulate webview processing the message
                if ((mockWebview as any).messageCallback) {
                    // If it's an event, simulate local event handling
                    if (message.type === 'event') {
                        // Simulate async processing
                        setTimeout(() => {
                            (mockWebview as any).messageCallback(message);
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

    test('should handle data loaded events', (done) => {
        let eventReceived = false;
        const testData = { data: { currentFile: 'test.nc' } };
        
        messageBus.onEvent('dataLoaded', (data: any) => {
            eventReceived = true;
            assert.strictEqual(data.data.currentFile, 'test.nc');
            done();
        });
        
        // Simulate data loaded event
        messageBus.emitDataLoaded(testData);
        
        // Give it time to process
        setTimeout(() => {
            if (!eventReceived) {
                done(new Error('Event was not received'));
            }
        }, 100);
    });

    test('should handle error events', (done) => {
        let errorReceived = false;
        
        messageBus.onEvent('error', (error: any) => {
            errorReceived = true;
            assert.strictEqual(error.message, 'Test error');
            assert.strictEqual(error.details, 'Test details');
            done();
        });
        
        // Simulate error event
        messageBus.emitError('Test error', 'Test details');
        
        // Give it time to process
        setTimeout(() => {
            if (!errorReceived) {
                done(new Error('Event was not received'));
            }
        }, 100);
    });

    test('should handle Python environment change events', (done) => {
        let envChangeReceived = false;
        
        messageBus.onEvent('pythonEnvironmentChanged', (data: any) => {
            envChangeReceived = true;
            assert.strictEqual(data.pythonPath, '/usr/bin/python');
            done();
        });
        
        // Simulate Python environment change event
        messageBus.emitPythonEnvironmentChanged(true, '/usr/bin/python');
        
        // Give it time to process
        setTimeout(() => {
            if (!envChangeReceived) {
                done(new Error('Event was not received'));
            }
        }, 100);
    });

    test('should handle UI state change events', (done) => {
        let stateChangeReceived = false;
        const testState = { ui: { plottingCapabilities: true } };
        
        messageBus.onEvent('uiStateChanged', (state: any) => {
            stateChangeReceived = true;
            assert.strictEqual(state.ui.plottingCapabilities, true);
            done();
        });
        
        // Simulate UI state change event
        messageBus.emitUIStateChanged(testState);
        
        // Give it time to process
        setTimeout(() => {
            if (!stateChangeReceived) {
                done(new Error('Event was not received'));
            }
        }, 100);
    });

    test('should handle multiple event listeners', (done) => {
        let listener1Called = false;
        let listener2Called = false;
        
        messageBus.onEvent('dataLoaded', () => {
            listener1Called = true;
            if (listener2Called) {
                done();
            }
        });
        
        messageBus.onEvent('dataLoaded', () => {
            listener2Called = true;
            if (listener1Called) {
                done();
            }
        });
        
        // Simulate data loaded event
        messageBus.emitDataLoaded({ data: { currentFile: 'test.nc' } });
        
        // Give it time to process
        setTimeout(() => {
            if (!listener1Called || !listener2Called) {
                done(new Error('Not all listeners were called'));
            }
        }, 100);
    });

    test('should handle request sending', async () => {
        // Register a request handler
        messageBus.registerRequestHandler('testCommand', async (payload: any) => {
            return { success: true, data: payload };
        });

        // Send a request
        const result = await messageBus.sendRequest('testCommand', { test: 'data' }) as any;
        
        assert.ok(result);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.test, 'data');
    });

    test('should handle undefined event data', (done) => {
        let eventReceived = false;
        
        messageBus.onEvent('dataLoaded', (data: any) => {
            eventReceived = true;
            assert.strictEqual(data, undefined);
            done();
        });
        
        // Simulate data loaded event with undefined data
        messageBus.emitDataLoaded(undefined);
        
        // Give it time to process
        setTimeout(() => {
            if (!eventReceived) {
                done(new Error('Event was not received'));
            }
        }, 100);
    });

    test('should handle null event data', (done) => {
        let eventReceived = false;
        
        messageBus.onEvent('dataLoaded', (data: any) => {
            eventReceived = true;
            assert.strictEqual(data, null);
            done();
        });
        
        // Simulate data loaded event with null data
        messageBus.emitDataLoaded(null);
        
        // Give it time to process
        setTimeout(() => {
            if (!eventReceived) {
                done(new Error('Event was not received'));
            }
        }, 100);
    });

    test('should handle empty event data', (done) => {
        let eventReceived = false;
        
        messageBus.onEvent('dataLoaded', (data: any) => {
            eventReceived = true;
            assert.strictEqual(data, '');
            done();
        });
        
        // Simulate data loaded event with empty data
        messageBus.emitDataLoaded('');
        
        // Give it time to process
        setTimeout(() => {
            if (!eventReceived) {
                done(new Error('Event was not received'));
            }
        }, 100);
    });

    test('should handle multiple error listeners', (done) => {
        let errorListener1Called = false;
        let errorListener2Called = false;
        
        messageBus.onEvent('error', () => {
            errorListener1Called = true;
            if (errorListener2Called) {
                done();
            }
        });
        
        messageBus.onEvent('error', () => {
            errorListener2Called = true;
            if (errorListener1Called) {
                done();
            }
        });
        
        // Simulate error event
        messageBus.emitError('Test error');
        
        // Give it time to process
        setTimeout(() => {
            if (!errorListener1Called || !errorListener2Called) {
                done(new Error('Not all error listeners were called'));
            }
        }, 100);
    });

    test('should handle event listener with this context', (done) => {
        let contextPreserved = false;
        const testContext = { test: 'context' };
        
        messageBus.onEvent('dataLoaded', function(this: any) {
            contextPreserved = this === testContext;
            done();
        }.bind(testContext));
        
        // Simulate data loaded event
        messageBus.emitDataLoaded({ data: { currentFile: 'test.nc' } });
        
        // Give it time to process
        setTimeout(() => {
            if (!contextPreserved) {
                done(new Error('Context was not preserved'));
            }
        }, 100);
    });

    test('should handle async event listeners', (done) => {
        let asyncListenerCalled = false;
        
        messageBus.onEvent('dataLoaded', async (data) => {
            // Simulate async processing
            await new Promise(resolve => setTimeout(resolve, 10));
            asyncListenerCalled = true;
            done();
        });
        
        // Simulate data loaded event
        messageBus.emitDataLoaded({ data: { currentFile: 'test.nc' } });
        
        // Give it time to process
        setTimeout(() => {
            if (!asyncListenerCalled) {
                done(new Error('Async listener was not called'));
            }
        }, 100);
    });

    test('should handle multiple event types', (done) => {
        let dataEventReceived = false;
        let errorEventReceived = false;
        
        messageBus.onEvent('dataLoaded', () => {
            dataEventReceived = true;
            if (errorEventReceived) {
                done();
            }
        });
        
        messageBus.onEvent('error', () => {
            errorEventReceived = true;
            if (dataEventReceived) {
                done();
            }
        });
        
        // Simulate both events
        messageBus.emitDataLoaded({ data: { currentFile: 'test.nc' } });
        messageBus.emitError('Test error');
        
        // Give it time to process
        setTimeout(() => {
            if (!dataEventReceived || !errorEventReceived) {
                done(new Error('Not all event types were received'));
            }
        }, 100);
    });

    test('should handle event listener with parameters', (done) => {
        let eventReceived = false;
        
        messageBus.onEvent('dataLoaded', (data: any) => {
            eventReceived = true;
            assert.strictEqual(data.data.currentFile, 'test.nc');
            done();
        });
        
        // Simulate data loaded event with specific data
        messageBus.emitDataLoaded({ data: { currentFile: 'test.nc' } });
        
        // Give it time to process
        setTimeout(() => {
            if (!eventReceived) {
                done(new Error('Event was not received'));
            }
        }, 100);
    });
});
