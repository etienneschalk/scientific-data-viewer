import * as vscode from 'vscode';
import { DataViewerPanel } from './DataViewerPanel';
import { PythonManager } from './python/PythonManager';
import { DataProcessor } from './python/DataProcessor';
import { Logger } from './common/Logger';
import { ErrorBoundary } from './common/ErrorBoundary';
import { OutlineProvider } from './outline/OutlineProvider';
import { ExtensionVirtualEnvironmentManager } from './python/ExtensionVirtualEnvironmentManager';
import { ScientificDataEditorProvider } from './ScientificDataEditorProvider';
import {
    showErrorMessage,
    showErrorMessageAndProposeHelpToInstallUv,
    showInformationMessage,
} from './common/vscodeutils';
import { ExtensionVirtualEnvironmentManagerUI } from './python/ExtensionVirtualEnvironmentManagerUI';
import { setupOfficialPythonExtensionChangeListeners } from './python/officialPythonExtensionApiUtils';
import { formatConfigValue } from './common/utils';
import {
    getDevMode,
    getOverridePythonInterpreter,
    getUseExtensionOwnEnvironment,
    getWorkspaceConfig,
} from './common/config';
import { SCIENTIFIC_DATA_VIEWER } from './constants';

export function activate(context: vscode.ExtensionContext) {
    Logger.initialize();
    Logger.info('⚛️ Scientific Data Viewer extension is now active!');

    // Initialize error boundary
    const errorBoundary = ErrorBoundary.getInstance();
    errorBoundary.registerGlobalHandler((error, context) => {
        Logger.error(`Global error: ${error.message}`);
        vscode.window.showErrorMessage(
            `Scientific Data Viewer Error: ${error.message}`
        );
    });

    // Set up configuration change listener for all Scientific Data Viewer settings
    const workspaceConfigChangeListener =
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(SCIENTIFIC_DATA_VIEWER)) {
                Logger.info('Scientific Data Viewer configuration changed');

                if (
                    event.affectsConfiguration(
                        'scientificDataViewer.python.overridePythonInterpreter'
                    )
                ) {
                    const message = `SDV configuration updated: overridePythonInterpreter is now: ${formatConfigValue(
                        getOverridePythonInterpreter()
                    )}`;
                    Logger.info(message);
                    if (getDevMode()) {
                        showInformationMessage(message, true, true);
                    }

                    refreshPython(pythonManager, statusBarItem);
                } else if (
                    event.affectsConfiguration(
                        'scientificDataViewer.python.useExtensionOwnEnvironment'
                    )
                ) {
                    const message = `SDV configuration updated: useExtensionOwnEnvironment is now: ${formatConfigValue(
                        getUseExtensionOwnEnvironment()
                    )}`;
                    Logger.info(message);
                    if (getDevMode()) {
                        showInformationMessage(message, true, true);
                    }

                    refreshPython(pythonManager, statusBarItem).then(() => {
                        if (!getUseExtensionOwnEnvironment()) {
                            return;
                        }
                        const envInfo =
                            pythonManager.getCurrentEnvironmentInfo();
                        if (envInfo?.source !== 'own-uv-env') {
                            const uvInstallationUrl =
                                extensionEnvManager.UV_INSTALLATION_URL;
                            const error = `
                            You tried to activate the usage of the extension's own environment,
                            but it seems that uv is not installed.
                            Please install uv from ${uvInstallationUrl} and try again.`;
                            showErrorMessageAndProposeHelpToInstallUv(
                                error,
                                uvInstallationUrl
                            );
                        }
                    });
                }
            } else if (
                event.affectsConfiguration('python.condaPath') ||
                event.affectsConfiguration('python.venvPath') ||
                event.affectsConfiguration(
                    'python.terminal.activateEnvironment'
                ) ||
                event.affectsConfiguration(
                    'python.terminal.activateEnvInCurrentTerminal'
                )
            ) {
                Logger.info(
                    '🐍 🔧 Configuration change that might affect the Python interpreter, refreshing Python environment...'
                );
                refreshPython(pythonManager, statusBarItem);
            }
        });

    // Initialize managers
    Logger.info('🔧 Initializing extension managers...');
    const extensionEnvManager = new ExtensionVirtualEnvironmentManager(
        context.globalStorageUri.fsPath
    );
    let pythonManager: PythonManager;
    let dataProcessor: DataProcessor;

    try {
        pythonManager = new PythonManager(extensionEnvManager);
        dataProcessor = DataProcessor.createInstance(pythonManager);
        Logger.info('🚀 Extension managers initialized successfully');
    } catch (error) {
        Logger.error(`❌ Failed to initialize Python manager: ${error}`);
        // Create a mock PythonManager for testing or when Python extension is not available
        pythonManager = {
            isReady: () => false,
            executePythonScript: async () => {
                throw new Error('Python environment not available');
            },
            executePythonFile: async () => {
                throw new Error('Python environment not available');
            },
            getPythonPath: () => undefined,
            getCurrentPythonPath: () => undefined,
            forceReinitialize: async () => {},
            getCurrentInterpreterPath: async () => undefined,
            setupInterpreterChangeListener: async () => undefined,
        } as any;
        dataProcessor = new DataProcessor(pythonManager);
        Logger.warn(
            '🚨 Extension initialized with mock Python manager (Python extension not available)'
        );
    }

    // Create status bar item for Python interpreter (hidden by default)
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    // Initialize status bar to show unknown status
    updateStatusBarItem(pythonManager, statusBarItem);

    // Initialize Python environment
    Logger.info('🔧 Initializing Python environment...');
    refreshPython(pythonManager, statusBarItem);

    const webviewPanelOptions: vscode.WebviewPanelOptions = {
        enableFindWidget: true,
        retainContextWhenHidden: true,
    };
    const webviewOptions: vscode.WebviewOptions = getWebviewOptions(
        context.extensionUri
    );
    const iconPath = vscode.Uri.joinPath(
        context.extensionUri,
        'media',
        'icon.svg'
    );

    // Register custom editor providers
    Logger.info('🔧 Registering custom editor providers...');
    const sciEditorProvider = new ScientificDataEditorProvider(
        webviewOptions,
        dataProcessor
    );
    const options = {
        // Warning! Naming is confusing!
        webviewOptions: webviewPanelOptions,
        // TODO eschalk supportsMultipleEditorsPerDocument to allow split editor??
        supportsMultipleEditorsPerDocument: true,
    };
    const editorRegistrations = [
        'netcdfEditor',
        'hdf5Editor',
        'zarrEditor',
        'gribEditor',
        'geotiffEditor',
        'jp2Editor',
    ].map((viewType) =>
        vscode.window.registerCustomEditorProvider(
            viewType,
            sciEditorProvider,
            options
        )
    );
    Logger.info('🚀 Custom editor providers registered successfully');

    // Register commands
    const openViewerCommand = vscode.commands.registerCommand(
        'scientificDataViewer.openViewer',
        async (uri?: vscode.Uri) => {
            Logger.info('🎮 👁️ Command: Open data viewer...');
            if (uri) {
                Logger.info(
                    `🎮 🔧 Opening data viewer for file: ${uri.fsPath}`
                );
                await waitThenCreateOrRevealPanel(
                    uri,
                    iconPath,
                    webviewOptions,
                    webviewPanelOptions,
                    pythonManager
                );
            } else {
                Logger.info(
                    '🎮 🔧 Opening file selection dialog for data viewer'
                );
                const fileUriList = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: true,
                    filters: getShowDialogFilters(context, [
                        'netcdf',
                        'hdf5',
                        'grib',
                        'geotiff',
                        'jp2',
                    ]),
                });
                fileUriList?.forEach(async (uri) => {
                    Logger.info(
                        `🎮 🔧 File selected for data viewer: ${uri.fsPath}`
                    );
                    await waitThenCreateOrRevealPanel(
                        uri,
                        iconPath,
                        webviewOptions,
                        webviewPanelOptions,
                        pythonManager
                    );
                });
            }
        }
    );

    const openViewerFolderCommand = vscode.commands.registerCommand(
        'scientificDataViewer.openViewerFolder',
        async (uri?: vscode.Uri) => {
            Logger.info('🎮 👁️ Command: Open data viewer (folder)...');
            if (uri) {
                Logger.info(
                    `🎮 🔧 Opening data viewer for folder: ${uri.fsPath}`
                );
                await waitThenCreateOrRevealPanel(
                    uri,
                    iconPath,
                    webviewOptions,
                    webviewPanelOptions,
                    pythonManager
                );
            } else {
                Logger.info(
                    '🎮 🔧 Opening folder selection dialog for data viewer'
                );
                const folderUriList = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: true,
                    filters: getShowDialogFilters(context, ['zarr']),
                });
                folderUriList?.forEach(async (uri) => {
                    Logger.info(
                        `🎮 🔧 Folder selected for data viewer: ${uri.fsPath}`
                    );
                    await waitThenCreateOrRevealPanel(
                        uri,
                        iconPath,
                        webviewOptions,
                        webviewPanelOptions,
                        pythonManager
                    );
                });
            }
        }
    );

    const refreshPythonEnvironmentCommand = vscode.commands.registerCommand(
        'scientificDataViewer.refreshPythonEnvironment',
        async () => {
            Logger.info(
                '🎮 🔄 Command: Manually refreshing Python environment...'
            );
            await refreshPython(pythonManager, statusBarItem);
            vscode.window.showInformationMessage(
                'Python environment refreshed!'
            );
        }
    );

    const showLogsCommand = vscode.commands.registerCommand(
        'scientificDataViewer.showLogs',
        () => {
            Logger.info('🎮 🗒️ Command: Showing logs...');
            Logger.show();
        }
    );

    const showSettingsCommand = vscode.commands.registerCommand(
        'scientificDataViewer.showSettings',
        () => {
            Logger.info(
                '🎮 ⚙️ Command: Opening Scientific Data Viewer settings...'
            );
            vscode.commands.executeCommand(
                'workbench.action.openSettings',
                SCIENTIFIC_DATA_VIEWER
            );
        }
    );

    const openDeveloperToolsCommand = vscode.commands.registerCommand(
        'scientificDataViewer.openDeveloperTools',
        () => {
            Logger.info(
                '🎮 🔧 Command: Opening developer tools for WebView...'
            );
            // This will open the developer tools for the currently active WebView
            vscode.commands.executeCommand(
                'workbench.action.webview.openDeveloperTools'
            );
        }
    );

    // Register outline provider
    const outlineProvider = new OutlineProvider();
    const outlineTreeView = vscode.window.createTreeView(
        'scientificDataViewer.outline',
        {
            treeDataProvider: outlineProvider,
            showCollapseAll: true,
        }
    );

    // Set tree view reference for collapse/expand operations
    outlineProvider.setTreeView(outlineTreeView);

    // Make outline provider accessible to DataViewerPanel
    DataViewerPanel.setOutlineProvider(outlineProvider);

    // The outline will be updated automatically when DataViewerPanels become active
    // via the onDidChangeViewState listener in DataViewerPanel

    const scrollToHeaderCommand = vscode.commands.registerCommand(
        'scientificDataViewer.scrollToHeader',
        async (headerId: string, headerLabel: string) => {
            // We can only manage one file at a time, so we need to get the current file from the outline provider
            let currentPanelId = outlineProvider.getCurrentPanelId();

            if (!currentPanelId) {
                Logger.warn(
                    `🎮 📋 No valid documentUri available for scrollToHeader command`
                );
                return;
            }

            Logger.info(
                `🎮 📋 Command: Scrolling to header ${headerLabel} (${headerId}) for panel with ID: ${currentPanelId}`
            );

            // Find the active DataViewerPanel and scroll to the header
            const activePanel = DataViewerPanel.getPanel(currentPanelId);
            if (activePanel) {
                await activePanel.scrollToHeader(headerId, headerLabel);
            } else {
                Logger.warn('📋 No active DataViewerPanel found for scrolling');
            }
        }
    );

    // Expand all command for outline
    const expandAllCommand = vscode.commands.registerCommand(
        'scientificDataViewer.expandAll',
        () => {
            Logger.info('🎮 📋 Command: Expanding all outline items');
            outlineProvider.expandAll();
        }
    );

    const installPackagesCommand = vscode.commands.registerCommand(
        'scientificDataViewer.python.installPackages',
        async (packages?: string[]) => {
            Logger.info('🎮 📦 Command: Installing Python packages');
            if (!packages || packages.length === 0) {
                vscode.window.showErrorMessage(
                    'No packages specified for installation'
                );
                return;
            }
            try {
                await pythonManager.installPackages(packages);
                // The main point of using the command is to refresh the Python environment
                // at extension level.
                refreshPython(pythonManager, statusBarItem);
                vscode.window.showInformationMessage(
                    `Successfully installed packages: ${packages.join(', ')}`
                );
            } catch (error) {
                Logger.error(`Failed to install packages: ${error}`);
                vscode.window.showErrorMessage(
                    `Failed to install packages: ${error}`
                );
            }
        }
    );

    const extensionVirtualEnvironmentManagerUI =
        new ExtensionVirtualEnvironmentManagerUI(extensionEnvManager);

    // Extension Virtual Environment Command
    const manageExtensionOwnEnvironmentCommand =
        vscode.commands.registerCommand(
            'scientificDataViewer.manageExtensionOwnEnvironment',
            async () => {
                Logger.info(
                    '🎮 🔧 Command: Manage Extension Virtual Environment'
                );
                await extensionVirtualEnvironmentManagerUI.manage();
            }
        );

    // Register context menu for supported files
    const supportedExtensions = getAllSupportedExtensions(context);
    Logger.info(
        `🔧 Detected supported extensions from package.json: ${supportedExtensions}`
    );
    vscode.workspace.onDidOpenTextDocument(async (document) => {
        const ext = document.uri.path.split('.').pop()?.toLowerCase();
        if (ext && supportedExtensions.includes(`.${ext}`)) {
            // Check if devMode is enabled
            const devMode = getDevMode();

            if (devMode) {
                Logger.info(
                    '🔧 DevMode enabled - automatically running development commands for opened file...'
                );

                // Run "Show Extension Logs" command immediately
                try {
                    await vscode.commands.executeCommand(
                        'scientificDataViewer.showLogs'
                    );
                    Logger.info(
                        '🔧 DevMode: Show Extension Logs command executed'
                    );
                } catch (error) {
                    Logger.error(
                        `🔧 DevMode: Failed to execute showLogs command: ${error}`
                    );
                }

                // Run "Open Developer Tools" command immediately
                try {
                    await vscode.commands.executeCommand(
                        'scientificDataViewer.openDeveloperTools'
                    );
                    Logger.info(
                        '🔧 DevMode: Open Developer Tools command executed'
                    );
                } catch (error) {
                    Logger.error(
                        `🔧 DevMode: Failed to execute openDeveloperTools command: ${error}`
                    );
                }
            }
        }
    });

    // Function to handle Python interpreter changes
    const handleOnDidChangeActiveEnvironmentPath = async () => {
        Logger.info(
            '🐍 🔧 Python interpreter configuration changed, refreshing Python environment...'
        );
        await refreshPython(pythonManager, statusBarItem);
    };

    const handleOnDidEnvironmentsChanged = async (environment: any) => {
        Logger.info(
            '🐍 🔧 Python environment created, refreshing Python environment...'
        );
        await refreshPython(pythonManager, statusBarItem);
    };

    Logger.info('🔧 Set up immediate Python interpreter change detection...');
    let immediateInterpreterListener: vscode.Disposable | undefined;
    try {
        setupOfficialPythonExtensionChangeListeners(
            handleOnDidChangeActiveEnvironmentPath,
            handleOnDidEnvironmentsChanged
        )
            .then((listener) => {
                immediateInterpreterListener = listener;
                if (immediateInterpreterListener) {
                    Logger.info(
                        '🚀 Immediate Python interpreter change detection enabled'
                    );
                    // Add to subscriptions after it's created
                    context.subscriptions.push(immediateInterpreterListener);
                } else {
                    Logger.warn(
                        '⚠️ Immediate Python interpreter change detection not available'
                    );
                }
            })
            .catch((error) => {
                Logger.error(
                    `❌ Failed to set up immediate Python interpreter change detection: ${error}`
                );
            });
    } catch (error) {
        Logger.error(
            `🔧 ❌ Failed to set up Python interpreter change detection: ${error}`
        );
    }

    // Also listen for workspace folder changes (when Python interpreter might change)
    const workspaceChangeListener =
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            Logger.info(
                '🐍 🔧 Workspace folder changed, refreshing Python environment...'
            );
            await refreshPython(pythonManager, statusBarItem);
        });

    context.subscriptions.push(
        openViewerCommand,
        openViewerFolderCommand,
        refreshPythonEnvironmentCommand,
        showLogsCommand,
        showSettingsCommand,
        openDeveloperToolsCommand,
        scrollToHeaderCommand,
        expandAllCommand,
        installPackagesCommand,
        manageExtensionOwnEnvironmentCommand,
        workspaceChangeListener,
        workspaceConfigChangeListener,
        ...editorRegistrations
    );
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'out'),
        ],
    };
}

