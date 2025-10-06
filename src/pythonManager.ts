import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { Logger } from './logger';
import { DataViewerPanel } from './dataViewerPanel';
import { ExtensionVirtualEnvironmentManager } from './extensionVirtualEnvironmentManager';
import { quoteIfNeeded, showErrorMessage } from './utils';

/**
 * Flag to control the creation of the extension own virtual environment
 * Indeed, we might want the uv environment creation to be handled by the user (via command only)
 * However, having an automatic installation attempt is useful to ensure that the extension works out of the box
 * It is written in this way to be able to easily change it in the future
 */
const ATTEMPT_CREATING_EXTENSION_OWN_UV_ENVIRONMENT = true;

/**
 * Enum to represent the source of the Python environment
 * - override: The user has set an override Python interpreter
 *   via 'scientificDataViewer.python.overridePythonInterpreter'
 * - own-uv-env: The extension has created its own virtual environment with uv
 *   via 'scientificDataViewer.python.useExtensionOwnEnvironment'
 * - python-extension: The Python extension has created the environment
 *   via 'scientificDataViewer.python.usePythonExtensionEnvironment'
 * - system: The system Python interpreter is used
 *   via 'scientificDataViewer.python.useSystemPython'
 */
type EnvironmentSource =
    | 'override'
    | 'own-uv-env'
    | 'python-extension'
    | 'system';

/**
 * Class to manage the Python environment
 * It is responsible for:
 * - Initializing the Python environment
 * - Validating the Python environment
 * - Installing required packages
 * - Updating the currently used interpreter in the configuration
 * - Getting the current environment info
 * - Setting up event listeners for Python environment changes and creation
 * - Prompting the user to install required packages
 * - Prompting the user to install packages for a specific format
 * - Executing Python files
 * - Checking package availability
 */
export class PythonManager {
    private _pythonPath: string | null = null;
    private _initialized: boolean = false;
    private _initializationPromise: Promise<void> | null = null;
    private _environmentSource: EnvironmentSource | null = null;
    // Core packages required for basic functionality
    private readonly corePackages = ['xarray', 'matplotlib'];
    // Additional packages for extended format support
    private readonly extendedPackages = [
        'netCDF4',
        'h5netcdf',
        'zarr',
        'h5py',
        'scipy',
        'cfgrib',
        'rioxarray',
        'xarray-sentinel',
    ];

    constructor(
        private readonly extensionEnvManager: ExtensionVirtualEnvironmentManager
    ) {}

    /**
     * Get the Python path
     */
    get pythonPath(): string | null {
        return this._pythonPath;
    }

    /**
     * Check if the Python environment is ready
     */
    get ready(): boolean {
        return this._initialized && this._pythonPath !== null;
    }

    /**
     * Wait for Python initialization to complete
     * This method should be called before any file operations to prevent race conditions
     */
    async waitForInitialization(): Promise<void> {
        if (this._initializationPromise) {
            Logger.debug(
                '🐍 ⏳ Waiting for Python initialization to complete...'
            );
            await this._initializationPromise;
        }
    }

    /**
     * Force initialize the Python environment
     */
    async forceInitialize(): Promise<void> {
        Logger.info('🐍 🔄 Force initializing Python environment...');
        this._initialized = false;
        this._initializationPromise = null; // Reset any existing initialization
        await this.initialize();
    }

