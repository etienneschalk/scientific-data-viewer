import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../common/Logger';
import {
    CORE_PACKAGES,
    EXTENDED_PACKAGES,
    ExtensionVirtualEnvironmentManager,
    formatPipInstallCommand,
    PLOT_PACKAGES,
    UvNotAvailableError,
} from './ExtensionVirtualEnvironmentManager';
import { getPythonInterpreterFromPythonExtension } from './officialPythonExtensionApiUtils';
import {
    getOverridePythonInterpreter,
    getUseExtensionOwnEnvironment,
} from '../common/config';
import { EnvironmentInfo, EnvironmentSource } from '../types';
import { PerformanceTimer } from '../common/PerformanceTimer';
import {
    formatCommandForDisplay,
    runProcess,
    RunProcessResult,
} from '../common/runProcess';

/** Timeout of the package availability check run at initialisation. */
const PACKAGE_CHECK_TIMEOUT_MS = 60_000;
/** Timeout of `python --version` / `python -m pip --version` probes. */
const PROBE_TIMEOUT_MS = 15_000;

/**
 * A Python process that can be aborted by operation ID
 */
interface ActiveProcess {
    controller: AbortController;
    startTime: number;
}

/** Interpreter chosen by an initialisation run. */
interface InterpreterState {
    pythonPath: string | null;
    source: EnvironmentSource | null;
    corePackagesInstalled: boolean;
    /** Why the environment cannot be used (null when it can) */
    notReadyReason: string | null;
    ownEnvironmentIssue: OwnEnvironmentIssue | null;
}

type SelectedInterpreter = {
    pythonPath: string;
    source: EnvironmentSource;
} | null;

/** Why the extension's own environment is not used although it is enabled. */
export interface OwnEnvironmentIssue {
    /** True when the cause is that uv is not installed. */
    uvMissing: boolean;
    message: string;
}

/**
 * Class to manage the Python environment.
 *
 * Environment sources, by priority:
 * - override: python.overridePythonInterpreter is set
 * - own-uv-env: python.useExtensionOwnEnvironment is on and the environment
 *   could be prepared (or created with uv)
 * - python-extension: interpreter selected in the official Python extension
 * - system: first working `python3` / `python` / common install path
 */
export class PythonManager {
    private _pythonPath: string | null = null;
    private _initialized: boolean = false;
    private _environmentSource: EnvironmentSource | null = null;
    private _corePackagesInstalled: boolean = false;
    private _notReadyReason: string | null =
        'Python initialisation has not run yet';
    private _ownEnvironmentIssue: OwnEnvironmentIssue | null = null;

    /** Promise of the initialisation in flight, if any. */
    private _initializationPromise: Promise<void> | null = null;
    /** Set when (re)initialisation is requested while a run is in flight. */
    private _reinitializeRequested = false;

    // Track active processes for timeout/abort handling
    private _activeProcesses: Map<string, ActiveProcess> = new Map();

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
     * Why the environment is not ready (null when it is): no interpreter, an
     * interpreter that does not run, or missing core packages.
     */
    get notReadyReason(): string | null {
        return this.ready ? null : this._notReadyReason;
    }

