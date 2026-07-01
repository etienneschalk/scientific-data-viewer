import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { Logger } from '../common/Logger';
import { quoteIfNeeded } from '../common/utils';
import { ExtensionVirtualEnvironment } from '../types';

export class ExtensionVirtualEnvironmentManager {
    public readonly PYTHON_VERSION = '3.13';
    public readonly UV_INSTALLATION_URL =
        'https://docs.astral.sh/uv/getting-started/installation/';
    private extensionEnv: ExtensionVirtualEnvironment;
    private readonly ENV_FOLDER_NAME = 'python-environment';
    // TODO: more fine grain control over uv-envs packages
    // current approach is to install everything in one go
    private readonly ALL_PACKAGES = [
        'xarray',
        'matplotlib',
        'netCDF4',
        'h5netcdf',
        'zarr',
        'h5py',
        'scipy',
        'cfgrib',
        'rioxarray',
        'cdflib',
    ];

    /**
     * Check if the extension virtual environment is ready to use
     */
    get ready(): boolean {
        return (
            this.extensionEnv !== null &&
            this.extensionEnv.isCreated &&
            this.extensionEnv.isInitialized &&
            fs.existsSync(this.extensionEnv.pythonPath)
        );
    }

    /**
     * Get the Python path for the extension virtual environment
     */
    get pythonPath(): string | null {
        if (this.ready) {
            return this.extensionEnv!.pythonPath;
        }
        return null;
    }

    /**
     * Create the extension's virtual environment
     */
    async create() {
        Logger.info('[uv] 🐍 🔧 Creating extension virtual environment...');

        // Ensure the storage directory exists
        await fs.promises.mkdir(this.globalStorageUriFsPath, {
            recursive: true,
        });

        // Check if uv is available
        const uvAvailable = await this.uvCheckAvailability();

        if (!uvAvailable) {
            throw new Error('uv is not available');
        }

        // First, install python with uv to ensure Python is available
        await this.uvInstallPython();

        // Use uv to create the virtual environment with Python
        await this.uvCreateVirtualEnvironment(this.extensionEnv!.path);
        this.extensionEnv!.createdWithUv = true;

        // Update the extension environment state
        this.extensionEnv!.isCreated = true;
        this.extensionEnv!.isInitialized = false;

        // Install required packages
        await this.uvInstallRequiredPackages({ upgrade: false });

        this.extensionEnv!.isInitialized = true;
        this.extensionEnv!.lastUpdated = new Date();

        Logger.info(
            '[uv] ✅ Extension virtual environment created successfully',
        );
    }

    /**
     * Get installed package versions from the extension virtual environment.
     * Uses pip's JSON output and matches against ALL_PACKAGES.
     */
    async getInstalledPackageVersions(): Promise<
        Array<{ name: string; version: string | null }>
    > {
        if (
            !this.extensionEnv?.isCreated ||
            !fs.existsSync(this.extensionEnv.pythonPath)
        ) {
            return this.ALL_PACKAGES.map((name) => ({ name, version: null }));
        }

        const installedByName = await this.queryInstalledPackageVersions();
        return this.ALL_PACKAGES.map((name) => ({
            name,
            version:
                installedByName.get(name.toLowerCase()) ??
                installedByName.get(name) ??
                null,
        }));
    }

    private async queryInstalledPackageVersions(): Promise<
        Map<string, string>
    > {
        const uvVersions = await this.queryUvPipListVersions();
        if (uvVersions.size > 0) {
            return uvVersions;
        }
        return this.queryPythonModulePipListVersions();
    }

    private async queryUvPipListVersions(): Promise<Map<string, string>> {
        const uvAvailable = await this.uvCheckAvailability();
        if (!uvAvailable) {
            return new Map();
        }

        return new Promise((resolve) => {
            const uvProcess = spawn(
                'uv',
                [
                    'pip',
                    'list',
                    '--format',
                    'json',
                    '--python',
                    quoteIfNeeded(this.extensionEnv!.pythonPath),
                ],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                },
            );

            let stdout = '';
            let stderr = '';

            uvProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            uvProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            uvProcess.on('close', (code) => {
                if (code !== 0) {
                    Logger.warn(
                        `[uv] Failed to list installed packages with uv pip (exit code ${code}): ${
                            stderr || stdout
                        }`,
                    );
                    resolve(new Map());
                    return;
                }

                resolve(this.parsePipListJson(stdout));
            });

            uvProcess.on('error', (error) => {
                Logger.warn(
                    `[uv] Failed to execute uv pip list: ${error.message}`,
                );
                resolve(new Map());
            });
        });
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

