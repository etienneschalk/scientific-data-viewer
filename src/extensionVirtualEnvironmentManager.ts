import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { Logger } from './logger';
import { quoteIfNeeded } from './utils';

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
    public readonly PYTHON_VERSION = '3.13';
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

            if (!uvAvailable) {
                throw new Error('uv is not available');
            }

            // Use uv to create the virtual environment with Python
            await this.installPythonAndCreateVirtualEnvironmentWithUv(
                this.extensionEnv!.path
            );
            this.extensionEnv!.createdWithUv = true;

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
        });
    }

    /**
     * Install Python using uv
     */
    private async installPythonWithUv(): Promise<void> {
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
    private async installPythonAndCreateVirtualEnvironmentWithUv(
        envPath: string
    ): Promise<void> {
        // First, ensure Python is available via uv
        await this.installPythonWithUv();

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
    private async installRequiredPackages(): Promise<void> {
        if (!this.extensionEnv || !this.extensionEnv.isCreated) {
            throw new Error('Extension virtual environment not created');
        }

        // Check if uv is available for package installation
        const uvAvailable = await this.checkUvAvailability();

        if (uvAvailable) {
            await this.installPackagesWithUv();
        } else {
            Logger.warn('🔧 uv is not available.');
        }
    }

    /**
     * Install packages using uv
     */
    private async installPackagesWithUv(): Promise<void> {
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
    getEnvironmentInfo(): ExtensionVirtualEnvironment {
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
        info.packages = this.extensionEnv?.packages || [];
        info.createdWithUv = this.extensionEnv!.createdWithUv;

        return info;
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

export class ExtensionVirtualEnvironmentManagerUI {
    constructor(
        private extensionEnvManager: ExtensionVirtualEnvironmentManager
    ) {}

    /**
     * Manage the extension virtual environment
     */
    public async manageExtensionOwnEnvironment(): Promise<void> {
        try {
            const envInfo = this.extensionEnvManager.getEnvironmentInfo();

            if (!envInfo.isCreated) {
                const createAction = await vscode.window.showQuickPick(
                    [
                        {
                            label: '$(plus) Create',
                            description: 'Create a new environment',
                        },
                        {
                            label: '$(close) Cancel',
                            description: 'Cancel environment creation',
                        },
                    ],
                    {
                        placeHolder:
                            'Extension virtual environment not found. What would you like to do?',
                        title: 'Extension Environment Setup',
                    }
                );

                if (createAction?.label === '$(plus) Create') {
                    await this.createExtensionOwnEnvironment();
                }
                return;
            }

            const action = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(sync) Update Packages',
                        description: 'Update all packages in the environment',
                    },
                    {
                        label: '$(trash) Delete',
                        description: 'Remove the environment',
                    },
                    {
                        label: '$(folder-opened) Open in Explorer',
                        description:
                            'Open the environment folder in file explorer',
                    },
                    {
                        label: '$(info) Information',
                        description:
                            'View detailed environment information in a new editor tab',
                    },
                    {
                        label: '$(close) Cancel',
                        description: 'Close this menu',
                    },
                ],
                {
                    placeHolder: 'Extension Virtual Environment Management',
                    title: 'Extension Environment Status',
                }
            );

            switch (action?.label) {
                case '$(plus) Create':
                    await this.createExtensionOwnEnvironment();
                    break;
                case '$(sync) Update Packages':
                    await this.updateExtensionOwnEnvironmentPackages();
                    break;
                case '$(trash) Delete':
                    await this.deleteExtensionOwnEnvironment();
                    break;
                case '$(folder-opened) Open in Explorer':
                    vscode.commands.executeCommand(
                        'revealFileInOS',
                        vscode.Uri.file(envInfo.path)
                    );
                    break;
                case '$(info) Information':
                    await this.showEnvironmentInfoInEditor(envInfo);
                    break;
            }
        } catch (error) {
            Logger.error(
                `🔧 ❌ Failed to manage extension environment: ${error}`
            );
            vscode.window.showErrorMessage(
                `Failed to manage extension environment: ${error}`
            );
        }
    }

    /**
     * Create the extension virtual environment
     */
    private async createExtensionOwnEnvironment(): Promise<void> {
        try {
            const created =
                await this.extensionEnvManager.createExtensionEnvironment();

            if (created) {
                // Update the configuration to use the extension environment
                const config = vscode.workspace.getConfiguration(
                    'scientificDataViewer.python'
                );
                await config.update(
                    'useExtensionOwnEnvironment',
                    true,
                    vscode.ConfigurationTarget.Workspace
                );
                vscode.window.showInformationMessage(
                    '✅ Extension virtual environment created successfully! The extension will now use its own isolated environment.'
                );
            } else {
                vscode.window.showErrorMessage(
                    '❌ Failed to create extension virtual environment. Please check the logs for details.'
                );
            }
        } catch (error) {
            Logger.error(
                `🔧 ❌ Failed to create extension environment: ${error}`
            );
            vscode.window.showErrorMessage(
                `Failed to create extension environment: ${error}`
            );
        }
    }

    /**
     * Update packages in the extension virtual environment
     */
    private async updateExtensionOwnEnvironmentPackages(): Promise<void> {
        try {
            Logger.info('📦 Updating extension environment packages...');
            const updated = await this.extensionEnvManager.updatePackages();

            if (updated) {
                vscode.window.showInformationMessage(
                    '✅ Extension environment packages updated successfully!'
                );
            } else {
                vscode.window.showErrorMessage(
                    '❌ Failed to update extension environment packages.'
                );
            }
        } catch (error) {
            Logger.error(
                `📦 ❌ Failed to update extension environment packages: ${error}`
            );
            vscode.window.showErrorMessage(
                `Failed to update packages: ${error}`
            );
        }
    }

    /**
     * Delete the extension virtual environment
     */
    private async deleteExtensionOwnEnvironment(): Promise<void> {
        try {
            const action = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(trash) Delete',
                        description:
                            'Are you sure? Permanently delete the extension virtual environment',
                    },
                    {
                        label: '$(close) Cancel',
                        description: 'Keep the environment and return to menu',
                    },
                ],
                {
                    placeHolder:
                        'Are you sure you want to delete the extension virtual environment?',
                    title: 'Delete Environment Confirmation',
                }
            );

            if (action?.label === '$(trash) Delete Environment') {
                Logger.info('🗑️ Deleting extension virtual environment...');
                const deleted =
                    await this.extensionEnvManager.deleteExtensionEnvironment();

                if (deleted) {
                    const config = vscode.workspace.getConfiguration(
                        'scientificDataViewer.python'
                    );
                    await config.update(
                        'useExtensionOwnEnvironment',
                        false,
                        vscode.ConfigurationTarget.Workspace
                    );
                    vscode.window.showInformationMessage(
                        '✅ Extension virtual environment deleted successfully!'
                    );
                } else {
                    vscode.window.showErrorMessage(
                        '❌ Failed to delete extension virtual environment.'
                    );
                }
            }
        } catch (error) {
            Logger.error(
                `🗑️ ❌ Failed to delete extension environment: ${error}`
            );
            vscode.window.showErrorMessage(
                `Failed to delete extension environment: ${error}`
            );
        }
    }

    /**
     * Show environment information in a new text editor tab
     */
    private async showEnvironmentInfoInEditor(
        envInfo: ExtensionVirtualEnvironment
    ): Promise<void> {
        try {
            const lastUpdated = envInfo.lastUpdated.toLocaleString();

            const toolUsed = envInfo.createdWithUv
                ? `uv (Python ${quoteIfNeeded(
                      this.extensionEnvManager.PYTHON_VERSION
                  )})`
                : 'Unknown';

            const envInfoContent = `
# Extension Virtual Environment Information

- 📁 Path: ${envInfo.path}
- 🐍 Python: ${envInfo.pythonPath}
- 🔧 Created with: ${toolUsed}
- 📦 Packages: ${envInfo.packages.length} installed
- 📅 Last Updated: ${lastUpdated}
- ${envInfo.isInitialized ? '✅ Status: Ready' : '❌ Status: Not Initialized'}

- 📦 Installed Packages:

${
    envInfo.packages.length > 0
        ? envInfo.packages.map((pkg: any) => `  - ${pkg}`).join('\n')
        : 'No packages installed'
}



_Report generated on: ${new Date().toLocaleString()}_
    `;

            // Create a new text document with the environment information
            const doc = await vscode.workspace.openTextDocument({
                content: envInfoContent,
                language: 'markdown',
            });

            // Open the document in a new editor tab
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true,
            });

            Logger.info(
                '📋 Environment information displayed in new editor tab'
            );
        } catch (error) {
            Logger.error(
                `📋 ❌ Failed to show environment info in editor: ${error}`
            );
            vscode.window.showErrorMessage(
                `Failed to show environment information: ${error}`
            );
        }
    }
}
