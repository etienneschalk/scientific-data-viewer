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
            // Reset initialization state when interpreter changes
            this.isInitialized = false;
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
                Logger.error('Python extension not found');
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
                Logger.debug(`Python API structure: ${JSON.stringify(Object.keys(pythonApi))}`);
                if (pythonApi.environments) {
                    Logger.debug(`Environments API methods: ${JSON.stringify(Object.keys(pythonApi.environments))}`);
                }
            }
            
            // Try the new environments API first
            if (pythonApi.environments && typeof pythonApi.environments.getActiveEnvironmentPath === 'function') {
                try {
                    const activeEnvironment = await pythonApi.environments.getActiveEnvironmentPath();
                    Logger.debug(`Python extension API active environment: ${JSON.stringify(activeEnvironment)}`);
                    return activeEnvironment?.path;
                } catch (envError) {
                    Logger.debug(`Environments API error: ${envError}`);
                }
            }
            
            // Try alternative environments API methods
            if (pythonApi.environments) {
                // Try getActiveInterpreter if available
                if (typeof pythonApi.environments.getActiveInterpreter === 'function') {
                    try {
                        const activeInterpreter = await pythonApi.environments.getActiveInterpreter();
                        Logger.debug(`Python extension API active interpreter (alt): ${JSON.stringify(activeInterpreter)}`);
                        return activeInterpreter?.path;
                    } catch (altError) {
                        Logger.debug(`Alternative environments API error: ${altError}`);
                    }
                }
                
                // Try getActiveEnvironment if available
                if (typeof pythonApi.environments.getActiveEnvironment === 'function') {
                    try {
                        const activeEnv = await pythonApi.environments.getActiveEnvironment();
                        Logger.debug(`Python extension API active environment (alt): ${JSON.stringify(activeEnv)}`);
                        return activeEnv?.path;
                    } catch (altError) {
                        Logger.debug(`Alternative environments API error: ${altError}`);
                    }
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
            // Validate the found interpreter
            await this.validatePythonEnvironment();
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
                    // Validate the found interpreter
                    await this.validatePythonEnvironment();
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
        Logger.debug(`Checking required packages`);
        Logger.debug(`Python path: ${pythonPath}`);

        const requiredPackages = ['xarray', 'netCDF4', 'zarr', 'h5py', 'numpy'];
        const availablePackages: string[] = [];

        for (const packageName of requiredPackages) {
            try {
                const isAvailable = await this.checkPackageAvailability(pythonPath, packageName);
                if (isAvailable) {
                    availablePackages.push(packageName);
                    Logger.debug(`Package available: ${packageName}`);
                }
                else {
                    Logger.debug(`Package not available: ${packageName}`);
                }
            } catch (error) {
                Logger.debug(`Package not available: ${packageName}: error: ${error}`);
            }
        }

        Logger.debug(`Available packages: ${availablePackages}`);
        return availablePackages;
    }

    private async checkPackageAvailability(pythonPath: string, packageName: string): Promise<boolean> {
        return new Promise((resolve) => {
            const args = ['-c', `'import ${packageName}'`];
            const process = spawn(pythonPath, args, { shell: true });
            
            process.on('close', (code) => {
                resolve(code === 0);
            });
            
            process.on('error', (error) => {
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
        Logger.info(`Validating Python environment`);
        Logger.info(`Python path: ${this.pythonPath}`);
        Logger.info(`Is initialized: ${this.isInitialized}`);

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
                    `You are using the Python interpreter at ${this.pythonPath}. Missing required packages: ${missingPackages.join(', ')}. Install them?`,
                    'Install',
                    'Cancel'
                );

                if (action === 'Install') {
                    try {
                        await this.installPackages(missingPackages);
                        // isInitialized is set in installPackages method after successful installation
                    } catch (error) {
                        Logger.error(`Package installation failed: ${error}`);
                        // Show detailed error information
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        vscode.window.showErrorMessage(`Package installation failed: ${errorMessage}`);
                        throw error; // Re-throw to be caught by the outer try-catch
                    }
                } else {
                    // User cancelled installation, but we still have a valid Python interpreter
                    // Set as initialized so the extension can work with what's available
                    this.isInitialized = true;
                    Logger.info(`Python environment ready (with missing packages)! Using interpreter: ${this.pythonPath}`);
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

        Logger.log(`executePythonScript: Executing Python script with args: ${args}`);
        Logger.log(`executePythonScript: Python path: ${this.pythonPath}`);
        Logger.log(`executePythonScript: Is initialized: ${this.isInitialized}`);

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

    async executePythonFile(scriptPath: string, args: string[] = []): Promise<any> {
        if (!this.pythonPath || !this.isInitialized) {
            throw new Error('Python environment not properly initialized. Please run "Select Python Interpreter" command first.');
        }

        Logger.log(`executePythonFile: Executing Python file ${scriptPath} with args: ${args}`);
        Logger.log(`executePythonFile: Python path: ${this.pythonPath}`);
        Logger.log(`executePythonFile: Is initialized: ${this.isInitialized}`);

        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonPath!, [scriptPath, ...args], { 
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

    async executePythonFileWithLogs(scriptPath: string, args: string[] = []): Promise<any> {
        if (!this.pythonPath || !this.isInitialized) {
            throw new Error('Python environment not properly initialized. Please run "Select Python Interpreter" command first.');
        }

        Logger.log(`executePythonFileWithLogs: Executing Python file ${scriptPath} with args: ${args}`);
        Logger.log(`executePythonFileWithLogs: Python path: ${this.pythonPath}`);

        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonPath!, [scriptPath, ...args], { 
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                const logData = data.toString();
                stderr += logData;
                
                // Forward Python logs to VSCode Logger
                // Parse log lines and forward them
                const lines = logData.split('\n').filter((line: string) => line.trim());
                lines.forEach((line: string) => {
                    if (line.includes(' - INFO - ')) {
                        const message = line.split(' - INFO - ')[1];
                        if (message) {
                            Logger.info(`[Python] ${message}`);
                        }
                    } else if (line.includes(' - ERROR - ')) {
                        const message = line.split(' - ERROR - ')[1];
                        if (message) {
                            Logger.error(`[Python] ${message}`);
                        }
                    } else if (line.includes(' - WARNING - ')) {
                        const message = line.split(' - WARNING - ')[1];
                        if (message) {
                            Logger.warn(`[Python] ${message}`);
                        }
                    } else if (line.includes(' - DEBUG - ')) {
                        const message = line.split(' - DEBUG - ')[1];
                        if (message) {
                            Logger.debug(`[Python] ${message}`);
                        }
                    } else if (line.trim()) {
                        // Any other stderr output that doesn't match the log format
                        Logger.info(`[Python] ${line.trim()}`);
                    }
                });
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

    /**
     * Set up immediate event listener for Python interpreter changes
     * Returns a disposable that should be disposed when the extension is deactivated
     */
    async setupInterpreterChangeListener(onInterpreterChange: () => Promise<void>): Promise<vscode.Disposable | undefined> {
        try {
            const pythonApi = await this.getPythonExtensionApi();
            if (!pythonApi || !pythonApi.environments) {
                Logger.debug('Python extension API or environments API not available for event listener');
                return undefined;
            }

            // Check if the onDidChangeActiveEnvironmentPath method exists
            if (typeof pythonApi.environments.onDidChangeActiveEnvironmentPath === 'function') {
                Logger.info('Setting up immediate Python interpreter change listener');
                
                const disposable = pythonApi.environments.onDidChangeActiveEnvironmentPath(async (environmentPath: any) => {
                    Logger.info(`Python interpreter changed immediately via event: ${environmentPath?.path || 'undefined'}`);
                    await onInterpreterChange();
                });

                return disposable;
            } else {
                Logger.debug('onDidChangeActiveEnvironmentPath method not available in Python extension API');
                return undefined;
            }
        } catch (error) {
            Logger.warn(`Failed to set up Python interpreter change listener: ${error}`);
            return undefined;
        }
    }

}
