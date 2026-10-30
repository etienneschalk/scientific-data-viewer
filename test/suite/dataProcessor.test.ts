import * as assert from 'assert';
import * as vscode from 'vscode';
import {
    buildCreatePlotCliArgs,
    DataProcessor,
} from '../../src/python/DataProcessor';
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
                        fileSize: 1024,
                    },
                };
            },
            executePythonFile: async (
                scriptPath: string,
                args: string[],
                enableLogs: boolean = false,
            ) => {
                // Mock response for testing
                if (args[0] === 'info') {
                    return {
                        result: {
                            fileSize: 1024,
                            xarray_html_repr: '',
                            xarray_text_repr: '',
                            xarray_show_versions: '',
                            format_info: {
                                extension: 'nc',
                                available_engines: [],
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
                        },
                    };
                } else if (args[0] === 'plot') {
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
        assert.strictEqual(dataInfo?.result?.fileSize, 1024);
    });

    test('should get data info with error handling', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (
                scriptPath: string,
                args: string[],
                enableLogs: boolean = false,
            ) => {
                throw new Error('Python script failed');
            },
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        await assert.rejects(
            processor.getDataInfo(mockUri),
            /Python script failed/,
        );
    });

    test('should create plot', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (
                scriptPath: string,
                args: string[],
                enableLogs: boolean = false,
            ) => {
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
            },
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const plotData = await processor.createPlot(mockUri, {
            variable: 'temperature',
        });
        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data.startsWith('iVBOR'));
    });

    test('should create plot with auto type', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (
                scriptPath: string,
                args: string[],
                enableLogs: boolean = false,
            ) => {
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
            },
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        const plotData = await processor.createPlot(mockUri, {
            variable: 'temperature',
        });
        assert.ok(plotData);
        assert.ok(plotData?.result?.plot_data.startsWith('iVBOR'));
    });

    test('should handle plot creation error', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (
                scriptPath: string,
                args: string[],
                enableLogs: boolean = false,
            ) => {
                throw new Error('Plot creation failed');
            },
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        // createPlot throws errors instead of returning null
        try {
            await processor.createPlot(mockUri, {
                variable: 'temperature',
            });
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.strictEqual(error.message, 'Plot creation failed');
        }
    });

    test('should handle plot creation with error in result', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (
                scriptPath: string,
                args: string[],
                enableLogs: boolean = false,
            ) => {
                return {
                    error: {
                        error: 'Plot creation failed',
                        format_info: {
                            extension: 'nc',
                            display_name: 'NetCDF',
                            available_engines: ['netcdf4'],
                            missing_packages: [],
                            is_supported: true,
                        },
                    },
                };
            },
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        // createPlot returns error in response instead of throwing
        const plotData = await processor.createPlot(mockUri, {
            variable: 'temperature',
        });
        assert.ok(plotData);
        assert.ok(plotData?.error);
        assert.strictEqual(plotData.error?.error, 'Plot creation failed');
    });

    test('should handle Python environment not ready', async () => {
        const mockPythonManager = {
            isReady: () => false,
            notReadyReason: 'missing core packages in /usr/bin/python3: xarray',
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        try {
            await processor.getDataInfo(mockUri);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.strictEqual(
                error.message,
                'Python environment not ready: missing core packages in /usr/bin/python3: xarray',
            );
        }
    });

    test('should handle Python environment not ready for plot', async () => {
        const mockPythonManager = {
            isReady: () => false,
            notReadyReason: 'missing core packages in /usr/bin/python3: xarray',
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        try {
            await processor.createPlot(mockUri, { variable: 'temperature' });
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.strictEqual(
                error.message,
                'Python environment not ready: missing core packages in /usr/bin/python3: xarray',
            );
        }
    });

    test('should handle empty file', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (
                scriptPath: string,
                args: string[],
                enableLogs: boolean = false,
            ) => {
                // Mock response for empty file
                return {
                    result: {
                        fileSize: 0,
                    },
                };
            },
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/empty.nc');

        const dataInfo = await processor.getDataInfo(mockUri);
        assert.ok(dataInfo);
        assert.strictEqual(dataInfo?.result?.fileSize, 0);
    });

    test('should handle data info with error field', async () => {
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (
                scriptPath: string,
                args: string[],
                enableLogs: boolean = false,
            ) => {
                return {
                    fileSize: 1024,
                    error: 'File corrupted',
                };
            },
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/corrupted.nc');

        const dataInfo = await processor.getDataInfo(mockUri);
        assert.ok(dataInfo);
        assert.strictEqual(dataInfo?.error, 'File corrupted');
    });

    test('should pass dimension slices, facet row/col, and bins to createPlot', async () => {
        let capturedArgs: string[] = [];
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (
                _scriptPath: string,
                args: string[],
                _enableLogs: boolean = false,
            ) => {
                capturedArgs = args;
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
            },
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        await processor.createPlot(mockUri, {
            variable: 'temperature',
            dimensionSlices: { time: '0:24:2', rlat: '100:120' },
            facetRow: 'time',
            facetCol: 'rlat',
            plotX: 'lon',
            plotY: 'lat',
            plotHue: 'time',
            bins: 50,
        });

        assert.ok(capturedArgs.includes('--dimension-slices'));
        const dimIdx = capturedArgs.indexOf('--dimension-slices');
        assert.ok(dimIdx >= 0, '--dimension-slices should be present');
        const dimJson = capturedArgs[dimIdx + 1];
        assert.ok(dimJson.includes('"time"') && dimJson.includes('"rlat"'));
        assert.ok(capturedArgs.includes('--facet-row'));
        assert.strictEqual(
            capturedArgs[capturedArgs.indexOf('--facet-row') + 1],
            'time',
        );
        assert.ok(capturedArgs.includes('--facet-col'));
        assert.strictEqual(
            capturedArgs[capturedArgs.indexOf('--facet-col') + 1],
            'rlat',
        );
        assert.ok(capturedArgs.includes('--plot-x'));
        assert.strictEqual(
            capturedArgs[capturedArgs.indexOf('--plot-x') + 1],
            'lon',
        );
        assert.ok(capturedArgs.includes('--plot-y'));
        assert.strictEqual(
            capturedArgs[capturedArgs.indexOf('--plot-y') + 1],
            'lat',
        );
        assert.ok(capturedArgs.includes('--plot-hue'));
        assert.strictEqual(
            capturedArgs[capturedArgs.indexOf('--plot-hue') + 1],
            'time',
        );
        assert.ok(capturedArgs.includes('--bins'));
        assert.strictEqual(
            capturedArgs[capturedArgs.indexOf('--bins') + 1],
            '50',
        );
    });

    test('should pass plot x, y, hue only to createPlot', async () => {
        let capturedArgs: string[] = [];
        const mockPythonManager = {
            ready: true,
            executePythonFile: async (
                _scriptPath: string,
                args: string[],
                _enableLogs: boolean = false,
            ) => {
                capturedArgs = args;
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
            },
        } as any;

        const processor = new DataProcessor(mockPythonManager);
        const mockUri = vscode.Uri.file('/path/to/test.nc');

        await processor.createPlot(mockUri, {
            variable: 'temperature',
            plotX: 'time',
            plotY: 'lat',
            plotHue: 'lon',
        });

        assert.ok(capturedArgs.includes('--plot-x'));
        assert.strictEqual(
            capturedArgs[capturedArgs.indexOf('--plot-x') + 1],
            'time',
        );
        assert.ok(capturedArgs.includes('--plot-y'));
        assert.strictEqual(
            capturedArgs[capturedArgs.indexOf('--plot-y') + 1],
            'lat',
        );
        assert.ok(capturedArgs.includes('--plot-hue'));
        assert.strictEqual(
            capturedArgs[capturedArgs.indexOf('--plot-hue') + 1],
            'lon',
        );
    });
});

