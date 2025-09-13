import * as vscode from 'vscode';
import { ScientificDataProvider } from './dataProvider';
import { DataViewerPanel } from './dataViewerPanel';
import { PythonManager } from './pythonManager';
import { DataProcessor } from './dataProcessor';

export function activate(context: vscode.ExtensionContext) {
    console.log('Scientific Data Viewer extension is now active!');

    // Initialize managers
    const pythonManager = new PythonManager(context);
    const dataProcessor = new DataProcessor(pythonManager);
    const dataProvider = new ScientificDataProvider(dataProcessor);

    // Register tree data provider
    vscode.window.createTreeView('scientificDataViewer', {
        treeDataProvider: dataProvider
    });

    // Register commands
    const openViewerCommand = vscode.commands.registerCommand(
        'scientificDataViewer.openViewer',
        async (uri?: vscode.Uri) => {
            if (uri) {
                await DataViewerPanel.createOrShow(context.extensionUri, uri, dataProcessor);
            } else {
                const fileUri = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    filters: {
                        'Scientific Data Files': ['nc', 'netcdf', 'zarr', 'h5', 'hdf5']
                    }
                });
                if (fileUri && fileUri[0]) {
                    await DataViewerPanel.createOrShow(context.extensionUri, fileUri[0], dataProcessor);
                }
            }
        }
    );

    const selectPythonCommand = vscode.commands.registerCommand(
        'scientificDataViewer.selectPythonInterpreter',
        async () => {
            await pythonManager.selectInterpreter();
        }
    );

    const refreshDataCommand = vscode.commands.registerCommand(
        'scientificDataViewer.refreshData',
        () => {
            dataProvider.refresh();
        }
    );

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
        selectPythonCommand,
        refreshDataCommand,
        fileWatcher
    );

    // Initialize Python environment
    pythonManager.initialize();
}

export function deactivate() {
    console.log('Scientific Data Viewer extension is now deactivated!');
}