async function refreshPython(
    pythonManager: PythonManager,
    statusBarItem: vscode.StatusBarItem
) {
    try {
        await pythonManager.forceInitialize();

        // Show success notification with interpreter name and path
        const pythonPath = pythonManager.pythonPath;
        if (pythonPath) {
            // const interpreterName = pythonPath.split('/').pop() || pythonPath.split('\\').pop() || 'Unknown';
            // vscode.window.showInformationMessage(`✅ Using Python interpreter: ${interpreterName} (${pythonPath})`);
            await updateStatusBarItem(pythonManager, statusBarItem);
        }

        await DataViewerPanel.refreshPanelsWithErrors();
    } catch (error) {
        Logger.error(`Failed to validate Python environment: ${error}`);
        showErrorMessage(
            `❌ Failed to validate Python environment: ${error}`,
            true,
            true
        );
    }
}

// Function to update status bar with current Python interpreter
function updateStatusBarItem(
    pythonManager: PythonManager,
    statusBarItem: vscode.StatusBarItem
) {
    statusBarItem.backgroundColor = undefined;

    const envInfo = pythonManager.getCurrentEnvironmentInfo();
    let icon;
    let tooltipStatus;
    if (!envInfo.initialized) {
        // Not initialized yet: we do not know if it will work or not
        tooltipStatus = 'Not initialized yet';
        icon = '$(question)';
    } else if (envInfo.ready) {
        // Initialized and ready: we know it will work
        tooltipStatus = 'Initialized and ready (all core packages installed)';
        icon = '$(check)';
    } else {
        // Initialized but not ready: we know it will not work
        tooltipStatus = 'Initialized but not ready (missing core packages)';
        icon = '$(x)';
    }

    const source = envInfo.source ?? 'unknown';
    statusBarItem.text = `${icon} SDV ${source}`;
    statusBarItem.tooltip = `Scientific Data Viewer - State

Status: 
${tooltipStatus} 

Environment Source:
${source}

Environment Python interpreter path: 
${envInfo.path ?? 'Not set'}
`;

    statusBarItem.show();
}

