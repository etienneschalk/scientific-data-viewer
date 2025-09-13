import * as vscode from 'vscode';
import { ScientificDataProvider } from './dataProvider';
import { DataViewerPanel } from './dataViewerPanel';
import { PythonManager } from './pythonManager';
import { DataProcessor } from './dataProcessor';
import { Logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
    Logger.initialize();
    Logger.info('Scientific Data Viewer extension is now active!');

    // Initialize managers
    Logger.info('Initializing extension managers...');
    const pythonManager = new PythonManager(context);
    const dataProcessor = new DataProcessor(pythonManager);
    const dataProvider = new ScientificDataProvider(dataProcessor);
    Logger.info('Extension managers initialized successfully');

    // Create status bar item for Python interpreter (hidden by default)
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.tooltip = 'Current Python interpreter for Scientific Data Viewer';
    statusBarItem.text = '$(python) Python: Not Set';
    // Don't show by default - only show when interpreter is selected

    // Register tree data provider
    Logger.info('Registering tree data provider...');
    vscode.window.createTreeView('scientificDataViewer', {
        treeDataProvider: dataProvider
    });
    Logger.info('Tree data provider registered successfully');

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


    const refreshDataCommand = vscode.commands.registerCommand(
        'scientificDataViewer.refreshData',
        () => {
            Logger.info('Refreshing data provider...');
            dataProvider.refresh();
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

    // Register file watcher for supported extensions
    const supportedExtensions = ['.nc', '.netcdf', '.zarr', '.h5', '.hdf5'];
    const fileWatcher = vscode.workspace.createFileSystemWatcher(
        `**/*.{${supportedExtensions.join(',')}}`
    );

    fileWatcher.onDidChange(async (uri) => {
        if (vscode.workspace.getConfiguration('scientificDataViewer').get('autoRefresh')) {
            dataProvider.refresh();
        }
    });

    fileWatcher.onDidCreate(async (uri) => {
        dataProvider.refresh();
    });

    fileWatcher.onDidDelete(async (uri) => {
        dataProvider.refresh();
    });

    // Register context menu for supported files
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
        openViewerCommand,
        refreshDataCommand,
        fileWatcher
    );

    // Initialize Python environment
    Logger.info('Initializing Python environment...');
    pythonManager.initialize();

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

    // Add a periodic check for Python interpreter changes using Python extension API
    let lastPythonPath: string | undefined = pythonManager.getPythonPath();
    const pythonCheckInterval = setInterval(async () => {
        try {
            const currentPythonPath = await pythonManager.getCurrentInterpreterPath();
            
            if (currentPythonPath && currentPythonPath !== lastPythonPath) {
                Logger.info('Periodic check detected Python interpreter change via extension API');
                lastPythonPath = currentPythonPath;
                await handlePythonInterpreterChange();
            }
        } catch (error) {
            Logger.error(`Error in periodic Python interpreter check: ${error}`);
        }
    }, 2000); // Check every 2 seconds

    context.subscriptions.push(
        openViewerCommand,
        refreshDataCommand,
        refreshPythonEnvironmentCommand,
        showLogsCommand,
        fileWatcher,
        statusBarItem,
        pythonInterpreterChangeListener,
        workspaceChangeListener,
        { dispose: () => clearInterval(pythonCheckInterval) }
    );

    // Status bar will only be shown when an interpreter is actually selected
}

export function deactivate() {
    Logger.info('Scientific Data Viewer extension is now deactivated!');
    Logger.dispose();
}
