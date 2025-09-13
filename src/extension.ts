import * as vscode from 'vscode';
import { DataViewerPanel } from './dataViewerPanel';
import { PythonManager } from './pythonManager';
import { DataProcessor } from './dataProcessor';
import { Logger } from './logger';

class ScientificDataEditorProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly dataProcessor: DataProcessor
    ) { }

    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        Logger.info(`Opening custom document for: ${uri.fsPath}`);

        // Create a custom document that represents the file
        return {
            uri: uri,
            dispose: () => {
                Logger.info(`Disposing custom document for: ${uri.fsPath}`);
            }
        };
    }

    public async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        Logger.info(`Resolving custom editor for: ${document.uri.fsPath}`);

        // Instead of showing a text editor, open our data viewer
        await DataViewerPanel.createOrShow(this.context.extensionUri, document.uri, this.dataProcessor);

        // Close the webview panel since we're using our own panel
        webviewPanel.dispose();
    }
}

export function activate(context: vscode.ExtensionContext) {
    Logger.initialize();
    Logger.info('Scientific Data Viewer extension is now active!');

    // Get configuration schema from extension manifest
    const extension = vscode.extensions.getExtension('etienne-schalk-sarl.scientific-data-viewer') || vscode.extensions.getExtension(context.extension.id);
    const packageJson = extension?.packageJSON;
    const configSchema = packageJson?.contributes?.configuration?.properties || {};

    // Helper function to format configuration value based on type
    function formatConfigValue(key: string, value: any): string {
        const fullKey = `scientificDataViewer.${key}`;
        const schema = configSchema[fullKey];
        if (!schema) return String(value);

        switch (schema.type) {
            case 'boolean':
                return value ? 'enabled 🟢' : 'disabled 🔴';
            case 'number':
                return `${value}`;
            case 'string':
                return `"${value}"`;
            default:
                return String(value);
        }
    }

    // Helper function to get configuration description
    function getConfigDescription(key: string): string {
        const fullKey = `scientificDataViewer.${key}`;
        const schema = configSchema[fullKey];
        return schema?.description || key;
    }

    // Set up configuration change listener for all Scientific Data Viewer settings
    const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('scientificDataViewer')) {
            Logger.info('Scientific Data Viewer configuration changed');

            const config = vscode.workspace.getConfiguration('scientificDataViewer');
            const changedSettings: string[] = [];

            // Check each configuration property for changes
            for (const [fullKey, schema] of Object.entries(configSchema)) {
                // Extract the property name from the full key (e.g., "scientificDataViewer.autoRefresh" -> "autoRefresh")
                const key = fullKey.replace('scientificDataViewer.', '');

                if (event.affectsConfiguration(fullKey)) {
                    const value = config.get(key);
                    const formattedValue = formatConfigValue(key, value);
                    const description = getConfigDescription(key);

                    Logger.info(`${key} is now: ${value}`);
                    changedSettings.push(`${description} is now ${formattedValue}`);
                }
            }

            if (changedSettings.length > 0) {
                // Show specific notification for changed settings
                const message = changedSettings.length === 1
                    ? `Configuration updated: ${changedSettings[0]}`
                    : `Configuration updated:\n• ${changedSettings.join('\n• ')}`;

                vscode.window.showInformationMessage(message,
                    'OK', 'Show Settings',).then(selection => {
                        if (selection === 'Show Settings') {
                            vscode.commands.executeCommand('workbench.action.openSettings', 'scientificDataViewer');
                        }
                    });
            }
        }
    });

    // Initialize managers
    Logger.info('Initializing extension managers...');
    let pythonManager: PythonManager;
    let dataProcessor: DataProcessor;

    try {
        pythonManager = new PythonManager(context);
        dataProcessor = new DataProcessor(pythonManager);
        Logger.info('Extension managers initialized successfully');
    } catch (error) {
        Logger.error(`Failed to initialize Python manager: ${error}`);
        // Create a mock PythonManager for testing or when Python extension is not available
        pythonManager = {
            isReady: () => false,
            executePythonScript: async () => { throw new Error('Python environment not available'); },
            executePythonFile: async () => { throw new Error('Python environment not available'); },
            executePythonFileWithLogs: async () => { throw new Error('Python environment not available'); },
            getPythonPath: () => undefined,
            getCurrentPythonPath: () => undefined,
            forceReinitialize: async () => { },
            getCurrentInterpreterPath: async () => undefined,
            setupInterpreterChangeListener: async () => undefined
        } as any;
        dataProcessor = new DataProcessor(pythonManager);
        Logger.warn('Extension initialized with mock Python manager (Python extension not available)');
    }

    // Create status bar item for Python interpreter (hidden by default)
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.tooltip = 'Current Python interpreter for Scientific Data Viewer';
    statusBarItem.text = '$(python) Python: Not Set';
    // Don't show by default - only show when interpreter is selected


    // Register custom editor providers
    Logger.info('Registering custom editor providers...');
    const netcdfEditorProvider = new ScientificDataEditorProvider(context, dataProcessor);
    const hdf5EditorProvider = new ScientificDataEditorProvider(context, dataProcessor);

    const netcdfEditorRegistration = vscode.window.registerCustomEditorProvider(
        'netcdfEditor',
        netcdfEditorProvider
    );

    const hdf5EditorRegistration = vscode.window.registerCustomEditorProvider(
        'hdf5Editor',
        hdf5EditorProvider
    );

    Logger.info('Custom editor providers registered successfully');

    // Register commands
    const openViewerCommand = vscode.commands.registerCommand(
        'scientificDataViewer.openViewer',
        async (uri?: vscode.Uri) => {
            if (uri) {
                Logger.info(`Opening data viewer for file: ${uri.fsPath}`);
                await DataViewerPanel.createOrShow(context.extensionUri, uri, dataProcessor);
            } else {
                Logger.info('Opening file selection dialog for data viewer');
                const fileUri = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    filters: {
                        'Scientific Data Files': ['nc', 'netcdf', 'zarr', 'h5', 'hdf5']
                    }
                });
                if (fileUri && fileUri[0]) {
                    Logger.info(`File selected for data viewer: ${fileUri[0].fsPath}`);
                    await DataViewerPanel.createOrShow(context.extensionUri, fileUri[0], dataProcessor);
                }
            }
        }
    );



    const refreshPythonEnvironmentCommand = vscode.commands.registerCommand(
        'scientificDataViewer.refreshPythonEnvironment',
        async () => {
            Logger.info('Manually refreshing Python environment...');
            await pythonManager.forceReinitialize();
            await DataViewerPanel.refreshCurrentPanel(dataProcessor);
            updateStatusBar();
            vscode.window.showInformationMessage('Python environment refreshed!');
        }
    );

    const showLogsCommand = vscode.commands.registerCommand(
        'scientificDataViewer.showLogs',
        () => {
            Logger.show();
        }
    );


    const showSettingsCommand = vscode.commands.registerCommand(
        'scientificDataViewer.showSettings',
        () => {
            Logger.info('Opening Scientific Data Viewer settings...');
            vscode.commands.executeCommand('workbench.action.openSettings', 'scientificDataViewer');
        }
    );


    // Function to update status bar with current Python interpreter
    const updateStatusBar = () => {
        const pythonPath = pythonManager.getPythonPath();
        if (pythonPath && pythonManager.isReady()) {
            // Only show status bar when interpreter is selected and ready
            const interpreterName = pythonPath.split('/').pop() || pythonPath.split('\\').pop() || 'Unknown';
            statusBarItem.text = `$(check) Python: Ready (${interpreterName})`;
            statusBarItem.backgroundColor = undefined;
            statusBarItem.show();
        } else {
            // Hide status bar when no interpreter or not ready
            statusBarItem.hide();
        }
    };


    // Register context menu for supported files
    const supportedExtensions = ['.nc', '.netcdf', '.zarr', '.h5', '.hdf5'];
    vscode.workspace.onDidOpenTextDocument(async (document) => {
        const ext = document.uri.path.split('.').pop()?.toLowerCase();
        if (ext && supportedExtensions.includes(`.${ext}`)) {
            // Show notification for supported files
            const action = await vscode.window.showInformationMessage(
                `Scientific data file detected: ${document.fileName}`,
                'Open in Data Viewer'
            );
            if (action === 'Open in Data Viewer') {
                await DataViewerPanel.createOrShow(context.extensionUri, document.uri, dataProcessor);
            }
        }
    });

    context.subscriptions.push(
        openViewerCommand
    );

    // Initialize Python environment
    Logger.info('Initializing Python environment...');
    try {
        pythonManager.initialize().then(async () => {
            // After Python initialization, refresh any panels that had errors
            await DataViewerPanel.refreshPanelsWithErrors(dataProcessor);
        }).catch((error) => {
            Logger.error(`Python initialization failed: ${error}`);
        });
    } catch (error) {
        Logger.error(`Python initialization setup failed: ${error}`);
    }

    // Function to handle Python interpreter changes
    const handlePythonInterpreterChange = async () => {
        Logger.info('Python interpreter configuration changed, re-validating environment...');

        // Get the current interpreter path for logging
        const currentInterpreterPath = await pythonManager.getCurrentInterpreterPath();

        // Show immediate notification that interpreter change was detected with path
        if (currentInterpreterPath) {
            const interpreterName = currentInterpreterPath.split('/').pop() || currentInterpreterPath.split('\\').pop() || 'Unknown';
            vscode.window.showInformationMessage(`New interpreter is now considered by the extension: ${interpreterName} (${currentInterpreterPath})`);
        } else {
            vscode.window.showInformationMessage('New interpreter is now considered by the extension');
        }

        try {
            await pythonManager.forceReinitialize();
            // Refresh any open data viewer panels
            await DataViewerPanel.refreshCurrentPanel(dataProcessor);
            // Also refresh panels that had errors
            await DataViewerPanel.refreshPanelsWithErrors(dataProcessor);

            // Show success notification with interpreter name and path
            const pythonPath = pythonManager.getPythonPath();
            if (pythonPath) {
                const interpreterName = pythonPath.split('/').pop() || pythonPath.split('\\').pop() || 'Unknown';
                vscode.window.showInformationMessage(`✅ Using Python interpreter: ${interpreterName} (${pythonPath})`);
                updateStatusBar();
            }
        } catch (error) {
            Logger.error(`Failed to validate Python environment: ${error}`);
            vscode.window.showErrorMessage(`❌ Failed to validate Python environment: ${error}`);
        }
    };

    // Listen for Python interpreter changes - only listen to Python extension events
    const pythonInterpreterChangeListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
        // Only listen to Python extension configuration changes that might affect interpreter
        if (event.affectsConfiguration('python.condaPath') ||
            event.affectsConfiguration('python.venvPath') ||
            event.affectsConfiguration('python.terminal.activateEnvironment') ||
            event.affectsConfiguration('python.terminal.activateEnvInCurrentTerminal')) {

            await handlePythonInterpreterChange();
        }
    });

    // Also listen for workspace folder changes (when Python interpreter might change)
    const workspaceChangeListener = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        // Check if Python interpreter changed when workspace changes using Python extension API
        try {
            const currentPythonPath = await pythonManager.getCurrentInterpreterPath();

            if (currentPythonPath && currentPythonPath !== pythonManager.getPythonPath()) {
                await handlePythonInterpreterChange();
            }
        } catch (error) {
            Logger.error(`Error checking Python interpreter on workspace change: ${error}`);
        }
    });

    // Set up immediate Python interpreter change detection
    let immediateInterpreterListener: vscode.Disposable | undefined;
    try {
        pythonManager.setupInterpreterChangeListener(handlePythonInterpreterChange).then((listener) => {
            immediateInterpreterListener = listener;
            if (immediateInterpreterListener) {
                Logger.info('Immediate Python interpreter change detection enabled');
                // Add to subscriptions after it's created
                context.subscriptions.push(immediateInterpreterListener);
            } else {
                Logger.warn('Immediate Python interpreter change detection not available');
            }
        }).catch((error) => {
            Logger.error(`Failed to set up immediate Python interpreter change detection: ${error}`);
        });
    } catch (error) {
        Logger.error(`Failed to set up Python interpreter change detection: ${error}`);
    }


    context.subscriptions.push(
        openViewerCommand,
        refreshPythonEnvironmentCommand,
        showLogsCommand,
        showSettingsCommand,
        statusBarItem,
        pythonInterpreterChangeListener,
        workspaceChangeListener,
        netcdfEditorRegistration,
        hdf5EditorRegistration,
        configListener
    );

    // Status bar will only be shown when an interpreter is actually selected
}

export function deactivate() {
    Logger.info('Scientific Data Viewer extension is now deactivated!');

    // Dispose of data viewer panel static resources
    DataViewerPanel.dispose();

    Logger.dispose();
}
