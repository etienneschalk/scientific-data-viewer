import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from './logger';

export class PythonManager {
    private pythonPath: string | undefined;
    private isInitialized: boolean = false;

    constructor(private context: vscode.ExtensionContext) {
        // Initialize without old pythonPath setting - will get from Python extension API
        this.pythonPath = undefined;
    }

    async initialize(): Promise<void> {
        // Get Python interpreter from Python extension API (recommended method)
        const newPythonPath = await this.getPythonInterpreterFromExtension();
        
        if (newPythonPath && newPythonPath !== this.pythonPath) {
            Logger.info(`Python interpreter changed from ${this.pythonPath} to ${newPythonPath}`);
            this.pythonPath = newPythonPath;
        }

        if (this.pythonPath) {
            await this.validatePythonEnvironment();
        } else {
            await this.findPythonInterpreter();
        }
    }

    private async getPythonInterpreterFromExtension(): Promise<string | undefined> {
        try {
            const pythonExtension = vscode.extensions.getExtension('ms-python.python');
            if (!pythonExtension) {
                Logger.debug('Python extension not found');
                return undefined;
            }

            if (!pythonExtension.isActive) {
                Logger.debug('Python extension is not active, attempting to activate...');
            }

            // Ensure the extension is activated
            const pythonApi = await pythonExtension.activate();
            
            if (!pythonApi) {
                Logger.warn('❌ Python extension API is not available after activation');
                return undefined;
            }
            else {
                Logger.debug('✅ Python extension API is available after activation');
            }
            
            // Try the new environments API first
            if (pythonApi.environments && typeof pythonApi.environments.getActiveInterpreter === 'function') {
                try {
                    const activeInterpreter = await pythonApi.environments.getActiveInterpreter();
                    Logger.debug(`Python extension API active interpreter: ${JSON.stringify(activeInterpreter)}`);
                    return activeInterpreter?.path;
                } catch (envError) {
                    Logger.debug(`Environments API error: ${envError}`);
                }
            }
            
            // Fallback to old settings API if available
            if (pythonApi.settings && typeof pythonApi.settings.getInterpreterDetails === 'function') {
                try {
                    const interpreterDetails = await pythonApi.settings.getInterpreterDetails();
                    Logger.debug(`Python extension API interpreter details (legacy): ${JSON.stringify(interpreterDetails)}`);
                    return interpreterDetails?.path;
                } catch (legacyError) {
                    Logger.debug(`Legacy API error: ${legacyError}`);
                }
            }
            
            Logger.warn('No compatible Python extension API found');
        } catch (error) {
            Logger.warn(`Could not access Python extension API: ${error}`);
        }
        
        // Fallback: try to get from VSCode configuration
        try {
            const vscodePythonPath = vscode.workspace.getConfiguration('python').get('defaultInterpreterPath') as string | undefined;
            if (vscodePythonPath) {
                Logger.debug(`Using Python path from VSCode configuration: ${vscodePythonPath}`);
            }
            return vscodePythonPath;
        } catch (error) {
            Logger.warn(`Could not access Python configuration: ${error}`);
        }
        
        return undefined;
    }