    /**
     * Why the last initialisation did not use the extension's own environment
     * although `useExtensionOwnEnvironment` is on (null when it is used, or
     * when the setting is off or an override interpreter takes precedence).
     */
    get ownEnvironmentIssue(): OwnEnvironmentIssue | null {
        return this._ownEnvironmentIssue;
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
     * (Re)initialize the Python environment.
     *
     * Single flight: when a run is already in flight, one more run is queued
     * after it (requests made meanwhile are coalesced into that run) and the
     * returned promise settles once the queued run is done. Only the latest
     * run commits its result, so a slow, outdated run never overwrites a
     * newer one.
     */
    forceInitialize(): Promise<void> {
        Logger.info('🐍 🔄 Initializing Python environment...');
        if (this._initializationPromise) {
            Logger.debug(
                '🐍 ⏳ Initialization in flight, scheduling one more run after it',
            );
            this._reinitializeRequested = true;
            return this._initializationPromise;
        }
        // Deferred start: the promise is stored before any run code executes,
        // so a refresh requested synchronously from within a run is queued.
        const run = Promise.resolve()
            .then(() => this.runInitializations())
            .finally(() => {
                this._initializationPromise = null;
            });
        this._initializationPromise = run;
        return run;
    }

    private async runInitializations(): Promise<void> {
        do {
            this._reinitializeRequested = false;
            const state = await this.resolveInterpreterState();
            if (this._reinitializeRequested) {
                Logger.debug(
                    '🐍 ⏭️ Discarding outdated initialization result (a newer run is queued)',
                );
                continue;
            }
            this._pythonPath = state.pythonPath;
            this._environmentSource = state.source;
            this._corePackagesInstalled = state.corePackagesInstalled;
            this._notReadyReason = state.notReadyReason;
            this._ownEnvironmentIssue = state.ownEnvironmentIssue;
            this._initialized = true;
            Logger.info(
                state.pythonPath
                    ? `🐍 📦 ${state.corePackagesInstalled ? '✅ Python environment ready' : `⚠️ Python environment not ready (${state.notReadyReason})`}: ${state.pythonPath} (${state.source})`
                    : '🐍 ⚠️ No suitable Python interpreter found. Please install Python and use VSCode\'s "Python: Select Interpreter" command.',
            );
        } while (this._reinitializeRequested);
    }

    /**
     * Execute a Python file
     * @param scriptPath    The path to the Python file
     * @param args          The arguments to pass to the Python file
     * @param enableLogs    Whether to forward the script's stderr logs to the Logger
     * @param operationId   Optional ID to track this operation for abort support
     * @param timeoutMs     Optional server-side timeout in milliseconds (default: no timeout).
     *                      The process is stopped when it elapses, with or without operationId,
     *                      even if the webview is closed.
     * @returns             The JSON value printed by the script on stdout
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

        const timer = new PerformanceTimer(
            `python-exec:${path.basename(scriptPath)}`,
        );
        timer.mark('start');
        try {
            return await this.runPythonScript(
                this._pythonPath,
                scriptPath,
                args,
                enableLogs,
                operationId,
                timeoutMs,
            );
        } finally {
            timer.finish('spawn');
        }
    }

    private async runPythonScript(
        pythonPath: string,
        scriptPath: string,
        args: string[],
        enableLogs: boolean,
        operationId?: string,
        timeoutMs?: number,
    ): Promise<unknown> {
        Logger.log(
            `🐍 📜 Executing ${path.basename(scriptPath)} (${
                enableLogs ? 'with' : 'without'
            } logs handover${operationId ? `, operation ${operationId}` : ''}${
                timeoutMs ? `, timeout ${timeoutMs}ms` : ''
            })`,
        );
        Logger.log(
            `🐍 📜 Full command (copy-paste): ${formatCommandForDisplay(
                pythonPath,
                [scriptPath, ...args],
            )}`,
        );

        const controller = new AbortController();
        if (operationId) {
            this._activeProcesses.set(operationId, {
                controller,
                startTime: Date.now(),
            });
        }

        let result: RunProcessResult;
        try {
            result = await runProcess(pythonPath, [scriptPath, ...args], {
                env: { ...process.env, PYTHONUNBUFFERED: '1' },
                timeoutMs,
                signal: controller.signal,
                onStderr: enableLogs ? forwardPythonLogs : undefined,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            throw new Error(
                (error as NodeJS.ErrnoException)?.code === 'ENOENT'
                    ? `Python interpreter not found at: ${pythonPath}. Please check your Python installation.`
                    : `Failed to execute Python script: ${message}`,
            );
        } finally {
            if (
                operationId &&
                this._activeProcesses.get(operationId)?.controller ===
                    controller
            ) {
                this._activeProcesses.delete(operationId);
            }
        }

        return parseScriptResult(result, timeoutMs);
    }

    /**
     * Abort an active Python process by operation ID (SIGTERM, then SIGKILL
     * after one second if it is still running).
     * @param operationId The ID of the operation to abort
     * @returns true if the process was found and stopped, false otherwise
     */
    public abortProcess(operationId: string): boolean {
        const activeProcess = this._activeProcesses.get(operationId);
        if (!activeProcess) {
            Logger.warn(
                `🐍 ⚠️ No active process found for operation: ${operationId}`,
            );
            return false;
        }
        this._activeProcesses.delete(operationId);
        Logger.info(
            `🐍 🛑 Aborting process for operation: ${operationId} (duration: ${
                Date.now() - activeProcess.startTime
            }ms)`,
        );
        activeProcess.controller.abort();
        return true;
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
        const abortedCount = operationIds.filter((operationId) =>
            this.abortProcess(operationId),
        ).length;
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

    /**
     * Pick the interpreter to use and check its packages, without changing
     * this manager's state (committed by runInitializations).
     */
    private async resolveInterpreterState(): Promise<InterpreterState> {
        Logger.info('🐍 🔧 [INIT] Initializing Python manager');
        const issue: { value: OwnEnvironmentIssue | null } = { value: null };
        const selected = await this.selectInterpreter(issue);
        const notReadyReason = selected
            ? await this.corePackagesIssue(selected.pythonPath)
            : 'No Python interpreter found. Select one with "Python: Select Interpreter", or turn on scientificDataViewer.python.useExtensionOwnEnvironment.';
        return {
            pythonPath: selected?.pythonPath ?? null,
            source: selected?.source ?? null,
            corePackagesInstalled: notReadyReason === null,
            notReadyReason,
            ownEnvironmentIssue: issue.value,
        };
    }

    private async selectInterpreter(issue: {
        value: OwnEnvironmentIssue | null;
    }): Promise<SelectedInterpreter> {
        const overrideInterpreter = getOverridePythonInterpreter();
        if (overrideInterpreter) {
            Logger.info(
                `🐍 🔧 Using override Python interpreter: ${overrideInterpreter}`,
            );
            return { pythonPath: overrideInterpreter, source: 'override' };
        }

        if (getUseExtensionOwnEnvironment()) {
            const own = await this.prepareOwnEnvironment();
            if (typeof own === 'string') {
                return { pythonPath: own, source: 'own-uv-env' };
            }
            issue.value = own;
        }

        const pythonExtensionPath =
            await getPythonInterpreterFromPythonExtension();
        if (pythonExtensionPath) {
            Logger.info(
                `🐍 🔀 Using the Python extension's interpreter: ${pythonExtensionPath}`,
            );
            return {
                pythonPath: pythonExtensionPath,
                source: 'python-extension',
            };
        }

        // Last chance: common Python paths. On Windows, try "python" before
        // "python3" so we avoid the Windows Store stub (python3.exe that opens
        // the Store and exits 0 with no output).
        const commonPaths =
            process.platform === 'win32'
                ? [
                      'python',
                      'python3',
                      'py',
                      'C:\\Python313\\python.exe',
                      'C:\\Python312\\python.exe',
                      'C:\\Python311\\python.exe',
                      'C:\\Python310\\python.exe',
                      'C:\\Python39\\python.exe',
                  ]
                : [
                      'python3',
                      'python',
                      '/usr/bin/python3',
                      '/usr/local/bin/python3',
                  ];
        for (const pythonPath of commonPaths) {
            if (await this.getPythonVersion(pythonPath)) {
                return { pythonPath, source: 'system' };
            }
        }
        return null;
    }

    /**
     * Interpreter of the extension's own environment: reuse (and upgrade if
     * needed) an existing one, else create it with uv. Returns why it cannot
     * be used otherwise.
     */
    private async prepareOwnEnvironment(): Promise<
        string | OwnEnvironmentIssue
    > {
        Logger.info('🐍 🔧 Using extension own virtual environment');
        const envManager = this.extensionEnvManager;
        let issue: OwnEnvironmentIssue;
        try {
            if (!envManager.ready && envManager.exists) {
                // Reuse the environment from a previous session; upgrade it
                // once if this extension version requires it.
                await this.prepareExistingExtensionEnvironment();
            }
            if (!envManager.ready) {
                await envManager.create();
            }
            if (envManager.pythonPath) {
                return envManager.pythonPath;
            }
            issue = {
                uvMissing: false,
                message: 'the environment could not be prepared',
            };
        } catch (error) {
            issue = {
                uvMissing: error instanceof UvNotAvailableError,
                message: error instanceof Error ? error.message : String(error),
            };
        }
        Logger.warn(
            `🐍 ⚠️ Extension own environment not usable (${issue.message}), falling back to the Python extension`,
        );
        return issue;
    }

    /**
     * Prepare the extension's own uv environment from a previous session.
     * When this extension version requires it (see ENVIRONMENT_REVISION), it
     * is deleted and recreated once, with a progress notification. On failure
     * the previous environment stays in use (if it still works) and the
     * recreation is retried next start.
     */
    private async prepareExistingExtensionEnvironment(): Promise<void> {
        const envManager = this.extensionEnvManager;
        if (!envManager.getUpdateReason()) {
            await envManager.prepareExisting();
            return;
        }

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Scientific Data Viewer: rebuilding its Python environment for this new version (this can take a few minutes)…',
            },
            () => envManager.prepareExisting(),
        );

        if (result.updated) {
            vscode.window.showInformationMessage(
                'Scientific Data Viewer: Python environment rebuilt for this new version.',
            );
        } else if (result.error && envManager.ready) {
            vscode.window.showWarningMessage(
                'Scientific Data Viewer: the Python environment could not be rebuilt (are you offline?). ' +
                    'The previous environment is used for now; it will be rebuilt at the next start, ' +
                    'or run "Scientific Data Viewer: Manage Extension Virtual Environment" → Recreate.',
            );
        }
    }