    /**
     * Execute a Python file
     * @param scriptPath    The path to the Python file
     * @param args          The arguments to pass to the Python file
     * @param enableLogs    Whether to enable logs
     * @returns             The result of the Python file
     */
    async executePythonFile(
        scriptPath: string,
        args: string[] = [],
        enableLogs: boolean = false
    ): Promise<any> {
        if (!this._pythonPath || !this._initialized) {
            throw new Error(
                'Python environment not properly initialized. Please run "Python: Select Interpreter" command first.'
            );
        }

        const methodName = enableLogs
            ? 'executePythonFileWithLogs'
            : 'executePythonFile';
        Logger.log(
            `🐍 📜 ${methodName}: Executing Python file ${scriptPath} with args: ${args} | Python path: ${this._pythonPath} | Is initialized: ${this._initialized}`
        );

        return new Promise((resolve, reject) => {
            const process = spawn(
                quoteIfNeeded(this._pythonPath!),
                [scriptPath, ...args],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                const logData = data.toString();
                stderr += logData;

                if (enableLogs) {
                    // Forward Python logs to VSCode Logger
                    // Parse log lines and forward them
                    const lines = logData
                        .split('\n')
                        .filter((line: string) => line.trim());
                    lines.forEach((line: string) => {
                        if (line.includes(' - INFO - ')) {
                            const message = line.split(' - INFO - ')[1];
                            if (message) {
                                Logger.info(`🐍 📜 [Python] ${message}`);
                            }
                        } else if (line.includes(' - ERROR - ')) {
                            const message = line.split(' - ERROR - ')[1];
                            if (message) {
                                Logger.error(`🐍 📜 [Python] ${message}`);
                            }
                        } else if (line.includes(' - WARNING - ')) {
                            const message = line.split(' - WARNING - ')[1];
                            if (message) {
                                Logger.warn(`🐍 📜 [Python] ${message}`);
                            }
                        } else if (line.includes(' - DEBUG - ')) {
                            const message = line.split(' - DEBUG - ')[1];
                            if (message) {
                                Logger.debug(`🐍 📜 [Python] ${message}`);
                            }
                        } else if (line.trim()) {
                            // Any other stderr output that doesn't match the log format
                            Logger.info(`🐍 📜 [Python] ${line.trim()}`);
                        }
                    });
                }
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        resolve(stdout);
                    }
                } else {
                    const errorMessage = stderr || 'Unknown Python error';
                    if (errorMessage.includes('ModuleNotFoundError')) {
                        reject(
                            new Error(
                                `Missing Python package: ${errorMessage}. Please install required packages with: pip install xarray netCDF4 zarr h5py numpy matplotlib`
                            )
                        );
                    } else if (errorMessage.includes('PermissionError')) {
                        reject(
                            new Error(
                                `Permission denied: ${errorMessage}. Please check file permissions.`
                            )
                        );
                    } else if (errorMessage.includes('FileNotFoundError')) {
                        reject(
                            new Error(
                                `File not found: ${errorMessage}. Please check the file path.`
                            )
                        );
                    } else {
                        reject(
                            new Error(
                                `Python script failed (exit code ${code}): \n${errorMessage}`
                            )
                        );
                    }
                }
            });

