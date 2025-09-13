import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';

export class PythonManager {
    private pythonPath: string | undefined;
    private isInitialized: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
        this.pythonPath = vscode.workspace.getConfiguration('scientificDataViewer').get('pythonPath');
    }

    async initialize(): Promise<void> {
        if (this.pythonPath) {
            await this.validatePythonEnvironment();
        } else {
            await this.findPythonInterpreter();
        }
    }

    async selectInterpreter(): Promise<void> {
        const pythonInterpreters = await this.findPythonInterpreters();
        
        if (pythonInterpreters.length === 0) {
            vscode.window.showErrorMessage('No Python interpreters found. Please install Python and required packages.');
            return;
        }

        const items = pythonInterpreters.map(interpreter => ({
            label: interpreter.path,
            description: interpreter.version,
            detail: interpreter.packages ? `Packages: ${interpreter.packages.join(', ')}` : 'No required packages found'
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select Python interpreter for scientific data processing',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            this.pythonPath = selected.label;
            await this.updateConfiguration();
            await this.validatePythonEnvironment();
        }
    }

    private async findPythonInterpreters(): Promise<Array<{path: string, version: string, packages?: string[]}>> {
        const interpreters: Array<{path: string, version: string, packages?: string[]}> = [];
        
        // Common Python paths to check
        const commonPaths = [
            'python3',
            'python',
            '/usr/bin/python3',
            '/usr/local/bin/python3',
            'C:\\Python39\\python.exe',
            'C:\\Python310\\python.exe',
            'C:\\Python311\\python.exe'
        ];

        for (const pythonPath of commonPaths) {
            try {
                const version = await this.getPythonVersion(pythonPath);
                if (version) {
                    const packages = await this.checkRequiredPackages(pythonPath);
                    interpreters.push({
                        path: pythonPath,
                        version: version,
                        packages: packages
                    });
                }
            } catch (error) {
                // Ignore errors for individual paths
            }
        }

        return interpreters;
    }

    private async findPythonInterpreter(): Promise<void> {
        const interpreters = await this.findPythonInterpreters();
        
        if (interpreters.length > 0) {
            // Use the first interpreter with required packages, or the first one available
            const interpreterWithPackages = interpreters.find(i => i.packages && i.packages.length > 0);
            this.pythonPath = interpreterWithPackages ? interpreterWithPackages.path : interpreters[0].path;
            await this.updateConfiguration();
        } else {
            vscode.window.showWarningMessage(
                'No suitable Python interpreter found. Please install Python with required packages (xarray, netCDF4, zarr).'
            );
        }
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

    private async checkRequiredPackages(pythonPath: string): Promise<string[]> {
        const requiredPackages = ['xarray', 'netCDF4', 'zarr', 'h5py', 'numpy'];
        const availablePackages: string[] = [];

        for (const packageName of requiredPackages) {
            try {
                const isAvailable = await this.checkPackageAvailability(pythonPath, packageName);
                if (isAvailable) {
                    availablePackages.push(packageName);
                }
            } catch (error) {
                // Package not available
            }
        }

        return availablePackages;
    }

    private async checkPackageAvailability(pythonPath: string, packageName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const process = spawn(pythonPath, ['-c', `import ${packageName}`], { shell: true });
            
            process.on('close', (code) => {
                resolve(code === 0);
            });
            
            process.on('error', () => {
                resolve(false);
            });
        });
    }

    private async validatePythonEnvironment(): Promise<void> {
        if (!this.pythonPath) {
            throw new Error('No Python interpreter configured');
        }

        try {
            const packages = await this.checkRequiredPackages(this.pythonPath);
            const missingPackages = ['xarray', 'netCDF4', 'zarr', 'h5py', 'numpy'].filter(
                pkg => !packages.includes(pkg)
            );

            if (missingPackages.length > 0) {
                const installCommand = `${this.pythonPath} -m pip install ${missingPackages.join(' ')}`;
                const action = await vscode.window.showWarningMessage(
                    `Missing required packages: ${missingPackages.join(', ')}. Install them?`,
                    'Install',
                    'Cancel'
                );

                if (action === 'Install') {
                    await this.installPackages(missingPackages);
                }
            } else {
                this.isInitialized = true;
                vscode.window.showInformationMessage('Python environment validated successfully!');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to validate Python environment: ${error}`);
        }
    }

    private async installPackages(packages: string[]): Promise<void> {
        if (!this.pythonPath) {
            throw new Error('No Python interpreter configured');
        }

        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonPath!, ['-m', 'pip', 'install', ...packages], { 
                shell: true,
                stdio: 'inherit'
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    this.isInitialized = true;
                    vscode.window.showInformationMessage('Packages installed successfully!');
                    resolve();
                } else {
                    reject(new Error(`Failed to install packages. Exit code: ${code}`));
                }
            });
            
            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    private async updateConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        await config.update('pythonPath', this.pythonPath, vscode.ConfigurationTarget.Global);
    }

    async executePythonScript(script: string, args: string[] = []): Promise<any> {
        if (!this.pythonPath || !this.isInitialized) {
            throw new Error('Python environment not properly initialized');
        }

        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonPath!, ['-c', script, ...args], { 
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe']
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
                    reject(new Error(`Python script failed: ${stderr}`));
                }
            });
            
            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    getPythonPath(): string | undefined {
        return this.pythonPath;
    }

    isReady(): boolean {
        return this.isInitialized && this.pythonPath !== undefined;
    }
}