    private async getPythonVersion(pythonPath: string): Promise<string | null> {
        try {
            const { code, stdout } = await runProcess(
                pythonPath,
                ['--version'],
                { timeoutMs: PROBE_TIMEOUT_MS },
            );
            return code === 0 && stdout.trim() ? stdout.trim() : null;
        } catch {
            return null;
        }
    }

    /**
     * Null when every core package can be found by the interpreter, else why
     * it cannot be used (missing packages, interpreter that does not run or
     * is too old), for the "not ready" messages.
     */
    private async corePackagesIssue(
        pythonPath: string,
    ): Promise<string | null> {
        try {
            const availability = await this.checkPackagesAvailability(
                pythonPath,
                [...CORE_PACKAGES, ...PLOT_PACKAGES, ...EXTENDED_PACKAGES],
            );
            Logger.debug(
                `🐍 📦 Package availability: ${JSON.stringify(availability)}`,
            );
            const missing = CORE_PACKAGES.filter((pkg) => !availability[pkg]);
            if (missing.length === 0) {
                return null;
            }
            Logger.info(
                `🐍 📦 ⚠️ Missing core packages: ${missing.join(', ')}`,
            );
            return `missing core packages in ${pythonPath}: ${missing.join(', ')}. Install them with: ${formatPipInstallCommand()}`;
        } catch (error) {
            Logger.error(
                `🐍 📦 ❌ Python environment validation failed: ${error}`,
            );
            const message =
                error instanceof Error ? error.message : String(error);
            return `the interpreter ${pythonPath} could not be used: ${message.replace(/^Failed to check package availability: (Error: )?/, '')}`;
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
        packageNames: readonly string[],
    ): Promise<Record<string, boolean>> {
        const scriptPath = path.join(
            __dirname,
            '../../../python/check_package_availability.py',
        );
        Logger.debug(`🐍 📦 🔍 Checking packages: ${packageNames.join(', ')}`);

        let result: unknown;
        try {
            result = await this.runPythonScript(
                pythonPath,
                scriptPath,
                [...packageNames],
                true, // Enable log handover for package availability check (e.g. debugging Issue #118)
                undefined,
                PACKAGE_CHECK_TIMEOUT_MS,
            );
        } catch (error) {
            Logger.error(`🐍 📦 ❌ Error checking packages: ${error}`);
            throw new Error(`Failed to check package availability: ${error}`);
        }

        if (typeof result !== 'object' || result === null) {
            throw new Error(
                'Invalid response format from package availability check',
            );
        }
        const resultObj = result as Record<string, unknown>;
        if (typeof resultObj._error === 'string') {
            throw new Error(
                `Package availability check failed: ${resultObj._error}`,
            );
        }
        return result as Record<string, boolean>;
    }

    /**
     * Install packages into the current interpreter. The extension's own
     * environment (and any interpreter without pip, when uv is installed) is
     * handled with `uv pip install --python`, the others with `python -m pip`.
     */
    async installPackages(packages: string[]): Promise<void> {
        const pythonPath = this._pythonPath;
        if (!pythonPath) {
            throw new Error('No Python interpreter configured');
        }
        // The command can be run from the webview: never pass options to pip / uv
        const invalid = packages.filter(
            (spec) => !isRequirementSpecifier(spec),
        );
        if (invalid.length > 0) {
            throw new Error(
                `Not a package requirement: ${invalid.map((spec) => JSON.stringify(spec)).join(', ')}`,
            );
        }
        Logger.info(
            `🐍 📦 🔍 Installing packages: ${packages.join(', ')} using Python: ${pythonPath}`,
        );

        if (this._environmentSource === 'own-uv-env') {
            await this.extensionEnvManager.uvInstallPackages(
                pythonPath,
                packages,
            );
            Logger.info(`🐍 📦 Installed with uv: ${packages.join(', ')}`);
            return;
        }

        if (!(await this.hasPip(pythonPath))) {
            if (await this.extensionEnvManager.isUvAvailable()) {
                await this.extensionEnvManager.uvInstallPackages(
                    pythonPath,
                    packages,
                );
                Logger.info(`🐍 📦 Installed with uv: ${packages.join(', ')}`);
                return;
            }
            throw new Error(
                `pip is not available for ${pythonPath}. Please install pip (or uv) or use a different Python interpreter.`,
            );
        }

        const pipArgs = ['-m', 'pip', 'install', ...packages];
        let result: RunProcessResult;
        try {
            result = await runProcess(pythonPath, pipArgs, {
                onStdout: (chunk) => Logger.debug(`🐍 📦 pip stdout: ${chunk}`),
                onStderr: (chunk) => Logger.warn(`🐍 📦 pip stderr: ${chunk}`),
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            Logger.error(`🐍 📦 ❌ pip process error: ${message}`);
            throw new Error(
                `Failed to execute pip: ${message}` +
                    ((error as NodeJS.ErrnoException)?.code === 'ENOENT'
                        ? `\n\n💡 Troubleshooting: Python interpreter not found at: ${pythonPath}` +
                          '\nPlease check your Python installation and try selecting a different interpreter.'
                        : ''),
            );
        }

        if (result.code === 0) {
            Logger.info(
                `Successfully installed packages: ${packages.join(', ')}`,
            );
            return;
        }
        throw new Error(pipFailureMessage(pythonPath, packages, result));
    }

    private async hasPip(pythonPath: string): Promise<boolean> {
        try {
            const { code, stdout } = await runProcess(
                pythonPath,
                ['-m', 'pip', '--version'],
                { timeoutMs: PROBE_TIMEOUT_MS },
            );
            Logger.debug(`🐍 📦 🔍 pip version: ${stdout.trim()}`);
            return code === 0;
        } catch {
            return false;
        }
    }
}

/** Forward the Python logger lines (` - LEVEL - message`) to the Logger. */
function forwardPythonLogs(chunk: string): void {
    for (const rawLine of chunk.split('\n')) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        const match = / - (INFO|ERROR|WARNING|DEBUG) - (.*)$/.exec(line);
        if (!match) {
            Logger.info(`🐍 📜 [Python] ${line}`);
            continue;
        }
        const [, level, message] = match;
        const text = `🐍 📜 [Python] [${level}] ${message}`;
        if (level === 'ERROR') {
            Logger.error(text);
        } else if (level === 'WARNING') {
            Logger.warn(text);
        } else if (level === 'DEBUG') {
            Logger.debug(text);
        } else {
            Logger.info(text);
        }
    }
}

/**
 * Parse the JSON printed by a script, or turn a failed run into an Error.
 * Exported for unit tests.
 */
/**
 * `name`, `name[extra]` or `name` with version constraints (`xarray>=2026.4.0`,
 * `eccodeslib<2.48`, `numpy>=2,<3`): a requirement for pip / uv, not an option.
 */
const REQUIREMENT_SPECIFIER =
    /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?(?:\[[A-Za-z0-9._-]+(?:,[A-Za-z0-9._-]+)*\])?(?:(?:===|==|!=|~=|>=|<=|>|<)[A-Za-z0-9.*+!_-]+(?:,(?:===|==|!=|~=|>=|<=|>|<)[A-Za-z0-9.*+!_-]+)*)?$/;

export function isRequirementSpecifier(spec: unknown): boolean {
    return typeof spec === 'string' && REQUIREMENT_SPECIFIER.test(spec);
}

export function parseScriptResult(
    result: RunProcessResult,
    timeoutMs?: number,
): unknown {
    const { code, signal, stdout, stderr } = result;

    if (result.timedOut) {
        throw new Error(
            `Python script timed out after ${timeoutMs} ms and was stopped.`,
        );
    }
    if (result.aborted || signal === 'SIGTERM' || signal === 'SIGKILL') {
        throw new Error(
            `Process was aborted (signal: ${signal ?? 'SIGTERM'}). This usually happens when a plot operation times out, or if the plot operation was cancelled by the user.`,
        );
    }

    if (code === 0) {
        const parsed = parseJsonOutput(stdout);
        if (parsed.ok) {
            return parsed.value;
        }
        Logger.error(
            `🐍 📜 Script output is not JSON (stdout length=${stdout.length}): ${stdout.slice(0, 300)}${
                stderr ? `\nStderr: ${stderr.slice(0, 1000)}` : ''
            }`,
        );
        throw new Error(
            stdout.trim()
                ? `Python script returned invalid output (expected JSON): ${stdout.trim().slice(0, 200)}`
                : 'Python script returned no output (expected JSON). See the extension logs for details.',
        );
    }

    // Log so the Extension Log always shows what we got (exit code 1 often = uncaught exception)
    Logger.error(
        `🐍 📜 Python script exited with code ${code}. Stderr (${stderr.length} chars):\n${stderr || '(empty)'}`,
    );
    Logger.error(
        `🐍 📜 Python script stdout (${stdout.length} chars):\n${stdout || '(empty)'}`,
    );
    const errorMessage = stderr || stdout || 'Unknown Python error';
    if (errorMessage.includes('ModuleNotFoundError')) {
        throw new Error(
            `Missing Python package: ${errorMessage}. Please install required packages with: ${formatPipInstallCommand()}`,
        );
    }
    if (errorMessage.includes('PermissionError')) {
        throw new Error(
            `Permission denied: ${errorMessage}. Please check file permissions.`,
        );
    }
    if (errorMessage.includes('FileNotFoundError')) {
        throw new Error(
            `File not found: ${errorMessage}. Please check the file path.`,
        );
    }
    // Prefer the script's JSON error from stdout (e.g. Invalid --dimension-slices JSON)
    const parsed = parseJsonOutput(stdout);
    if (
        parsed.ok &&
        typeof (parsed.value as { error?: unknown })?.error === 'string' &&
        (parsed.value as { error: string }).error.length > 0
    ) {
        throw new Error((parsed.value as { error: string }).error);
    }
    throw new Error(
        errorMessage.trim().split('\n').pop()?.trim() ||
            `Python script failed (exit code ${code})`,
    );
}

/**
 * Parse stdout as JSON; when it is not, try its last non-empty line (scripts
 * print one JSON line, possibly after stray prints from libraries).
 */
function parseJsonOutput(
    stdout: string,
): { ok: true; value: unknown } | { ok: false } {
    const candidates = [stdout.trim()];
    const lastLine = stdout.trim().split('\n').pop()?.trim();
    if (lastLine && lastLine !== candidates[0]) {
        candidates.push(lastLine);
    }
    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }
        try {
            return { ok: true, value: JSON.parse(candidate) };
        } catch {
            // try the next candidate
        }
    }
    return { ok: false };
}

