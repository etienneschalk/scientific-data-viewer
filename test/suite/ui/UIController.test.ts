import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    resolveWebviewFileName,
    UIController,
    WEBVIEW_ALLOWED_COMMANDS,
} from '../../../src/panel/UIController';
import { ErrorBoundary } from '../../../src/common/ErrorBoundary';

const PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

suite('UIController Test Suite', () => {
    let tmpDir: string;
    let dataFile: vscode.Uri;
    let posted: any[];
    let receive: (message: unknown) => void;
    let mockWebview: vscode.Webview;
    let dataInfoResponse: any;
    let plotCalls: Array<{ uri: vscode.Uri; plot: any }>;
    let errors: Error[];
    let successes: string[];
    let controller: UIController;

    function makeDataProcessor(): any {
        return {
            pythonManagerInstance: {
                pythonPath: '/usr/bin/python3',
                waitForInitialization: async () => {},
            },
            getDataInfo: async () => dataInfoResponse,
            createPlot: async (uri: vscode.Uri, plot: any) => {
                plotCalls.push({ uri, plot });
                return { result: { plot_data: PNG_BASE64 } };
            },
            abortPlot: () => false,
        };
    }

    async function request(command: string, payload: unknown = {}) {
        const id = `req-${Math.random()}`;
        receive({ type: 'request', id, command, payload });
        for (let i = 0; i < 200; i++) {
            const response = posted.find((m) => m.requestId === id);
            if (response) {
                return response;
            }
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        throw new Error(`No response for ${command}`);
    }

    function events(name: string) {
        return posted.filter((m) => m.type === 'event' && m.event === name);
    }

    setup(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdv-uicontroller-'));
        // Two bytes, so that a 0.000001 MB (~1 byte) limit is exceeded
        dataFile = vscode.Uri.file(path.join(tmpDir, 'data.nc'));
        fs.writeFileSync(dataFile.fsPath, 'xx');

        posted = [];
        plotCalls = [];
        errors = [];
        successes = [];
        dataInfoResponse = {
            result: {
                format_info: {
                    extension: '.nc',
                    display_name: 'NetCDF',
                    available_engines: ['netcdf4'],
                    missing_packages: [],
                },
                used_engine: 'netcdf4',
                fileSize: 1,
            },
        };
        mockWebview = {
            onDidReceiveMessage: (callback: (message: unknown) => void) => {
                receive = callback;
                return { dispose: () => {} };
            },
            postMessage: (message: unknown) => {
                posted.push(message);
                return Promise.resolve(true);
            },
        } as any;
        controller = new UIController(
            1,
            mockWebview,
            (error) => errors.push(error),
            (success) => successes.push(success),
            makeDataProcessor(),
        );
    });

    teardown(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('loadFile emits dataLoaded with the data info', async () => {
        await controller.loadFile(dataFile);

        const [loaded] = events('dataLoaded');
        assert.ok(loaded);
        assert.strictEqual(loaded.payload.data.currentFile, dataFile.fsPath);
        assert.deepStrictEqual(
            loaded.payload.data.dataInfo,
            dataInfoResponse.result,
        );
        assert.strictEqual(typeof loaded.payload.data.lastLoadTime, 'string');
        assert.strictEqual(
            loaded.payload.python.pythonPath,
            '/usr/bin/python3',
        );
        assert.deepStrictEqual(
            controller.getDataInfo(),
            dataInfoResponse.result,
        );
        assert.deepStrictEqual(successes, ['Data loaded successfully']);
        // Only one message per load (no per-field state broadcasts)
        assert.strictEqual(posted.length, 1);
    });

    test('loadFile shows backend errors with suggestion and type', async () => {
        dataInfoResponse = {
            error: {
                error: 'No engine could open the file',
                error_type: 'ValueError',
                suggestion: 'pip install netCDF4',
            },
        };

        await controller.loadFile(dataFile);

        assert.strictEqual(errors.length, 1);
        assert.deepStrictEqual(events('error')[0].payload, {
            message: 'No engine could open the file',
            details: 'pip install netCDF4',
            errorType: 'ValueError',
        });
        assert.strictEqual(events('dataLoaded').length, 0);
    });

    test('loadFile reports the size limit in MB', async () => {
        const config = vscode.workspace.getConfiguration(
            'scientificDataViewer',
        );
        const previous = config.inspect<number>('maxFileSize')?.globalValue;
        await config.update(
            'maxFileSize',
            0.000001,
            vscode.ConfigurationTarget.Global,
        );
        try {
            await controller.loadFile(dataFile);
        } finally {
            await config.update(
                'maxFileSize',
                previous,
                vscode.ConfigurationTarget.Global,
            );
        }

        const message: string = events('error')[0].payload.message;
        assert.match(message, /Maximum allowed: 0\.000001MB$/);
    });

    test('createPlot passes the request options and the file URI (with query)', async () => {
        const kerchunkUri = dataFile.with({ query: 'openAs=kerchunk' });
        await controller.loadFile(kerchunkUri);

        const response = await request('createPlot', {
            variable: '/temperature',
            plotX: 'lon',
            bins: 10,
        });

        assert.strictEqual(response.success, true);
        assert.strictEqual(response.payload, PNG_BASE64);
        assert.strictEqual(plotCalls[0].uri.query, 'openAs=kerchunk');
        assert.deepStrictEqual(plotCalls[0].plot, {
            variable: '/temperature',
            plotX: 'lon',
            bins: 10,
        });
    });

    test('createPlot fails when no file is loaded', async () => {
        const response = await request('createPlot', { variable: 'x' });
        assert.strictEqual(response.success, false);
        assert.strictEqual(response.error, 'No file loaded');
    });

    test('executeCommand only runs allowlisted commands', async () => {
        const response = await request('executeCommand', {
            command: 'workbench.action.terminal.sendSequence',
            args: [{ text: 'echo pwned\n' }],
        });

        assert.strictEqual(response.success, false);
        assert.match(response.error, /not allowed/);
        assert.ok(
            WEBVIEW_ALLOWED_COMMANDS.has('scientificDataViewer.showLogs'),
        );
    });

    test('savePlot writes next to the data file', async () => {
        await controller.loadFile(dataFile);

        const response = await request('savePlot', {
            plotData: PNG_BASE64,
            variable: 'temperature',
            fileName: 'sdv-plots/data.nc/temperature.png',
        });

        assert.strictEqual(response.success, true);
        const expected = path.join(
            tmpDir,
            'sdv-plots',
            'data.nc',
            'temperature.png',
        );
        assert.strictEqual(response.payload.filePath, expected);
        const written = await vscode.workspace.fs.readFile(
            vscode.Uri.file(expected),
        );
        assert.strictEqual(Buffer.from(written).toString('base64'), PNG_BASE64);
    });

    test('savePlot rejects file names escaping the data folder', async () => {
        await controller.loadFile(dataFile);

        const response = await request('savePlot', {
            plotData: PNG_BASE64,
            variable: 'temperature',
            fileName: '../outside.png',
        });

        assert.strictEqual(response.payload.success, false);
        assert.match(response.payload.error, /Invalid plot file name/);
    });

    test('dispose unregisters the error handler', () => {
        const handlers: Map<string, unknown> = (
            ErrorBoundary.getInstance() as any
        ).errorHandlers;
        assert.ok(handlers.has('UIController-<1>'));

        controller.dispose();

        assert.ok(!handlers.has('UIController-<1>'));
    });
});

suite('resolveWebviewFileName', () => {
    const base = path.join(os.tmpdir(), 'base');

    test('accepts relative paths below the base folder', () => {
        assert.strictEqual(
            resolveWebviewFileName(base, 'sdv-plots/a.nc/var_1.png'),
            path.join(base, 'sdv-plots', 'a.nc', 'var_1.png'),
        );
    });

    for (const fileName of [
        '',
        '../x.png',
        'sdv-plots/../../x.png',
        '..\\x.png',
        '/etc/passwd',
        'C:\\Windows\\x.png',
    ]) {
        test(`rejects ${JSON.stringify(fileName)}`, () => {
            assert.throws(() => resolveWebviewFileName(base, fileName));
        });
    }
});
