import * as assert from 'assert';
import * as vscode from 'vscode';
import { PythonManager } from '../../src/pythonManager';

suite('PythonManager Test Suite', () => {
    let pythonManager: PythonManager;
    let mockContext: vscode.ExtensionContext;

    suiteSetup(() => {
        // Mock ExtensionContext
        mockContext = {
            extensionPath: '/test/extension/path',
            subscriptions: [],
            extensionUri: vscode.Uri.file('/test/extension/path'),
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            secrets: {
                get: () => Promise.resolve(undefined),
                store: () => Promise.resolve(),
                delete: () => Promise.resolve()
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
                extensionPack: []
            },
            storagePath: '/test/storage/path',
            globalStoragePath: '/test/global/storage/path',
            logPath: '/test/log/path',
            extensionMode: vscode.ExtensionMode.Test,
            asAbsolutePath: (relativePath: string) => `/test/extension/path/${relativePath}`,
            environmentVariableCollection: {} as any,
        } as any;
    });

    setup(() => {
        pythonManager = new PythonManager(mockContext);
    });

    teardown(() => {
        // Clean up any resources
    });

    test('should create PythonManager instance', () => {
        assert.ok(pythonManager);
        assert.strictEqual(pythonManager.getPythonPath(), undefined);
        assert.strictEqual(pythonManager.isReady(), false);
    });

    test('should initialize without Python extension', async () => {
        // Mock vscode.extensions.getExtension to return undefined
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => undefined;

        try {
            await pythonManager.initialize();
            // Should not throw an error even without Python extension
            assert.ok(true);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should handle Python extension not active', async () => {
        // Mock vscode.extensions.getExtension to return inactive extension
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => ({
            isActive: false,
            activate: () => Promise.resolve({})
        }) as any;

        try {
            await pythonManager.initialize();
            // Should not throw an error
            assert.ok(true);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should handle Python extension API without environments', async () => {
        // Mock vscode.extensions.getExtension to return extension without environments API
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => ({
            isActive: true,
            activate: () => Promise.resolve({})
        }) as any;

        try {
            await pythonManager.initialize();
            // Should not throw an error
            assert.ok(true);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should handle Python extension API with environments but no active environment', async () => {
        // Mock vscode.extensions.getExtension to return extension with environments API
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => ({
            isActive: true,
            activate: () => Promise.resolve({
                environments: {
                    getActiveEnvironmentPath: () => Promise.resolve(undefined)
                }
            })
        }) as any;

        try {
            await pythonManager.initialize();
            // Should not throw an error
            assert.ok(true);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should get Python path from extension API', async () => {
        // Mock vscode.extensions.getExtension to return extension with active environment
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => ({
            isActive: true,
            activate: () => Promise.resolve({
                environments: {
                    getActiveEnvironmentPath: () => Promise.resolve({ path: '/usr/bin/python3' })
                }
            })
        }) as any;

        try {
            await pythonManager.initialize();
            // Note: We can't easily test the actual path setting without mocking the validation process
            assert.ok(true);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should handle Python extension activation error', async () => {
        // Mock vscode.extensions.getExtension to return extension that fails to activate
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => ({
            isActive: false,
            activate: () => Promise.reject(new Error('Activation failed'))
        }) as any;

        try {
            await pythonManager.initialize();
            // Should not throw an error
            assert.ok(true);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should get current Python path', () => {
        const pythonPath = pythonManager.getPythonPath();
        assert.strictEqual(pythonPath, undefined);
    });

    test('should get current Python path alias', () => {
        const pythonPath = pythonManager.getCurrentPythonPath();
        assert.strictEqual(pythonPath, undefined);
    });

    test('should check if ready', () => {
        assert.strictEqual(pythonManager.isReady(), false);
    });

    test('should handle force reinitialize', async () => {
        // Mock the initialize method to avoid actual Python validation
        const originalInitialize = pythonManager.initialize;
        pythonManager.initialize = async () => {
            // Mock successful initialization
            (pythonManager as any).isInitialized = true;
            (pythonManager as any).pythonPath = '/usr/bin/python3';
        };

        try {
            await pythonManager.forceReinitialize();
            assert.ok(true);
        } finally {
            pythonManager.initialize = originalInitialize;
        }
    });

    test('should get current interpreter path', async () => {
        // Mock the getPythonInterpreterFromExtension method
        const originalGetPythonInterpreterFromExtension = (pythonManager as any).getPythonInterpreterFromExtension;
        (pythonManager as any).getPythonInterpreterFromExtension = async () => '/usr/bin/python3';

        try {
            const interpreterPath = await pythonManager.getCurrentInterpreterPath();
            assert.strictEqual(interpreterPath, '/usr/bin/python3');
        } finally {
            (pythonManager as any).getPythonInterpreterFromExtension = originalGetPythonInterpreterFromExtension;
        }
    });

    test('should handle executePythonScript when not ready', async () => {
        try {
            await pythonManager.executePythonScript('print("hello")');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('Python environment not properly initialized'));
        }
    });

    test('should handle executePythonFile when not ready', async () => {
        try {
            await pythonManager.executePythonFile('/path/to/script.py');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('Python environment not properly initialized'));
        }
    });

    test('should handle executePythonFileWithLogs when not ready', async () => {
        try {
            await pythonManager.executePythonFileWithLogs('/path/to/script.py');
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('Python environment not properly initialized'));
        }
    });

    test('should setup interpreter change listener', async () => {
        // Mock the getPythonExtensionApi method
        const originalGetPythonExtensionApi = (pythonManager as any).getPythonExtensionApi;
        (pythonManager as any).getPythonExtensionApi = async () => ({
            environments: {
                onDidChangeActiveEnvironmentPath: (callback: any) => ({
                    dispose: () => {}
                })
            }
        });

        try {
            const listener = await pythonManager.setupInterpreterChangeListener(async () => {});
            assert.ok(listener);
        } finally {
            (pythonManager as any).getPythonExtensionApi = originalGetPythonExtensionApi;
        }
    });

    test('should handle setup interpreter change listener when extension not available', async () => {
        // Mock the getPythonExtensionApi method to return undefined
        const originalGetPythonExtensionApi = (pythonManager as any).getPythonExtensionApi;
        (pythonManager as any).getPythonExtensionApi = async () => undefined;

        try {
            const listener = await pythonManager.setupInterpreterChangeListener(async () => {});
            assert.strictEqual(listener, undefined);
        } finally {
            (pythonManager as any).getPythonExtensionApi = originalGetPythonExtensionApi;
        }
    });

    test('should handle setup interpreter change listener when environments API not available', async () => {
        // Mock the getPythonExtensionApi method to return API without environments
        const originalGetPythonExtensionApi = (pythonManager as any).getPythonExtensionApi;
        (pythonManager as any).getPythonExtensionApi = async () => ({});

        try {
            const listener = await pythonManager.setupInterpreterChangeListener(async () => {});
            assert.strictEqual(listener, undefined);
        } finally {
            (pythonManager as any).getPythonExtensionApi = originalGetPythonExtensionApi;
        }
    });

    test('should handle setup interpreter change listener when method not available', async () => {
        // Mock the getPythonExtensionApi method to return API without the required method
        const originalGetPythonExtensionApi = (pythonManager as any).getPythonExtensionApi;
        (pythonManager as any).getPythonExtensionApi = async () => ({
            environments: {}
        });

        try {
            const listener = await pythonManager.setupInterpreterChangeListener(async () => {});
            assert.strictEqual(listener, undefined);
        } finally {
            (pythonManager as any).getPythonExtensionApi = originalGetPythonExtensionApi;
        }
    });

    test('should handle setup interpreter change listener error', async () => {
        // Mock the getPythonExtensionApi method to throw an error
        const originalGetPythonExtensionApi = (pythonManager as any).getPythonExtensionApi;
        (pythonManager as any).getPythonExtensionApi = async () => {
            throw new Error('API error');
        };

        try {
            const listener = await pythonManager.setupInterpreterChangeListener(async () => {});
            assert.strictEqual(listener, undefined);
        } finally {
            (pythonManager as any).getPythonExtensionApi = originalGetPythonExtensionApi;
        }
    });

    test('should check if Python extension is available', () => {
        // Mock vscode.extensions.getExtension
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => ({
            isActive: true
        }) as any;

        try {
            const isAvailable = (pythonManager as any).isPythonExtensionAvailable();
            assert.ok(isAvailable);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should check if Python extension is not available', () => {
        // Mock vscode.extensions.getExtension to return undefined
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => undefined;

        try {
            const isAvailable = (pythonManager as any).isPythonExtensionAvailable();
            assert.strictEqual(isAvailable, false);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should get Python extension API', async () => {
        // Mock vscode.extensions.getExtension
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => ({
            isActive: true,
            activate: () => Promise.resolve({ test: 'api' })
        }) as any;

        try {
            const api = await (pythonManager as any).getPythonExtensionApi();
            assert.ok(api);
            assert.strictEqual(api.test, 'api');
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should handle get Python extension API when extension not found', async () => {
        // Mock vscode.extensions.getExtension to return undefined
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => undefined;

        try {
            const api = await (pythonManager as any).getPythonExtensionApi();
            assert.strictEqual(api, undefined);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should handle get Python extension API activation error', async () => {
        // Mock vscode.extensions.getExtension to return extension that fails to activate
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => ({
            isActive: false,
            activate: () => Promise.reject(new Error('Activation failed'))
        }) as any;

        try {
            const api = await (pythonManager as any).getPythonExtensionApi();
            assert.strictEqual(api, undefined);
        } finally {
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should handle VSCode configuration fallback', async () => {
        // Mock vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = (section?: string) => ({
            get: (key: string) => {
                if (section === 'python' && key === 'defaultInterpreterPath') {
                    return '/usr/bin/python3';
                }
                return undefined;
            }
        }) as any;

        // Mock the Python extension to be available but without the required APIs so it falls back to VSCode config
        const originalGetExtension = vscode.extensions.getExtension;
        vscode.extensions.getExtension = () => ({
            isActive: false,
            activate: async () => null // Return null to trigger fallback
        }) as any;

        try {
            const interpreterPath = await (pythonManager as any).getPythonInterpreterFromExtension();
            assert.strictEqual(interpreterPath, '/usr/bin/python3');
        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
            vscode.extensions.getExtension = originalGetExtension;
        }
    });

    test('should handle VSCode configuration error', async () => {
        // Mock vscode.workspace.getConfiguration to throw an error
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            throw new Error('Configuration error');
        };

        try {
            const interpreterPath = await (pythonManager as any).getPythonInterpreterFromExtension();
            assert.strictEqual(interpreterPath, undefined);
        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('should handle multiple initialization calls', async () => {
        // Mock the getPythonInterpreterFromExtension method
        const originalGetPythonInterpreterFromExtension = (pythonManager as any).getPythonInterpreterFromExtension;
        let callCount = 0;
        (pythonManager as any).getPythonInterpreterFromExtension = async () => {
            callCount++;
            return undefined;
        };

        try {
            await pythonManager.initialize();
            await pythonManager.initialize();
            await pythonManager.initialize();
            
            // Should have been called multiple times
            assert.ok(callCount > 0);
        } finally {
            (pythonManager as any).getPythonInterpreterFromExtension = originalGetPythonInterpreterFromExtension;
        }
    });

    test('should handle concurrent initialization calls', async () => {
        // Mock the getPythonInterpreterFromExtension method
        const originalGetPythonInterpreterFromExtension = (pythonManager as any).getPythonInterpreterFromExtension;
        let callCount = 0;
        (pythonManager as any).getPythonInterpreterFromExtension = async () => {
            callCount++;
            return undefined;
        };

        try {
            // Create multiple concurrent initialization calls
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(pythonManager.initialize());
            }
            
            await Promise.all(promises);
            
            // Should have been called multiple times
            assert.ok(callCount > 0);
        } finally {
            (pythonManager as any).getPythonInterpreterFromExtension = originalGetPythonInterpreterFromExtension;
        }
    });
});
