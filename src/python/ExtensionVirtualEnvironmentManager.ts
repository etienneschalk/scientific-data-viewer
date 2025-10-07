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
    private readonly REQUIRED_PACKAGES = [
        'xarray',
        'matplotlib',
        'netCDF4',
        'h5netcdf',
        'zarr',
        'h5py',
        'scipy',
        'cfgrib',
        'rioxarray',
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
        Logger.info('🔧 Creating extension virtual environment...');

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
        await this.uvInstallRequiredPackages();

        this.extensionEnv!.isInitialized = true;
        this.extensionEnv!.lastUpdated = new Date();

        Logger.info('✅ Extension virtual environment created successfully');
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
                'Extension virtual environment not ready for package updates'
            );
            return false;
        }

        try {
            Logger.info(
                '📦 Updating packages in extension virtual environment...'
            );
            await this.uvInstallRequiredPackages();
            this.extensionEnv!.lastUpdated = new Date();
            Logger.info('✅ Packages updated successfully');
            return true;
        } catch (error) {
            Logger.error(`❌ Failed to update packages: ${error}`);
            return false;
        }
    }

    /**
     * Delete the extension virtual environment
     */
    async delete(): Promise<boolean> {
        try {
            if (this.extensionEnv && this.extensionEnv.isCreated) {
                Logger.info('🗑️ Deleting extension virtual environment...');
                await fs.promises.rm(this.extensionEnv.path, {
                    recursive: true,
                    force: true,
                });

                this.extensionEnv.isCreated = false;
                this.extensionEnv.isInitialized = false;
                this.extensionEnv.packages = [];

                Logger.info(
                    '✅ Extension virtual environment deleted successfully'
                );
                return true;
            }
            return true;
        } catch (error) {
            Logger.error(
                `❌ Failed to delete extension virtual environment: ${error}`
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
            this.ENV_FOLDER_NAME
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
            `🔧 Extension virtual environment initialized at: ${envPath}`
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

    /**
     * Check if uv is available and can be used to create virtual environments
     */
    private async uvCheckAvailability(): Promise<boolean> {
        return new Promise((resolve) => {
            Logger.info('🔧 Checking if uv is available...');
            const process = spawn('uv', ['--version'], { shell: true });

            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    Logger.info(`🔧 uv is available: ${output.trim()}`);
                    resolve(true);
                } else {
                    Logger.info(
                        `🔧 ℹ️ uv is not available, you can install it from 🔗 ${this.UV_INSTALLATION_URL}`
                    );
                    resolve(false);
                }
            });

            process.on('error', () => {
                Logger.error(
                    `🔧 ℹ️ uv is not available, you can install it from 🔗 ${this.UV_INSTALLATION_URL}`
                );
                resolve(false);
            });
        });
    }

    /**
     * Install Python using uv
     */
    private async uvInstallPython(): Promise<void> {
        return new Promise((resolve, reject) => {
            Logger.info(
                `🔧 Installing Python ${this.PYTHON_VERSION} with uv...`
            );

            const process = spawn(
                'uv',
                ['python', 'install', this.PYTHON_VERSION],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                Logger.debug(`🔧 uv python install stdout: ${output}`);
            });

            process.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                Logger.debug(`🔧 uv python install stderr: ${output}`);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    Logger.info(
                        `✅ Python ${this.PYTHON_VERSION} installed successfully with uv`
                    );
                    resolve();
                } else {
                    Logger.warn(
                        `⚠️ Failed to install Python ${
                            this.PYTHON_VERSION
                        } with uv (exit code ${code}): ${stderr || stdout}`
                    );
                    // Don't reject - continue with system Python
                    resolve();
                }
            });

            process.on('error', (error) => {
                Logger.warn(
                    `⚠️ Failed to execute uv python install: ${error.message}`
                );
                // Don't reject - continue with system Python
                resolve();
            });
        });
    }

    /**
     * Create a virtual environment using uv
     */
    private async uvCreateVirtualEnvironment(envPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            Logger.info(
                `🔧 Creating virtual environment with uv at: ${envPath}`
            );

            // Try to use Python specifically
            const process = spawn(
                'uv',
                [
                    'venv',
                    '--python',
                    this.PYTHON_VERSION,
                    quoteIfNeeded(envPath),
                ],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                Logger.debug(`🔧 uv venv stdout: ${output}`);
            });

            process.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                Logger.debug(`🔧 uv venv stderr: ${output}`);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    Logger.info(
                        `✅ Virtual environment created successfully with uv using Python ${this.PYTHON_VERSION}`
                    );
                    resolve();
                } else {
                    // If Python failed, try with system Python
                    Logger.warn(
                        `⚠️ Failed to create environment with Python ${
                            this.PYTHON_VERSION
                        }: code: ${code}: ${stderr || stdout}`
                    );
                }
            });

            process.on('error', (error) => {
                Logger.warn(
                    `⚠️ Failed to execute uv venv with Python ${this.PYTHON_VERSION}: ${error.message}`
                );
            });
        });
    }

    /**
     * Install required packages in the extension virtual environment
     */
    private async uvInstallRequiredPackages(): Promise<void> {
        if (!this.extensionEnv || !this.extensionEnv.isCreated) {
            throw new Error('Extension virtual environment not created');
        }

        // Check if uv is available for package installation
        const uvAvailable = await this.uvCheckAvailability();

        if (!uvAvailable) {
            Logger.warn('🔧 uv is not available.');
            return;
        }

        return new Promise((resolve, reject) => {
            Logger.info(
                '📦 Installing required packages in extension virtual environment with uv...'
            );

            // Use the environment's Python path
            const uvProcess = spawn(
                'uv',
                [
                    'pip',
                    'install',
                    '--python',
                    quoteIfNeeded(this.extensionEnv!.pythonPath),
                    ...this.REQUIRED_PACKAGES,
                ],
                {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            let stdout = '';
            let stderr = '';

            uvProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                Logger.debug(`📦 uv pip stdout: ${output}`);
            });

            uvProcess.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                Logger.debug(`📦 uv pip stderr: ${output}`);
            });

            uvProcess.on('close', (code) => {
                if (code === 0) {
                    Logger.info(
                        '✅ Required packages installed successfully with uv'
                    );
                    this.extensionEnv!.packages = [...this.REQUIRED_PACKAGES];
                    resolve();
                } else {
                    reject(
                        new Error(
                            `Failed to install packages with uv (exit code ${code}): ${
                                stderr || stdout
                            }`
                        )
                    );
                }
            });

            uvProcess.on('error', (error) => {
                reject(new Error(`Failed to execute uv pip: ${error.message}`));
            });
        });
    }
}
