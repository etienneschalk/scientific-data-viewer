import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../common/Logger';
import {
    formatCommandForDisplay,
    runProcess,
    RunProcessResult,
} from '../common/runProcess';

/**
 * Python requirements of the extension's own uv environment, and the single
 * source of the package lists used elsewhere (package checks, healthcheck,
 * install hints).
 *
 * xarray 2026.04.0 raised its minimum zarr to 3.0 and dropped zarr-python 2
 * (Zarr v2 *data* stays readable through zarr-python 3), so both are pinned
 * together to keep the environment self-consistent.
 */
export const ALL_REQUIREMENTS: readonly string[] = [
    'xarray>=2026.4.0',
    'matplotlib',
    'netCDF4',
    'h5netcdf>=1.8',
    'zarr>=3',
    'h5py',
    'scipy',
    'cfgrib',
    'rioxarray',
    'cdflib',
];

/**
 * Strip the version specifier from a pip requirement.
 * `zarr>=3` becomes `zarr`, while `h5py` is returned unchanged.
 */
export function requirementPackageName(requirement: string): string {
    return requirement.split(/[<>=!~[\s]/)[0];
}

// Package names below double as import names (checked with find_spec), which
// holds for every requirement above.
/** Packages required for basic functionality. */
export const CORE_PACKAGES: readonly string[] = ['xarray'];
/** Packages required for plotting. */
export const PLOT_PACKAGES: readonly string[] = ['matplotlib'];
/** Optional packages (I/O engines) for extended format support. */
export const EXTENDED_PACKAGES: readonly string[] = ALL_REQUIREMENTS.map(
    requirementPackageName,
).filter(
    (name) => !CORE_PACKAGES.includes(name) && !PLOT_PACKAGES.includes(name),
);

/** `pip install ...` command line for the requirements, for messages. */
export function formatPipInstallCommand(
    requirements: readonly string[] = ALL_REQUIREMENTS,
): string {
    return formatCommandForDisplay('pip', ['install', ...requirements]);
}

/** Thrown when an operation needs uv and uv is not installed. */
export class UvNotAvailableError extends Error {
    constructor() {
        super('uv is not available');
        this.name = 'UvNotAvailableError';
    }
}

/** Contents of the state file recorded in the environment folder. */
export interface ExtensionEnvironmentState {
    revision: number;
    requirements: string[];
    updatedAt: string;
}

/** Outcome of preparing an already existing environment at startup. */
export interface PrepareExistingResult {
    /** Why an update was attempted; null when the environment was up to date. */
    updateReason: string | null;
    /** True when the update ran and succeeded. */
    updated: boolean;
    /** Error message when the update failed (the previous environment is kept if usable). */
    error?: string;
}

/** Location and state of the extension's own virtual environment. */
export interface ExtensionVirtualEnvironment {
    path: string;
    pythonPath: string;
    isCreated: boolean;
    isInitialized: boolean;
}

const UV_VERSION_TIMEOUT_MS = 10_000;
const UV_LIST_TIMEOUT_MS = 60_000;
const IMPORT_CHECK_TIMEOUT_MS = 30_000;

export class ExtensionVirtualEnvironmentManager {
    public readonly PYTHON_VERSION = '3.13';
    public readonly UV_INSTALLATION_URL =
        'https://docs.astral.sh/uv/getting-started/installation/';
    private extensionEnv: ExtensionVirtualEnvironment;
    private readonly ENV_FOLDER_NAME = 'python-environment';
    /**
     * Bump this number in a release that needs existing extension environments
     * to be updated (new or changed requirement, or to force an upgrade).
     * Environments recorded with a lower revision are upgraded once, at the next
     * extension start. Changing ALL_REQUIREMENTS also triggers an update, even
     * if this number was not bumped.
     *
     * History:
     * - 1 (v0.13.0): xarray>=2026.4.0, zarr>=3, h5netcdf>=1.8
     */
    public readonly ENVIRONMENT_REVISION = 1;
    private readonly STATE_FILE_NAME = 'sdv-environment.json';
    // Distribution names without version specifiers, for reporting and for
    // matching against `pip list` output.
    private readonly ALL_PACKAGES = ALL_REQUIREMENTS.map(
        requirementPackageName,
    );
    /** Tail of the queue serialising create / update / prepare / delete. */
    private operationQueue: Promise<unknown> = Promise.resolve();

    constructor(private globalStorageUriFsPath: string) {
        const envPath = path.join(
            this.globalStorageUriFsPath,
            this.ENV_FOLDER_NAME,
        );
        this.extensionEnv = {
            path: envPath,
            pythonPath: this.getPythonExecutablePath(envPath),
            isCreated: fs.existsSync(envPath),
            isInitialized: false,
        };

        Logger.info(
            `[uv] 🚀 Extension virtual environment initialized at: ${envPath}`,
        );
    }

    /**
     * Check if the extension virtual environment is ready to use
     */
    get ready(): boolean {
        return (
            this.extensionEnv.isCreated &&
            this.extensionEnv.isInitialized &&
            fs.existsSync(this.extensionEnv.pythonPath)
        );
    }

    /**
     * Get the Python path for the extension virtual environment
     */
    get pythonPath(): string | null {
        return this.ready ? this.extensionEnv.pythonPath : null;
    }

    /**
     * True when an environment folder with a Python executable exists, even if
     * it has not been prepared in this session yet (see prepareExisting).
     */
    get exists(): boolean {
        return (
            this.extensionEnv.isCreated &&
            fs.existsSync(this.extensionEnv.pythonPath)
        );
    }

    /**
     * Get the extension virtual environment
     */
    retrieve(): ExtensionVirtualEnvironment {
        return this.extensionEnv;
    }

    /** When the packages were last installed or updated, from the state file. */
    getLastUpdated(): Date | null {
        const updatedAt = this.readEnvironmentState()?.updatedAt;
        return updatedAt ? new Date(updatedAt) : null;
    }

    /**
     * Run environment-changing operations one at a time, so that a startup
     * initialisation, a configuration change and the manage UI never install
     * into the same folder concurrently.
     */
    private serialize<T>(operation: () => Promise<T>): Promise<T> {
        const run = this.operationQueue.then(operation, operation);
        this.operationQueue = run.catch(() => undefined);
        return run;
    }

    /**
     * Create the extension's virtual environment. Does nothing when it is
     * already ready (e.g. created by a concurrent caller).
     */
    create(): Promise<void> {
        return this.serialize(async () => {
            if (this.ready) {
                Logger.info(
                    '[uv] ✅ Extension virtual environment already created',
                );
                return;
            }
            Logger.info('[uv] 🐍 🔧 Creating extension virtual environment...');

            await fs.promises.mkdir(this.globalStorageUriFsPath, {
                recursive: true,
            });

            if (!(await this.isUvAvailable())) {
                throw new UvNotAvailableError();
            }

            // Install Python with uv first to ensure it is available
            await this.uvInstallPython();
            await this.uvCreateVirtualEnvironment(this.extensionEnv.path);

            this.extensionEnv.isCreated = true;
            this.extensionEnv.isInitialized = false;

            await this.uvInstallRequiredPackages({ upgrade: false });

            this.extensionEnv.isInitialized = true;
            await this.recordEnvironmentState();

            Logger.info(
                '[uv] ✅ Extension virtual environment created successfully',
            );
        });
    }

    /**
     * Update packages in the extension virtual environment
     */
    update(): Promise<boolean> {
        return this.serialize(async () => {
            if (!this.ready) {
                Logger.warn(
                    '[uv] Extension virtual environment not ready for package updates',
                );
                return false;
            }
            try {
                Logger.info(
                    '[uv] 📦 Updating packages in extension virtual environment...',
                );
                await this.uvInstallRequiredPackages({ upgrade: true });
                await this.recordEnvironmentState();
                Logger.info('[uv] ✅ Packages updated successfully');
                return true;
            } catch (error) {
                Logger.error(`[uv] ❌ Failed to update packages: ${error}`);
                return false;
            }
        });
    }

    /**
     * Make an existing environment usable for this session: reuse it as is when
     * up to date, otherwise upgrade its packages once. If the upgrade fails (e.g.
     * offline), the previous environment is kept when it can still import the
     * core packages, and the update is retried at the next start (the state is
     * only recorded on success). An environment that cannot import them is not
     * marked initialised, so the caller recreates it or falls back.
     */
    prepareExisting(): Promise<PrepareExistingResult> {
        return this.serialize(async () => {
            if (!this.exists) {
                throw new Error('Extension virtual environment does not exist');
            }
            const updateReason = this.getUpdateReason();
            if (!updateReason) {
                Logger.info(
                    '[uv] ✅ Extension virtual environment is up to date',
                );
                this.extensionEnv.isInitialized = true;
                return { updateReason, updated: false };
            }

            Logger.info(
                `[uv] 📦 Updating extension virtual environment: ${updateReason}`,
            );
            try {
                await this.uvInstallRequiredPackages({ upgrade: true });
                await this.recordEnvironmentState();
                this.extensionEnv.isInitialized = true;
                Logger.info('[uv] ✅ Extension virtual environment updated');
                return { updateReason, updated: true };
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                const usable = await this.hasCorePackages();
                this.extensionEnv.isInitialized = usable;
                Logger.warn(
                    usable
                        ? `[uv] ⚠️ Extension virtual environment update failed, keeping the previous one: ${message}`
                        : `[uv] ❌ Extension virtual environment update failed and the previous one is not usable: ${message}`,
                );
                return { updateReason, updated: false, error: message };
            }
        });
    }

    /**
     * Delete the extension virtual environment
     */
    delete(): Promise<boolean> {
        return this.serialize(async () => {
            try {
                if (this.extensionEnv.isCreated) {
                    Logger.info(
                        '[uv] 🗑️ Deleting extension virtual environment...',
                    );
                    await fs.promises.rm(this.extensionEnv.path, {
                        recursive: true,
                        force: true,
                    });
                    this.extensionEnv.isCreated = false;
                    this.extensionEnv.isInitialized = false;
                    Logger.info(
                        '[uv] ✅ Extension virtual environment deleted successfully',
                    );
                }
                return true;
            } catch (error) {
                Logger.error(
                    `[uv] ❌ Failed to delete extension virtual environment: ${error}`,
                );
                return false;
            }
        });
    }

    private get stateFilePath(): string {
        return path.join(this.extensionEnv.path, this.STATE_FILE_NAME);
    }

    /** State recorded at the last successful install/update, or null. */
    readEnvironmentState(): ExtensionEnvironmentState | null {
        try {
            const raw = fs.readFileSync(this.stateFilePath, 'utf8');
            const state = JSON.parse(raw) as ExtensionEnvironmentState;
            return typeof state.revision === 'number' &&
                Array.isArray(state.requirements)
                ? state
                : null;
        } catch {
            return null;
        }
    }

    /** Record that the environment matches the current revision and requirements. */
    async recordEnvironmentState(): Promise<void> {
        const state: ExtensionEnvironmentState = {
            revision: this.ENVIRONMENT_REVISION,
            requirements: [...ALL_REQUIREMENTS],
            updatedAt: new Date().toISOString(),
        };
        await fs.promises.writeFile(
            this.stateFilePath,
            JSON.stringify(state, null, 2),
            'utf8',
        );
    }

    /**
     * Why the existing environment must be updated before use, or null when it
     * is up to date (or does not exist). An environment recorded by a newer
     * extension version (higher revision) is left alone.
     */
    getUpdateReason(): string | null {
        if (!this.exists) {
            return null;
        }
        const state = this.readEnvironmentState();
        if (!state) {
            return 'the environment was created by an older extension version';
        }
        if (state.revision < this.ENVIRONMENT_REVISION) {
            return `environment revision ${state.revision} is older than required revision ${this.ENVIRONMENT_REVISION}`;
        }
        if (state.revision > this.ENVIRONMENT_REVISION) {
            return null;
        }
        const recorded = [...state.requirements].sort().join(',');
        const current = [...ALL_REQUIREMENTS].sort().join(',');
        return recorded === current ? null : 'the required packages changed';
    }

    /**
     * Check if uv is available on the PATH.
     */
    async isUvAvailable(): Promise<boolean> {
        try {
            const { code, stdout } = await runProcess('uv', ['--version'], {
                timeoutMs: UV_VERSION_TIMEOUT_MS,
            });
            if (code === 0) {
                Logger.info(`[uv] 🔧 uv is available: ${stdout.trim()}`);
                return true;
            }
        } catch {
            // spawn error (ENOENT): not installed
        }
        Logger.info(
            `[uv] 🔧 ℹ️ uv is not available, you can install it from 🔗 ${this.UV_INSTALLATION_URL}`,
        );
        return false;
    }

    /**
     * `uv pip install` arguments that install (or upgrade) the requirements
     * into the given interpreter. Arguments are passed to uv as is (no shell).
     */
    buildInstallArgs(
        pythonPath: string,
        packages: readonly string[],
        upgrade: boolean,
    ): string[] {
        return [
            'pip',
            'install',
            '--python',
            pythonPath,
            ...(upgrade ? ['--upgrade'] : []),
            ...packages,
        ];
    }

    /**
     * Get installed package versions from the extension virtual environment.
     * Uses pip's JSON output and matches against the requirements.
     */
    async getInstalledPackageVersions(): Promise<
        Array<{ name: string; version: string | null }>
    > {
        if (!this.exists) {
            return this.ALL_PACKAGES.map((name) => ({ name, version: null }));
        }

        const installedByName = await this.queryInstalledPackageVersions();
        return this.ALL_PACKAGES.map((name) => ({
            name,
            version: installedByName.get(name.toLowerCase()) ?? null,
        }));
    }

    private async queryInstalledPackageVersions(): Promise<
        Map<string, string>
    > {
        const pythonPath = this.extensionEnv.pythonPath;
        // uv-created venvs usually have no pip module, so uv is tried first.
        const attempts: Array<[string, string[]]> = [
            ['uv', ['pip', 'list', '--format', 'json', '--python', pythonPath]],
            [pythonPath, ['-m', 'pip', 'list', '--format=json']],
        ];
        for (const [command, args] of attempts) {
            try {
                const { code, stdout, stderr } = await runProcess(
                    command,
                    args,
                    { timeoutMs: UV_LIST_TIMEOUT_MS },
                );
                if (code === 0) {
                    const versions = this.parsePipListJson(stdout);
                    if (versions.size > 0) {
                        return versions;
                    }
                } else {
                    Logger.warn(
                        `[uv] Failed to list installed packages with ${formatCommandForDisplay(command, args)} (exit code ${code}): ${stderr || stdout}`,
                    );
                }
            } catch (error) {
                Logger.warn(
                    `[uv] Failed to execute ${formatCommandForDisplay(command, args)}: ${error}`,
                );
            }
        }
        return new Map();
    }

    private parsePipListJson(stdout: string): Map<string, string> {
        try {
            const entries = JSON.parse(stdout) as Array<{
                name: string;
                version: string;
            }>;
            const versions = new Map<string, string>();
            for (const entry of entries) {
                versions.set(entry.name.toLowerCase(), entry.version);
            }
            return versions;
        } catch (error) {
            Logger.warn(`[uv] Failed to parse pip list JSON: ${error}`);
            return new Map();
        }
    }

    /** True when the environment's interpreter can import the core packages. */
    private async hasCorePackages(): Promise<boolean> {
        try {
            const { code } = await runProcess(
                this.extensionEnv.pythonPath,
                ['-c', CORE_PACKAGES.map((name) => `import ${name}`).join(';')],
                { timeoutMs: IMPORT_CHECK_TIMEOUT_MS },
            );
            return code === 0;
        } catch {
            return false;
        }
    }

    /**
     * Get the Python executable path for the given environment path
     */
    private getPythonExecutablePath(envPath: string): string {
        if (process.platform === 'win32') {
            return path.join(envPath, 'Scripts', 'python.exe');
        } else {
            return path.join(envPath, 'bin', 'python');
        }
    }

    private logUvOutput(
        label: string,
        stream: 'stdout' | 'stderr',
        text: string,
    ): void {
        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
        for (const line of lines) {
            Logger.info(`[uv] ${label} ${stream}: ${line}`);
        }
    }

    /** Run uv with the given arguments (no shell), logging its output. */
    private runUv(
        args: string[],
        label: string = '📦',
    ): Promise<RunProcessResult> {
        const uvArgs = ['-v', ...args];
        Logger.info(`[uv] Executing: ${formatCommandForDisplay('uv', uvArgs)}`);
        return runProcess('uv', uvArgs, {
            onStdout: (chunk) => this.logUvOutput(label, 'stdout', chunk),
            onStderr: (chunk) => this.logUvOutput(label, 'stderr', chunk),
        });
    }

    private async logRequiredPackageVersions(heading: string): Promise<void> {
        const versions = await this.getInstalledPackageVersions();
        Logger.info(`[uv] ${heading}`);
        for (const pkg of versions) {
            Logger.info(
                `[uv]   - ${pkg.name}: ${pkg.version ?? 'not installed'}`,
            );
        }
    }

    private async logOutdatedRequiredPackages(): Promise<void> {
        if (!this.exists) {
            return;
        }

        try {
            const { code, stdout, stderr } = await this.runUv(
                [
                    'pip',
                    'list',
                    '--outdated',
                    '--format',
                    'json',
                    '--python',
                    this.extensionEnv.pythonPath,
                ],
                '📋',
            );

            if (code !== 0) {
                Logger.warn(
                    `[uv] Could not check outdated packages (exit code ${code}): ${
                        stderr || stdout
                    }`,
                );
                return;
            }

            const outdated = JSON.parse(stdout || '[]') as Array<{
                name: string;
                version: string;
                latest_version?: string;
            }>;

            const requiredOutdated = outdated.filter((entry) =>
                this.ALL_PACKAGES.some(
                    (pkg) => pkg.toLowerCase() === entry.name.toLowerCase(),
                ),
            );

            if (requiredOutdated.length === 0) {
                Logger.info(
                    '[uv] No required packages are reported as outdated (uv may still upgrade transitive dependencies with --upgrade).',
                );
                return;
            }

            Logger.info('[uv] Outdated required packages:');
            for (const entry of requiredOutdated) {
                Logger.info(
                    `[uv]   - ${entry.name}: ${entry.version} → ${entry.latest_version ?? 'unknown'}`,
                );
            }
        } catch (error) {
            Logger.warn(`[uv] Failed to check outdated packages: ${error}`);
        }
    }

    /**
     * Install Python using uv
     */
    private async uvInstallPython(): Promise<void> {
        try {
            Logger.info(
                `[uv] 🔧 Installing Python ${this.PYTHON_VERSION} with uv...`,
            );
            const { code, stdout, stderr } = await this.runUv(
                ['python', 'install', this.PYTHON_VERSION],
                '🔧',
            );
            if (code === 0) {
                Logger.info(
                    `[uv] ✅ Python ${this.PYTHON_VERSION} installed successfully with uv`,
                );
            } else {
                Logger.warn(
                    `[uv] ⚠️ Failed to install Python ${
                        this.PYTHON_VERSION
                    } with uv (exit code ${code}): ${stderr || stdout}`,
                );
            }
        } catch (error) {
            Logger.warn(
                `[uv] ⚠️ Failed to execute uv python install: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Create a virtual environment using uv
     */
    private async uvCreateVirtualEnvironment(envPath: string): Promise<void> {
        Logger.info(
            `[uv] 🔧 Creating virtual environment with uv at: ${envPath}`,
        );

        try {
            const { code, stdout, stderr } = await this.runUv(
                ['venv', '--clear', '--python', this.PYTHON_VERSION, envPath],
                '🔧',
            );
            if (code === 0) {
                Logger.info(
                    `[uv] ✅ Virtual environment created successfully with uv using Python ${this.PYTHON_VERSION}`,
                );
            } else {
                Logger.warn(
                    `[uv] ⚠️ Failed to create environment with Python ${
                        this.PYTHON_VERSION
                    }: exit code ${code}: ${stderr || stdout}`,
                );
            }
        } catch (error) {
            Logger.warn(
                `[uv] ⚠️ Failed to execute uv venv with Python ${
                    this.PYTHON_VERSION
                }: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Install packages into an interpreter with `uv pip install --python`.
     * Used for the extension's own environment, which has no pip module.
     * Throws with uv's output when the install fails.
     */
    async uvInstallPackages(
        pythonPath: string,
        packages: readonly string[],
        upgrade: boolean = false,
    ): Promise<void> {
        if (!(await this.isUvAvailable())) {
            throw new UvNotAvailableError();
        }
        const { code, stdout, stderr } = await this.runUv(
            this.buildInstallArgs(pythonPath, packages, upgrade),
        );
        if (code !== 0) {
            throw new Error(
                `uv failed to ${upgrade ? 'upgrade' : 'install'} packages (exit code ${code}): ${
                    stderr || stdout
                }`,
            );
        }
    }

    /**
     * Install or upgrade required packages in the extension virtual environment.
     * Use upgrade: true when refreshing an existing env (--upgrade asks uv to pull newer versions).
     */
    private async uvInstallRequiredPackages(options?: {
        upgrade?: boolean;
    }): Promise<void> {
        if (!this.extensionEnv.isCreated) {
            throw new Error('Extension virtual environment not created');
        }

        const upgrade = options?.upgrade ?? false;

        Logger.info(
            upgrade
                ? '[uv] 📦 Upgrading required packages in extension virtual environment with uv...'
                : '[uv] 📦 Installing required packages in extension virtual environment with uv...',
        );
        Logger.info(
            `[uv] Target packages (${ALL_REQUIREMENTS.length}): ${ALL_REQUIREMENTS.join(', ')}`,
        );

        if (upgrade) {
            await this.logRequiredPackageVersions(
                'Package versions before upgrade:',
            );
            await this.logOutdatedRequiredPackages();
        }

        // Throws rather than returning: callers record the environment as up
        // to date after a successful install.
        await this.uvInstallPackages(
            this.extensionEnv.pythonPath,
            ALL_REQUIREMENTS,
            upgrade,
        );

        Logger.info(
            upgrade
                ? '[uv] ✅ Required packages upgraded successfully with uv'
                : '[uv] ✅ Required packages installed successfully with uv',
        );
        await this.logRequiredPackageVersions(
            upgrade
                ? 'Package versions after upgrade:'
                : 'Package versions after install:',
        );
    }
}