            process.on('error', (error) => {
                if (error.message.includes('ENOENT')) {
                    reject(
                        new Error(
                            `Python interpreter not found at: ${this._pythonPath}. Please check your Python installation.`
                        )
                    );
                } else {
                    reject(
                        new Error(
                            `Failed to execute Python script: ${error.message}`
                        )
                    );
                }
            });
        });
    }

    /**
     * Get information about the current Python environment
     * @returns             The current environment info
     */
    async getCurrentEnvironmentInfo(): Promise<{
        type: EnvironmentSource;
        path: string;
    } | null> {
        if (!this._pythonPath || !this._environmentSource) {
            return null;
        }

        return {
            type: this._environmentSource,
            path: this._pythonPath,
        };
    }

    /**
     * Set up event listeners for Python environment changes and creation
     * Returns a disposable that should be disposed when the extension is deactivated
     */
    async setupOfficialPythonExtensionChangeListeners(
        onDidChangeActiveEnvironmentPath: () => Promise<void>,
        onDidEnvironmentsChanged: (environment: any) => Promise<void>
    ): Promise<vscode.Disposable | undefined> {
        try {
            const pythonApi = await this.getPythonExtensionApi();
            if (!pythonApi || !pythonApi.environments) {
                Logger.debug(
                    '🐍 ⚠️ Python extension API or environments API not available for event listeners'
                );
                return undefined;
            }

            const disposables: vscode.Disposable[] = [];

            // Listen for active interpreter changes (existing functionality)
            if (
                typeof pythonApi.environments
                    .onDidChangeActiveEnvironmentPath === 'function'
            ) {
                Logger.info(
                    '🐍 🔧 [Official Python Extension] Setting up Python interpreter change listener for onDidChangeActiveEnvironmentPath...'
                );

                const interpreterDisposable =
                    pythonApi.environments.onDidChangeActiveEnvironmentPath(
                        async (event: any) => {
                            Logger.info(
                                `🐍 🔔 [Official Python Extension] Python interpreter changed: ${
                                    event?.path || 'undefined'
                                }`
                            );
                            await onDidChangeActiveEnvironmentPath();
                        }
                    );

                disposables.push(interpreterDisposable);
            }

            // Listen for environment creation/removal/updates (NEW functionality)
            if (
                typeof pythonApi.environments.onDidEnvironmentsChanged ===
                'function'
            ) {
                Logger.info(
                    '🐍 🔧 [Official Python Extension] Setting up Python environment change listener for onDidEnvironmentsChanged...'
                );

                const environmentDisposable =
                    pythonApi.environments.onDidEnvironmentsChanged(
                        async (event: any) => {
                            // Add comprehensive debugging
                            Logger.debug(
                                `🐍 🔍 [Official Python Extension] Environment change event received: ${JSON.stringify(
                                    event,
                                    null,
                                    2
                                )}`
                            );

                            // Handle newly created environments
                            if (event.added && event.added.length > 0) {
                                Logger.info(
                                    `🐍 🆕 [Official Python Extension] New Python environments created: ${event.added.length}`
                                );
                                for (const env of event.added) {
                                    Logger.info(
                                        `🐍 🆕 New environment: ${
                                            env.path || env.id || 'unknown'
                                        }`
                                    );
                                    await onDidEnvironmentsChanged(env);
                                }
                            }

                            // Handle removed environments
                            if (event.removed && event.removed.length > 0) {
                                Logger.info(
                                    `🐍 🗑️ [Official Python Extension] Python environments removed: ${event.removed.length}`
                                );
                                for (const env of event.removed) {
                                    Logger.info(
                                        `🐍 🗑️ Removed environment: ${
                                            env.path || env.id || 'unknown'
                                        }`
                                    );
                                    await onDidEnvironmentsChanged(env);
                                }
                            }

                            // Handle updated environments
                            if (event.updated && event.updated.length > 0) {
                                Logger.info(
                                    `🐍 🔄 [Official Python Extension] Python environments updated: ${event.updated.length}`
                                );
                                for (const env of event.updated) {
                                    Logger.info(
                                        `🐍 🔄 Updated environment: ${
                                            env.path || env.id || 'unknown'
                                        }`
                                    );
                                    await onDidEnvironmentsChanged(env);
                                }
                            }
                        }
                    );

                disposables.push(environmentDisposable);
            }

            // If no listeners were set up, return undefined
            if (disposables.length === 0) {
                Logger.debug(
                    '🐍 ⚠️ No compatible event listeners available in Python extension API'
                );
                return undefined;
            }

            // Return a combined disposable
            return {
                dispose: () => {
                    disposables.forEach((d) => d.dispose());
                },
            };
        } catch (error) {
            Logger.warn(
                `🐍 ❌ Failed to set up Python environment change listeners: ${error}`
            );
            return undefined;
        }
    }

    /**
     * Prompt the user to install required packages
     * @param missingPackages The list of missing packages
     */
    async promptToInstallRequiredPackages(
        missingPackages: string[]
    ): Promise<void> {
        const action = await vscode.window.showWarningMessage(
            `You are using the Python interpreter at ${
                this._pythonPath
            }. Missing required packages: ${missingPackages.join(
                ', '
            )}. Install them?`,
            'Install',
            'Cancel'
        );

        if (action === 'Install') {
            try {
                await this.installPackages(missingPackages);
                // TODO eschalk: This is a hack to refresh the panels with errors.
                // We should find a better way to do this. XXX
                await DataViewerPanel.refreshPanelsWithErrors();
            } catch (error) {
                Logger.error(`🐍 📦 ❌ Package installation failed: ${error}`);
                // Show detailed error information
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                showErrorMessage(
                    `Package installation failed: ${errorMessage}`
                );
                throw error;
            }
        } else {
            // User cancelled installation, but we still have a valid Python interpreter
            // Set as initialized so the extension can work with what's available
            Logger.info(
                `🐍 📦 ⚠️ Python environment ready (with missing packages)! Using interpreter: ${this._pythonPath}`
            );
        }
    }

    /**
     * Prompt the user to install packages for a specific format
     * @param format          The format to install packages for
     * @param missingPackages The list of missing packages
     */
    async promptToInstallPackagesForFormat(
        format: string,
        missingPackages: string[]
    ): Promise<void> {
        const action = await vscode.window.showWarningMessage(
            `You are using the Python interpreter at ${
                this._pythonPath
            }. Missing packages for format ${format}: ${missingPackages.join(
                ', '
            )}. Install them?`,
            'Install',
            'Cancel'
        );

        if (action === 'Install') {
            try {
                await this.installPackages(missingPackages);
                // TODO eschalk: This is a hack to refresh the panels with errors.
                // We should find a better way to do this. XXX
                await DataViewerPanel.refreshPanelsWithErrors();
            } catch (error) {
                Logger.error(`🐍 📦 ❌ Package installation failed: ${error}`);
                // Show detailed error information
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                showErrorMessage(
                    `Package installation failed: ${errorMessage}`
                );
                throw error;
            }
        } else {
            // User cancelled installation, but we still have a valid Python interpreter
            // Set as initialized so the extension can work with what's available
            Logger.info(
                `🐍 📦 ⚠️ Installation cancelled for format ${format}: ${missingPackages.join(
                    ', '
                )}.`
            );
        }
    }

    private async initialize(): Promise<void> {
        // If initialization is already in progress, wait for it to complete
        if (this._initializationPromise) {
            Logger.debug(
                '🐍 ⏳ Python initialization already in progress, waiting...'
            );
            return this._initializationPromise;
        }

        // Start initialization and store the promise
        this._initializationPromise = this.doInitialize();
        return this._initializationPromise;
    }

    private async doInitialize(): Promise<void> {
        try {
            Logger.info('🐍 🔧 [INIT] Initializing Python manager');
            const config = vscode.workspace.getConfiguration(
                'scientificDataViewer.python'
            );

            // First, check if there's an override interpreter set
            const overrideInterpreter = config.get<string>(
                'overridePythonInterpreter',
                ''
            );
            if (overrideInterpreter) {
                Logger.info(
                    `🐍 🔧 Using override Python interpreter: ${overrideInterpreter}`
                );
                await this.validatePythonEnvironment(overrideInterpreter);
                await this.updateCurrentlyUsedInterpreterInConfig('override');
                return;
            }

            // Check if extension environment is enabled
            const useExtensionEnv = config.get<boolean>(
                'useExtensionOwnEnvironment',
                false
            );
            if (useExtensionEnv) {
                Logger.info('🐍 🔧 Using extension own virtual environment');

                if (this.extensionEnvManager.ready) {
                    await this.validatePythonEnvironment(
                        this.extensionEnvManager.pythonPath
                    );
                    await this.updateCurrentlyUsedInterpreterInConfig(
                        'own-uv-env'
                    );
                    return;
                } else if (ATTEMPT_CREATING_EXTENSION_OWN_UV_ENVIRONMENT) {
                    // Try to create the extension environment
                    try {
                        await this.extensionEnvManager.create();
                        if (this.extensionEnvManager.ready) {
                            await this.validatePythonEnvironment(
                                this.extensionEnvManager.pythonPath
                            );
                            await this.updateCurrentlyUsedInterpreterInConfig(
                                'own-uv-env'
                            );
                            return;
                        }
                    } catch (error) {
                        Logger.warn(
                            '🐍 ⚠️ Failed to create extension own environment, falling back to Python extension'
                        );
                    }
                } else {
                    Logger.warn(
                        '🐍 ⚠️ Extension own environment not ready, falling back to Python extension'
                    );
                }
            }

            // Fallback: Use Python extension API (original behavior)
            const newPythonPath =
                await this.getPythonInterpreterFromExtension();

            if (newPythonPath) {
                Logger.info(
                    `🐍 🔀 Python interpreter changed from ${this._pythonPath} to ${newPythonPath}`
                );
                await this.validatePythonEnvironment(newPythonPath);
                await this.updateCurrentlyUsedInterpreterInConfig(
                    'python-extension'
                );
                return;
            }

            // Fallback: Last chance - Common Python paths to check
            const commonPaths = [
                'python3',
                'python',
                '/usr/bin/python3',
                '/usr/local/bin/python3',
                'C:\\Python39\\python.exe',
                'C:\\Python310\\python.exe',
                'C:\\Python311\\python.exe',
            ];

            for (const pythonPath of commonPaths) {
                try {
                    const version = await this.getPythonVersion(pythonPath);
                    if (version) {
                        await this.validatePythonEnvironment(pythonPath);
                        await this.updateCurrentlyUsedInterpreterInConfig(
                            'system'
                        );
                        return;
                    }
                } catch (error) {
                    // Ignore errors for individual paths
                }
            }

            vscode.window.showWarningMessage(
                'No suitable Python interpreter found. Please install Python and use VSCode\'s "Python: Select Interpreter" command.'
            );
        } finally {
            // Clear the initialization promise when done
            this._initializationPromise = null;
        }
    }

    private async getPythonInterpreterFromExtension(): Promise<string | null> {
        try {
            const pythonExtension =
                vscode.extensions.getExtension('ms-python.python');
            if (!pythonExtension) {
                Logger.error('🐍 ❌ Python extension not found');
                return null;
            }

            if (!pythonExtension.isActive) {
                Logger.debug(
                    '🐍 💤 Python extension is not active, attempting to activate...'
                );
            }

            // Ensure the extension is activated
            const pythonApi = await pythonExtension.activate();

            if (!pythonApi) {
                Logger.warn(
                    '🐍 ⚠️ Python extension API is not available after activation'
                );
                // Continue to VSCode configuration fallback
            } else {
                Logger.debug(
                    '🐍 ✅ Python extension API is available after activation'
                );
                Logger.debug(
                    `🐍 🔍 Python API structure: ${JSON.stringify(
                        Object.keys(pythonApi)
                    )}`
                );
                if (pythonApi.environments) {
                    Logger.debug(
                        `🐍 🔍 Environments API methods: ${JSON.stringify(
                            Object.keys(pythonApi.environments)
                        )}`
                    );
                }
            }

            // Try the new environments API with resolveEnvironment (recommended approach)
            if (
                pythonApi &&
                pythonApi.environments &&
                typeof pythonApi.environments.getActiveEnvironmentPath ===
                    'function'
            ) {
                try {
                    const activeEnvironmentPath =
                        await pythonApi.environments.getActiveEnvironmentPath();
                    Logger.debug(
                        `🐍 🔍 Python extension API active environment path: ${JSON.stringify(
                            activeEnvironmentPath
                        )}`
                    );

                    if (activeEnvironmentPath && activeEnvironmentPath.path) {
                        // Resolve the environment to get complete details and ensure it's valid
                        if (
                            typeof pythonApi.environments.resolveEnvironment ===
                            'function'
                        ) {
                            try {
                                const resolvedEnvironment =
                                    await pythonApi.environments.resolveEnvironment(
                                        activeEnvironmentPath
                                    );
                                Logger.debug(
                                    `🐍 🔍 Resolved environment details: ${JSON.stringify(
                                        resolvedEnvironment
                                    )}`
                                );

                                if (resolvedEnvironment) {
                                    // Use the resolved environment's path, which should be more reliable
                                    const resolvedPath =
                                        resolvedEnvironment.path ||
                                        resolvedEnvironment.executable?.path ||
                                        activeEnvironmentPath.path;
                                    Logger.info(
                                        `🐍 ✅ Using resolved Python environment: ${resolvedPath}`
                                    );
                                    return resolvedPath;
                                } else {
                                    Logger.warn(
                                        '🐍 ⚠️ Environment resolution returned null, using original path'
                                    );
                                    return activeEnvironmentPath.path;
                                }
                            } catch (resolveError) {
                                Logger.warn(
                                    `🐍 ⚠️ Environment resolution failed: ${resolveError}, using original path`
                                );
                                return activeEnvironmentPath.path;
                            }
                        } else {
                            Logger.debug(
                                '🐍 ⚠️ resolveEnvironment not available, using original path'
                            );
                            return activeEnvironmentPath.path;
                        }
                    }
                } catch (envError) {
                    Logger.debug(`🐍 ⚠️ Environments API error: ${envError}`);
                    // Continue to VSCode configuration fallback
                }
            }

            // Try alternative environments API methods
            if (pythonApi && pythonApi.environments) {
                // Try getActiveInterpreter if available
                if (
                    typeof pythonApi.environments.getActiveInterpreter ===
                    'function'
                ) {
                    try {
                        const activeInterpreter =
                            await pythonApi.environments.getActiveInterpreter();
                        Logger.debug(
                            `🐍 🔍 Python extension API active interpreter (alt): ${JSON.stringify(
                                activeInterpreter
                            )}`
                        );
                        return activeInterpreter?.path;
                    } catch (altError) {
                        Logger.debug(
                            `🐍 ⚠️ Alternative environments API error: ${altError}`
                        );
                    }
                }

                // Try getActiveEnvironment if available
                if (
                    typeof pythonApi.environments.getActiveEnvironment ===
                    'function'
                ) {
                    try {
                        const activeEnv =
                            await pythonApi.environments.getActiveEnvironment();
                        Logger.debug(
                            `🐍 🔍 Python extension API active environment (alt): ${JSON.stringify(
                                activeEnv
                            )}`
                        );
                        return activeEnv?.path;
                    } catch (altError) {
                        Logger.debug(
                            `🐍 ⚠️ Alternative environments API error: ${altError}`
                        );
                    }
                }
            }

            // Fallback to old settings API if available
            if (
                pythonApi &&
                pythonApi.settings &&
                typeof pythonApi.settings.getInterpreterDetails === 'function'
            ) {
                try {
                    const interpreterDetails =
                        await pythonApi.settings.getInterpreterDetails();
                    Logger.debug(
                        `🐍 🔍 Python extension API interpreter details (legacy): ${JSON.stringify(
                            interpreterDetails
                        )}`
                    );
                    return interpreterDetails?.path;
                } catch (legacyError) {
                    Logger.debug(`🐍 ⚠️ Legacy API error: ${legacyError}`);
                }
            }

            Logger.warn('🐍 ⚠️ No compatible Python extension API found');
        } catch (error) {
            Logger.warn(
                `🐍 ⚠️ Could not access Python extension API: ${error}`
            );
        }

        // Fallback: try to get from VSCode configuration
        try {
            const vscodePythonPath = vscode.workspace
                .getConfiguration('python')
                .get('defaultInterpreterPath') as string | null;
            if (vscodePythonPath) {
                Logger.debug(
                    `🐍 🔍 Using Python path from VSCode configuration: ${vscodePythonPath}`
                );
            }
            return vscodePythonPath;
        } catch (error) {
            Logger.warn(
                `🐍 ⚠️ Could not access Python configuration: ${error}`
            );
        }

        return null;
    }

    private async getPythonVersion(pythonPath: string): Promise<string | null> {
        return new Promise((resolve) => {
            const process = spawn(quoteIfNeeded(pythonPath), ['--version'], {
                shell: true,
            });
            let output = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    resolve(null);
                }
            });

            process.on('error', () => {
                resolve(null);
            });
        });
    }

    private async checkRequiredPackages(pythonPath: string): Promise<string[]> {
        Logger.debug(`🐍 🔍 Checking required packages`);

        const allPackages = [...this.corePackages, ...this.extendedPackages];
        const availablePackages: string[] = [];

        for (const packageName of allPackages) {
            try {
                const isAvailable = await this.checkPackageAvailability(
                    pythonPath,
                    packageName
                );
                if (isAvailable) {
                    availablePackages.push(packageName);
                    Logger.debug(`🐍 📦 ✅ Package available: ${packageName}`);
                } else {
                    Logger.debug(
                        `🐍 📦 ⚠️ Package not available: ${packageName}`
                    );
                }
            } catch (error) {
                Logger.debug(
                    `🐍 📦 ⚠️ Package not available: ${packageName}: error: ${error}`
                );
            }
        }

        Logger.debug(
            `🐍 📦 ℹ️ Available packages: ${availablePackages.join(', ')}`
        );
        return availablePackages;
    }

    private async checkPipAvailability(): Promise<void> {
        if (!this._pythonPath) {
            throw new Error('No Python interpreter configured');
        }

        return new Promise((resolve, reject) => {
            const process = spawn(
                quoteIfNeeded(this._pythonPath!),
                ['-m', 'pip', '--version'],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    Logger.debug(`🐍 📦 🔍 pip version: ${stdout.trim()}`);
                    resolve();
                } else {
                    reject(
                        new Error(
                            `pip check failed (exit code ${code}): ${
                                stderr || stdout
                            }`
                        )
                    );
                }
            });

            process.on('error', (error) => {
                reject(
                    new Error(
                        `Failed to check pip availability: ${error.message}`
                    )
                );
            });
        });
    }

    /**
     * Check if a package is available
     * @param pythonPath    The path to the Python interpreter
     * @param packageName   The name of the package to check
     * @returns             True if the package is available, False otherwise
     */
    private async checkPackageAvailability(
        pythonPath: string,
        packageName: string
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const args = [
                '-c',
                `"from importlib.util import find_spec; exit(1 if find_spec('${packageName}') is None else 0)"`,
            ];
            const process = spawn(quoteIfNeeded(pythonPath), args, {
                shell: true,
            });

            process.on('close', (code) => {
                resolve(code === 0);
            });

            process.on('error', (error) => {
                resolve(false);
            });
        });
    }

    private async validatePythonEnvironment(
        pythonPath: string | null
    ): Promise<void> {
        this._initialized = false;
        this._pythonPath = pythonPath;

        Logger.info(
            `🐍 🛡️ validatePythonEnvironment: Validating Python environment. Is initialized: ${this._initialized} | Python path: ${this._pythonPath}`
        );

        if (!this._pythonPath) {
            throw new Error('No Python interpreter configured');
        }

        try {
            const packages = await this.checkRequiredPackages(this._pythonPath);
            const missingCorePackages = this.corePackages.filter(
                (pkg) => !packages.includes(pkg)
            );

            // Only require core packages for basic functionality
            const missingPackages = missingCorePackages;

            if (missingPackages.length > 0) {
                this.promptToInstallRequiredPackages(missingPackages);
            } else {
                this._initialized = true;
                // Don't show notification during initialization - only when interpreter changes
                Logger.info(
                    `🐍 📦 ✅ Python environment ready! Using interpreter: ${this._pythonPath}`
                );
            }
        } catch (error) {
            Logger.error(
                `🐍 📦 ❌ Python environment validation failed: ${error}`
            );
            showErrorMessage(`Failed to validate Python environment: ${error}`);
        }
    }

    async installPackages(packages: string[]): Promise<void> {
        if (!this._pythonPath) {
            throw new Error('No Python interpreter configured');
        }

        // First, check if pip is available
        try {
            await this.checkPipAvailability();
        } catch (error) {
            throw new Error(
                `pip is not available: ${error}. Please install pip or use a different Python interpreter.`
            );
        }

        return new Promise((resolve, reject) => {
            Logger.info(
                `🐍 📦 🔍 Installing packages: ${packages.join(
                    ', '
                )} using Python: ${this._pythonPath}`
            );
            Logger.debug(`🐍 📦 🔍 Working directory: ${process.cwd()}`);
            Logger.debug(`🐍 📦 🔍 Environment PATH: ${process.env.PATH}`);

            const pipProcess = spawn(
                quoteIfNeeded(this._pythonPath!),
                ['-m', 'pip', 'install', ...packages],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            let stdout = '';
            let stderr = '';

            pipProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                Logger.debug(`🐍 📦 pip stdout: ${output}`);
            });

            pipProcess.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                Logger.warn(`🐍 📦 pip stderr: ${output}`);
            });

            pipProcess.on('close', (code) => {
                Logger.debug(`🐍 📦 pip process exited with code: ${code}`);
                Logger.debug(`🐍 📦 pip stdout: ${stdout}`);
                Logger.debug(`🐍 📦 pip stderr: ${stderr}`);

                if (code === 0) {
                    this._initialized = true;
                    vscode.window.showInformationMessage(
                        `Successfully installed packages: ${packages.join(
                            ', '
                        )}`
                    );
                    resolve();
                } else {
                    // Create detailed error message with pip output
                    let errorMessage = `Failed to install packages. Exit code: ${code}`;

                    if (stderr) {
                        errorMessage += `\n\nPip Error Output:\n${stderr}`;
                    }

                    if (stdout) {
                        errorMessage += `\n\nPip Standard Output:\n${stdout}`;
                    }

                    // Add common troubleshooting tips based on error content
                    if (
                        stderr.includes('Permission denied') ||
                        stderr.includes('Access is denied')
                    ) {
                        errorMessage += `\n\n💡 Troubleshooting: Permission denied. Try running:\n${
                            this._pythonPath
                        } -m pip install --user ${packages.join(' ')}`;
                    } else if (stderr.includes('No module named pip')) {
                        errorMessage += `\n\n💡 Troubleshooting: pip is not installed. Try installing pip first or use a different Python interpreter.`;
                    } else if (stderr.includes('Could not find a version')) {
                        errorMessage += `\n\n💡 Troubleshooting: Package version not found. Try updating pip:\n${this._pythonPath} -m pip install --upgrade pip`;
                    } else if (
                        stderr.includes('SSL') ||
                        stderr.includes('certificate')
                    ) {
                        errorMessage += `\n\n💡 Troubleshooting: SSL/Certificate issue. Try:\n${
                            this._pythonPath
                        } -m pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org ${packages.join(
                            ' '
                        )}`;
                    } else if (stderr.includes('Microsoft Visual C++')) {
                        errorMessage += `\n\n💡 Troubleshooting: Missing Visual C++ compiler. Install Microsoft Visual C++ Build Tools or use pre-compiled packages.`;
                    }

                    reject(new Error(errorMessage));
                }
            });

            pipProcess.on('error', (error) => {
                Logger.error(`🐍 📦 ❌ pip process error: ${error.message}`);
                let errorMessage = `Failed to execute pip: ${error.message}`;

                if (error.message.includes('ENOENT')) {
                    errorMessage += `\n\n💡 Troubleshooting: Python interpreter not found at: ${this._pythonPath}`;
                    errorMessage += `\nPlease check your Python installation and try selecting a different interpreter.`;
                }

                reject(new Error(errorMessage));
            });
        });
    }

    /**
     * Get Python extension API if available
     */
    private async getPythonExtensionApi(): Promise<any | undefined> {
        try {
            const pythonExtension =
                vscode.extensions.getExtension('ms-python.python');
            if (!pythonExtension) {
                return undefined;
            }
            return await pythonExtension.activate();
        } catch (error) {
            Logger.debug(`🐍 ❌ Failed to activate Python extension: ${error}`);
            return undefined;
        }
    }

    /**
     * Update the currently used interpreter in the configuration
     */
    private async updateCurrentlyUsedInterpreterInConfig(
        source: EnvironmentSource
    ): Promise<void> {
        const interpreterPath = this._pythonPath;
        this._environmentSource = source;
        try {
            const config = vscode.workspace.getConfiguration(
                'scientificDataViewer.python'
            );
            const currentValue = config.get<string>(
                'currentlyInUseInterpreter',
                ''
            );

            if (currentValue !== interpreterPath) {
                await config.update(
                    'currentlyInUseInterpreter',
                    interpreterPath,
                    vscode.ConfigurationTarget.Workspace
                );
                Logger.info(
                    `🐍 📝 Updated currently used interpreter: ${interpreterPath} (source: ${source})`
                );
            }
        } catch (error) {
            Logger.warn(
                `🐍 ⚠️ Failed to update currently used interpreter: ${error}`
            );
        }
    }
}
