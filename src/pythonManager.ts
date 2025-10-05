import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from './logger';
import { DataViewerPanel } from './dataViewerPanel';
import { VirtualEnvironmentManager, VirtualEnvironment } from './virtualEnvironmentManager';
import { ExtensionVirtualEnvironmentManager } from './extensionVirtualEnvironmentManager';

export class PythonManager {
    private pythonPath: string | undefined = undefined;
    private isInitialized: boolean = false;
    private initializationPromise: Promise<void> | null = null;

    constructor(private readonly virtualEnvManager: VirtualEnvironmentManager, private readonly extensionEnvManager: ExtensionVirtualEnvironmentManager) {
    }

    async _initialize(): Promise<void> {
        // If initialization is already in progress, wait for it to complete
        if (this.initializationPromise) {
            Logger.debug(
                '🐍 ⏳ Python initialization already in progress, waiting...'
            );
            return this.initializationPromise;
        }

        // Start initialization and store the promise
        this.initializationPromise = this._doInitialize();
        return this.initializationPromise;
    }

    private async _doInitialize(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('scientificDataViewer');
            
            // Check if extension environment is enabled
            const useExtensionEnv = config.get<boolean>('useExtensionEnvironment', false);
            if (useExtensionEnv) {
                Logger.info('🐍 🔧 Using extension virtual environment');
                
                if (this.extensionEnvManager.isReady()) {
                    this.pythonPath = this.extensionEnvManager.getPythonPath()!;
                    this.isInitialized = false;
                    await this.validatePythonEnvironment();
                    return;
                } else {
                    // Try to create the extension environment
                    const created = await this.extensionEnvManager.createExtensionEnvironment();
                    if (created && this.extensionEnvManager.isReady()) {
                        this.pythonPath = this.extensionEnvManager.getPythonPath()!;
                        this.isInitialized = false;
                        await this.validatePythonEnvironment();
                        return;
                    } else {
                        Logger.warn('🐍 ⚠️ Failed to create extension environment, falling back to other options');
                    }
                }
            }

            // First, check if there's a configured Python interpreter in settings
            const settingsInterpreter = this.virtualEnvManager.getCurrentInterpreterFromSettings();
            if (settingsInterpreter) {
                Logger.info(`🐍 🔧 Using configured Python interpreter: ${settingsInterpreter}`);
                this.pythonPath = settingsInterpreter;
                this.isInitialized = false;
                await this.validatePythonEnvironment();
                return;
            }

            // Check if auto-detection is enabled
            const autoDetect = config.get<boolean>('autoDetectVirtualEnvironments', true);
            
            if (autoDetect) {
                // Try to find and use a virtual environment
                const virtualEnvs = await this.virtualEnvManager.detectVirtualEnvironments();
                const bestEnv = this.virtualEnvManager.getBestEnvironment();
                
                if (bestEnv) {
                    Logger.info(`🐍 🔍 Found virtual environment: ${bestEnv.name} (${bestEnv.type}) at ${bestEnv.pythonPath}`);
                    this.pythonPath = bestEnv.pythonPath;
                    this.isInitialized = false;
                    await this.validatePythonEnvironment();
                    return;
                }
            }

            // Fall back to Python extension API (original behavior)
            const newPythonPath = await this.getPythonInterpreterFromExtension();

            if (newPythonPath && newPythonPath !== this.pythonPath) {
                Logger.info(
                    `🐍 🔀 Python interpreter changed from ${this.pythonPath} to ${newPythonPath}`
                );
                this.pythonPath = newPythonPath;
                // Reset initialization state when interpreter changes
                this.isInitialized = false;
            }

            if (this.pythonPath) {
                await this.validatePythonEnvironment();
            } else {
                await this.findPythonInterpreter();
            }
        } finally {
            // Clear the initialization promise when done
            this.initializationPromise = null;
        }
    }

    private async getPythonInterpreterFromExtension(): Promise<
        string | undefined
    > {
        try {
            const pythonExtension =
                vscode.extensions.getExtension('ms-python.python');
            if (!pythonExtension) {
                Logger.error('🐍 ❌ Python extension not found');
                return undefined;
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
                .get('defaultInterpreterPath') as string | undefined;
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

        return undefined;
    }

    private async findPythonInterpreter(): Promise<void> {
        // Try to get interpreter from Python extension API first
        const extensionPath = await this.getPythonInterpreterFromExtension();
        if (extensionPath) {
            this.pythonPath = extensionPath;
            // Validate the found interpreter
            await this.validatePythonEnvironment();
            return;
        }

        // Fallback: Common Python paths to check
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
                    this.pythonPath = pythonPath;
                    // Validate the found interpreter
                    await this.validatePythonEnvironment();
                    return;
                }
            } catch (error) {
                // Ignore errors for individual paths
            }
        }

        vscode.window.showWarningMessage(
            'No suitable Python interpreter found. Please install Python and use VSCode\'s "Python: Select Interpreter" command.'
        );
    }

    private async getPythonVersion(pythonPath: string): Promise<string | null> {
        return new Promise((resolve) => {
            const process = spawn(pythonPath, ['--version'], { shell: true });
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

    public async checkRequiredPackages(pythonPath: string): Promise<string[]> {
        Logger.debug(`🐍 🔍 Checking required packages`);

        // Core packages required for basic functionality
        const corePackages = ['xarray', 'matplotlib'];
        // Additional packages for extended format support
        const extendedPackages = [
            'netCDF4',
            'h5netcdf',
            'zarr',
            'h5py',
            'scipy',
            'cfgrib',
            'rioxarray',
            'xarray-sentinel',
        ];
        const allPackages = [...corePackages, ...extendedPackages];
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

    public async checkPackageAvailability(
        pythonPath: string,
        packageName: string
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const args = [
                '-c',
                `"from importlib.util import find_spec; exit(1 if find_spec('${packageName}') is None else 0)"`,
            ];
            const process = spawn(pythonPath, args, { shell: true });

            process.on('close', (code) => {
                resolve(code === 0);
            });

            process.on('error', (error) => {
                resolve(false);
            });
        });
    }

    private async checkPipAvailability(): Promise<void> {
        if (!this.pythonPath) {
            throw new Error('No Python interpreter configured');
        }

        return new Promise((resolve, reject) => {
            const process = spawn(
                this.pythonPath!,
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

    private async validatePythonEnvironment(): Promise<void> {
        this.isInitialized = false;

        Logger.info(
            `🐍 🛡️ validatePythonEnvironment: Validating Python environment. Is initialized: ${this.isInitialized} | Python path: ${this.pythonPath}`
        );

        if (!this.pythonPath) {
            throw new Error('No Python interpreter configured');
        }

        try {
            const packages = await this.checkRequiredPackages(this.pythonPath);
            const corePackages = ['xarray', 'matplotlib'];
            const missingCorePackages = corePackages.filter(
                (pkg) => !packages.includes(pkg)
            );

            // Only require core packages for basic functionality
            const missingPackages = missingCorePackages;

            if (missingPackages.length > 0) {
                this.promptToInstallRequiredPackages(missingPackages);
            } else {
                this.isInitialized = true;
                // Don't show notification during initialization - only when interpreter changes
                Logger.info(
                    `🐍 📦 ✅ Python environment ready! Using interpreter: ${this.pythonPath}`
                );
            }
        } catch (error) {
            Logger.error(
                `🐍 📦 ❌ Python environment validation failed: ${error}`
            );
            vscode.window.showErrorMessage(
                `Failed to validate Python environment: ${error}`
            );
        }
    }

    private async installPackages(packages: string[]): Promise<void> {
        if (!this.pythonPath) {
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
                )} using Python: ${this.pythonPath}`
            );
            Logger.debug(`🐍 📦 🔍 Working directory: ${process.cwd()}`);
            Logger.debug(`🐍 📦 🔍 Environment PATH: ${process.env.PATH}`);

            const pipProcess = spawn(
                this.pythonPath!,
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
                    this.isInitialized = true;
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
                            this.pythonPath
                        } -m pip install --user ${packages.join(' ')}`;
                    } else if (stderr.includes('No module named pip')) {
                        errorMessage += `\n\n💡 Troubleshooting: pip is not installed. Try installing pip first or use a different Python interpreter.`;
                    } else if (stderr.includes('Could not find a version')) {
                        errorMessage += `\n\n💡 Troubleshooting: Package version not found. Try updating pip:\n${this.pythonPath} -m pip install --upgrade pip`;
                    } else if (
                        stderr.includes('SSL') ||
                        stderr.includes('certificate')
                    ) {
                        errorMessage += `\n\n💡 Troubleshooting: SSL/Certificate issue. Try:\n${
                            this.pythonPath
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
                    errorMessage += `\n\n💡 Troubleshooting: Python interpreter not found at: ${this.pythonPath}`;
                    errorMessage += `\nPlease check your Python installation and try selecting a different interpreter.`;
                }

                reject(new Error(errorMessage));
            });
        });
    }

    async executePythonScript(
        script: string,
        args: string[] = []
    ): Promise<any> {
        if (!this.pythonPath || !this.isInitialized) {
            throw new Error(
                'Python environment not properly initialized. Please run "Python: Select Interpreter" command first.'
            );
        }

        Logger.log(
            `🐍 📦 📜 executePythonScript: Executing Python script with args: ${args} | Python path: ${this.pythonPath} | Is initialized: ${this.isInitialized}`
        );

        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonPath!, ['-c', script, ...args], {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

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
                            `Python interpreter not found at: ${this.pythonPath}. Please check your Python installation.`
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

    async executePythonFile(
        scriptPath: string,
        args: string[] = [],
        enableLogs: boolean = false
    ): Promise<any> {
        if (!this.pythonPath || !this.isInitialized) {
            throw new Error(
                'Python environment not properly initialized. Please run "Python: Select Interpreter" command first.'
            );
        }

        const methodName = enableLogs
            ? 'executePythonFileWithLogs'
            : 'executePythonFile';
        Logger.log(
            `🐍 📜 ${methodName}: Executing Python file ${scriptPath} with args: ${args} | Python path: ${this.pythonPath} | Is initialized: ${this.isInitialized}`
        );

        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonPath!, [scriptPath, ...args], {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

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
                            `Python interpreter not found at: ${this.pythonPath}. Please check your Python installation.`
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

    getPythonPath(): string | undefined {
        return this.pythonPath;
    }

    hasPythonPath(): boolean {
        return this.pythonPath !== undefined;
    }

    isReady(): boolean {
        return this.isInitialized && this.hasPythonPath();
    }

    getCurrentPythonPath(): string | undefined {
        return this.pythonPath;
    }

    async forceInitialize(): Promise<void> {
        Logger.info('🐍 🔄 Force initializing Python environment...');
        this.isInitialized = false;
        this.initializationPromise = null; // Reset any existing initialization
        await this._initialize();
    }

    /**
     * Wait for Python initialization to complete
     * This method should be called before any file operations to prevent race conditions
     */
    async waitForInitialization(): Promise<void> {
        if (this.initializationPromise) {
            Logger.debug(
                '🐍 ⏳ Waiting for Python initialization to complete...'
            );
            await this.initializationPromise;
        }
    }

    async getCurrentInterpreterPath(): Promise<string | undefined> {
        return await this.getPythonInterpreterFromExtension();
    }

    /**
     * Get the resolved environment details for the current Python interpreter
     * This provides complete environment information including executable path, environment variables, etc.
     */
    async getResolvedEnvironment(): Promise<any | undefined> {
        try {
            const pythonExtension =
                vscode.extensions.getExtension('ms-python.python');
            if (!pythonExtension) {
                Logger.error('🐍 ❌ Python extension not found');
                return undefined;
            }

            const pythonApi = await pythonExtension.activate();
            if (!pythonApi || !pythonApi.environments) {
                Logger.warn(
                    '🐍 ⚠️ Python extension API or environments API not available'
                );
                return undefined;
            }

            // Get the active environment path first
            if (
                typeof pythonApi.environments.getActiveEnvironmentPath ===
                'function'
            ) {
                try {
                    const activeEnvironmentPath =
                        await pythonApi.environments.getActiveEnvironmentPath();
                    if (activeEnvironmentPath && activeEnvironmentPath.path) {
                        // Resolve the environment to get complete details
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
                                return resolvedEnvironment;
                            } catch (resolveError) {
                                Logger.warn(
                                    `🐍 ⚠️ Environment resolution failed: ${resolveError}`
                                );
                                return undefined;
                            }
                        } else {
                            Logger.debug(
                                '🐍 ⚠️ resolveEnvironment not available'
                            );
                            return undefined;
                        }
                    }
                } catch (envError) {
                    Logger.warn(
                        `🐍 ⚠️ Failed to get active environment path: ${envError}`
                    );
                    return undefined;
                }
            }

            return undefined;
        } catch (error) {
            Logger.warn(`🐍 ⚠️ Could not get resolved environment: ${error}`);
            return undefined;
        }
    }

    /**
     * Check if the Python extension is available and active
     */
    private isPythonExtensionAvailable(): boolean {
        const pythonExtension =
            vscode.extensions.getExtension('ms-python.python');
        return pythonExtension !== undefined;
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

    async promptToInstallRequiredPackages(
        missingPackages: string[]
    ): Promise<void> {
        const action = await vscode.window.showWarningMessage(
            `You are using the Python interpreter at ${
                this.pythonPath
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
                vscode.window.showErrorMessage(
                    `Package installation failed: ${errorMessage}`
                );
                throw error;
            }
        } else {
            // User cancelled installation, but we still have a valid Python interpreter
            // Set as initialized so the extension can work with what's available
            Logger.info(
                `🐍 📦 ⚠️ Python environment ready (with missing packages)! Using interpreter: ${this.pythonPath}`
            );
        }
    }

    async promptToInstallPackagesForFormat(
        format: string,
        missingPackages: string[]
    ): Promise<void> {
        const action = await vscode.window.showWarningMessage(
            `You are using the Python interpreter at ${
                this.pythonPath
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
                vscode.window.showErrorMessage(
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

    /**
     * Get the virtual environment manager
     */
    getVirtualEnvironmentManager(): VirtualEnvironmentManager {
        return this.virtualEnvManager;
    }

    /**
     * Get the extension virtual environment manager
     */
    getExtensionEnvironmentManager(): ExtensionVirtualEnvironmentManager {
        return this.extensionEnvManager;
    }

    /**
     * Select a Python interpreter from detected virtual environments
     */
    async selectPythonInterpreter(): Promise<void> {
        try {
            const selectedEnv = await this.virtualEnvManager.showEnvironmentSelector();
            if (selectedEnv) {
                await this.virtualEnvManager.setPythonInterpreter(selectedEnv.pythonPath);
                this.pythonPath = selectedEnv.pythonPath;
                this.isInitialized = false;
                await this.validatePythonEnvironment();
                
                vscode.window.showInformationMessage(
                    `Selected Python interpreter: ${selectedEnv.name} (${selectedEnv.type})`
                );
            }
        } catch (error) {
            Logger.error(`🐍 ❌ Failed to select Python interpreter: ${error}`);
            vscode.window.showErrorMessage(`Failed to select Python interpreter: ${error}`);
        }
    }

    /**
     * Detect virtual environments in the workspace
     */
    async detectVirtualEnvironments(): Promise<void> {
        try {
            const environments = await this.virtualEnvManager.detectVirtualEnvironments();
            
            if (environments.length === 0) {
                vscode.window.showInformationMessage('No virtual environments found in the workspace.');
                return;
            }

            const validEnvs = environments.filter(env => env.isValid);
            const invalidEnvs = environments.filter(env => !env.isValid);

            let message = `Found ${environments.length} virtual environment(s):\n\n`;
            
            if (validEnvs.length > 0) {
                message += `✅ Valid environments (${validEnvs.length}):\n`;
                for (const env of validEnvs) {
                    message += `  | ${env.name} (${env.type}) - ${env.packages?.length || 0} packages\n`;
                }
            }

            if (invalidEnvs.length > 0) {
                message += `\n❌ Invalid environments (${invalidEnvs.length}):\n`;
                for (const env of invalidEnvs) {
                    message += `  | ${env.name} (${env.type}) - Invalid Python interpreter\n`;
                }
            }

            message += ` | Use "Select Python Interpreter" to choose an environment.`;

            vscode.window.showInformationMessage(message, "OK");
        } catch (error) {
            Logger.error(`🐍 ❌ Failed to detect virtual environments: ${error}`);
            vscode.window.showErrorMessage(`Failed to detect virtual environments: ${error}`);
        }
    }

    /**
     * Reset to use the Python extension's default interpreter
     */
    async resetPythonInterpreter(): Promise<void> {
        try {
            await this.virtualEnvManager.resetPythonInterpreter();
            this.pythonPath = undefined;
            this.isInitialized = false;
            await this.forceInitialize();
            
            vscode.window.showInformationMessage('Reset to use Python extension\'s default interpreter.');
        } catch (error) {
            Logger.error(`🐍 ❌ Failed to reset Python interpreter: ${error}`);
            vscode.window.showErrorMessage(`Failed to reset Python interpreter: ${error}`);
        }
    }

    /**
     * Get information about the current Python environment
     */
    async getCurrentEnvironmentInfo(): Promise<{ type: string; path: string; packages: string[] } | undefined> {
        if (!this.pythonPath) {
            return undefined;
        }

        // Check if current interpreter is from the extension environment
        const extensionEnv = this.extensionEnvManager.getExtensionEnvironment();
        if (extensionEnv && this.pythonPath === extensionEnv.pythonPath) {
            return {
                type: 'extension',
                path: extensionEnv.path,
                packages: extensionEnv.packages || []
            };
        }

        // Check if current interpreter is from a detected virtual environment
        const detectedEnvs = this.virtualEnvManager.getDetectedEnvironments();
        const currentEnv = detectedEnvs.find(env => env.pythonPath === this.pythonPath);
        
        if (currentEnv) {
            return {
                type: currentEnv.type,
                path: currentEnv.path,
                packages: currentEnv.packages || []
            };
        }

        // If not from a detected environment, get basic info
        try {
            const packages = await this.virtualEnvManager.getInstalledPackages(this.pythonPath);
            return {
                type: 'system',
                path: this.pythonPath,
                packages: packages
            };
        } catch (error) {
            Logger.debug(`🐍 Could not get environment info: ${error}`);
            return {
                type: 'unknown',
                path: this.pythonPath,
                packages: []
            };
        }
    }

    /**
     * Create the extension virtual environment
     */
    async createExtensionEnvironment(): Promise<void> {
        try {
            Logger.info('🔧 Creating extension virtual environment...');
            const created = await this.extensionEnvManager.createExtensionEnvironment();
            
            if (created) {
                // Update the configuration to use the extension environment
                const config = vscode.workspace.getConfiguration('scientificDataViewer');
                await config.update('useExtensionEnvironment', true, vscode.ConfigurationTarget.Workspace);
                
                // Update the Python path and reinitialize
                this.pythonPath = this.extensionEnvManager.getPythonPath()!;
                this.isInitialized = false;
                await this.validatePythonEnvironment();
                
                vscode.window.showInformationMessage(
                    '✅ Extension virtual environment created successfully! The extension will now use its own isolated environment.'
                );
            } else {
                vscode.window.showErrorMessage(
                    '❌ Failed to create extension virtual environment. Please check the logs for details.'
                );
            }
        } catch (error) {
            Logger.error(`🔧 ❌ Failed to create extension environment: ${error}`);
            vscode.window.showErrorMessage(`Failed to create extension environment: ${error}`);
        }
    }

    /**
     * Manage the extension virtual environment
     */
    async manageExtensionEnvironment(): Promise<void> {
        try {
            const envInfo = this.extensionEnvManager.getEnvironmentInfo();
            
            if (!envInfo.isCreated) {
                const action = await vscode.window.showInformationMessage(
                    'Extension virtual environment not found. Would you like to create one?',
                    'Create Environment',
                    'Cancel'
                );
                
                if (action === 'Create Environment') {
                    await this.createExtensionEnvironment();
                }
                return;
            }

            const sizeText = envInfo.size ? this.extensionEnvManager.formatBytes(envInfo.size) : 'Unknown';
            const lastUpdated = envInfo.lastUpdated.toLocaleString();
            
            const toolUsed = (envInfo as any).createdWithUv ? 'uv (Python 3.13)' : 'Python venv';
            const message = `Extension Virtual Environment Status:

📁 Path: ${envInfo.path}
🐍 Python: ${envInfo.pythonPath}
🔧 Created with: ${toolUsed}
📦 Packages: ${envInfo.packages.length} installed
💾 Size: ${sizeText}
📅 Last Updated: ${lastUpdated}
✅ Status: ${envInfo.isInitialized ? 'Ready' : 'Not Initialized'}

What would you like to do?`;

            const action = await vscode.window.showInformationMessage(
                message,
                'Update Packages',
                'Delete Environment',
                'Open in Explorer',
                'Cancel'
            );

            switch (action) {
                case 'Update Packages':
                    await this.updateExtensionEnvironmentPackages();
                    break;
                case 'Delete Environment':
                    await this.deleteExtensionEnvironment();
                    break;
                case 'Open in Explorer':
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(envInfo.path));
                    break;
            }
        } catch (error) {
            Logger.error(`🔧 ❌ Failed to manage extension environment: ${error}`);
            vscode.window.showErrorMessage(`Failed to manage extension environment: ${error}`);
        }
    }

    /**
     * Update packages in the extension virtual environment
     */
    async updateExtensionEnvironmentPackages(): Promise<void> {
        try {
            Logger.info('📦 Updating extension environment packages...');
            const updated = await this.extensionEnvManager.updatePackages();
            
            if (updated) {
                vscode.window.showInformationMessage('✅ Extension environment packages updated successfully!');
            } else {
                vscode.window.showErrorMessage('❌ Failed to update extension environment packages.');
            }
        } catch (error) {
            Logger.error(`📦 ❌ Failed to update extension environment packages: ${error}`);
            vscode.window.showErrorMessage(`Failed to update packages: ${error}`);
        }
    }

    /**
     * Delete the extension virtual environment
     */
    async deleteExtensionEnvironment(): Promise<void> {
        try {
            const action = await vscode.window.showWarningMessage(
                'Are you sure you want to delete the extension virtual environment? This action cannot be undone.',
                'Delete',
                'Cancel'
            );
            
            if (action === 'Delete') {
                Logger.info('🗑️ Deleting extension virtual environment...');
                const deleted = await this.extensionEnvManager.deleteExtensionEnvironment();
                
                if (deleted) {
                    // Reset to use other environments
                    const config = vscode.workspace.getConfiguration('scientificDataViewer');
                    await config.update('useExtensionEnvironment', false, vscode.ConfigurationTarget.Workspace);
                    
                    // Reinitialize with other options
                    this.pythonPath = undefined;
                    this.isInitialized = false;
                    await this.forceInitialize();
                    
                    vscode.window.showInformationMessage('✅ Extension virtual environment deleted successfully!');
                } else {
                    vscode.window.showErrorMessage('❌ Failed to delete extension virtual environment.');
                }
            }
        } catch (error) {
            Logger.error(`🗑️ ❌ Failed to delete extension environment: ${error}`);
            vscode.window.showErrorMessage(`Failed to delete extension environment: ${error}`);
        }
    }

    /**
     * Set up event listeners for Python environment changes and creation
     * Returns a disposable that should be disposed when the extension is deactivated
     */
    async setupEnvironmentChangeListeners(
        onInterpreterChange: () => Promise<void>,
        onEnvironmentCreated: (environment: any) => Promise<void>
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
                    '🐍 🔧 Setting up Python interpreter change listener...'
                );

                const interpreterDisposable =
                    pythonApi.environments.onDidChangeActiveEnvironmentPath(
                        async (event: any) => {
                            Logger.info(
                                `🐍 🔔 Python interpreter changed: ${
                                    event?.path || 'undefined'
                                }`
                            );
                            await onInterpreterChange();
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
                    '🐍 🔧 Setting up Python environment change listener...'
                );

                const environmentDisposable =
                    pythonApi.environments.onDidEnvironmentsChanged(
                        async (event: any) => {
                            // Add comprehensive debugging
                            Logger.debug(
                                `🐍 🔍 Environment change event received: ${JSON.stringify(
                                    event,
                                    null,
                                    2
                                )}`
                            );

                            // Handle newly created environments
                            if (event.added && event.added.length > 0) {
                                Logger.info(
                                    `🐍 🆕 New Python environments created: ${event.added.length}`
                                );
                                for (const env of event.added) {
                                    Logger.info(
                                        `🐍 🆕 New environment: ${
                                            env.path || env.id || 'unknown'
                                        }`
                                    );
                                    await onEnvironmentCreated(env);
                                }
                            }

                            // Handle removed environments
                            if (event.removed && event.removed.length > 0) {
                                Logger.info(
                                    `🐍 🗑️ Python environments removed: ${event.removed.length}`
                                );
                                for (const env of event.removed) {
                                    Logger.info(
                                        `🐍 🗑️ Removed environment: ${
                                            env.path || env.id || 'unknown'
                                        }`
                                    );
                                }
                            }

                            // Handle updated environments
                            if (event.updated && event.updated.length > 0) {
                                Logger.info(
                                    `🐍 🔄 Python environments updated: ${event.updated.length}`
                                );
                                for (const env of event.updated) {
                                    Logger.info(
                                        `🐍 🔄 Updated environment: ${
                                            env.path || env.id || 'unknown'
                                        }`
                                    );
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
}
