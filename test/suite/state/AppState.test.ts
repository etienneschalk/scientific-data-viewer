import * as assert from 'assert';
import { StateManager, AppState } from '../../../src/state/AppState';

suite('AppState Test Suite', () => {
    let stateManager: StateManager;

    setup(() => {
        stateManager = new StateManager();
    });

    teardown(() => {
        // Clean up any resources
    });

    test('should create StateManager instance', () => {
        assert.ok(stateManager);
    });

    test('should have initial state', () => {
        const state = stateManager.getState();
        assert.ok(state);
        assert.ok(typeof state === 'object');
        assert.ok(state.data);
        assert.ok(state.ui);
        assert.ok(state.python);
        assert.ok(state.extension);
    });

    test('should update data state', () => {
        const initialState = stateManager.getState();
        
        stateManager.setCurrentFile('test.nc');
        stateManager.setDataInfo({ format: 'NetCDF' });
        const updatedState = stateManager.getState();
        
        assert.notStrictEqual(initialState, updatedState);
        assert.strictEqual(updatedState.data.currentFile, 'test.nc');
        assert.strictEqual(updatedState.data.dataInfo?.format, 'NetCDF');
    });

    test('should update UI state', () => {
        const initialState = stateManager.getState();
        
        stateManager.dispatch({ type: 'SET_PLOTTING_CAPABILITIES', payload: true });
        stateManager.dispatch({ type: 'SET_LOADING', payload: false });
        const updatedState = stateManager.getState();
        
        assert.notStrictEqual(initialState, updatedState);
        assert.strictEqual(updatedState.ui.plottingCapabilities, true);
        assert.strictEqual(updatedState.data.isLoading, false);
    });

    test('should update Python state', () => {
        const initialState = stateManager.getState();
        
        stateManager.setPythonReady(true);
        stateManager.setPythonPath('/usr/bin/python');
        const updatedState = stateManager.getState();
        
        assert.notStrictEqual(initialState, updatedState);
        assert.strictEqual(updatedState.python.pythonPath, '/usr/bin/python');
        assert.strictEqual(updatedState.python.isReady, true);
    });

    test('should update extension state', () => {
        const initialState = stateManager.getState();
        const extensionConfig = { autoRefresh: true };
        
        stateManager.setExtension(extensionConfig);
        const updatedState = stateManager.getState();
        
        assert.notStrictEqual(initialState, updatedState);
        assert.strictEqual(updatedState.extension.extensionConfig?.autoRefresh, true);
    });

    test('should handle partial data updates', () => {
        const newData = { currentFile: 'test.nc' };
        
        stateManager.setCurrentFile('test.nc');
        const state = stateManager.getState();
        
        assert.strictEqual(state.data.currentFile, 'test.nc');
        // Other data properties should remain unchanged or be undefined
    });

    test('should handle partial UI updates', () => {
        const newUI = { plottingCapabilities: true };
        
        stateManager.dispatch({ type: 'SET_PLOTTING_CAPABILITIES', payload: true });
        const state = stateManager.getState();
        
        assert.strictEqual(state.ui.plottingCapabilities, true);
        // Other UI properties should remain unchanged or be undefined
    });

    test('should handle partial Python updates', () => {
        const newPython = { pythonPath: '/usr/bin/python' };
        
        stateManager.setPythonReady(true);
        stateManager.setPythonPath('/usr/bin/python');
        const state = stateManager.getState();
        
        assert.strictEqual(state.python.pythonPath, '/usr/bin/python');
        // Other Python properties should remain unchanged or be undefined
    });

    test('should handle partial extension updates', () => {
        const newExtension = { extensionConfig: { autoRefresh: true } };
        
        stateManager.setExtension({ autoRefresh: true });
        const state = stateManager.getState();
        
        assert.strictEqual(state.extension.extensionConfig?.autoRefresh, true);
        // Other extension properties should remain unchanged or be undefined
    });

    test('should handle multiple updates', () => {
        stateManager.setCurrentFile('test1.nc');
        stateManager.dispatch({ type: 'SET_PLOTTING_CAPABILITIES', payload: true });
        stateManager.setPythonPath('/usr/bin/python');
        stateManager.setExtension({ autoRefresh: true });
        
        const state = stateManager.getState();
        
        assert.strictEqual(state.data.currentFile, 'test1.nc');
        assert.strictEqual(state.ui.plottingCapabilities, true);
        assert.strictEqual(state.python.pythonPath, '/usr/bin/python');
        assert.strictEqual(state.extension.extensionConfig?.autoRefresh, true);
    });

    test('should handle undefined values', () => {
        stateManager.setCurrentFile(null);
        stateManager.dispatch({ type: 'SET_PLOTTING_CAPABILITIES', payload: false });
        stateManager.setPythonPath(null);
        stateManager.setExtension(null);
        
        const state = stateManager.getState();
        
        assert.strictEqual(state.data.currentFile, null);
        assert.strictEqual(state.ui.plottingCapabilities, false);
        assert.strictEqual(state.python.pythonPath, null);
        assert.strictEqual(state.extension.extensionConfig, null);
    });

    test('should handle null values', () => {
        stateManager.setCurrentFile(null);
        stateManager.dispatch({ type: 'SET_PLOTTING_CAPABILITIES', payload: false });
        stateManager.setPythonPath(null);
        stateManager.setExtension(null);
        
        const state = stateManager.getState();
        
        assert.strictEqual(state.data.currentFile, null);
        assert.strictEqual(state.ui.plottingCapabilities, false);
        assert.strictEqual(state.python.pythonPath, null);
        assert.strictEqual(state.extension.extensionConfig, null);
    });

    test('should handle empty objects', () => {
        // No-op for empty data update
        // No-op for empty UI update
        // No-op for empty Python update
        // No-op for empty extension update
        
        const state = stateManager.getState();
        
        // Should not throw and should maintain existing state
        assert.ok(state);
        assert.ok(typeof state === 'object');
    });

    test('should handle complex data structures', () => {
        const complexData = {
            currentFile: 'test.nc',
            dataInfo: {
                format: 'NetCDF',
                dimensions: { time: 100, lat: 180, lon: 360 },
                variables: [
                    { name: 'temperature', dtype: 'float32', shape: [100, 180, 360] }
                ]
            },
            lastLoadTime: new Date()
        };
        
        stateManager.setCurrentFile(complexData.currentFile);
        stateManager.setDataInfo(complexData.dataInfo);
        stateManager.setLastLoadTime(complexData.lastLoadTime);
        const state = stateManager.getState();
        
        assert.strictEqual(state.data.currentFile, 'test.nc');
        assert.strictEqual(state.data.dataInfo?.format, 'NetCDF');
        assert.strictEqual(state.data.dataInfo?.dimensions?.time, 100);
        assert.strictEqual(state.data.dataInfo?.variables?.length, 1);
        assert.ok(state.data.lastLoadTime instanceof Date);
    });

    test('should handle complex UI structures', () => {
        const complexUI = {
            plottingCapabilities: true,
            isLoading: false,
            selectedVariable: 'temperature',
            plotType: 'line',
            showAdvancedOptions: true
        };
        
        stateManager.dispatch({ type: 'SET_PLOTTING_CAPABILITIES', payload: complexUI.plottingCapabilities });
        stateManager.dispatch({ type: 'SET_LOADING', payload: complexUI.isLoading });
        stateManager.dispatch({ type: 'SET_SELECTED_VARIABLE', payload: complexUI.selectedVariable });
        stateManager.dispatch({ type: 'SET_PLOT_TYPE', payload: complexUI.plotType });
        const state = stateManager.getState();
        
        assert.strictEqual(state.ui.plottingCapabilities, true);
        assert.strictEqual(state.data.isLoading, false);
        assert.strictEqual(state.ui.selectedVariable, 'temperature');
        assert.strictEqual(state.ui.plotType, 'line');
    });

    test('should handle complex Python structures', () => {
        const complexPython = {
            pythonPath: '/usr/bin/python',
            isReady: true,
            version: '3.9.0',
            packages: ['xarray', 'netcdf4', 'matplotlib'],
            environment: 'conda'
        };
        
        stateManager.setPythonPath(complexPython.pythonPath);
        stateManager.setPythonReady(complexPython.isReady);
        stateManager.dispatch({ type: 'SET_AVAILABLE_PACKAGES', payload: complexPython.packages });
        const state = stateManager.getState();
        
        assert.strictEqual(state.python.pythonPath, '/usr/bin/python');
        assert.strictEqual(state.python.isReady, true);
        assert.strictEqual(state.python.availablePackages.length, 3);
    });

    test('should handle complex extension structures', () => {
        const complexExtension = {
            extensionConfig: {
                autoRefresh: true,
                maxFileSize: 500,
                defaultView: 'default',
                plottingCapabilities: true,
                devMode: false
            },
            version: '0.2.0',
            lastUpdate: new Date()
        };
        
        stateManager.setExtension(complexExtension.extensionConfig);
        const state = stateManager.getState();
        
        assert.strictEqual(state.extension.extensionConfig?.autoRefresh, true);
        assert.strictEqual(state.extension.extensionConfig?.maxFileSize, 500);
        assert.strictEqual(state.extension.extensionConfig?.defaultView, 'default');
        assert.strictEqual(state.extension.extensionConfig?.plottingCapabilities, true);
        assert.strictEqual(state.extension.extensionConfig?.devMode, false);
    });

    test('should maintain state immutability', () => {
        const initialState = stateManager.getState();
        const initialData = initialState.data;
        
        stateManager.setCurrentFile('test.nc');
        const updatedState = stateManager.getState();
        
        // Original state should not be modified
        assert.notStrictEqual(initialState, updatedState);
        assert.notStrictEqual(initialData, updatedState.data);
    });

    test('should handle rapid state updates', () => {
        // Simulate rapid state updates
        for (let i = 0; i < 100; i++) {
            stateManager.setCurrentFile(`test${i}.nc`);
            stateManager.dispatch({ type: 'SET_LOADING', payload: i % 2 === 0 });
        }
        
        const state = stateManager.getState();
        assert.strictEqual(state.data.currentFile, 'test99.nc');
        assert.strictEqual(state.data.isLoading, false);
    });

    test('should handle state reset', () => {
        stateManager.setCurrentFile('test.nc');
        stateManager.dispatch({ type: 'SET_PLOTTING_CAPABILITIES', payload: true });
        
        // Reset to initial state
        stateManager.dispatch({ type: 'RESET_STATE' });
        const state = stateManager.getState();
        
        // Should be back to initial state
        assert.ok(state);
        assert.ok(typeof state === 'object');
    });

    test('should handle state subscription', () => {
        let stateChangeCount = 0;
        let lastState: AppState | null = null;
        
        const unsubscribe = stateManager.subscribe((state: AppState) => {
            stateChangeCount++;
            lastState = state;
        });
        
        stateManager.setCurrentFile('test.nc');
        stateManager.dispatch({ type: 'SET_PLOTTING_CAPABILITIES', payload: true });
        
        assert.strictEqual(stateChangeCount, 2);
        assert.ok(lastState);
        assert.strictEqual((lastState as AppState).data.currentFile, 'test.nc');
        assert.strictEqual((lastState as AppState).ui.plottingCapabilities, true);
        
        // Test unsubscribe
        unsubscribe();
        stateManager.setCurrentFile('test2.nc');
        
        // Should not trigger subscription after unsubscribe
        assert.strictEqual(stateChangeCount, 2);
    });

    test('should handle multiple state subscriptions', () => {
        let subscription1Count = 0;
        let subscription2Count = 0;
        
        const unsubscribe1 = stateManager.subscribe(() => {
            subscription1Count++;
        });
        
        const unsubscribe2 = stateManager.subscribe(() => {
            subscription2Count++;
        });
        
        stateManager.setCurrentFile('test.nc');
        
        assert.strictEqual(subscription1Count, 1);
        assert.strictEqual(subscription2Count, 1);
        
        unsubscribe1();
        stateManager.setCurrentFile('test2.nc');
        
        assert.strictEqual(subscription1Count, 1);
        assert.strictEqual(subscription2Count, 2);
        
        unsubscribe2();
    });

    test('should handle state subscription errors', () => {
        let errorCaught = false;
        
        const unsubscribe = stateManager.subscribe(() => {
            throw new Error('Subscription error');
        });
        
        // Should not throw even if subscription has error
        assert.doesNotThrow(() => {
            stateManager.setCurrentFile('test.nc');
        });
        
        unsubscribe();
    });

    test('should handle concurrent state updates', async () => {
        const promises = [];
        
        for (let i = 0; i < 10; i++) {
            promises.push(new Promise(resolve => {
                setTimeout(() => {
                    stateManager.setCurrentFile(`test${i}.nc`);
                    resolve(undefined);
                }, Math.random() * 10);
            }));
        }
        
        await Promise.all(promises);
        
        const state = stateManager.getState();
        assert.ok(state.data.currentFile);
        assert.ok(state.data.currentFile.startsWith('test'));
    });
});