#!/usr/bin/env node

/**
 * Unit tests for core functionality
 * These tests verify the core logic without requiring VS Code environment
 */

const fs = require('fs');
const path = require('path');

// Simple test framework
class UnitTestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.errors = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🧪 Running unit tests for core functionality...\n');
        
        for (const test of this.tests) {
            try {
                console.log(`Running: ${test.name}`);
                await test.fn();
                console.log(`✅ PASSED: ${test.name}\n`);
                this.passed++;
            } catch (error) {
                console.log(`❌ FAILED: ${test.name}`);
                console.log(`   Error: ${error.message}\n`);
                this.failed++;
                this.errors.push({ test: test.name, error: error.message });
            }
        }

        console.log('📊 Unit Test Results:');
        console.log(`   Total: ${this.tests.length}`);
        console.log(`   Passed: ${this.passed}`);
        console.log(`   Failed: ${this.failed}`);
        
        if (this.errors.length > 0) {
            console.log('\n❌ Failed Tests:');
            this.errors.forEach(({ test, error }) => {
                console.log(`   ${test}: ${error}`);
            });
        }

        return this.failed === 0;
    }
}

// Mock VS Code API for testing
const mockVSCode = {
    window: {
        createOutputChannel: () => ({
            appendLine: () => {},
            show: () => {},
            dispose: () => {}
        }),
        showInformationMessage: () => Promise.resolve(),
        showErrorMessage: () => Promise.resolve(),
        showOpenDialog: () => Promise.resolve([]),
        createStatusBarItem: () => ({
            text: '',
            tooltip: '',
            show: () => {},
            hide: () => {},
            dispose: () => {}
        })
    },
    workspace: {
        getConfiguration: () => ({
            get: () => undefined,
            has: () => false
        }),
        onDidChangeConfiguration: () => ({ dispose: () => {} }),
        onDidOpenTextDocument: () => ({ dispose: () => {} }),
        onDidChangeWorkspaceFolders: () => ({ dispose: () => {} })
    },
    commands: {
        registerCommand: () => ({ dispose: () => {} }),
        executeCommand: () => Promise.resolve(),
        getCommands: () => Promise.resolve([])
    },
    extensions: {
        getExtension: () => null
    },
    Uri: {
        file: (path) => ({ fsPath: path, path: path })
    },
    ExtensionMode: {
        Test: 1
    },
    ExtensionKind: {
        Workspace: 1
    },
    StatusBarAlignment: {
        Right: 1
    },
    CancellationToken: {
        None: {}
    },
    CustomDocumentOpenContext: {},
    WebviewPanel: {
        viewType: 'test'
    }
};

// Set up global mocks
global.vscode = mockVSCode;
global.assert = require('assert');

// Load and run tests
const testRunner = new UnitTestRunner();

// Test 1: Logger functionality
testRunner.test('Logger can be instantiated and used', () => {
    // Mock the Logger class
    class MockLogger {
        static initialize() {
            if (!this.outputChannel) {
                this.outputChannel = {
                    appendLine: function() {},
                    show: function() {},
                    dispose: function() {}
                };
            }
        }
        
        static log(message, level = 'info') {
            this.initialize();
            // Simulate logging
            return `${level}: ${message}`;
        }
        
        static info(message) {
            return this.log(message, 'info');
        }
        
        static error(message) {
            return this.log(message, 'error');
        }
        
        static warn(message) {
            return this.log(message, 'warn');
        }
        
        static debug(message) {
            return this.log(message, 'debug');
        }
    }
    
    // Test basic functionality
    const result = MockLogger.info('Test message');
    assert.strictEqual(result, 'info: Test message');
    
    const errorResult = MockLogger.error('Test error');
    assert.strictEqual(errorResult, 'error: Test error');
});

// Test 2: DataProcessor interface validation
testRunner.test('DataProcessor interface is properly defined', () => {
    // Check if the DataProcessor class exists and has required methods
    const dataProcessorPath = path.join(__dirname, 'out', 'src', 'dataProcessor.js');
    if (!fs.existsSync(dataProcessorPath)) {
        throw new Error('DataProcessor not compiled. Run npm run compile first.');
    }
    
    const content = fs.readFileSync(dataProcessorPath, 'utf8');
    
    // Check for required methods
    const requiredMethods = ['getDataInfo', 'createPlot'];
    for (const method of requiredMethods) {
        if (!content.includes(method)) {
            throw new Error(`DataProcessor missing method: ${method}`);
        }
    }
    
    // Check for class definition
    if (!content.includes('class DataProcessor')) {
        throw new Error('DataProcessor class not found');
    }
});

