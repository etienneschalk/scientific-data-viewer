import * as assert from 'assert';
import { ErrorBoundary } from '../../../src/common/ErrorBoundary';

suite('ErrorBoundary Tests', () => {
    let errorBoundary: ErrorBoundary;

    setup(() => {
        // Clear the singleton instance to ensure clean state
        (ErrorBoundary as any).instance = undefined;
        errorBoundary = ErrorBoundary.getInstance();
        errorBoundary.clearErrorHistory();
    });

    test('should handle errors with component-specific handlers', () => {
        let handledError: Error | null = null;
        let handledContext: any = null;

        errorBoundary.registerHandler('test-component', (error, context) => {
            handledError = error;
            handledContext = context;
        });

        const testError = new Error('Test error');
        const testContext = { component: 'test-component', operation: 'test-operation' };

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
        const testContext = { component: 'failing-component', operation: 'test-operation' };

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

    test('should count errors by component', () => {
        errorBoundary.handleError(new Error('Error 1'), { component: 'comp1', operation: 'op1' });
        errorBoundary.handleError(new Error('Error 2'), { component: 'comp1', operation: 'op2' });
        errorBoundary.handleError(new Error('Error 3'), { component: 'comp2', operation: 'op1' });

        assert.strictEqual(errorBoundary.getErrorCount('comp1'), 2);
        assert.strictEqual(errorBoundary.getErrorCount('comp2'), 1);
        assert.strictEqual(errorBoundary.getErrorCount(), 3);
    });

    test('should wrap async operations', async () => {
        const successResult = await errorBoundary.wrapAsync(
            async () => 'success',
            { component: 'test', operation: 'async' }
        );
        assert.strictEqual(successResult, 'success');

        const errorResult = await errorBoundary.wrapAsync(
            async () => { throw new Error('async error'); },
            { component: 'test', operation: 'async' }
        );
        assert.strictEqual(errorResult, null);
    });

    test('should wrap sync operations', () => {
        const successResult = errorBoundary.wrapSync(
            () => 'success',
            { component: 'test', operation: 'sync' }
        );
        assert.strictEqual(successResult, 'success');

        const errorResult = errorBoundary.wrapSync(
            () => { throw new Error('sync error'); },
            { component: 'test', operation: 'sync' }
        );
        assert.strictEqual(errorResult, null);
    });
});
