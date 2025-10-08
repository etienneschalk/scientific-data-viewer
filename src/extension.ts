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
    getVersion,
    setPackageJson,
    getDisplayName,
    getAllSupportedExtensions,
    getShowDialogFilters,
} from './common/vscodeutils';
import { ExtensionVirtualEnvironmentManagerUI } from './python/ExtensionVirtualEnvironmentManagerUI';
import { setupOfficialPythonExtensionChangeListeners } from './python/officialPythonExtensionApiUtils';
import { formatConfigValue } from './common/utils';
import {
    SDV_EXTENSION_ID,
    CMD_OPEN_VIEWER,
    CMD_OPEN_VIEWER_FOLDER,
    CMD_REFRESH_PYTHON_ENVIRONMENT,
    CMD_SHOW_LOGS,
    CMD_SHOW_SETTINGS,
    CMD_OPEN_DEVELOPER_TOOLS,
    CMD_SCROLL_TO_HEADER,
    CMD_EXPAND_ALL,
    CMD_PYTHON_INSTALL_PACKAGES,
    CMD_MANAGE_EXTENSION_OWN_ENVIRONMENT,
    OUTLINE_TREE_VIEW_ID,
    getDevMode,
    getOverridePythonInterpreter,
    getOverridePythonInterpreterConfigFullKey,
    getUseExtensionOwnEnvironment,
    getUseExtensionOwnEnvironmentConfigFullKey,
} from './common/config';
import { updateStatusBarItem } from './StatusBarItem';
import { PackageJson } from './package-types';

