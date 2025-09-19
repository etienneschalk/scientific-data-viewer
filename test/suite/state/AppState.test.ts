import * as assert from 'assert';
import { StateManager } from '../../../src/state/AppState';

suite('StateManager Tests', () => {
    let stateManager: StateManager;

    setup(() => {
        stateManager = new StateManager();
    });

    test('should initialize with default state', () => {
        const state = stateManager.getState();
        assert.strictEqual(state.data.currentFile, null);
        assert.strictEqual(state.data.isLoading, false);
        assert.strictEqual(state.ui.plottingCapabilities, false);
        assert.strictEqual(state.python.isReady, false);
    });

    test('should update state through actions', () => {
        stateManager.dispatch({ type: 'SET_CURRENT_FILE', payload: '/test/file.nc' });
        stateManager.dispatch({ type: 'SET_LOADING', payload: true });
        stateManager.dispatch({ type: 'SET_PYTHON_READY', payload: true });

        const state = stateManager.getState();
        assert.strictEqual(state.data.currentFile, '/test/file.nc');
        assert.strictEqual(state.data.isLoading, true);
        assert.strictEqual(state.python.isReady, true);
    });

    test('should notify subscribers on state changes', () => {
        let notifiedState: any = null;
        const unsubscribe = stateManager.subscribe((state) => {
            notifiedState = state;
        });

        stateManager.dispatch({ type: 'SET_CURRENT_FILE', payload: '/test/file.nc' });
        
        assert.notStrictEqual(notifiedState, null);
        assert.strictEqual(notifiedState.data.currentFile, '/test/file.nc');

        unsubscribe();
    });

    test('should validate state correctly', () => {
        // Valid state
        let validation = stateManager.validateState();
        assert.strictEqual(validation.isValid, true);
        assert.strictEqual(validation.errors.length, 0);

        // Invalid state - loading but data already set
        stateManager.dispatch({ type: 'SET_DATA_INFO', payload: { test: 'data' } });
        stateManager.dispatch({ type: 'SET_LOADING', payload: true });
        
        validation = stateManager.validateState();
        assert.strictEqual(validation.isValid, false);
        assert.strictEqual(validation.errors.length, 1);
        assert.ok(validation.errors[0].includes('Data is loading but dataInfo is already set'));
    });

    test('should support undo functionality', () => {
        stateManager.dispatch({ type: 'SET_CURRENT_FILE', payload: '/test/file1.nc' });
        const state1 = stateManager.getState();
        
        stateManager.dispatch({ type: 'SET_CURRENT_FILE', payload: '/test/file2.nc' });
        const state2 = stateManager.getState();
        
        assert.strictEqual(state2.data.currentFile, '/test/file2.nc');
        
        stateManager.undo();
        const state3 = stateManager.getState();
        
        assert.strictEqual(state3.data.currentFile, '/test/file1.nc');
    });

    test('should handle utility methods', () => {
        stateManager.setCurrentFile('/test/file.nc');
        stateManager.setLoading(true);
        stateManager.setPythonReady(true);

        const state = stateManager.getState();
        assert.strictEqual(state.data.currentFile, '/test/file.nc');
        assert.strictEqual(state.data.isLoading, true);
        assert.strictEqual(state.python.isReady, true);
    });
});