function pipFailureMessage(
    pythonPath: string,
    packages: string[],
    result: RunProcessResult,
): string {
    const { code, stdout, stderr } = result;
    let message = `Failed to install packages. Exit code: ${code}`;
    if (stderr) {
        message += `\n\nPip Error Output:\n${stderr}`;
    }
    if (stdout) {
        message += `\n\nPip Standard Output:\n${stdout}`;
    }
    const pip = (...args: string[]) =>
        formatCommandForDisplay(pythonPath, ['-m', 'pip', ...args]);
    if (
        stderr.includes('Permission denied') ||
        stderr.includes('Access is denied')
    ) {
        message += `\n\n💡 Troubleshooting: Permission denied. Try running:\n${pip('install', '--user', ...packages)}`;
    } else if (stderr.includes('Could not find a version')) {
        message += `\n\n💡 Troubleshooting: Package version not found. Try updating pip:\n${pip('install', '--upgrade', 'pip')}`;
    } else if (stderr.includes('SSL') || stderr.includes('certificate')) {
        message += `\n\n💡 Troubleshooting: SSL/Certificate issue. Try:\n${pip(
            'install',
            '--trusted-host',
            'pypi.org',
            '--trusted-host',
            'pypi.python.org',
            '--trusted-host',
            'files.pythonhosted.org',
            ...packages,
        )}`;
    } else if (stderr.includes('Microsoft Visual C++')) {
        message += `\n\n💡 Troubleshooting: Missing Visual C++ compiler. Install Microsoft Visual C++ Build Tools or use pre-compiled packages.`;
    }
    return message;
}
