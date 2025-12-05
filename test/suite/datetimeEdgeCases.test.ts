import * as assert from 'assert';
import * as vscode from 'vscode';
import { DataProcessor } from '../../src/python/DataProcessor';

suite('Datetime Edge Cases Test Suite', () => {
    let dataProcessor: DataProcessor;
    let mockPythonManager: any;

    suiteSetup(() => {
        // Mock PythonManager for testing
        mockPythonManager = {
            ready: true,
            executePythonFile: async (
                scriptPath: string,
                args: string[],
                enableLogs: boolean = false,
            ) => {
                // Mock responses based on test scenario
                if (args[0] === 'info') {
                    return {
                        result: {
                            format: 'NetCDF',
                            fileSize: 1024,
                            xarray_html_repr: '',
                            xarray_text_repr: '',
                            xarray_show_versions: '',
                            format_info: {
                                extension: 'nc',
                                available_engines: ['netcdf4'],
                                missing_packages: [],
                                is_supported: true,
                            },
                            used_engine: 'netcdf4',
                            dimensions_flattened: {},
                            coordinates_flattened: {},
                            variables_flattened: {},
                            attributes_flattened: {},
                            xarray_html_repr_flattened: {},
                            xarray_text_repr_flattened: {},
                            datetime_variables: {
                                '/': [
                                    {
                                        name: 'time',
                                        min: '2020-01-01T00:00:00',
                                        max: '2020-01-10T00:00:00',
                                    },
                                ],
                            },
                        },
                    };
                } else if (args[0] === 'plot') {
                    // Check for datetime parameters
                    const hasDatetimeVar = args.includes('--datetime-variable');
                    const hasStartDatetime = args.includes('--start-datetime');
                    const hasEndDatetime = args.includes('--end-datetime');

                    if (hasDatetimeVar && hasStartDatetime && hasEndDatetime) {
                        // Test case: datetime filtering
                        return {
                            result: {
                                plot_data:
                                    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                                format_info: {
                                    extension: 'nc',
                                    display_name: 'NetCDF',
                                    available_engines: ['netcdf4'],
                                    missing_packages: [],
                                    is_supported: true,
                                },
                            },
                        };
                    }

                    // Default plot response
                    return {
                        result: {
                            plot_data:
                                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                            format_info: {
                                extension: 'nc',
                                display_name: 'NetCDF',
                                available_engines: ['netcdf4'],
                                missing_packages: [],
                                is_supported: true,
                            },
                        },
                    };
                }
                return {};
            },
        };

        dataProcessor = new DataProcessor(mockPythonManager);
    });

    test('should create plot with datetime variable', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            'time',
            '2020-01-01T00:00:00',
            '2020-01-10T00:00:00',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should create plot with only datetime variable (no time range)', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            'time',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should create plot with only start datetime', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            'time',
            '2020-01-01T00:00:00',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should create plot with only end datetime', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            'time',
            undefined,
            '2020-01-10T00:00:00',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should handle empty datetime variable name', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            '',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should handle whitespace-only datetime variable name', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            '   ',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should handle empty start datetime', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            'time',
            '',
            '2020-01-10T00:00:00',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should handle empty end datetime', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            'time',
            '2020-01-01T00:00:00',
            '',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should handle datetime variable with dots in name', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature.hourly',
            'auto',
            false,
            'time.stamp',
            '2020-01-01T00:00:00',
            '2020-01-10T00:00:00',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should handle cross-group datetime variable', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const plotData = await dataProcessor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            'subgroup/time',
            '2020-01-01T00:00:00',
            '2020-01-10T00:00:00',
        );

        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data);
    });

    test('should get data info with datetime variables', async () => {
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const dataInfo = await dataProcessor.getDataInfo(mockUri);

        assert.ok(dataInfo);
        assert.ok(dataInfo?.result?.datetime_variables);
        assert.ok(dataInfo?.result?.datetime_variables['/']);
        assert.strictEqual(dataInfo?.result?.datetime_variables['/'][0].name, 'time');
        assert.ok(dataInfo?.result?.datetime_variables['/'][0].min);
        assert.ok(dataInfo?.result?.datetime_variables['/'][0].max);
    });

    test('should get data info with no datetime variables', async () => {
        const mockPythonManagerNoDatetime = {
            ready: true,
            executePythonFile: async () => ({
                result: {
                    format: 'NetCDF',
                    fileSize: 1024,
                    xarray_html_repr: '',
                    xarray_text_repr: '',
                    xarray_show_versions: '',
                    format_info: {
                        extension: 'nc',
                        available_engines: ['netcdf4'],
                        missing_packages: [],
                        is_supported: true,
                    },
                    used_engine: 'netcdf4',
                    dimensions_flattened: {},
                    coordinates_flattened: {},
                    variables_flattened: {},
                    attributes_flattened: {},
                    xarray_html_repr_flattened: {},
                    xarray_text_repr_flattened: {},
                    datetime_variables: {},
                },
            }),
        } as any;

        const processor = new DataProcessor(mockPythonManagerNoDatetime);
        const mockUri = vscode.Uri.file('/path/to/test.nc');
        const dataInfo = await processor.getDataInfo(mockUri);

        assert.ok(dataInfo);
        assert.ok(dataInfo?.result?.datetime_variables);
        assert.strictEqual(
            Object.keys(dataInfo?.result?.datetime_variables || {}).length,
            0,
        );
    });

    test('should handle plot creation error with invalid datetime', async () => {
        const mockPythonManagerError = {
            ready: true,
            executePythonFile: async () => ({
                error: {
                    error: 'Error processing datetime variable: Invalid datetime string',
                    format_info: {
                        extension: 'nc',
                        display_name: 'NetCDF',
                        available_engines: ['netcdf4'],
                        missing_packages: [],
                        is_supported: true,
                    },
                },
            }),
        } as any;

        const processor = new DataProcessor(mockPythonManagerError);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const plotData = await processor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            'time',
            'invalid-datetime',
        );

        assert.ok(plotData);
        assert.ok(plotData?.error);
        assert.ok(plotData.error?.error.includes('datetime'));
    });

    test('should handle plot creation error with datetime variable not found', async () => {
        const mockPythonManagerError = {
            ready: true,
            executePythonFile: async () => ({
                error: {
                    error: "Datetime variable 'nonexistent_time' not found in dataset",
                    format_info: {
                        extension: 'nc',
                        display_name: 'NetCDF',
                        available_engines: ['netcdf4'],
                        missing_packages: [],
                        is_supported: true,
                    },
                },
            }),
        } as any;

        const processor = new DataProcessor(mockPythonManagerError);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const plotData = await processor.createPlot(
            mockUri,
            'temperature',
            'auto',
            false,
            'nonexistent_time',
        );

        assert.ok(plotData);
        assert.ok(plotData?.error);
        assert.ok(plotData.error?.error.includes('not found'));
    });
});