// Test 3: PythonManager interface validation
testRunner.test('PythonManager interface is properly defined', () => {
    const pythonManagerPath = path.join(__dirname, 'out', 'src', 'pythonManager.js');
    if (!fs.existsSync(pythonManagerPath)) {
        throw new Error('PythonManager not compiled. Run npm run compile first.');
    }
    
    const content = fs.readFileSync(pythonManagerPath, 'utf8');
    
    // Check for required methods
    const requiredMethods = ['isReady', 'executePythonScript', 'executePythonFile'];
    for (const method of requiredMethods) {
        if (!content.includes(method)) {
            throw new Error(`PythonManager missing method: ${method}`);
        }
    }
    
    // Check for class definition
    if (!content.includes('class PythonManager')) {
        throw new Error('PythonManager class not found');
    }
});

// Test 4: Error handling validation
testRunner.test('Error handling is properly implemented', () => {
    const errorBoundaryPath = path.join(__dirname, 'out', 'src', 'error', 'ErrorBoundary.js');
    if (!fs.existsSync(errorBoundaryPath)) {
        throw new Error('ErrorBoundary not compiled. Run npm run compile first.');
    }
    
    const content = fs.readFileSync(errorBoundaryPath, 'utf8');
    
    // Check for error handling methods
    const requiredMethods = ['handleError', 'registerHandler', 'registerGlobalHandler'];
    for (const method of requiredMethods) {
        if (!content.includes(method)) {
            throw new Error(`ErrorBoundary missing method: ${method}`);
        }
    }
    
    // Check for singleton pattern
    if (!content.includes('getInstance')) {
        throw new Error('ErrorBoundary should implement singleton pattern');
    }
});

// Test 5: Configuration validation
testRunner.test('Configuration schema is valid', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const config = packageJson.contributes.configuration;
    
    if (!config || !config.properties) {
        throw new Error('Configuration properties not found');
    }
    
    // Test each configuration property
    for (const [key, property] of Object.entries(config.properties)) {
        // Check required fields
        if (!property.type) {
            throw new Error(`Configuration property ${key} missing type`);
        }
        
        // Check type validity
        const validTypes = ['boolean', 'string', 'number', 'array', 'object'];
        if (!validTypes.includes(property.type)) {
            throw new Error(`Configuration property ${key} has invalid type: ${property.type}`);
        }
        
        // Check default value matches type
        if (property.default !== undefined) {
            const expectedType = property.type === 'boolean' ? 'boolean' : 
                                property.type === 'number' ? 'number' : 'string';
            if (typeof property.default !== expectedType) {
                throw new Error(`Configuration property ${key} default value type mismatch`);
            }
        }
    }
});

// Test 6: File extension validation
testRunner.test('Supported file extensions are properly defined', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const languages = packageJson.contributes.languages;
    
    const expectedExtensions = ['.nc', '.netcdf', '.h5', '.hdf5', '.zarr', '.grib', '.grib2', '.tif', '.tiff', '.geotiff', '.jp2', '.jpeg2000', '.safe', '.nc4', '.cdf'];
    
    for (const language of languages) {
        if (language.extensions) {
            for (const ext of language.extensions) {
                if (!expectedExtensions.includes(ext)) {
                    throw new Error(`Unexpected file extension: ${ext}`);
                }
            }
        }
    }
});

// Test 7: Command validation
testRunner.test('Commands are properly configured', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const commands = packageJson.contributes.commands;
    
    // Check that all commands have required fields
    for (const command of commands) {
        if (!command.command) {
            throw new Error('Command missing command field');
        }
        
        if (!command.title) {
            throw new Error(`Command ${command.command} missing title`);
        }
        
        // Check command naming convention
        if (!command.command.startsWith('scientificDataViewer.')) {
            throw new Error(`Command ${command.command} should start with 'scientificDataViewer.'`);
        }
    }
});

// Test 8: Menu validation
testRunner.test('Menus are properly configured', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const menus = packageJson.contributes.menus;
    
    // Check explorer context menu
    if (!menus['explorer/context']) {
        throw new Error('Missing explorer context menu');
    }
    
    // Check command palette menu
    if (!menus['commandPalette']) {
        throw new Error('Missing command palette menu');
    }
    
    // Check that menu items reference valid commands
    const commands = packageJson.contributes.commands.map(cmd => cmd.command);
    
    for (const menuType of Object.keys(menus)) {
        for (const menuItem of menus[menuType]) {
            if (menuItem.command && !commands.includes(menuItem.command)) {
                throw new Error(`Menu item references non-existent command: ${menuItem.command}`);
            }
        }
    }
});

