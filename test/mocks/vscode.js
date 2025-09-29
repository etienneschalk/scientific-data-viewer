// Mock VS Code API for testing outside of VS Code environment
const vscode = {
    // Extension context
    ExtensionContext: class ExtensionContext {
        constructor() {
            this.extensionPath = '/test/extension/path';
            this.subscriptions = [];
            this.extensionUri = { fsPath: '/test/extension/path' };
            this.globalState = {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            };
            this.workspaceState = {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            };
            this.secrets = {
                get: () => Promise.resolve(undefined),
                store: () => Promise.resolve(),
                delete: () => Promise.resolve()
            };
            this.extension = {
                id: 'test.extension',
                extensionPath: '/test/extension/path',
                isActive: true,
                packageJSON: {},
                extensionKind: 1, // Workspace
                exports: {},
                activate: () => Promise.resolve({}),
                extensionDependencies: [],
                extensionPack: []
            };
            this.storagePath = '/test/storage/path';
            this.globalStoragePath = '/test/global/storage/path';
            this.logPath = '/test/log/path';
            this.extensionMode = 1; // Test
            this.asAbsolutePath = (relativePath) => `/test/extension/path/${relativePath}`;
            this.environmentVariableCollection = {};
        }
    },

    // Uri
    Uri: {
        file: (path) => ({ fsPath: path, scheme: 'file' }),
        parse: (uri) => ({ fsPath: uri, scheme: 'file' }),
        joinPath: (base, ...pathSegments) => ({
            fsPath: [base.fsPath, ...pathSegments].join('/'),
            scheme: 'file'
        })
    },

    // Webview
    Webview: class Webview {
        constructor() {
            this.html = '';
            this.options = {};
            this.onDidReceiveMessage = () => ({ dispose: () => {} });
            this.postMessage = () => Promise.resolve();
        }
    },

    // WebviewPanel
    WebviewPanel: class WebviewPanel {
        constructor() {
            this.webview = new vscode.Webview();
            this.viewType = 'test';
            this.title = 'Test Panel';
            this.onDidChangeViewState = () => ({ dispose: () => {} });
            this.onDidDispose = () => ({ dispose: () => {} });
            this.reveal = () => {};
            this.dispose = () => {};
        }
    },

    // Commands
    commands: {
        registerCommand: () => ({ dispose: () => {} }),
        executeCommand: () => Promise.resolve(),
        getCommands: () => Promise.resolve([])
    },

    // Extensions
    extensions: {
        getExtension: (id) => {
            if (id === 'ms-python.python') {
                return {
                    id: 'ms-python.python',
                    isActive: true,
                    activate: () => Promise.resolve({
                        environment: {
                            getActiveEnvironmentPath: () => Promise.resolve('/usr/bin/python'),
                            onDidChangeActiveEnvironmentPath: () => ({ dispose: () => {} })
                        }
                    }),
                    exports: {
                        environment: {
                            getActiveEnvironmentPath: () => Promise.resolve('/usr/bin/python'),
                            onDidChangeActiveEnvironmentPath: () => ({ dispose: () => {} })
                        }
                    }
                };
            }
            return undefined;
        },
        all: [],
        onDidChange: () => ({ dispose: () => {} })
    },

    // Window
    window: {
        createWebviewPanel: () => new vscode.WebviewPanel(),
        createOutputChannel: (name) => ({
            name: name,
            append: () => {},
            appendLine: () => {},
            show: () => {},
            hide: () => {},
            clear: () => {},
            dispose: () => {}
        }),
        showInformationMessage: () => Promise.resolve(),
        showErrorMessage: () => Promise.resolve(),
        showWarningMessage: () => Promise.resolve(),
        showInputBox: () => Promise.resolve(),
        showQuickPick: () => Promise.resolve(),
        createStatusBarItem: () => ({
            text: '',
            tooltip: '',
            command: '',
            show: () => {},
            hide: () => {},
            dispose: () => {}
        }),
        onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
        activeTextEditor: null
    },

    // Workspace
    workspace: {
        getConfiguration: (section) => ({
            get: (key, defaultValue) => {
                const configs = {
                    'scientificDataViewer.plottingCapabilities': true,
                    'scientificDataViewer.devMode': false,
                    'scientificDataViewer.autoRefresh': true,
                    'scientificDataViewer.maxFileSize': 500,
                    'scientificDataViewer.allowMultipleTabsForSameFile': false,
                    'scientificDataViewer.defaultView': 'data'
                };
                return configs[`${section}.${key}`] !== undefined ? configs[`${section}.${key}`] : defaultValue;
            },
            update: () => Promise.resolve(),
            inspect: () => undefined,
            has: () => true
        }),
        onDidChangeConfiguration: () => ({ dispose: () => {} }),
        onDidOpenTextDocument: () => ({ dispose: () => {} }),
        onDidCloseTextDocument: () => ({ dispose: () => {} }),
        textDocuments: [],
        workspaceFolders: [],
        name: 'test-workspace',
        rootPath: '/test/workspace'
    },

    // Disposable
    Disposable: class Disposable {
        constructor(fn) {
            this._fn = fn;
        }
        dispose() {
            if (this._fn) {
                this._fn();
            }
        }
    },

    // Event
    Event: class Event {
        constructor() {}
    },

    // ExtensionKind
    ExtensionKind: {
        Workspace: 1,
        UI: 2
    },

    // ExtensionMode
    ExtensionMode: {
        Production: 0,
        Development: 1,
        Test: 2
    },

    // ViewColumn
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3,
        Four: 4,
        Five: 5,
        Six: 6,
        Seven: 7,
        Eight: 8,
        Nine: 9,
        Active: -1,
        Beside: -2
    },

    // StatusBarAlignment
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },

    // TextEditor
    TextEditor: class TextEditor {
        constructor() {
            this.document = {
                fileName: '/test/file.txt',
                languageId: 'plaintext',
                lineCount: 1,
                getText: () => '',
                getWordRangeAtPosition: () => undefined,
                positionAt: () => ({ line: 0, character: 0 }),
                offsetAt: () => 0,
                validatePosition: () => ({ line: 0, character: 0 }),
                validateRange: () => ({ start: { line: 0, character: 0 }, end: { line: 0, character: 0 } })
            };
            this.selection = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
            this.selections = [];
            this.visibleRanges = [];
            this.options = {};
            this.viewColumn = 1;
        }
    },

    // Position
    Position: class Position {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },

    // Range
    Range: class Range {
        constructor(start, end) {
            this.start = start;
            this.end = end;
        }
    },

    // Selection
    Selection: class Selection {
        constructor(anchor, active) {
            this.anchor = anchor;
            this.active = active;
        }
    }
};

module.exports = vscode;