export function activate(context: vscode.ExtensionContext) {
    setPackageJson(getPackageJSON(context));
    
    Logger.initialize();

    Logger.info(`⚛️ ${getDisplayName()} extension is now active!`);
    Logger.info(`🏷️ Version: ${getVersion()}`);

    // Initialize error boundary
    const errorBoundary = ErrorBoundary.getInstance();
    errorBoundary.registerGlobalHandler((error, context) => {
        Logger.error(`Global error: ${error.message}`);
        vscode.window.showErrorMessage(
            `${getDisplayName()} Error: ${error.message}`
        );
    });

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

    // Create status bar item for Python interpreter (hidden by default)
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );

    // Initialize managers
    Logger.info('🔧 Initializing extension managers...');
    const extensionEnvManager = new ExtensionVirtualEnvironmentManager(
        context.globalStorageUri.fsPath
    );

    const extensionVirtualEnvironmentManagerUI =
        new ExtensionVirtualEnvironmentManagerUI(extensionEnvManager);
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

    Logger.info('🔧 Refreshing Python environment...');
    refreshPython(pythonManager, statusBarItem);
    Logger.info('🚀 Python environment refreshed successfully');

    Logger.info('🔧 Registering custom editor providers...');
    context.subscriptions.push(
        ...registerCustomEditorProviders(
            dataProcessor,
            webviewOptions,
            webviewPanelOptions
        )
    );
    Logger.info('🚀 Custom editor providers registered successfully');

    // Create outline provider
    // The outline will be updated automatically when DataViewerPanels become active
    // via the onDidChangeViewState listener in DataViewerPanel
    Logger.info(`🔧 Creating outline provider...`);
    const outlineProvider = createOutlineProvider();
    Logger.info(`🚀 Outline provider created successfully`);

    Logger.info(`🔧 Registering commands...`);
    context.subscriptions.push(
        vscode.commands.registerCommand(
            CMD_OPEN_VIEWER,
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
                        filters: getShowDialogFilters([
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
        ),
        vscode.commands.registerCommand(
            CMD_OPEN_VIEWER_FOLDER,
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
                        filters: getShowDialogFilters(['zarr']),
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
        ),
        vscode.commands.registerCommand(
            CMD_REFRESH_PYTHON_ENVIRONMENT,
            async () => {
                Logger.info(
                    '🎮 🔄 Command: Manually refreshing Python environment...'
                );
                await refreshPython(pythonManager, statusBarItem);
                vscode.window.showInformationMessage(
                    'Python environment refreshed!'
                );
            }
        ),
        vscode.commands.registerCommand(CMD_SHOW_LOGS, () => {
            Logger.info('🎮 🗒️ Command: Showing logs...');
            Logger.show();
        }),
        vscode.commands.registerCommand(CMD_SHOW_SETTINGS, () => {
            Logger.info(
                `🎮 ⚙️ Command: Opening ${getDisplayName()} settings...`
            );
            vscode.commands.executeCommand(
                'workbench.action.openSettings',
                SDV_EXTENSION_ID
            );
        }),
        vscode.commands.registerCommand(CMD_OPEN_DEVELOPER_TOOLS, () => {
            Logger.info(
                '🎮 🔧 Command: Opening developer tools for WebView...'
            );
            // This will open the developer tools for the currently active WebView
            vscode.commands.executeCommand(
                'workbench.action.webview.openDeveloperTools'
            );
        }),
        vscode.commands.registerCommand(
            CMD_SCROLL_TO_HEADER,
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
                    Logger.warn(
                        '📋 No active DataViewerPanel found for scrolling'
                    );
                }
            }
        ),
        vscode.commands.registerCommand(CMD_EXPAND_ALL, () => {
            Logger.info('🎮 📋 Command: Expanding all outline items');
            outlineProvider.expandAll();
        }),
        vscode.commands.registerCommand(
            CMD_PYTHON_INSTALL_PACKAGES,
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
                        `Successfully installed packages: ${packages.join(
                            ', '
                        )}`
                    );
                } catch (error) {
                    Logger.error(`Failed to install packages: ${error}`);
                    vscode.window.showErrorMessage(
                        `Failed to install packages: ${error}`
                    );
                }
            }
        ),
        vscode.commands.registerCommand(
            CMD_MANAGE_EXTENSION_OWN_ENVIRONMENT,
            async () => {
                Logger.info(
                    '🎮 🔧 Command: Manage Extension Virtual Environment'
                );
                await extensionVirtualEnvironmentManagerUI.manage();
            }
        )
    );
    Logger.info(`🚀 Commands registered successfully`);

    const supportedExtensions = getAllSupportedExtensions();
    Logger.info(
        `🔧 Detected supported extensions from package.json: ${supportedExtensions}`
    );
    Logger.info(`🔧 Set up workspace listeners...`);
    context.subscriptions.push(
        // Open devtools and logs when opening a file in devmode
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
                        await vscode.commands.executeCommand(CMD_SHOW_LOGS);
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
                            CMD_OPEN_DEVELOPER_TOOLS
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
        }),
        // Set up configuration change listener for all ${getDisplayName()} settings
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration(SDV_EXTENSION_ID)) {
                Logger.info(`${getDisplayName()} configuration changed`);

                if (
                    event.affectsConfiguration(
                        getOverridePythonInterpreterConfigFullKey()
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
                        getUseExtensionOwnEnvironmentConfigFullKey()
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
                        if (
                            !getUseExtensionOwnEnvironment() ||
                            pythonManager.getCurrentEnvironmentInfo()
                                ?.source === 'own-uv-env'
                        ) {
                            return;
                        }
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
        }),
        // Also listen for workspace folder changes (when Python interpreter might change)
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            Logger.info(
                '🐍 🔧 Workspace folder changed, refreshing Python environment...'
            );
            await refreshPython(pythonManager, statusBarItem);
        })
    );
    Logger.info(`🚀 Workspace listeners set up successfully`);

    Logger.info(
        '🔧 Set up immediate official Python extension interpreter change detection...'
    );
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
    try {
        setupOfficialPythonExtensionChangeListeners(
            handleOnDidChangeActiveEnvironmentPath,
            handleOnDidEnvironmentsChanged
        )
            .then((listener) => {
                if (listener) {
                    Logger.info(
                        '🚀 Immediate official Python extension interpreter change detection enabled'
                    );
                    // Add to subscriptions after it's created
                    context.subscriptions.push(listener);
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
}

function registerCustomEditorProviders(
    dataProcessor: DataProcessor,
    webviewOptions: vscode.WebviewOptions,
    webviewPanelOptions: vscode.WebviewPanelOptions
) {
    const sciEditorProvider = new ScientificDataEditorProvider(
        webviewOptions,
        dataProcessor
    );
    const options = {
        // Warning! Naming is confusing!
        webviewOptions: webviewPanelOptions,
        // Allow Split Editor
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
    return editorRegistrations;
}

function createOutlineProvider() {
    const outlineProvider = new OutlineProvider();
    const outlineTreeView = vscode.window.createTreeView(OUTLINE_TREE_VIEW_ID, {
        treeDataProvider: outlineProvider,
        showCollapseAll: true,
    });

    // Set tree view reference for collapse/expand operations
    outlineProvider.setTreeView(outlineTreeView);

    // Make outline provider accessible to DataViewerPanel
    DataViewerPanel.setOutlineProvider(outlineProvider);
    return outlineProvider;
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

    Logger.info('${getDisplayName()} extension is now deactivated!');
    Logger.info('Last word before disposing the Logger.');
    Logger.dispose();
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
        updateStatusBarItem(
            pythonManager.getCurrentEnvironmentInfo(),
            statusBarItem
        );
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

function getPackageJSON(context: vscode.ExtensionContext): PackageJson {
    // Important: We need to cast to PackageJson to avoid type errors
    // when accessing the package.json file
    // This means we trust the PackageJson interface to be correct.
    return vscode.extensions.getExtension(context.extension.id)?.packageJSON as PackageJson;
}