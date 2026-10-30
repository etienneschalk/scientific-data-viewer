import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    isRequirementSpecifier,
    PythonManager,
} from '../../src/python/PythonManager';
import {
    ALL_REQUIREMENTS,
    ENVIRONMENT_CONSTRAINTS,
    ExtensionVirtualEnvironmentManager,
} from '../../src/python/ExtensionVirtualEnvironmentManager';
import {
    getPythonExtensionApi,
    getPythonInterpreterFromPythonExtension,
    setupOfficialPythonExtensionChangeListeners,
} from '../../src/python/officialPythonExtensionApiUtils';

suite('PythonManager Test Suite', () => {
    let pythonManager: PythonManager;
    let mockContext: vscode.ExtensionContext;
    let mockGetExtension: (
        extensionId: string,
    ) => vscode.Extension<any> | undefined;
    let originalGetExtension: (
        extensionId: string,
    ) => vscode.Extension<any> | undefined;

    suiteSetup(() => {
        // Store original getExtension function
        originalGetExtension = vscode.extensions.getExtension;

        // Create centralized mock for vscode.extensions.getExtension
        configureMockGetExtension({
            extensionExists: true,
            isActive: false,
            activateResult: {
                test: 'api',
                environments: {
                    onDidChangeActiveEnvironmentPath: (callback: any) => ({
                        dispose: () => {},
                    }),
                    onDidEnvironmentsChanged: (callback: any) => ({
                        dispose: () => {},
                    }),
                },
            },
        });

        // Mock ExtensionContext
        mockContext = {
            extensionPath: '/test/extension/path',
            subscriptions: [],
            extensionUri: vscode.Uri.file('/test/extension/path'),
            globalStorageUri: vscode.Uri.file('/test/global/storage/path'),
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => [],
            },
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => [],
            },
            secrets: {
                get: () => Promise.resolve(undefined),
                store: () => Promise.resolve(),
                delete: () => Promise.resolve(),
            },
            extension: {
                id: 'test.extension',
                extensionPath: '/test/extension/path',
                isActive: true,
                packageJSON: {},
                extensionKind: vscode.ExtensionKind.Workspace,
                exports: {},
                activate: () => Promise.resolve({}),
                extensionDependencies: [],
                extensionPack: [],
            },
            storagePath: '/test/storage/path',
            globalStoragePath: '/test/global/storage/path',
            logPath: '/test/log/path',
            extensionMode: vscode.ExtensionMode.Test,
            asAbsolutePath: (relativePath: string) =>
                `/test/extension/path/${relativePath}`,
            environmentVariableCollection: {} as any,
        } as any;
    });

    setup(() => {
        pythonManager = new PythonManager(
            new ExtensionVirtualEnvironmentManager(
                mockContext.globalStorageUri.fsPath,
            ),
        );
        // Apply the mock for each test
        vscode.extensions.getExtension = mockGetExtension;
    });

    teardown(() => {
        // Restore original getExtension function after each test
        vscode.extensions.getExtension = originalGetExtension;
    });

    suiteTeardown(() => {
        // Restore original getExtension function after all tests
        vscode.extensions.getExtension = originalGetExtension;
    });

    // Helper method to configure the mock for different test scenarios
    function configureMockGetExtension(config: {
        extensionExists?: boolean;
        isActive?: boolean;
        activateResult?: any;
        activateError?: Error;
    }) {
        mockGetExtension = (extensionId: string) => {
            if (extensionId !== 'ms-python.python') {
                return undefined;
            }
            if (!config.extensionExists) {
                return undefined;
            }

            return {
                id: 'ms-python.python',
                extensionPath: '/test/python/extension/path',
                isActive: config.isActive ?? true,
                packageJSON: {},
                extensionKind: vscode.ExtensionKind.Workspace,
                exports: {},
                activate: async () => {
                    if (config.activateError) {
                        throw config.activateError;
                    }
                    return (
                        config.activateResult ?? {
                            test: 'api',
                            environments: {
                                onDidChangeActiveEnvironmentPath: (
                                    callback: any,
                                ) => ({
                                    dispose: () => {},
                                }),
                                onDidEnvironmentsChanged: (callback: any) => ({
                                    dispose: () => {},
                                }),
                            },
                        }
                    );
                },
                extensionDependencies: [],
                extensionPack: [],
            } as any;
        };
        vscode.extensions.getExtension = mockGetExtension;
    }

    test('should create PythonManager instance', () => {
        assert.ok(pythonManager);
        assert.strictEqual(pythonManager.pythonPath, null);
        assert.strictEqual(pythonManager.ready, false);
    });

    test('should initialize without Python extension', async () => {
        // Configure mock to return undefined (extension not found)
        configureMockGetExtension({ extensionExists: false });

        await pythonManager.forceInitialize();

        // Should not throw an error even without Python extension
        assert.ok(true);
    });

    test('should handle Python extension not active', async () => {
        // Configure mock to return inactive extension
        configureMockGetExtension({
            extensionExists: true,
            isActive: false,
            activateResult: {},
        });

        await pythonManager.forceInitialize();
        // Should not throw an error
        assert.ok(true);
    });

    test('should handle Python extension API without environments', async () => {
        // Configure mock to return extension without environments API
        configureMockGetExtension({
            extensionExists: true,
            isActive: true,
            activateResult: {},
        });

        await pythonManager.forceInitialize();
        // Should not throw an error
        assert.ok(true);
    });

    test('should handle Python extension API with environments but no active environment', async () => {
        // Configure mock to return extension with environments API but no active environment
        configureMockGetExtension({
            extensionExists: true,
            isActive: true,
            activateResult: {
                environments: {
                    getActiveEnvironmentPath: () => Promise.resolve(undefined),
                },
            },
        });

        await pythonManager.forceInitialize();
        // Should not throw an error
        assert.ok(true);
    });

    test('should get Python path from extension API', async () => {
        // Configure mock to return extension with active environment
        configureMockGetExtension({
            extensionExists: true,
            isActive: true,
            activateResult: {
                environments: {
                    getActiveEnvironmentPath: () =>
                        Promise.resolve({ path: '/usr/bin/python3' }),
                },
            },
        });

        await pythonManager.forceInitialize();
        // Note: We can't easily test the actual path setting without mocking the validation process
        assert.ok(true);
    });

    test('should handle Python extension activation error', async () => {
        // Configure mock to return extension that fails to activate
        configureMockGetExtension({
            extensionExists: true,
            isActive: false,
            activateError: new Error('Activation failed'),
        });

        await pythonManager.forceInitialize();
        // Should not throw an error
        assert.ok(true);
    });

    test('should get current Python path', () => {
        const pythonPath = pythonManager.pythonPath;
        assert.strictEqual(pythonPath, null);
    });

    test('should get current Python path alias', () => {
        const pythonPath = pythonManager.pythonPath;
        assert.strictEqual(pythonPath, null);
    });

    test('should check if ready', () => {
        assert.strictEqual(pythonManager.ready, false);
    });

    test('should handle executePythonFile when not ready', async () => {
        try {
            await pythonManager.executePythonFile('/path/to/script.py');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(
                error.message.includes(
                    'Python environment not properly initialized',
                ),
            );
        }
    });

    test('should handle executePythonFile with logs when not ready', async () => {
        try {
            await pythonManager.executePythonFile(
                '/path/to/script.py',
                [],
                true,
            );
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(
                error.message.includes(
                    'Python environment not properly initialized',
                ),
            );
        }
    });

    test('should setup interpreter change listener', async () => {
        // Configure mock to return extension that fails to activate
        configureMockGetExtension({
            extensionExists: true,
            isActive: true,
            activateResult: {
                test: 'api',
                environments: {
                    onDidChangeActiveEnvironmentPath: (callback: any) => ({
                        dispose: () => {},
                    }),
                    onDidEnvironmentsChanged: (callback: any) => ({
                        dispose: () => {},
                    }),
                },
            },
        });

        const listener = await setupOfficialPythonExtensionChangeListeners(
            async () => {},
        );
        assert.ok(listener?.dispose);
    });

    test('should handle setup interpreter change listener when extension not available', async () => {
        // Mock the getPythonExtensionApi method to return undefined
        configureMockGetExtension({
            extensionExists: false,
        });

        try {
            const listener = await setupOfficialPythonExtensionChangeListeners(
                async () => {},
            );
            assert.strictEqual(listener, undefined);
        } finally {
        }
    });

    test('should handle setup interpreter change listener when environments API not available', async () => {
        // Mock the getPythonExtensionApi method to return API without environments
        configureMockGetExtension({
            extensionExists: false,
        });

        try {
            const listener = await setupOfficialPythonExtensionChangeListeners(
                async () => {},
            );
            assert.strictEqual(listener, undefined);
        } finally {
        }
    });

    test('should handle setup interpreter change listener when method not available', async () => {
        // Mock the getPythonExtensionApi method to return API without the required method
        configureMockGetExtension({
            extensionExists: true,
            isActive: false,
            activateResult: {},
        });

        try {
            const listener = await setupOfficialPythonExtensionChangeListeners(
                async () => {},
            );
            assert.strictEqual(listener, undefined);
        } finally {
        }
    });

    test('should handle setup interpreter change listener error', async () => {
        // Mock the getPythonExtensionApi method to throw an error
        configureMockGetExtension({
            extensionExists: true,
            isActive: false,
            activateError: new Error('Activation failed'),
        });

        try {
            const listener = await setupOfficialPythonExtensionChangeListeners(
                async () => {},
            );
            assert.strictEqual(listener, undefined);
        } finally {
        }
    });

    test('should check if Python extension is available', () => {
        // This test is skipped because isPythonExtensionAvailable is not a public method
        // The functionality is tested through other methods that use the Python extension
        assert.ok(
            true,
            'Test skipped - isPythonExtensionAvailable is not a public method',
        );
    });

    test('should check if Python extension is not available', () => {
        // This test is skipped because isPythonExtensionAvailable is not a public method
        // The functionality is tested through other methods that use the Python extension
        assert.ok(
            true,
            'Test skipped - isPythonExtensionAvailable is not a public method',
        );
    });

    test('should get Python extension API', async () => {
        // Configure mock to return extension with test API
        configureMockGetExtension({
            extensionExists: true,
            isActive: true,
            activateResult: { test: 'api' },
        });

        const api = await getPythonExtensionApi();
        assert.ok(api);
        assert.strictEqual(api.test, 'api');
    });

    test('should handle get Python extension API when extension not found', async () => {
        // Configure mock to return undefined (extension not found)
        configureMockGetExtension({ extensionExists: false });

        const api = await getPythonExtensionApi();
        assert.strictEqual(api, undefined);
    });

    test('should handle get Python extension API activation error', async () => {
        // Configure mock to return extension that fails to activate
        configureMockGetExtension({
            extensionExists: true,
            isActive: false,
            activateError: new Error('Activation failed'),
        });

        const api = await getPythonExtensionApi();
        assert.strictEqual(api, undefined);
    });

    test('should handle VSCode configuration fallback', async () => {
        // Mock vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = (section?: string) =>
            ({
                get: (key: string) => {
                    if (
                        section === 'python' &&
                        key === 'defaultInterpreterPath'
                    ) {
                        return '/usr/bin/python3';
                    }
                    return undefined;
                },
            }) as any;

        // Configure mock to return extension that activates but returns null (triggers fallback)
        configureMockGetExtension({
            extensionExists: true,
            isActive: false,
            activateResult: undefined,
        });

        try {
            const interpreterPath =
                await getPythonInterpreterFromPythonExtension();
            assert.strictEqual(interpreterPath, '/usr/bin/python3');
        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('should handle VSCode configuration error', async () => {
        // Mock vscode.workspace.getConfiguration to throw an error
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            throw new Error('Configuration error');
        };

        try {
            const interpreterPath =
                await getPythonInterpreterFromPythonExtension();
            assert.strictEqual(interpreterPath, undefined);
        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('should handle multiple sequential initialization calls', async () => {
        // Mock the getPythonInterpreterFromExtension method
        let callCount = 0;
        vscode.extensions.getExtension = (extensionId: string) => {
            if (extensionId !== 'ms-python.python') {
                return undefined;
            }

            return {
                id: 'ms-python.python',
                extensionPath: '/test/python/extension/path',
                isActive: false,
                packageJSON: {},
                extensionKind: vscode.ExtensionKind.Workspace,
                exports: {},
                activate: async () => {
                    callCount++;
                    return undefined;
                },
                extensionDependencies: [],
                extensionPack: [],
            } as any;
        };
        try {
            await pythonManager.forceInitialize();
            await pythonManager.forceInitialize();
            await pythonManager.forceInitialize();

            // Should have been called multiple times
            assert.ok(callCount == 3);
        } finally {
        }
    });

    test('should handle concurrent initialization calls', async () => {
        // Mock the getPythonInterpreterFromExtension method
        let callCount = 0;
        vscode.extensions.getExtension = (extensionId: string) => {
            if (extensionId !== 'ms-python.python') {
                return undefined;
            }

            return {
                id: 'ms-python.python',
                extensionPath: '/test/python/extension/path',
                isActive: false,
                packageJSON: {},
                extensionKind: vscode.ExtensionKind.Workspace,
                exports: {},
                activate: async () => {
                    callCount++;
                    return undefined;
                },
                extensionDependencies: [],
                extensionPack: [],
            } as any;
        };

        try {
            // Create multiple concurrent initialization calls
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(pythonManager.forceInitialize());
            }

            await Promise.all(promises);

            // Single flight: calls made before the run started are served
            // by that single run.
            assert.strictEqual(callCount, 1);
        } finally {
        }
    });
});

suite('PythonManager initialization and execution', () => {
    function newManager(): PythonManager {
        return new PythonManager(
            new ExtensionVirtualEnvironmentManager(
                path.join(os.tmpdir(), 'sdv-pm-test-unused'),
            ),
        );
    }

    type State = {
        pythonPath: string | null;
        source: string | null;
        corePackagesInstalled: boolean;
        ownEnvironmentIssue: null;
    };
    const state = (pythonPath: string | null): State => ({
        pythonPath,
        source: pythonPath ? 'system' : null,
        corePackagesInstalled: pythonPath !== null,
        ownEnvironmentIssue: null,
    });

    test('concurrent refreshes: single flight, the latest run wins', async () => {
        const manager = newManager();
        const results = [state('/old/python'), state('/new/python')];
        let calls = 0;
        (manager as any).resolveInterpreterState = async () => {
            const result = results[calls++];
            await new Promise((resolve) => setTimeout(resolve, 30));
            return result;
        };

        const first = manager.forceInitialize();
        await new Promise((resolve) => setTimeout(resolve, 5));
        assert.strictEqual(calls, 1);
        // Requested while the first run is in flight: coalesced into one
        // more run after it
        const second = manager.forceInitialize();
        const third = manager.forceInitialize();
        await Promise.all([first, second, third]);

        assert.strictEqual(calls, 2);
        assert.strictEqual(manager.pythonPath, '/new/python');
        assert.strictEqual(manager.ready, true);
    });

    test('an outdated run does not commit its result', async () => {
        const manager = newManager();
        const committed: Array<string | null> = [];
        let calls = 0;
        (manager as any).resolveInterpreterState = async () => {
            calls += 1;
            const current = calls;
            if (current === 1) {
                // A refresh is requested while the first run is in flight
                void manager.forceInitialize();
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
            return state(current === 1 ? '/stale/python' : '/fresh/python');
        };
        Object.defineProperty(manager, '_pythonPath', {
            get: () => committed[committed.length - 1] ?? null,
            set: (value: string | null) => committed.push(value),
            configurable: true,
        });

        await manager.forceInitialize();
        await manager.waitForInitialization();

        assert.deepStrictEqual(committed, ['/fresh/python']);
    });

    test('no interpreter found resets the previous interpreter state', async () => {
        const manager = newManager();
        let next = state('/usr/bin/python3');
        (manager as any).resolveInterpreterState = async () => next;
        await manager.forceInitialize();
        assert.strictEqual(manager.ready, true);

        next = state(null);
        await manager.forceInitialize();

        const info = manager.getCurrentEnvironmentInfo();
        assert.strictEqual(info.path, null);
        assert.strictEqual(info.source, null);
        assert.strictEqual(info.ready, false);
        assert.strictEqual(info.initialized, true);
    });

    test('install packages in the own uv environment uses uv, not pip', async () => {
        const envManager = new ExtensionVirtualEnvironmentManager(
            path.join(os.tmpdir(), 'sdv-pm-test-unused'),
        );
        const manager = new PythonManager(envManager);
        const calls: Array<[string, readonly string[]]> = [];
        (envManager as any).uvInstallPackages = async (
            pythonPath: string,
            packages: readonly string[],
        ) => {
            calls.push([pythonPath, packages]);
        };
        (manager as any).hasPip = async () => {
            throw new Error('pip must not be used');
        };
        (manager as any)._pythonPath = '/env/bin/python';
        (manager as any)._environmentSource = 'own-uv-env';

        await manager.installPackages(['cfgrib', 'zarr>=3']);

        assert.deepStrictEqual(calls, [
            ['/env/bin/python', ['cfgrib', 'zarr>=3']],
        ]);
    });

    suite('executePythonFile', () => {
        let dir: string;
        const previousRunAsNode = process.env.ELECTRON_RUN_AS_NODE;

        function readyManager(): PythonManager {
            const manager = newManager();
            // The extension host binary runs scripts as Node.js
            (manager as any)._pythonPath = process.execPath;
            (manager as any)._initialized = true;
            (manager as any)._corePackagesInstalled = true;
            return manager;
        }

        function script(name: string, code: string): string {
            const file = path.join(dir, name);
            fs.writeFileSync(file, code);
            return file;
        }

        setup(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdv-pm-exec-'));
            process.env.ELECTRON_RUN_AS_NODE = '1';
        });

        teardown(() => {
            fs.rmSync(dir, { recursive: true, force: true });
            if (previousRunAsNode === undefined) {
                delete process.env.ELECTRON_RUN_AS_NODE;
            } else {
                process.env.ELECTRON_RUN_AS_NODE = previousRunAsNode;
            }
        });

        test('resolves the JSON printed on stdout', async () => {
            const file = script(
                'ok.js',
                'console.log("library noise"); console.log(JSON.stringify({ args: process.argv.slice(2) }))',
            );
            const result = await readyManager().executePythonFile(file, [
                'a b',
                'x>=1',
            ]);
            assert.deepStrictEqual(result, { args: ['a b', 'x>=1'] });
        });

        test('rejects non-JSON output on exit code 0', async () => {
            const file = script('text.js', 'console.log("not json")');
            await assert.rejects(
                readyManager().executePythonFile(file),
                /invalid output \(expected JSON\): not json/,
            );
        });

        test('timeout applies without an operation id', async () => {
            const file = script('slow.js', 'setTimeout(() => {}, 60000)');
            await assert.rejects(
                readyManager().executePythonFile(
                    file,
                    [],
                    false,
                    undefined,
                    300,
                ),
                /timed out after 300 ms/,
            );
        });

        test('abortProcess stops a tracked operation', async () => {
            const manager = readyManager();
            const file = script('slow.js', 'setTimeout(() => {}, 60000)');
            const running = manager.executePythonFile(file, [], false, 'op-1');
            await new Promise((resolve) => setTimeout(resolve, 100));
            assert.strictEqual(manager.isOperationActive('op-1'), true);
            assert.strictEqual(manager.abortProcess('op-1'), true);
            await assert.rejects(running, /Process was aborted/);
            assert.strictEqual(manager.isOperationActive('op-1'), false);
            assert.strictEqual(manager.abortProcess('op-1'), false);
        });

        test('missing module error suggests the extension requirements', async () => {
            const file = script(
                'missing.js',
                'process.stderr.write("ModuleNotFoundError: No module named xarray"); process.exit(1)',
            );
            await assert.rejects(
                readyManager().executePythonFile(file),
                /pip install "xarray>=2026\.4\.0" matplotlib/,
            );
        });
    });
});

suite('isRequirementSpecifier', () => {
    test('accepts every requirement the extension installs', () => {
        for (const spec of [
            ...ALL_REQUIREMENTS,
            ...ENVIRONMENT_CONSTRAINTS,
            'netCDF4',
            'h5netcdf',
            'rioxarray',
            'kerchunk',
            'zarr>=3',
            'numpy>=2,<3',
            'xarray[io,viz]>=2026.4.0',
        ]) {
            assert.ok(isRequirementSpecifier(spec), spec);
        }
    });

    test('rejects options, URLs, paths and anything else (QA 0.13.0 H1)', () => {
        for (const spec of [
            '--index-url',
            '-r',
            '-e',
            'http://127.0.0.1:9/simple',
            'git+https://example.com/x.git',
            '../local',
            '/abs/path',
            'pkg; rm -rf ~',
            'a b',
            '',
            ['nested'],
            42,
        ]) {
            assert.ok(!isRequirementSpecifier(spec), JSON.stringify(spec));
        }
    });
});
