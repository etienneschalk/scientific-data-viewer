import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { Logger } from './logger';

export interface ExtensionVirtualEnvironment {
    path: string;
    pythonPath: string;
    isCreated: boolean;
    isInitialized: boolean;
    packages: string[];
    lastUpdated: Date;
    createdWithUv?: boolean;
}

export class ExtensionVirtualEnvironmentManager {
    private extensionEnv: ExtensionVirtualEnvironment | null = null;
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

    constructor(private context: vscode.ExtensionContext) {
        this.initializeExtensionEnvironment();
    }

    /**
     * Initialize the extension virtual environment
     */
    private initializeExtensionEnvironment(): void {
        const envPath = path.join(
            this.context.globalStorageUri.fsPath,
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
     * Create the extension's virtual environment
     */
    async createExtensionEnvironment(): Promise<boolean> {
        try {
            Logger.info('🔧 Creating extension virtual environment...');

            // Ensure the storage directory exists
            await fs.promises.mkdir(this.context.globalStorageUri.fsPath, {
                recursive: true,
            });

            // Check if uv is available - if not, fall back to Python venv
            const uvAvailable = await this.checkUvAvailability();

            if (uvAvailable) {
                // Use uv to create the virtual environment with Python 3.13
                await this.createVirtualEnvironmentWithUv(
                    this.extensionEnv!.path
                );
                this.extensionEnv!.createdWithUv = true;
            } else {
                // Fall back to Python venv
                const pythonInterpreter = await this.findPythonInterpreter();
                if (!pythonInterpreter) {
                    throw new Error(
                        'No suitable Python interpreter found to create virtual environment'
                    );
                }

                Logger.info(
                    `🔧 Using Python interpreter: ${pythonInterpreter}`
                );
                await this.createVirtualEnvironment(
                    pythonInterpreter,
                    this.extensionEnv!.path
                );
                this.extensionEnv!.createdWithUv = false;
            }

            // Update the extension environment state
            this.extensionEnv!.isCreated = true;
            this.extensionEnv!.isInitialized = false;

            // Install required packages
            await this.installRequiredPackages();

            this.extensionEnv!.isInitialized = true;
            this.extensionEnv!.lastUpdated = new Date();

            Logger.info(
                '✅ Extension virtual environment created successfully'
            );
            return true;
        } catch (error) {
            Logger.error(
                `❌ Failed to create extension virtual environment: ${error}`
            );
            return false;
        }
    }

    /**
     * Check if uv is available and can be used to create virtual environments
     */
    private async checkUvAvailability(): Promise<boolean> {
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
                    Logger.info('🔧 uv is not available, will use Python venv');
                    resolve(false);
                }
            });

