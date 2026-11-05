import * as assert from 'assert';
import { ErrorBoundary } from '../../../src/common/ErrorBoundary';

suite('ErrorBoundary Tests', () => {
    let errorBoundary: ErrorBoundary;

    setup(() => {
        // Clear the singleton instance to ensure clean state
        (ErrorBoundary as any).instance = undefined;
        errorBoundary = ErrorBoundary.getInstance();
    });

    test('should handle errors with component-specific handlers', () => {
        let handledError: Error | null = null;
        let handledContext: any = null;

        errorBoundary.registerHandler('test-component', (error, context) => {
            handledError = error;
            handledContext = context;
        });

        const testError = new Error('Test error');
        const testContext = {
            component: 'test-component',
            operation: 'test-operation',
        };

        errorBoundary.handleError(testError, testContext);

        assert.strictEqual(handledError, testError);
        assert.deepStrictEqual(handledContext, testContext);
    });

    test('should fall back to global handler when component handler fails', () => {
        let globalHandledError: Error | null = null;

        errorBoundary.registerGlobalHandler((error, context) => {
            globalHandledError = error;
        });

        // Register a component handler that throws
        errorBoundary.registerHandler('failing-component', (error, context) => {
            throw new Error('Handler failed');
        });

        const testError = new Error('Test error');
        const testContext = {
            component: 'failing-component',
            operation: 'test-operation',
        };

        errorBoundary.handleError(testError, testContext);

        assert.strictEqual(globalHandledError, testError);
    });

    test('should track error history', () => {
        const testError = new Error('Test error');
        const testContext = { component: 'test', operation: 'test' };

        errorBoundary.handleError(testError, testContext);

        const history = errorBoundary.getErrorHistory();
        assert.strictEqual(history.length, 1);
        assert.strictEqual(history[0].error, testError);
        assert.deepStrictEqual(history[0].context, testContext);
    });

    test('unregistered component handler is no longer called', () => {
        let componentCalls = 0;
        let globalCalls = 0;
        errorBoundary.registerGlobalHandler(() => {
            globalCalls += 1;
        });
        errorBoundary.registerHandler('panel-1', () => {
            componentCalls += 1;
        });
        const context = { component: 'panel-1', operation: 'op' };

        errorBoundary.handleError(new Error('first'), context);
        errorBoundary.unregisterHandler('panel-1');
        errorBoundary.handleError(new Error('second'), context);
        // Unregistering an unknown component is a no-op
        errorBoundary.unregisterHandler('never-registered');

        assert.strictEqual(componentCalls, 1);
        assert.strictEqual(globalCalls, 1);
    });

    test('does not hook process-wide uncaught exceptions', () => {
        const before = process.listenerCount('uncaughtException');
        (ErrorBoundary as any).instance = undefined;
        ErrorBoundary.getInstance();
        assert.strictEqual(process.listenerCount('uncaughtException'), before);
    });

    test('should wrap async operations', async () => {
        const successResult = await errorBoundary.wrapAsync(
            async () => 'success',
            { component: 'test', operation: 'async' },
        );
        assert.strictEqual(successResult, 'success');

        const errorResult = await errorBoundary.wrapAsync(
            async () => {
                throw new Error('async error');
            },
            { component: 'test', operation: 'async' },
        );
        assert.strictEqual(errorResult, null);
    });
});