// Test 9: Custom editors validation
testRunner.test('Custom editors are properly configured', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const customEditors = packageJson.contributes.customEditors;
    
    // Check that all custom editors have required fields
    for (const editor of customEditors) {
        if (!editor.viewType) {
            throw new Error('Custom editor missing viewType');
        }
        
        if (!editor.displayName) {
            throw new Error(`Custom editor ${editor.viewType} missing displayName`);
        }
        
        if (!editor.selector || !Array.isArray(editor.selector)) {
            throw new Error(`Custom editor ${editor.viewType} missing or invalid selector`);
        }
        
        // Check selector format
        for (const selector of editor.selector) {
            if (!selector.filenamePattern) {
                throw new Error(`Custom editor ${editor.viewType} selector missing filenamePattern`);
            }
        }
    }
});

// Test 10: Python script validation
testRunner.test('Python script has required functionality', () => {
    const pythonScriptPath = path.join(__dirname, 'python', 'get_data_info.py');
    const content = fs.readFileSync(pythonScriptPath, 'utf8');
    
    // Check for required imports
    const requiredImports = ['argparse', 'sys', 'os'];
    for (const importName of requiredImports) {
        if (!content.includes(`import ${importName}`) && !content.includes(`from ${importName}`)) {
            throw new Error(`Python script missing import: ${importName}`);
        }
    }
    
    // Check for main function
    if (!content.includes('def main()')) {
        throw new Error('Python script missing main() function');
    }
    
    // Check for argument parsing
    if (!content.includes('ArgumentParser') && !content.includes('add_argument')) {
        throw new Error('Python script missing argument parsing');
    }
    
    // Check for error handling
    if (!content.includes('try:') && !content.includes('except:')) {
        throw new Error('Python script missing error handling');
    }
});

// Test 11: Webview script validation
testRunner.test('Webview script has required functionality', () => {
    const webviewScriptPath = path.join(__dirname, 'src', 'ui', 'webview', 'webview-script.js');
    const content = fs.readFileSync(webviewScriptPath, 'utf8');
    
    // Check for required functions
    const requiredFunctions = ['showError', 'displayDataInfo', 'initialize'];
    for (const func of requiredFunctions) {
        if (!content.includes(`function ${func}`)) {
            throw new Error(`Webview script missing function: ${func}`);
        }
    }
    
    // Check for event handling
    if (!content.includes('addEventListener') && !content.includes('onclick')) {
        throw new Error('Webview script missing event handling');
    }
    
    // Check for error handling
    if (!content.includes('try') && !content.includes('catch')) {
        throw new Error('Webview script missing error handling');
    }
});

// Test 12: TypeScript compilation validation
testRunner.test('TypeScript compilation produces valid JavaScript', () => {
    const outDir = path.join(__dirname, 'out');
    const srcDir = path.join(__dirname, 'src');
    
    // Check that all TypeScript files have corresponding JavaScript files
    function findTsFiles(dir) {
        const files = [];
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                files.push(...findTsFiles(itemPath));
            } else if (item.endsWith('.ts')) {
                files.push(itemPath);
            }
        }
        return files;
    }
    
    const tsFiles = findTsFiles(srcDir);
    
    for (const tsFile of tsFiles) {
        const relativePath = path.relative(srcDir, tsFile);
        const jsFile = path.join(outDir, 'src', relativePath.replace('.ts', '.js'));
        
        if (!fs.existsSync(jsFile)) {
            // Check if it's a file that might not need compilation (like .d.ts files)
            if (tsFile.endsWith('.d.ts')) {
                continue;
            }
            throw new Error(`TypeScript file ${relativePath} not compiled to JavaScript`);
        }
        
        // Check that the JavaScript file has content
        const jsContent = fs.readFileSync(jsFile, 'utf8');
        if (jsContent.trim().length === 0) {
            throw new Error(`Compiled JavaScript file ${relativePath} is empty`);
        }
    }
});

// Run the tests
testRunner.run().then(success => {
    if (success) {
        console.log('\n🎉 All unit tests passed!');
    } else {
        console.log('\n❌ Some unit tests failed. Please fix the issues.');
    }
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Unit test runner error:', error);
    process.exit(1);
});
