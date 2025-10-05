import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { Logger } from './logger';

export interface VirtualEnvironment {
    name: string;
    path: string;
    pythonPath: string;
    type: 'uv' | 'venv' | 'conda' | 'pipenv' | 'poetry' | 'custom';
    isValid: boolean;
    packages?: string[];
}

export class VirtualEnvironmentManager {
    private detectedEnvironments: VirtualEnvironment[] = [];


    /**
     * Detect all virtual environments in the workspace and configured paths
     */
    async detectVirtualEnvironments(): Promise<VirtualEnvironment[]> {
        Logger.info('🔍 Detecting virtual environments...');
        this.detectedEnvironments = [];

        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const searchPaths: string[] = [];

        // Add workspace folders
        for (const folder of workspaceFolders) {
            searchPaths.push(folder.uri.fsPath);
        }


        // Detect environments in each path
        for (const searchPath of searchPaths) {
            await this.detectEnvironmentsInPath(searchPath);
        }

        Logger.info(`🔍 Found ${this.detectedEnvironments.length} virtual environments`);
        return this.detectedEnvironments;
    }

    /**
     * Detect virtual environments in a specific directory
     */
    private async detectEnvironmentsInPath(basePath: string): Promise<void> {
        try {
            const items = await fs.promises.readdir(basePath, { withFileTypes: true });
            
            for (const item of items) {
                if (item.isDirectory()) {
                    const envPath = path.join(basePath, item.name);
                    await this.checkForVirtualEnvironment(envPath, item.name);
                }
            }

            // // Also check for .venv in the base path (uv convention)
            // const uvEnvPath = path.join(basePath, '.venv');
            // if (fs.existsSync(uvEnvPath)) {
            //     await this.checkForVirtualEnvironment(uvEnvPath, '.venv');
            // }
        } catch (error) {
            Logger.debug(`🔍 Error reading directory ${basePath}: ${error}`);
        }
    }

    /**
     * Check if a directory contains a virtual environment
     */
    private async checkForVirtualEnvironment(envPath: string, name: string): Promise<void> {
        try {
            // Check for different virtual environment types
            const envTypes = [
                { type: 'uv' as const, pythonPath: path.join(envPath, 'bin', 'python'), checkFile: 'pyproject.toml' },
                { type: 'venv' as const, pythonPath: path.join(envPath, 'bin', 'python'), checkFile: 'pyvenv.cfg' },
                { type: 'conda' as const, pythonPath: path.join(envPath, 'bin', 'python'), checkFile: 'conda-meta' },
                { type: 'pipenv' as const, pythonPath: path.join(envPath, 'bin', 'python'), checkFile: 'Pipfile' },
                { type: 'poetry' as const, pythonPath: path.join(envPath, 'bin', 'python'), checkFile: 'pyproject.toml' }
            ];

            // Windows paths
            const windowsEnvTypes = [
                { type: 'uv' as const, pythonPath: path.join(envPath, 'Scripts', 'python.exe'), checkFile: 'pyproject.toml' },
                { type: 'venv' as const, pythonPath: path.join(envPath, 'Scripts', 'python.exe'), checkFile: 'pyvenv.cfg' },
                { type: 'conda' as const, pythonPath: path.join(envPath, 'Scripts', 'python.exe'), checkFile: 'conda-meta' },
                { type: 'pipenv' as const, pythonPath: path.join(envPath, 'Scripts', 'python.exe'), checkFile: 'Pipfile' },
                { type: 'poetry' as const, pythonPath: path.join(envPath, 'Scripts', 'python.exe'), checkFile: 'pyproject.toml' }
            ];

            const allEnvTypes = process.platform === 'win32' ? windowsEnvTypes : envTypes;

            for (const envType of allEnvTypes) {
                if (fs.existsSync(envType.pythonPath) && fs.existsSync(path.join(envPath, envType.checkFile))) {
                    const isValid = await this.validatePythonInterpreter(envType.pythonPath);
                    const packages = isValid ? await this.getInstalledPackages(envType.pythonPath) : [];

                    const virtualEnv: VirtualEnvironment = {
                        name: name,
                        path: envPath,
                        pythonPath: envType.pythonPath,
                        type: envType.type,
                        isValid: isValid,
                        packages: packages
                    };

                    this.detectedEnvironments.push(virtualEnv);
                    Logger.debug(`🔍 Found ${envType.type} environment: ${name} at ${envPath}`);
                    break; // Only add once per directory
                }
            }
        } catch (error) {
            Logger.debug(`🔍 Error checking virtual environment ${envPath}: ${error}`);
        }
    }

