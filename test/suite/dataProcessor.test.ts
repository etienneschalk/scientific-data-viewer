import * as assert from 'assert';
import * as vscode from 'vscode';
import { DataProcessor } from '../../src/dataProcessor';
import { PythonManager } from '../../src/pythonManager';

suite('DataProcessor Test Suite', () => {
    let dataProcessor: DataProcessor;
    let pythonManager: PythonManager;

    suiteSetup(() => {
        // Mock PythonManager for testing
        pythonManager = {
            isReady: () => true,
            executePythonScript: async (script: string) => {
                // Mock response for testing
                return {
                    format: 'NetCDF',
                    fileSize: 1024,
                    dimensions: { time: 100, lat: 180, lon: 360 },
                    variables: [
                        { name: 'temperature', dtype: 'float32', shape: [100, 180, 360] },
                        { name: 'time', dtype: 'datetime64', shape: [100] }
                    ]
                };
            }
        } as any;

        dataProcessor = new DataProcessor(pythonManager);
    });

    test('should create DataProcessor instance', () => {
        assert.ok(dataProcessor);
    });

    test('should get data info for valid file', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const dataInfo = await dataProcessor.getDataInfo(mockUri);
        
        assert.ok(dataInfo);
        assert.strictEqual(dataInfo?.format, 'NetCDF');
        assert.ok(dataInfo?.dimensions);
        assert.ok(dataInfo?.variables);
    });

    test('should get variable list', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const variables = await dataProcessor.getVariableList(mockUri);
        
        assert.ok(Array.isArray(variables));
        assert.ok(variables.length > 0);
    });

    test('should get dimension list', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const dimensions = await dataProcessor.getDimensionList(mockUri);
        
        assert.ok(Array.isArray(dimensions));
        assert.ok(dimensions.length > 0);
    });

    test('should handle Python environment not ready', async () => {
        const mockPythonManager = {
            isReady: () => false
        } as any;
        
        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        
        try {
            await processor.getDataInfo(mockUri);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.strictEqual(error.message, 'Python environment not ready');
        }
    });
});
