import * as assert from 'assert';
import * as vscode from 'vscode';
import { DataProcessor, DataInfo } from '../../src/dataProcessor';
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
                    result: {
                        format: 'NetCDF',
                        fileSize: 1024,
                        dimensions: { time: 100, lat: 180, lon: 360 },
                        variables: [
                            { name: 'temperature', dtype: 'float32', shape: [100, 180, 360] },
                            { name: 'time', dtype: 'datetime64', shape: [100] }
                        ]
                    }
                };
            },
            executePythonFile: async (scriptPath: string, args: string[]) => {
                // Mock response for testing
                return {
                    result: {
                        format: 'NetCDF',
                        fileSize: 1024,
                        dimensions: { time: 100, lat: 180, lon: 360 },
                        variables: [
                            { name: 'temperature', dtype: 'float32', shape: [100, 180, 360] },
                            { name: 'time', dtype: 'datetime64', shape: [100] }
                        ]
                    }
                };
            },
            executePythonFileWithLogs: async (scriptPath: string, args: string[]) => {
                // Mock response for testing
                return {
                    result: {
                        format: 'NetCDF',
                        fileSize: 1024,
                        dimensions: { time: 100, lat: 180, lon: 360 },
                        variables: [
                            { name: 'temperature', dtype: 'float32', shape: [100, 180, 360] },
                            { name: 'time', dtype: 'datetime64', shape: [100] }
                        ]
                    }
                };
            }
        } as any;

        dataProcessor = new DataProcessor(pythonManager);
    });

    test('should create DataProcessor instance', () => {
        assert.ok(dataProcessor);
        assert.ok(dataProcessor.pythonManagerInstance);
    });

    test('should get data info for valid file', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const dataInfo = await dataProcessor.getDataInfo(mockUri);

        assert.ok(dataInfo);
        assert.strictEqual(dataInfo?.result?.format, 'NetCDF');
        assert.ok(dataInfo?.result?.dimensions);
        assert.ok(dataInfo?.result?.variables);
        assert.strictEqual(dataInfo?.result?.fileSize, 1024);
    });

    test('should get data info with error handling', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                throw new Error('Python script failed');
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const dataInfo = await processor.getDataInfo(mockUri);
        assert.strictEqual(dataInfo, null);
    });


    test('should create plot', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFileWithLogs: async (scriptPath: string, args: string[]) => {
                return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const plotData = await processor.createPlot(mockUri, 'temperature', 'line');
        assert.ok(plotData);
        assert.ok(plotData.startsWith('iVBOR'));
    });

    test('should create plot with auto type', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFileWithLogs: async (scriptPath: string, args: string[]) => {
                return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const plotData = await processor.createPlot(mockUri, 'temperature');
        assert.ok(plotData);
        assert.ok(plotData.startsWith('iVBOR'));
    });

    test('should handle plot creation error', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFileWithLogs: async (scriptPath: string, args: string[]) => {
                throw new Error('Plot creation failed');
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const plotData = await processor.createPlot(mockUri, 'temperature', 'line');
        assert.strictEqual(plotData, null);
    });

    test('should handle plot creation with error in result', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFileWithLogs: async (scriptPath: string, args: string[]) => {
                return { error: 'Plot creation failed' };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const plotData = await processor.createPlot(mockUri, 'temperature', 'line');
        assert.strictEqual(plotData, null);
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

    test('should handle Python environment not ready for plot', async () => {
        const mockPythonManager = {
            isReady: () => false
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        try {
            await processor.createPlot(mockUri, 'temperature');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.strictEqual(error.message, 'Python environment not ready');
        }
    });

    test('should handle empty file', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                // Mock response for empty file
                return {
                    result: {
                        format: 'NetCDF',
                        fileSize: 0,
                        dimensions: {},
                        variables: []
                    }
                };
            },
            executePythonFileWithLogs: async (scriptPath: string, args: string[]) => {
                // Mock response for empty file
                return {
                    result: {
                        format: 'NetCDF',
                        fileSize: 0,
                        dimensions: {},
                        variables: []
                    }
                };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/empty.nc');

        const dataInfo = await processor.getDataInfo(mockUri);
        assert.ok(dataInfo);
        assert.strictEqual(dataInfo?.result?.format, 'NetCDF');
        assert.strictEqual(dataInfo?.result?.fileSize, 0);
        assert.ok(dataInfo?.result?.dimensions);
        assert.ok(dataInfo?.result?.variables);
        assert.strictEqual(dataInfo?.result?.variables?.length, 0);
    });

    test('should handle data info with error field', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return {
                    format: 'NetCDF',
                    fileSize: 1024,
                    error: 'File corrupted'
                };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/corrupted.nc');

        const dataInfo = await processor.getDataInfo(mockUri);
        assert.ok(dataInfo);
        assert.strictEqual(dataInfo?.error, 'File corrupted');
    });
});