    private async findPythonInterpreter(): Promise<void> {
        // Try to get interpreter from Python extension API first
        const extensionPath = await this.getPythonInterpreterFromExtension();
        if (extensionPath) {
            this.pythonPath = extensionPath;
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
            'C:\\Python311\\python.exe'
        ];

        for (const pythonPath of commonPaths) {
            try {
                const version = await this.getPythonVersion(pythonPath);
                if (version) {
                    this.pythonPath = pythonPath;
                    return;
                }
            } catch (error) {
                // Ignore errors for individual paths
            }
        }

        vscode.window.showWarningMessage(
            'No suitable Python interpreter found. Please install Python and use VSCode\'s "Select Python Interpreter" command.'
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

    private async checkPipAvailability(): Promise<void> {
        if (!this.pythonPath) {
            throw new Error('No Python interpreter configured');
        }

        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonPath!, ['-m', 'pip', '--version'], { 
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
                    Logger.debug(`pip version: ${stdout.trim()}`);
                    resolve();
                } else {
                    reject(new Error(`pip check failed (exit code ${code}): ${stderr || stdout}`));
                }
            });
            
            process.on('error', (error) => {
                reject(new Error(`Failed to check pip availability: ${error.message}`));
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
                const action = await vscode.window.showWarningMessage(
                    `AAA
                    You are using the Python interpreter at ${this.pythonPath}. Missing required packages: ${missingPackages.join(', ')}. Install them?`,
                    'Install',
                    'Cancel'
                );

                if (action === 'Install') {
                    try {
                        await this.installPackages(missingPackages);
                    } catch (error) {
                        Logger.error(`Package installation failed: ${error}`);
                        // Show detailed error information
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Package installation failed: ${errorMessage}`);
                        throw error; // Re-throw to be caught by the outer try-catch
                    }
                }
            } else {
                this.isInitialized = true;
                // Don't show notification during initialization - only when interpreter changes
                Logger.info(`Python environment ready! Using interpreter: ${this.pythonPath}`);
            }
        } catch (error) {
            Logger.error(`Python environment validation failed: ${error}`);
            vscode.window.showErrorMessage(`Failed to validate Python environment: ${error}`);
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
            throw new Error(`pip is not available: ${error}. Please install pip or use a different Python interpreter.`);
        }

        return new Promise((resolve, reject) => {
            Logger.info(`Installing packages: ${packages.join(', ')} using Python: ${this.pythonPath}`);
            Logger.debug(`Working directory: ${process.cwd()}`);
            Logger.debug(`Environment PATH: ${process.env.PATH}`);
            
            const pipProcess = spawn(this.pythonPath!, ['-m', 'pip', 'install', ...packages], { 
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            
            pipProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                Logger.debug(`pip stdout: ${output}`);
            });
            
            pipProcess.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                Logger.warn(`pip stderr: ${output}`);
            });
            
            pipProcess.on('close', (code) => {
                Logger.debug(`pip process exited with code: ${code}`);
                Logger.debug(`pip stdout: ${stdout}`);
                Logger.debug(`pip stderr: ${stderr}`);
                
                if (code === 0) {
                    this.isInitialized = true;
                    vscode.window.showInformationMessage('Packages installed successfully!');
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
                    if (stderr.includes('Permission denied') || stderr.includes('Access is denied')) {
                        errorMessage += `\n\n💡 Troubleshooting: Permission denied. Try running:\n${this.pythonPath} -m pip install --user ${packages.join(' ')}`;
                    } else if (stderr.includes('No module named pip')) {
                        errorMessage += `\n\n💡 Troubleshooting: pip is not installed. Try installing pip first or use a different Python interpreter.`;
                    } else if (stderr.includes('Could not find a version')) {
                        errorMessage += `\n\n💡 Troubleshooting: Package version not found. Try updating pip:\n${this.pythonPath} -m pip install --upgrade pip`;
                    } else if (stderr.includes('SSL') || stderr.includes('certificate')) {
                        errorMessage += `\n\n💡 Troubleshooting: SSL/Certificate issue. Try:\n${this.pythonPath} -m pip install --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org ${packages.join(' ')}`;
                    } else if (stderr.includes('Microsoft Visual C++')) {
                        errorMessage += `\n\n💡 Troubleshooting: Missing Visual C++ compiler. Install Microsoft Visual C++ Build Tools or use pre-compiled packages.`;
                    }
                    
                    reject(new Error(errorMessage));
                }
            });
            
            pipProcess.on('error', (error) => {
                Logger.error(`pip process error: ${error.message}`);
                let errorMessage = `Failed to execute pip: ${error.message}`;
                
                if (error.message.includes('ENOENT')) {
                    errorMessage += `\n\n💡 Troubleshooting: Python interpreter not found at: ${this.pythonPath}`;
                    errorMessage += `\nPlease check your Python installation and try selecting a different interpreter.`;
                }
                
                reject(new Error(errorMessage));
            });
        });
    }


    async executePythonScript(script: string, args: string[] = []): Promise<any> {
        if (!this.pythonPath || !this.isInitialized) {
            throw new Error('Python environment not properly initialized. Please run "Select Python Interpreter" command first.');
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
                    const errorMessage = stderr || 'Unknown Python error';
                    if (errorMessage.includes('ModuleNotFoundError')) {
                        reject(new Error(`Missing Python package: ${errorMessage}. Please install required packages with: pip install xarray netCDF4 zarr h5py numpy matplotlib`));
                    } else if (errorMessage.includes('PermissionError')) {
                        reject(new Error(`Permission denied: ${errorMessage}. Please check file permissions.`));
                    } else if (errorMessage.includes('FileNotFoundError')) {
                        reject(new Error(`File not found: ${errorMessage}. Please check the file path.`));
                    } else {
                        reject(new Error(`Python script failed (exit code ${code}): ${errorMessage}`));
                    }
                }
            });
            
            process.on('error', (error) => {
                if (error.message.includes('ENOENT')) {
                    reject(new Error(`Python interpreter not found at: ${this.pythonPath}. Please check your Python installation.`));
                } else {
                    reject(new Error(`Failed to execute Python script: ${error.message}`));
                }
            });
        });
    }

    getPythonPath(): string | undefined {
        return this.pythonPath;
    }

    isReady(): boolean {
        return this.isInitialized && this.pythonPath !== undefined;
    }

    async forceReinitialize(): Promise<void> {
        Logger.info('Force reinitializing Python environment...');
        this.isInitialized = false;
        await this.initialize();
    }

    async getCurrentInterpreterPath(): Promise<string | undefined> {
        return await this.getPythonInterpreterFromExtension();
    }

    /**
     * Check if the Python extension is available and active
     */
    private isPythonExtensionAvailable(): boolean {
        const pythonExtension = vscode.extensions.getExtension('ms-python.python');
        return pythonExtension !== undefined;
    }

    /**
     * Get Python extension API if available
     */
    private async getPythonExtensionApi(): Promise<any | undefined> {
        try {
            const pythonExtension = vscode.extensions.getExtension('ms-python.python');
            if (!pythonExtension) {
                return undefined;
            }
            return await pythonExtension.activate();
        } catch (error) {
            Logger.debug(`Failed to activate Python extension: ${error}`);
            return undefined;
        }
    }

}