            process.on('error', () => {
                Logger.info('🔧 uv is not available, will use Python venv');
                resolve(false);
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                process.kill();
                Logger.info('🔧 uv check timed out, will use Python venv');
                resolve(false);
            }, 5000);
        });
    }


    /**
     * Find a suitable Python interpreter for creating the virtual environment
     */
    private async findPythonInterpreter(): Promise<string | null> {
        const candidates = [
            'python3',
            'python',
            '/usr/bin/python3',
            '/usr/local/bin/python3',
        ];

        for (const candidate of candidates) {
            try {
                const isValid = await this.validatePythonInterpreter(candidate);
                if (isValid) {
                    return candidate;
                }
            } catch (error) {
                // Continue to next candidate
            }
        }

        return null;
    }

    /**
     * Validate that a Python interpreter is working and has venv module
     */
    private async validatePythonInterpreter(
        pythonPath: string
    ): Promise<boolean> {
        return new Promise((resolve) => {
            Logger.info(`🔧 Validating Python interpreter: ${pythonPath}`);
            const process = spawn(
                pythonPath,
                ['-c', `'import venv; print("venv available")'`],
                { shell: true }
            );

            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
                Logger.debug(`🔧 venv stdout: ${output}`);
            });

            process.stderr.on('data', (data) => {
                output += data.toString();
                Logger.debug(`🔧 venv stderr: ${output}`);
            });

            process.on('close', (code) => {
                resolve(code === 0 && output.includes('venv available'));
            });

            process.on('error', () => {
                resolve(false);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                process.kill();
                resolve(false);
            }, 10000);
        });
    }

    /**
     * Install Python 3.13 using uv
     */
    private async installPythonWithUv(): Promise<void> {
        return new Promise((resolve, reject) => {
            Logger.info('🔧 Installing Python 3.13 with uv...');

            const process = spawn('uv', ['python', 'install', '3.13'], {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

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
                        '✅ Python 3.13 installed successfully with uv'
                    );
                    resolve();
                } else {
                    Logger.warn(
                        `⚠️ Failed to install Python 3.13 with uv (exit code ${code}): ${
                            stderr || stdout
                        }`
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

            // Timeout after 2 minutes
            setTimeout(() => {
                process.kill();
                Logger.warn(
                    '⚠️ Python installation with uv timed out, continuing with system Python'
                );
                resolve();
            }, 120000);
        });
    }

    /**
     * Create a virtual environment using uv
     */
    private async createVirtualEnvironmentWithUv(
        envPath: string
    ): Promise<void> {
        // First, ensure Python 3.13 is available via uv
        await this.installPythonWithUv();

        return new Promise((resolve, reject) => {
            Logger.info(
                `🔧 Creating virtual environment with uv at: ${envPath}`
            );

            // Try to use Python 3.13 specifically
            const process = spawn('uv', ['venv', '--python', '3.13', envPath], {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

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
                        '✅ Virtual environment created successfully with uv using Python 3.13'
                    );
                    resolve();
                } else {
                    // If Python 3.13 failed, try with system Python
                    Logger.warn(
                        `⚠️ Failed to create environment with Python 3.13, trying with system Python: ${
                            stderr || stdout
                        }`
                    );
                    this.createVirtualEnvironmentWithUvFallback(envPath)
                        .then(resolve)
                        .catch(reject);
                }
            });

            process.on('error', (error) => {
                Logger.warn(
                    `⚠️ Failed to execute uv venv with Python 3.13: ${error.message}`
                );
                // Try with system Python
                this.createVirtualEnvironmentWithUvFallback(envPath)
                    .then(resolve)
                    .catch(reject);
            });

            // Timeout after 30 seconds (uv is faster)
            setTimeout(() => {
                process.kill();
                Logger.warn(
                    '⚠️ Virtual environment creation with uv timed out, trying fallback'
                );
                this.createVirtualEnvironmentWithUvFallback(envPath)
                    .then(resolve)
                    .catch(reject);
            }, 30000);
        });
    }

    /**
     * Fallback method to create virtual environment with uv using system Python
     */
    private async createVirtualEnvironmentWithUvFallback(
        envPath: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            Logger.info(
                `🔧 Creating virtual environment with uv using system Python at: ${envPath}`
            );

            const process = spawn('uv', ['venv', envPath], {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                Logger.debug(`🔧 uv venv fallback stdout: ${output}`);
            });

            process.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                Logger.debug(`🔧 uv venv fallback stderr: ${output}`);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    Logger.info(
                        '✅ Virtual environment created successfully with uv using system Python'
                    );
                    resolve();
                } else {
                    reject(
                        new Error(
                            `Failed to create virtual environment with uv fallback (exit code ${code}): ${
                                stderr || stdout
                            }`
                        )
                    );
                }
            });

            process.on('error', (error) => {
                reject(
                    new Error(
                        `Failed to execute uv venv fallback command: ${error.message}`
                    )
                );
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                process.kill();
                reject(
                    new Error(
                        'Virtual environment creation with uv fallback timed out'
                    )
                );
            }, 30000);
        });
    }

    /**
     * Create a virtual environment using the specified Python interpreter
     */
    private async createVirtualEnvironment(
        pythonPath: string,
        envPath: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            Logger.info(
                `🔧 Creating virtual environment with Python venv at: ${envPath}`
            );

            const process = spawn(pythonPath, ['-m', 'venv', envPath], {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                Logger.debug(`🔧 venv stdout: ${output}`);
            });

            process.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                Logger.debug(`🔧 venv stderr: ${output}`);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    Logger.info(
                        '✅ Virtual environment created successfully with Python venv'
                    );
                    resolve();
                } else {
                    reject(
                        new Error(
                            `Failed to create virtual environment (exit code ${code}): ${
                                stderr || stdout
                            }`
                        )
                    );
                }
            });

            process.on('error', (error) => {
                reject(
                    new Error(
                        `Failed to execute venv command: ${error.message}`
                    )
                );
            });

            // Timeout after 60 seconds
            setTimeout(() => {
                process.kill();
                reject(new Error('Virtual environment creation timed out'));
            }, 60000);
        });
    }

    /**
     * Install required packages in the extension virtual environment
     */
    private async installRequiredPackages(): Promise<void> {
        if (!this.extensionEnv || !this.extensionEnv.isCreated) {
            throw new Error('Extension virtual environment not created');
        }

        Logger.info(
            '📦 Installing required packages in extension virtual environment...'
        );

        // Check if uv is available for package installation
        const uvAvailable = await this.checkUvAvailability();

        if (uvAvailable) {
            await this.installPackagesWithUv();
        } else {
            await this.installPackagesWithPip();
        }
    }

    /**
     * Install packages using uv
     */
    private async installPackagesWithUv(): Promise<void> {
        return new Promise((resolve, reject) => {
            Logger.info('📦 Installing packages with uv...');

            // Use the environment's Python path
            const uvProcess = spawn(
                'uv',
                [
                    'pip',
                    'install',
                    '--python',
                    this.extensionEnv!.pythonPath,
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
                reject(
                    new Error(`Failed to execute uv pip: ${error.message}`)
                );
            });

            // Timeout after 3 minutes (uv is faster)
            setTimeout(() => {
                uvProcess.kill();
                reject(new Error('Package installation with uv timed out'));
            }, 180000);
        });
    }


    /**
     * Install packages using pip
     */
    private async installPackagesWithPip(): Promise<void> {
        return new Promise((resolve, reject) => {
            Logger.info('📦 Installing packages with pip...');

            const pipProcess = spawn(
                this.extensionEnv!.pythonPath,
                ['-m', 'pip', 'install', ...this.REQUIRED_PACKAGES],
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
                Logger.debug(`📦 pip stdout: ${output}`);
            });

            pipProcess.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                Logger.debug(`📦 pip stderr: ${output}`);
            });

            pipProcess.on('close', (code) => {
                if (code === 0) {
                    Logger.info(
                        '✅ Required packages installed successfully with pip'
                    );
                    this.extensionEnv!.packages = [...this.REQUIRED_PACKAGES];
                    resolve();
                } else {
                    reject(
                        new Error(
                            `Failed to install packages with pip (exit code ${code}): ${
                                stderr || stdout
                            }`
                        )
                    );
                }
            });

            pipProcess.on('error', (error) => {
                reject(new Error(`Failed to execute pip: ${error.message}`));
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                pipProcess.kill();
                reject(new Error('Package installation with pip timed out'));
            }, 300000);
        });
    }

    /**
     * Get the extension virtual environment
     */
    getExtensionEnvironment(): ExtensionVirtualEnvironment | null {
        return this.extensionEnv;
    }

    /**
     * Check if the extension virtual environment is ready to use
     */
    isReady(): boolean {
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
    getPythonPath(): string | null {
        if (this.isReady()) {
            return this.extensionEnv!.pythonPath;
        }
        return null;
    }

    /**
     * Update packages in the extension virtual environment
     */
    async updatePackages(): Promise<boolean> {
        if (!this.isReady()) {
            Logger.warn(
                'Extension virtual environment not ready for package updates'
            );
            return false;
        }

        try {
            Logger.info(
                '📦 Updating packages in extension virtual environment...'
            );
            await this.installRequiredPackages();
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
    async deleteExtensionEnvironment(): Promise<boolean> {
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
     * Get information about the extension virtual environment
     */
    getEnvironmentInfo(): {
        isCreated: boolean;
        isInitialized: boolean;
        path: string;
        pythonPath: string;
        packages: string[];
        lastUpdated: Date;
        size?: number;
    } {
        if (!this.extensionEnv) {
            return {
                isCreated: false,
                isInitialized: false,
                path: '',
                pythonPath: '',
                packages: [],
                lastUpdated: new Date(),
            };
        }

        const info = { ...this.extensionEnv };

        // Try to get directory size
        try {
            if (
                this.extensionEnv.isCreated &&
                fs.existsSync(this.extensionEnv.path)
            ) {
                const stats = fs.statSync(this.extensionEnv.path);
                // info.size = this.getDirectorySize(this.extensionEnv.path);
            }
        } catch (error) {
            Logger.debug(`Could not get directory size: ${error}`);
        }

        return info;
    }

    /**
     * Calculate directory size recursively
     */
    private getDirectorySize(dirPath: string): number {
        let totalSize = 0;

        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = fs.statSync(itemPath);

                if (stats.isDirectory()) {
                    totalSize += this.getDirectorySize(itemPath);
                } else {
                    totalSize += stats.size;
                }
            }
        } catch (error) {
            Logger.debug(
                `Error calculating directory size for ${dirPath}: ${error}`
            );
        }

        return totalSize;
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
