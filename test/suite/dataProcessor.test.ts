import * as assert from 'assert';
import * as vscode from 'vscode';
import { DataProcessor, DataInfo } from '../../src/python/DataProcessor';
import { PythonManager } from '../../src/python/PythonManager';

suite('DataProcessor Test Suite', () => {
    let dataProcessor: DataProcessor;
    let pythonManager: PythonManager;

    suiteSetup(() => {
        // Mock PythonManager for testing
        pythonManager = {
            ready: true,
            executePythonScript: async (script: string) => {
                // Mock response for testing
                return {
                    result: {
                        format: 'NetCDF',
                        fileSize: 1024
                    }
                };
            },
            executePythonFile: async (scriptPath: string, args: string[], enableLogs: boolean = false) => {
                // Mock response for testing
                if (args[0] === 'info') {
                    return {
                        result: {
                            format: 'NetCDF',
                            fileSize: 1024,
                            xarray_html_repr: '',
                            xarray_text_repr: '',
                            xarray_show_versions: '',
                            format_info: { extension: 'nc', available_engines: [], missing_packages: [], is_supported: true },
                            used_engine: 'netcdf4',
                            dimensions_flattened: {},
                            coordinates_flattened: {},
                            variables_flattened: {},
                            attributes_flattened: {},
                            xarray_html_repr_flattened: {},
                            xarray_text_repr_flattened: {}
                        }
                    };
                } else if (args[0] === 'plot') {
                    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                }
                return {};
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
        assert.strictEqual(dataInfo?.result?.fileSize, 1024);
    });

    test('should get data info with error handling', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (scriptPath: string, args: string[], enableLogs: boolean = false) => {
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
            ready: true,
            executePythonFile: async (scriptPath: string, args: string[], enableLogs: boolean = false) => {
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
            ready: true,
            executePythonFile: async (scriptPath: string, args: string[], enableLogs: boolean = false) => {
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
            ready: true,
            executePythonFile: async (scriptPath: string, args: string[], enableLogs: boolean = false) => {
                throw new Error('Plot creation failed');
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        // createPlot throws errors instead of returning null
        try {
            await processor.createPlot(mockUri, 'temperature', 'line');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.strictEqual(error.message, 'Plot creation failed');
        }
    });

    test('should handle plot creation with error in result', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (scriptPath: string, args: string[], enableLogs: boolean = false) => {
                return { error: 'Plot creation failed' };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        // createPlot throws errors instead of returning null
        try {
            await processor.createPlot(mockUri, 'temperature', 'line');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.strictEqual(error.message, 'Plot creation failed');
        }
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
            ready: true,
            executePythonFile: async (scriptPath: string, args: string[], enableLogs: boolean = false) => {
                // Mock response for empty file
                return {
                    result: {
                        format: 'NetCDF',
                        fileSize: 0
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
    });

    test('should handle data info with error field', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (scriptPath: string, args: string[], enableLogs: boolean = false) => {
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
