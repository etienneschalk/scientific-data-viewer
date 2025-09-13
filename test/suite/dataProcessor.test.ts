import * as assert from 'assert';
import * as vscode from 'vscode';
import { DataProcessor, DataInfo, DataSlice } from '../../src/dataProcessor';
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
            },
            executePythonFile: async (scriptPath: string, args: string[]) => {
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
            },
            executePythonFileWithLogs: async (scriptPath: string, args: string[]) => {
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
        assert.ok(dataProcessor.pythonManagerInstance);
    });

    test('should get data info for valid file', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const dataInfo = await dataProcessor.getDataInfo(mockUri);

        assert.ok(dataInfo);
        assert.strictEqual(dataInfo?.format, 'NetCDF');
        assert.ok(dataInfo?.dimensions);
        assert.ok(dataInfo?.variables);
        assert.strictEqual(dataInfo?.fileSize, 1024);
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

    test('should get data slice', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return {
                    variable: 'temperature',
                    data: [1, 2, 3, 4, 5],
                    shape: [5],
                    dtype: 'float32'
                };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const dataSlice = await processor.getDataSlice(mockUri, 'temperature');
        assert.ok(dataSlice);
        assert.strictEqual(dataSlice?.variable, 'temperature');
        assert.ok(Array.isArray(dataSlice?.data));
        assert.strictEqual(dataSlice?.dtype, 'float32');
    });

    test('should get data slice with slice specification', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return {
                    variable: 'temperature',
                    data: [1, 2, 3],
                    shape: [3],
                    dtype: 'float32'
                };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const sliceSpec = { start: 0, end: 3 };

        const dataSlice = await processor.getDataSlice(mockUri, 'temperature', sliceSpec);
        assert.ok(dataSlice);
        assert.strictEqual(dataSlice?.variable, 'temperature');
    });

    test('should get data slice with error handling', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                throw new Error('Python script failed');
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const dataSlice = await processor.getDataSlice(mockUri, 'temperature');
        assert.strictEqual(dataSlice, null);
    });

    test('should get variable list', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const variables = await dataProcessor.getVariableList(mockUri);

        assert.ok(Array.isArray(variables));
        assert.ok(variables.length > 0);
        assert.strictEqual(variables[0], 'temperature');
        assert.strictEqual(variables[1], 'time');
    });

    test('should get variable list for empty data', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return {
                    format: 'NetCDF',
                    fileSize: 0,
                    dimensions: {},
                    variables: []
                };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/empty.nc');

        const variables = await processor.getVariableList(mockUri);
        assert.ok(Array.isArray(variables));
        assert.strictEqual(variables.length, 0);
    });

    test('should get variable list for null data info', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return null;
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const variables = await processor.getVariableList(mockUri);
        assert.ok(Array.isArray(variables));
        assert.strictEqual(variables.length, 0);
    });

    test('should get dimension list', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const dimensions = await dataProcessor.getDimensionList(mockUri);

        assert.ok(Array.isArray(dimensions));
        assert.ok(dimensions.length > 0);
        assert.ok(dimensions.includes('time'));
        assert.ok(dimensions.includes('lat'));
        assert.ok(dimensions.includes('lon'));
    });

    test('should get dimension list for empty data', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return {
                    format: 'NetCDF',
                    fileSize: 0,
                    dimensions: {},
                    variables: []
                };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/empty.nc');

        const dimensions = await processor.getDimensionList(mockUri);
        assert.ok(Array.isArray(dimensions));
        assert.strictEqual(dimensions.length, 0);
    });

    test('should get dimension list for null data info', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return null;
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const dimensions = await processor.getDimensionList(mockUri);
        assert.ok(Array.isArray(dimensions));
        assert.strictEqual(dimensions.length, 0);
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

    test('should get HTML representation', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return { html: '<div>Test HTML</div>' };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const htmlRep = await processor.getHtmlRepresentation(mockUri);
        assert.strictEqual(htmlRep, '<div>Test HTML</div>');
    });

    test('should handle HTML representation error', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                throw new Error('HTML generation failed');
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const htmlRep = await processor.getHtmlRepresentation(mockUri);
        assert.strictEqual(htmlRep, null);
    });

    test('should get text representation', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return { text: 'Test text representation' };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const textRep = await processor.getTextRepresentation(mockUri);
        assert.strictEqual(textRep, 'Test text representation');
    });

    test('should handle text representation error', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                throw new Error('Text generation failed');
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const textRep = await processor.getTextRepresentation(mockUri);
        assert.strictEqual(textRep, null);
    });

    test('should get show versions', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                return { versions: 'xarray: 0.20.0\nnumpy: 1.21.0' };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const versions = await processor.getShowVersions();
        assert.strictEqual(versions, 'xarray: 0.20.0\nnumpy: 1.21.0');
    });

    test('should handle show versions error', async () => {
        const mockPythonManager = {
            isReady: () => true,
            executePythonFile: async (scriptPath: string, args: string[]) => {
                throw new Error('Version check failed');
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const versions = await processor.getShowVersions();
        assert.strictEqual(versions, null);
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

    test('should handle Python environment not ready for data slice', async () => {
        const mockPythonManager = {
            isReady: () => false
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        try {
            await processor.getDataSlice(mockUri, 'temperature');
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
                    format: 'NetCDF',
                    fileSize: 0,
                    dimensions: {},
                    variables: []
                };
            },
            executePythonFileWithLogs: async (scriptPath: string, args: string[]) => {
                // Mock response for empty file
                return {
                    format: 'NetCDF',
                    fileSize: 0,
                    dimensions: {},
                    variables: []
                };
            }
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/empty.nc');

        const dataInfo = await processor.getDataInfo(mockUri);
        assert.ok(dataInfo);
        assert.strictEqual(dataInfo?.format, 'NetCDF');
        assert.strictEqual(dataInfo?.fileSize, 0);
        assert.ok(dataInfo?.dimensions);
        assert.ok(dataInfo?.variables);
        assert.strictEqual(dataInfo?.variables?.length, 0);
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