    /**
     * Validate that a Python interpreter is working
     */
    private async validatePythonInterpreter(pythonPath: string): Promise<boolean> {
        return new Promise((resolve) => {
            const process = spawn(pythonPath, ['--version'], { shell: true });
            
            process.on('close', (code) => {
                resolve(code === 0);
            });

            process.on('error', () => {
                resolve(false);
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                process.kill();
                resolve(false);
            }, 5000);
        });
    }

    /**
     * Get installed packages in a Python environment
     */
    public async getInstalledPackages(pythonPath: string): Promise<string[]> {
        return new Promise((resolve) => {
            const process = spawn(pythonPath, ['-c', 'import pkg_resources; print(",".join([d.project_name for d in pkg_resources.working_set]))'], { shell: true });
            
            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    const packages = output.trim().split(',').filter(pkg => pkg.trim());
                    resolve(packages);
                } else {
                    resolve([]);
                }
            });

            process.on('error', () => {
                resolve([]);
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                process.kill();
                resolve([]);
            }, 10000);
        });
    }

    /**
     * Get all detected virtual environments
     */
    getDetectedEnvironments(): VirtualEnvironment[] {
        return this.detectedEnvironments;
    }

    /**
     * Find a virtual environment by name or path
     */
    findEnvironment(nameOrPath: string): VirtualEnvironment | undefined {
        return this.detectedEnvironments.find(env => 
            env.name === nameOrPath || env.path === nameOrPath || env.pythonPath === nameOrPath
        );
    }

    /**
     * Get the best virtual environment for the current workspace
     */
    getBestEnvironment(): VirtualEnvironment | undefined {
        // Priority order: uv > venv > conda > pipenv > poetry
        const priority = ['uv', 'venv', 'conda', 'pipenv', 'poetry'];
        
        for (const type of priority) {
            const env = this.detectedEnvironments.find(e => e.type === type && e.isValid);
            if (env) {
                return env;
            }
        }

        // If no environment found by priority, return the first valid one
        return this.detectedEnvironments.find(e => e.isValid);
    }

    /**
     * Check if a virtual environment has the required packages
     */
    async checkRequiredPackages(env: VirtualEnvironment): Promise<{ hasRequired: boolean; missing: string[] }> {
        const requiredPackages = ['xarray', 'matplotlib'];
        const missing: string[] = [];

        for (const pkg of requiredPackages) {
            if (!env.packages?.includes(pkg)) {
                missing.push(pkg);
            }
        }

        return {
            hasRequired: missing.length === 0,
            missing: missing
        };
    }

    /**
     * Show a quick pick to select a virtual environment
     */
    async showEnvironmentSelector(): Promise<VirtualEnvironment | undefined> {
        if (this.detectedEnvironments.length === 0) {
            await this.detectVirtualEnvironments();
        }

        if (this.detectedEnvironments.length === 0) {
            vscode.window.showInformationMessage('No virtual environments found in the workspace.');
            return undefined;
        }

        const items = this.detectedEnvironments.map(env => ({
            label: `$(python) ${env.name}`,
            description: `${env.type} - ${env.path}`,
            detail: env.isValid ? `Valid (${env.packages?.length || 0} packages)` : 'Invalid Python interpreter',
            env: env
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a virtual environment',
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.env;
    }

    /**
     * Get the current Python interpreter from settings
     */
    getCurrentInterpreterFromSettings(): string | undefined {
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        return config.get<string>('overridePythonInterpreter') || undefined;
    }

    /**
     * Set the Python interpreter in settings
     */
    async setPythonInterpreter(pythonPath: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        await config.update('overridePythonInterpreter', pythonPath, vscode.ConfigurationTarget.Workspace);
        Logger.info(`🐍 Set Python interpreter to: ${pythonPath}`);
    }

    /**
     * Reset the Python interpreter to use the Python extension's default
     */
    async resetPythonInterpreter(): Promise<void> {
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        await config.update('overridePythonInterpreter', '', vscode.ConfigurationTarget.Workspace);
        Logger.info('🐍 Reset Python interpreter to use Python extension default');
    }

    /**
     * Get the effective Python interpreter (settings override or Python extension)
     */
    async getEffectiveInterpreter(): Promise<string | undefined> {
        const settingsInterpreter = this.getCurrentInterpreterFromSettings();
        if (settingsInterpreter) {
            return settingsInterpreter;
        }

        // Fall back to Python extension API
        try {
            const pythonExtension = vscode.extensions.getExtension('ms-python.python');
            if (pythonExtension && pythonExtension.isActive) {
                const pythonApi = await pythonExtension.activate();
                if (pythonApi && pythonApi.environments) {
                    const activeEnvironmentPath = await pythonApi.environments.getActiveEnvironmentPath();
                    return activeEnvironmentPath?.path;
                }
            }
        } catch (error) {
            Logger.debug(`🐍 Could not get Python extension interpreter: ${error}`);
        }

        return undefined;
    }
}

