import { spawn, ChildProcess } from 'child_process';
import { Logger } from '../common/Logger';
import { ExtensionVirtualEnvironmentManager } from './ExtensionVirtualEnvironmentManager';
import { quoteIfNeeded } from '../common/utils';
import { showErrorMessage } from '../common/vscodeutils';
import { getPythonInterpreterFromPythonExtension } from './officialPythonExtensionApiUtils';
import {
    getOverridePythonInterpreter,
    getUseExtensionOwnEnvironment,
} from '../common/config';
import { EnvironmentInfo, EnvironmentSource } from '../types';
import path from 'path';

/**
 * Represents an active Python process that can be tracked and aborted
 */
interface ActiveProcess {
    process: ChildProcess;
    operationId: string;
    startTime: number;
    timeoutHandle?: NodeJS.Timeout; // Server-side timeout handle
}

/**
 * Flag to control the creation of the extension own virtual environment
 * Indeed, we might want the uv environment creation to be handled by the user (via command only)
 * However, having an automatic installation attempt is useful to ensure that the extension works out of the box
 * It is written in this way to be able to easily change it in the future
 */
const ATTEMPT_CREATING_EXTENSION_OWN_UV_ENVIRONMENT = true;

/**
 * Enum to represent the source of the Python environment
 * - override: The user has set an override Python interpreter when set
 *   via python section config: overridePythonInterpreter
 * - own-uv-env: The extension has created its own virtual environment with uv
 *   when python section config: useExtensionOwnEnvironment = true
 * - python-extension: The Python extension has created the environment
 *   when python section config: useExtensionOwnEnvironment = false
 * - system: The system Python interpreter is used (default behaviour)
 */

/**
 * Class to manage the Python environment
 * It is responsible for:
 * - Initializing the Python environment
 * - Validating the Python environment
 * - Installing required packages
 * - Updating the currently used interpreter in the configuration
 * - Getting the current environment info
 * - Setting up event listeners for Python environment changes and creation
 * - Executing Python files
 * - Checking package availability
 */
export class PythonManager {
    private _pythonPath: string | null = null;
    private _initialized: boolean = false;
    private _initializationPromise: Promise<void> | null = null;
    private _environmentSource: EnvironmentSource | null = null;
    private _corePackagesInstalled: boolean = false;

    // Track active processes for timeout/abort handling
    private _activeProcesses: Map<string, ActiveProcess> = new Map();

    // Core packages required for basic functionality
    private readonly corePackages = ['xarray'];
    private readonly plotPackages = ['matplotlib'];
    // Additional packages for extended format support
    private readonly extendedPackages = [
        'netCDF4',
        'h5netcdf',
        'zarr',
        'h5py',
        'scipy',
        'cfgrib',
        'rioxarray',
        'cdflib',
    ];

    constructor(
        private readonly extensionEnvManager: ExtensionVirtualEnvironmentManager,
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
        return (
            this._initialized &&
            this._pythonPath !== null &&
            this._corePackagesInstalled
        );
    }

    /**
     * Wait for Python initialization to complete
     * This method should be called before any file operations to prevent race conditions
     */
    async waitForInitialization(): Promise<void> {
        if (this._initializationPromise) {
            Logger.debug(
                '🐍 ⏳ Waiting for Python initialization to complete...',
            );
            await this._initializationPromise;
        }
    }

    /**
     * Force initialize the Python environment
     */
    async forceInitialize(): Promise<void> {
        Logger.info('🐍 🔄 Force initializing Python environment...');
        this._initializationPromise = null; // Reset any existing initialization
        await this.initializeIfNotInitializing();
    }