suite('buildCreatePlotCliArgs', () => {
    const baseOptions = {
        style: 'default',
        netcdfEngineOrder: ['netcdf4', 'h5netcdf'],
        showInheritedCoordinates: true,
    };

    test('builds the minimal command', () => {
        assert.deepStrictEqual(
            buildCreatePlotCliArgs('/d/a.nc', { variable: '/t' }, baseOptions),
            [
                'plot',
                '/d/a.nc',
                '/t',
                '--style',
                'default',
                '--netcdf-engine-order',
                'netcdf4,h5netcdf',
            ],
        );
    });

    test('skips empty, null and invalid values (as sent by the webview)', () => {
        const args = buildCreatePlotCliArgs(
            '/d/a.nc',
            {
                variable: 't',
                datetimeVariableName: '   ',
                facetRow: '',
                cmap: null as unknown as string,
                colWrap: 0,
                bins: 2.5,
                aspect: -1,
                size: null,
                vmin: null,
                dimensionSlices: {},
            },
            baseOptions,
        );
        assert.deepStrictEqual(args.slice(5), [
            '--netcdf-engine-order',
            'netcdf4,h5netcdf',
        ]);
    });

    test('maps every option to its flag', () => {
        const args = buildCreatePlotCliArgs(
            '/d/a.nc',
            {
                variable: 't',
                datetimeVariableName: 'time',
                startDatetime: '2020-01-01',
                endDatetime: '2020-02-01',
                dimensionSlices: { time: '0:2' },
                facetRow: 'time',
                facetCol: 'lev',
                colWrap: 'auto',
                plotX: 'lon',
                plotY: 'lat',
                plotHue: 'lev',
                xincrease: false,
                yincrease: true,
                aspect: 2,
                size: 3,
                robust: true,
                cmap: ' viridis ',
                bins: 20,
                vmin: 0,
                vmax: 1.5,
                addColorbar: false,
                addLegend: true,
            },
            {
                ...baseOptions,
                convertBandsToVariables: true,
                showInheritedCoordinates: false,
                openAsKerchunk: true,
                facetgridFigsize: [4, 3],
            },
        );
        const flagValue = (flag: string) => args[args.indexOf(flag) + 1];
        assert.strictEqual(flagValue('--datetime-variable'), 'time');
        assert.strictEqual(flagValue('--start-datetime'), '2020-01-01');
        assert.strictEqual(flagValue('--end-datetime'), '2020-02-01');
        assert.strictEqual(flagValue('--dimension-slices'), '{"time":"0:2"}');
        assert.strictEqual(flagValue('--facet-row'), 'time');
        assert.strictEqual(flagValue('--facet-col'), 'lev');
        assert.strictEqual(flagValue('--col-wrap'), 'auto');
        assert.strictEqual(flagValue('--plot-x'), 'lon');
        assert.strictEqual(flagValue('--plot-y'), 'lat');
        assert.strictEqual(flagValue('--plot-hue'), 'lev');
        assert.strictEqual(flagValue('--xincrease'), 'false');
        assert.strictEqual(flagValue('--yincrease'), 'true');
        assert.strictEqual(flagValue('--aspect'), '2');
        assert.strictEqual(flagValue('--size'), '3');
        assert.strictEqual(flagValue('--cmap'), 'viridis');
        assert.strictEqual(flagValue('--bins'), '20');
        assert.strictEqual(flagValue('--vmin'), '0');
        assert.strictEqual(flagValue('--vmax'), '1.5');
        assert.strictEqual(flagValue('--facetgrid-figsize'), '4,3');
        for (const flag of [
            '--robust',
            '--no-add-colorbar',
            '--add-legend',
            '--convert-bands-to-variables',
            '--no-show-inherited-coordinates',
            '--open-as-kerchunk',
        ]) {
            assert.ok(args.includes(flag), flag);
        }
    });
});