async function waitThenCreateOrRevealPanel(
    uri: vscode.Uri,
    iconPath: vscode.Uri,
    webviewOptions: vscode.WebviewOptions,
    webviewPanelOptions: vscode.WebviewPanelOptions,
    pythonManager: PythonManager
) {
    // Wait for Python initialization to complete before creating the panel
    // This prevents the race condition where file opening happens before Python validation
    try {
        await pythonManager.waitForInitialization();
        Logger.info(
            `🚚 👍 Python initialization complete, creating data viewer panel for: ${uri.fsPath}`
        );
    } catch (error) {
        Logger.warn(
            `🚚 ⚠️ Python initialization failed, but proceeding with panel creation: ${error}`
        );
    }

    DataViewerPanel.createOrReveal(
        uri,
        iconPath,
        webviewOptions,
        webviewPanelOptions
    );
}
export function deactivate() {
    Logger.info('');
    Logger.info('');
    Logger.info('');
    Logger.info("Starting extension's deactivation procedure...");
    // Dispose of data viewer panel static resources
    DataViewerPanel.dispose();
    ErrorBoundary.getInstance().dispose();
    // Has event listeners that needs to be disposed
    // Could be a singleton
    // Needs to access instance
    // Cannot activate return disposables?
    // PythonManager

    // Nothing to dispose.
    // DataProcessor

    // Panes-related data is disposed by panes themselves.
    // OutlineProvider

    Logger.info('Scientific Data Viewer extension is now deactivated!');
    Logger.info('Last word before disposing the Logger.');
    Logger.dispose();
}

function getAllSupportedExtensions(
    context: vscode.ExtensionContext,
    ids?: string[]
): string[] {
    const languages = vscode.extensions.getExtension(context.extension.id)
        ?.packageJSON?.contributes?.languages;
    const allSupportedExtensions =
        languages
            ?.filter((el: any) => !ids || ids.includes(el.id))
            .flatMap((el: any) => el.extensions) || [];
    return allSupportedExtensions;
}

function getShowDialogFilters(
    context: vscode.ExtensionContext,
    ids?: string[]
): { [name: string]: string[] } {
    const languages = vscode.extensions.getExtension(context.extension.id)
        ?.packageJSON?.contributes?.languages;
    const allSupportedExtensions =
        languages
            ?.filter((el: any) => !ids || ids.includes(el.id))
            .flatMap((el: any) => el.extensions) || [];
    const filters: { [name: string]: string[] } = {
        'Scientific Data Files': allSupportedExtensions.map((ext: any) =>
            ext.slice(1)
        ),
        ...Object.fromEntries(
            languages
                ?.filter((el: any) => !ids || ids.includes(el.id))
                .map((el: any) => [
                    el.aliases[0],
                    el.extensions.map((ext: any) => ext.slice(1)),
                ])
        ),
    };
    return filters;
}