    /** Fallback when uv is unavailable; uv-created venvs often have no pip module. */
    private async queryPythonModulePipListVersions(): Promise<
        Map<string, string>
    > {
        return new Promise((resolve) => {
            const pythonPath = quoteIfNeeded(this.extensionEnv!.pythonPath);
            const pipProcess = spawn(
                pythonPath,
                ['-m', 'pip', 'list', '--format=json'],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                },
            );

            let stdout = '';
            let stderr = '';

            pipProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pipProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pipProcess.on('close', (code) => {
                if (code !== 0) {
                    Logger.warn(
                        `[uv] Failed to list installed packages with python -m pip (exit code ${code}): ${
                            stderr || stdout
                        }`,
                    );
                    resolve(new Map());
                    return;
                }

                resolve(this.parsePipListJson(stdout));
            });

            pipProcess.on('error', (error) => {
                Logger.warn(
                    `[uv] Failed to execute python -m pip list: ${error.message}`,
                );
                resolve(new Map());
            });
        });
    }

    /**
     * Get the extension virtual environment
     */
    retrieve(): ExtensionVirtualEnvironment {
        return this.extensionEnv;
    }

    /**
     * Update packages in the extension virtual environment
     */
    async update(): Promise<boolean> {
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
            this.extensionEnv!.lastUpdated = new Date();
            Logger.info('[uv] ✅ Packages updated successfully');
            return true;
        } catch (error) {
            Logger.error(`[uv] ❌ Failed to update packages: ${error}`);
            return false;
        }
    }

    /**
     * Delete the extension virtual environment
     */
    async delete(): Promise<boolean> {
        try {
            if (this.extensionEnv && this.extensionEnv.isCreated) {
                Logger.info(
                    '[uv] 🗑️ Deleting extension virtual environment...',
                );
                await fs.promises.rm(this.extensionEnv.path, {
                    recursive: true,
                    force: true,
                });

                this.extensionEnv.isCreated = false;
                this.extensionEnv.isInitialized = false;
                this.extensionEnv.packages = [];

                Logger.info(
                    '[uv] ✅ Extension virtual environment deleted successfully',
                );
                return true;
            }
            return true;
        } catch (error) {
            Logger.error(
                `[uv] ❌ Failed to delete extension virtual environment: ${error}`,
            );
            return false;
        }
    }

    /**
     * Initialize the extension virtual environment
     */
    constructor(private globalStorageUriFsPath: string) {
        const envPath = path.join(
            this.globalStorageUriFsPath,
            this.ENV_FOLDER_NAME,
        );
        const pythonPath = this.getPythonExecutablePath(envPath);

        this.extensionEnv = {
            path: envPath,
            pythonPath: pythonPath,
            isCreated: fs.existsSync(envPath),
            isInitialized: false,
            packages: [],
            lastUpdated: new Date(),
        };

        Logger.info(
            `[uv] 🚀 Extension virtual environment initialized at: ${envPath}`,
        );
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

    private formatUvCommand(args: string[]): string {
        return `uv ${args.join(' ')}`;
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

    private spawnUv(
        args: string[],
        options?: { verbose?: boolean; label?: string },
    ): Promise<{ code: number; stdout: string; stderr: string }> {
        const verbose = options?.verbose ?? false;
        const label = options?.label ?? '📦';
        const spawnArgs = verbose ? ['-v', ...args] : args;

        Logger.info(`[uv] Executing: ${this.formatUvCommand(spawnArgs)}`);

        return new Promise((resolve, reject) => {
            const child = spawn('uv', spawnArgs, {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;
                if (verbose) {
                    this.logUvOutput(label, 'stdout', chunk);
                }
            });

            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                stderr += chunk;
                if (verbose) {
                    this.logUvOutput(label, 'stderr', chunk);
                }
            });

            child.on('close', (code) => {
                resolve({
                    code: code ?? 1,
                    stdout,
                    stderr,
                });
            });

            child.on('error', (error) => {
                reject(error);
            });
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
        if (
            !this.extensionEnv?.isCreated ||
            !fs.existsSync(this.extensionEnv.pythonPath)
        ) {
            return;
        }

        try {
            const { code, stdout, stderr } = await this.spawnUv(
                [
                    'pip',
                    'list',
                    '--outdated',
                    '--format',
                    'json',
                    '--python',
                    quoteIfNeeded(this.extensionEnv.pythonPath),
                ],
                { verbose: true, label: '📋' },
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
     * Check if uv is available and can be used to create virtual environments
     */
    private async uvCheckAvailability(): Promise<boolean> {
        return new Promise((resolve) => {
            Logger.info('[uv] 🔧 Checking if uv is available...');
            const process = spawn('uv', ['--version'], { shell: true });

            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    Logger.info(`[uv] 🔧 uv is available: ${output.trim()}`);
                    resolve(true);
                } else {
                    Logger.info(
                        `[uv] 🔧 ℹ️ uv is not available, you can install it from 🔗 ${this.UV_INSTALLATION_URL}`,
                    );
                    resolve(false);
                }
            });

            process.on('error', () => {
                Logger.error(
                    `[uv] 🔧 ℹ️ uv is not available, you can install it from 🔗 ${this.UV_INSTALLATION_URL}`,
                );
                resolve(false);
            });
        });
    }

    /**
     * Install Python using uv
     */
    private async uvInstallPython(): Promise<void> {
        try {
            Logger.info(
                `[uv] 🔧 Installing Python ${this.PYTHON_VERSION} with uv...`,
            );

            const { code, stdout, stderr } = await this.spawnUv(
                ['python', 'install', this.PYTHON_VERSION],
                { verbose: true, label: '🔧' },
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
            const { code, stdout, stderr } = await this.spawnUv(
                [
                    'venv',
                    '--clear',
                    '--python',
                    this.PYTHON_VERSION,
                    quoteIfNeeded(envPath),
                ],
                { verbose: true, label: '🔧' },
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
     * Install or upgrade required packages in the extension virtual environment.
     * Use upgrade: true when refreshing an existing env (--upgrade asks uv to pull newer versions).
     */
    private async uvInstallRequiredPackages(options?: {
        upgrade?: boolean;
    }): Promise<void> {
        if (!this.extensionEnv || !this.extensionEnv.isCreated) {
            throw new Error('Extension virtual environment not created');
        }

        const upgrade = options?.upgrade ?? false;

        // Check if uv is available for package installation
        const uvAvailable = await this.uvCheckAvailability();

        if (!uvAvailable) {
            Logger.warn('[uv] 🔧 uv is not available.');
            return;
        }

        Logger.info(
            upgrade
                ? '[uv] 📦 Upgrading required packages in extension virtual environment with uv...'
                : '[uv] 📦 Installing required packages in extension virtual environment with uv...',
        );
        Logger.info(
            `[uv] Target packages (${this.ALL_PACKAGES.length}): ${this.ALL_PACKAGES.join(', ')}`,
        );

        if (upgrade) {
            await this.logRequiredPackageVersions(
                'Package versions before upgrade:',
            );
            await this.logOutdatedRequiredPackages();
        }

        const installArgs = [
            'pip',
            'install',
            '--python',
            quoteIfNeeded(this.extensionEnv!.pythonPath),
        ];
        if (upgrade) {
            installArgs.push('--upgrade');
        }
        installArgs.push(...this.ALL_PACKAGES);

        const { code, stdout, stderr } = await this.spawnUv(installArgs, {
            verbose: true,
            label: '📦',
        });

        if (code === 0) {
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
            this.extensionEnv!.packages = [...this.ALL_PACKAGES];
            return;
        }

        throw new Error(
            `[uv] Failed to ${upgrade ? 'upgrade' : 'install'} packages with uv (exit code ${code}): ${
                stderr || stdout
            }`,
        );
    }
}