    /**
     * Execute a Python file
     * @param scriptPath    The path to the Python file
     * @param args          The arguments to pass to the Python file
     * @param enableLogs    Whether to enable logs
     * @param operationId   Optional ID to track this operation for abort support
     * @param timeoutMs     Optional server-side timeout in milliseconds (default: no timeout)
     *                      This timeout is independent of the webview and will kill the process
     *                      even if the webview is closed.
     * @returns             The result of the Python file
     */
    async executePythonFile(
        scriptPath: string,
        args: string[] = [],
        enableLogs: boolean = false,
        operationId?: string,
        timeoutMs?: number,
    ): Promise<any> {
        if (!this._initialized) {
            throw new Error(
                'Python environment not properly initialized. Please run "Python: Select Interpreter" command first.',
            );
        }

        if (this._pythonPath === null) {
            throw new Error(
                'Python path is not set. Please run "Python: Select Interpreter" command first.',
            );
        }

        return await this.executePythonFileUnchecked(
            this._pythonPath,
            scriptPath,
            args,
            enableLogs,
            operationId,
            timeoutMs,
        );
    }

    private async executePythonFileUnchecked(
        pythonPath: string,
        scriptPath: string,
        args: string[],
        enableLogs: boolean,
        operationId?: string,
        timeoutMs?: number,
    ) {
        const quotedPythonPath = quoteIfNeeded(pythonPath);
        Logger.log(
            `🐍 📜 Executing Python file ${scriptPath} with args: [${args.join(' ')}]`,
        );
        Logger.info(
            `🐍 📜 - ${
                enableLogs ? 'With logs handover' : 'Without logs handover'
            }`,
        );
        Logger.info(
            `🐍 📜 - Provided Python path for script execution: ${quotedPythonPath}`,
        );
        Logger.info(`🐍 📜 - Is initialized: ${this._initialized}`);
        if (operationId) {
            Logger.info(`🐍 📜 - Operation ID: ${operationId}`);
        }
        const fullCommand = [quotedPythonPath, scriptPath, ...args].join(' ');
        Logger.info(`🐍 📜 Full command (copy-paste): ${fullCommand}`);

        return new Promise((resolve, reject) => {
            // Use detached: true so we can kill the entire process group
            // This is important because shell: true spawns a shell that then spawns Python
            // Without detached: true, killing the shell leaves Python as an orphan process
            // -u: unbuffered stdout/stderr so tracebacks and errors are visible when piped (exit code 1)
            const childProcess = spawn(
                quotedPythonPath,
                ['-u', scriptPath, ...args],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    detached: true,
                },
            );

            // Track this process if an operation ID was provided
            let serverTimeoutHandle: NodeJS.Timeout | undefined;
            if (operationId) {
                const activeProcess: ActiveProcess = {
                    process: childProcess,
                    operationId,
                    startTime: Date.now(),
                };

                // Set up server-side timeout if specified
                // This timeout is independent of the webview and will kill the process
                // even if the user closes the tab
                if (timeoutMs && timeoutMs > 0) {
                    serverTimeoutHandle = setTimeout(() => {
                        Logger.warn(
                            `🐍 ⏰ Server-side timeout (${timeoutMs}ms) reached for operation: ${operationId}`,
                        );
                        this.abortProcess(operationId);
                    }, timeoutMs);
                    activeProcess.timeoutHandle = serverTimeoutHandle;
                    Logger.debug(
                        `🐍 📜 Server-side timeout set: ${timeoutMs}ms for operation: ${operationId}`,
                    );
                }

                this._activeProcesses.set(operationId, activeProcess);
                Logger.debug(
                    `🐍 📜 Tracking process for operation: ${operationId} (PID: ${childProcess.pid})`,
                );
            }

            let stdout = '';
            let stderr = '';

            childProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            childProcess.stderr.on('data', (data) => {
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
                                Logger.info(`🐍 📜 [Python] [INFO] ${message}`);
                            }
                        } else if (line.includes(' - ERROR - ')) {
                            const message = line.split(' - ERROR - ')[1];
                            if (message) {
                                Logger.error(
                                    `🐍 📜 [Python] [ERROR] ${message}`,
                                );
                            }
                        } else if (line.includes(' - WARNING - ')) {
                            const message = line.split(' - WARNING - ')[1];
                            if (message) {
                                Logger.warn(
                                    `🐍 📜 [Python] [WARNING] ${message}`,
                                );
                            }
                        } else if (line.includes(' - DEBUG - ')) {
                            const message = line.split(' - DEBUG - ')[1];
                            if (message) {
                                Logger.debug(
                                    `🐍 📜 [Python] [DEBUG] ${message}`,
                                );
                            }
                        } else if (line.trim()) {
                            // Any other stderr output that doesn't match the log format
                            Logger.info(`🐍 📜 [Python] ${line.trim()}`);
                        }
                    });
                }
            });

            childProcess.on('close', (code, signal) => {
                // Clear server-side timeout if it exists
                if (serverTimeoutHandle) {
                    clearTimeout(serverTimeoutHandle);
                }

                // Remove from active processes tracking
                if (operationId) {
                    const activeProcess =
                        this._activeProcesses.get(operationId);
                    if (activeProcess?.timeoutHandle) {
                        clearTimeout(activeProcess.timeoutHandle);
                    }
                    this._activeProcesses.delete(operationId);
                    Logger.debug(
                        `🐍 📜 Process completed for operation: ${operationId} (code: ${code}, signal: ${signal})`,
                    );
                }

                // Check if this process was killed/aborted
                if (signal === 'SIGTERM' || signal === 'SIGKILL') {
                    reject(
                        new Error(
                            `Process was aborted (signal: ${signal}). This usually happens when a plot operation times out, or if the plot operation was cancelled by the user.`,
                        ),
                    );
                    return;
                }

                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        Logger.debug(
                            `🐍 📜 JSON parse failed for script output (stdout length=${stdout.length}): ${stdout.slice(0, 300)}`,
                        );
                        resolve(stdout);
                    }
                } else {
                    // Log so Extension Log always shows what we got (exit code 1 often = uncaught exception)
                    Logger.error(
                        `🐍 📜 Python script exited with code ${code}. Stderr (${stderr?.length ?? 0} chars):\n${stderr || '(empty)'}`,
                    );
                    Logger.error(
                        `🐍 📜 Python script stdout (${stdout?.length ?? 0} chars):\n${stdout || '(empty)'}`,
                    );
                    const errorMessage = stderr || stdout || 'Unknown Python error';
                    // Prefer script's JSON error from stdout (e.g. Invalid --dimension-slices JSON)
                    let userMessage: string;
                    try {
                        const out = stdout?.trim();
                        if (out && (out.startsWith('{') || out.startsWith('['))) {
                            const parsed = JSON.parse(out);
                            if (
                                parsed &&
                                typeof parsed.error === 'string' &&
                                parsed.error.length > 0
                            ) {
                                userMessage = parsed.error;
                            } else {
                                userMessage =
                                    errorMessage.trim().split('\n').pop()?.trim() ||
                                    `Python script failed (exit code ${code})`;
                            }
                        } else {
                            userMessage =
                                errorMessage.trim().split('\n').pop()?.trim() ||
                                `Python script failed (exit code ${code})`;
                        }
                    } catch {
                        userMessage =
                            errorMessage.trim().split('\n').pop()?.trim() ||
                            `Python script failed (exit code ${code})`;
                    }
                    if (errorMessage.includes('ModuleNotFoundError')) {
                        reject(
                            new Error(
                                `Missing Python package: ${errorMessage}. Please install required packages with: pip install xarray netCDF4 zarr h5py numpy matplotlib`,
                            ),
                        );
                    } else if (errorMessage.includes('PermissionError')) {
                        reject(
                            new Error(
                                `Permission denied: ${errorMessage}. Please check file permissions.`,
                            ),
                        );
                    } else if (errorMessage.includes('FileNotFoundError')) {
                        reject(
                            new Error(
                                `File not found: ${errorMessage}. Please check the file path.`,
                            ),
                        );
                    } else {
                        reject(new Error(userMessage));
                    }
                }
            });

            childProcess.on('error', (error) => {
                // Clear server-side timeout if it exists
                if (serverTimeoutHandle) {
                    clearTimeout(serverTimeoutHandle);
                }

                // Remove from active processes tracking
                if (operationId) {
                    const activeProcess =
                        this._activeProcesses.get(operationId);
                    if (activeProcess?.timeoutHandle) {
                        clearTimeout(activeProcess.timeoutHandle);
                    }
                    this._activeProcesses.delete(operationId);
                }

                if (error.message.includes('ENOENT')) {
                    reject(
                        new Error(
                            `Python interpreter not found at: ${pythonPath}. Please check your Python installation.`,
                        ),
                    );
                } else {
                    reject(
                        new Error(
                            `Failed to execute Python script: ${error.message}`,
                        ),
                    );
                }
            });
        });
    }

    /**
     * Abort an active Python process by operation ID
     * @param operationId The ID of the operation to abort
     * @returns true if the process was found and killed, false otherwise
     */
    public abortProcess(operationId: string): boolean {
        const activeProcess = this._activeProcesses.get(operationId);
        if (!activeProcess) {
            Logger.warn(
                `🐍 ⚠️ No active process found for operation: ${operationId}`,
            );
            return false;
        }

        // Clear the server-side timeout if it exists
        if (activeProcess.timeoutHandle) {
            clearTimeout(activeProcess.timeoutHandle);
        }

        const { process: childProcess } = activeProcess;
        const duration = Date.now() - activeProcess.startTime;
        const pid = childProcess.pid;

        Logger.info(
            `🐍 🛑 Aborting process for operation: ${operationId} (PID: ${pid}, duration: ${duration}ms)`,
        );

        if (!pid) {
            Logger.warn(
                `🐍 ⚠️ Process PID is undefined, cannot kill: ${operationId}`,
            );
            this._activeProcesses.delete(operationId);
            return false;
        }

        try {
            // Kill the entire process group using negative PID
            // This is necessary because when shell: true is used, Node spawns a shell
            // which then spawns Python. We need to kill the entire process group
            // to ensure the Python process is also terminated.
            // The process was spawned with detached: true to make this work.
            Logger.debug(`🐍 🛑 Killing process group with SIGTERM: -${pid}`);
            process.kill(-pid, 'SIGTERM');

            // If the process doesn't terminate within 1 second, force kill with SIGKILL
            setTimeout(() => {
                if (this._activeProcesses.has(operationId)) {
                    Logger.warn(
                        `🐍 ⚠️ Process didn't terminate gracefully, force killing process group: ${operationId}`,
                    );
                    try {
                        process.kill(-pid, 'SIGKILL');
                    } catch (killError) {
                        // Process might already be dead, which is fine
                        Logger.debug(
                            `🐍 ℹ️ Force kill returned error (process may already be dead): ${killError}`,
                        );
                    }
                }
            }, 1000);

            return true;
        } catch (error) {
            Logger.error(
                `🐍 ❌ Failed to abort process ${operationId}: ${error}`,
            );
            this._activeProcesses.delete(operationId);
            return false;
        }
    }

    /**
     * Get all active operation IDs
     * @returns Array of active operation IDs
     */
    public getActiveOperations(): string[] {
        return Array.from(this._activeProcesses.keys());
    }

    /**
     * Check if an operation is currently active
     * @param operationId The ID of the operation to check
     * @returns true if the operation is active, false otherwise
     */
    public isOperationActive(operationId: string): boolean {
        return this._activeProcesses.has(operationId);
    }

    /**
     * Abort all active processes.
     * This is useful for cleanup when the extension is deactivated or when
     * a panel is disposed while operations are still running.
     * @returns The number of processes that were aborted
     */
    public abortAllProcesses(): number {
        const operationIds = Array.from(this._activeProcesses.keys());
        if (operationIds.length === 0) {
            Logger.info('🐍 🧹 No active processes to abort');
            return 0;
        }

        Logger.info(
            `🐍 🧹 Aborting all ${operationIds.length} active processes`,
        );

        let abortedCount = 0;
        for (const operationId of operationIds) {
            if (this.abortProcess(operationId)) {
                abortedCount++;
            }
        }

        Logger.info(`🐍 🧹 Aborted ${abortedCount} processes`);
        return abortedCount;
    }

    /**
     * Get information about the current Python environment
     * @returns             The current environment info
     */
    getCurrentEnvironmentInfo(): EnvironmentInfo {
        return {
            initialized: this._initialized,
            ready: this.ready, // initialized and python path is set
            source: this._environmentSource,
            path: this._pythonPath,
        };
    }

    private async initializeIfNotInitializing(): Promise<void> {
        // If initialization is already in progress, wait for it to complete
        if (this._initializationPromise) {
            Logger.debug(
                '🐍 ⏳ Python initialization already in progress, waiting...',
            );
            return this._initializationPromise;
        }

        // Start initialization and store the promise
        this._initializationPromise = this.doInitialize();
        return this._initializationPromise;
    }

    private async doInitialize(): Promise<void> {
        this._initialized = false;
        try {
            Logger.info('🐍 🔧 [INIT] Initializing Python manager');
            const overrideInterpreter = getOverridePythonInterpreter();
            const useExtensionEnv = getUseExtensionOwnEnvironment();

            // First, check if there's an override interpreter set
            if (overrideInterpreter) {
                Logger.info(
                    `🐍 🔧 Using override Python interpreter: ${overrideInterpreter}`,
                );
                await this.validatePythonEnvironment(
                    overrideInterpreter,
                    'override',
                );
                return;
            }

            // Check if extension environment is enabled
            if (useExtensionEnv) {
                Logger.info('🐍 🔧 Using extension own virtual environment');

                if (this.extensionEnvManager.ready) {
                    await this.validatePythonEnvironment(
                        this.extensionEnvManager.pythonPath,
                        'own-uv-env',
                    );
                    return;
                } else if (ATTEMPT_CREATING_EXTENSION_OWN_UV_ENVIRONMENT) {
                    // Try to create the extension environment
                    try {
                        await this.extensionEnvManager.create();
                        if (this.extensionEnvManager.ready) {
                            await this.validatePythonEnvironment(
                                this.extensionEnvManager.pythonPath,
                                'own-uv-env',
                            );
                            return;
                        }
                    } catch (error) {
                        Logger.warn(
                            '🐍 ⚠️ Failed to create extension own environment, falling back to Python extension',
                        );
                    }
                } else {
                    Logger.warn(
                        '🐍 ⚠️ Extension own environment not ready, falling back to Python extension',
                    );
                }
            }

            // Fallback: Use Python extension API (original behavior)
            const newPythonPath =
                await getPythonInterpreterFromPythonExtension();

            if (newPythonPath) {
                Logger.info(
                    `🐍 🔀 Python interpreter changed from ${this._pythonPath} to ${newPythonPath}`,
                );
                await this.validatePythonEnvironment(
                    newPythonPath,
                    'python-extension',
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
                        await this.validatePythonEnvironment(
                            pythonPath,
                            'system',
                        );
                        return;
                    }
                } catch (error) {
                    // Ignore errors for individual paths
                }
            }

            Logger.warn(
                'No suitable Python interpreter found. Please install Python and use VSCode\'s "Python: Select Interpreter" command.',
            );
        } finally {
            // Clear the initialization promise when done
            this._initializationPromise = null;
            this._initialized = true;
        }
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

    private async checkAvailablePackages(
        pythonPath: string,
    ): Promise<string[]> {
        Logger.debug(`🐍 🔍 Checking required packages`);

        const allPackages = [
            ...this.corePackages,
            ...this.plotPackages,
            ...this.extendedPackages,
        ];

        try {
            const availability = await this.checkPackagesAvailability(
                pythonPath,
                allPackages,
            );

            const availablePackages: string[] = [];
            for (const [packageName, isAvailable] of Object.entries(
                availability,
            )) {
                if (isAvailable) {
                    availablePackages.push(packageName);
                    Logger.debug(`🐍 📦 ✅ Package available: ${packageName}`);
                } else {
                    Logger.debug(
                        `🐍 📦 ⚠️ Package not available: ${packageName}`,
                    );
                }
            }

            Logger.debug(
                `🐍 📦 ℹ️ Available packages: ${availablePackages.join(', ')}`,
            );
            return availablePackages;
        } catch (error) {
            Logger.debug(`🐍 📦 ⚠️ Error checking packages: ${error}`);
            return [];
        }
    }

    /**
     * Check if packages are available using the Python script
     * @param pythonPath    The path to the Python interpreter
     * @param packageNames  The names of the packages to check
     * @returns             Dictionary mapping package names to boolean availability status
     */
    public async checkPackagesAvailability(
        pythonPath: string,
        packageNames: string[],
    ): Promise<Record<string, boolean>> {
        const scriptPath = path.join(
            __dirname,
            '../../../python/check_package_availability.py',
        );

        try {
            Logger.debug(
                `🐍 📦 🔍 Checking packages: ${packageNames.join(', ')}`,
            );

            const result = await this.executePythonFileUnchecked(
                pythonPath,
                scriptPath,
                packageNames,
                false, // Don't enable logs for package checking
            );

            // Log raw result for debugging (e.g. Issue #118: invalid response format)
            const resultType = typeof result;
            const resultPreview =
                result === null
                    ? 'null'
                    : resultType === 'string'
                      ? (result as string).slice(0, 500)
                      : JSON.stringify(result).slice(0, 500);
            Logger.debug(
                `🐍 📦 Package availability check raw result: type=${resultType}, preview=${resultPreview}`,
            );

            // The result should be a JSON object with package availability
            if (typeof result === 'object' && result !== null) {
                return result as Record<string, boolean>;
            } else {
                Logger.error(
                    `🐍 📦 Invalid package check response: expected object, got type=${resultType}, value=${resultPreview}`,
                );
                throw new Error(
                    'Invalid response format from package availability check',
                );
            }
        } catch (error) {
            Logger.error(`🐍 📦 ❌ Error checking packages: ${error}`);
            throw new Error(`Failed to check package availability: ${error}`);
        }
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
                },
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
                            }`,
                        ),
                    );
                }
            });

            process.on('error', (error) => {
                reject(
                    new Error(
                        `Failed to check pip availability: ${error.message}`,
                    ),
                );
            });
        });
    }

    private async validatePythonEnvironment(
        pythonPath: string | null,
        source: EnvironmentSource,
    ): Promise<void> {
        this._pythonPath = pythonPath;
        this._environmentSource = source;

        Logger.info(
            `🐍 🛡️ validatePythonEnvironment: Validating Python environment. Is initialized: ${this._initialized} | Python path: ${this._pythonPath}`,
        );

        if (!this._pythonPath) {
            throw new Error('No Python interpreter configured');
        }

        try {
            const packages = await this.checkAvailablePackages(
                this._pythonPath,
            );
            const missingCorePackages = this.corePackages.filter(
                (pkg) => !packages.includes(pkg),
            );

            // Only require core packages for basic functionality
            if (missingCorePackages.length === 0) {
                this._corePackagesInstalled = true;
                Logger.info(
                    `🐍 📦 ✅ Python environment ready! Using interpreter: ${this._pythonPath}`,
                );
            } else {
                this._corePackagesInstalled = false;
                Logger.info(
                    `🐍 📦 ⚠️ Python environment not ready! Missing core packages: ${missingCorePackages.join(
                        ', ',
                    )}`,
                );
            }
        } catch (error) {
            Logger.error(
                `🐍 📦 ❌ Python environment validation failed: ${error}`,
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
                `pip is not available: ${error}. Please install pip or use a different Python interpreter.`,
            );
        }

        return new Promise((resolve, reject) => {
            Logger.info(
                `🐍 📦 🔍 Installing packages: ${packages.join(
                    ', ',
                )} using Python: ${this._pythonPath}`,
            );
            Logger.debug(`🐍 📦 🔍 Working directory: ${process.cwd()}`);
            Logger.debug(`🐍 📦 🔍 Environment PATH: ${process.env.PATH}`);

            const pipProcess = spawn(
                quoteIfNeeded(this._pythonPath!),
                ['-m', 'pip', 'install', ...packages],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                },
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
                    Logger.info(
                        `Successfully installed packages: ${packages.join(
                            ', ',
                        )}`,
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
                            ' ',
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
}
