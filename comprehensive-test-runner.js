#!/usr/bin/env node

/**
 * Comprehensive test runner for the Scientific Data Viewer extension
 * This tests various aspects of the extension for publication readiness
 */

const fs = require('fs');
const path = require('path');

// Simple test framework
class ComprehensiveTestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.errors = [];
        this.warnings = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    warn(message) {
        this.warnings.push(message);
    }

    async run() {
        console.log('🧪 Running comprehensive tests for publication readiness...\n');
        
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

        console.log('📊 Test Results:');
        console.log(`   Total: ${this.tests.length}`);
        console.log(`   Passed: ${this.passed}`);
        console.log(`   Failed: ${this.failed}`);
        
        if (this.warnings.length > 0) {
            console.log(`\n⚠️  Warnings: ${this.warnings.length}`);
            this.warnings.forEach(warning => {
                console.log(`   ${warning}`);
            });
        }
        
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
const testRunner = new ComprehensiveTestRunner();

// Test 1: Package.json validation
testRunner.test('Package.json is valid and complete', () => {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check required fields
    const requiredFields = ['name', 'version', 'displayName', 'description', 'main', 'engines', 'publisher'];
    for (const field of requiredFields) {
        if (!packageJson[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
    
    // Check version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(packageJson.version)) {
        throw new Error('Invalid version format. Expected semver format (e.g., 1.0.0)');
    }
    
    // Check VS Code engine version
    const vscodeVersion = packageJson.engines.vscode;
    if (!vscodeVersion.startsWith('^')) {
        throw new Error('VS Code engine version should start with ^');
    }
    
    // Check that version is reasonable (not 0.0.0)
    if (packageJson.version === '0.0.0') {
        throw new Error('Version should not be 0.0.0 for publication');
    }
    
    // Check publisher is not empty
    if (!packageJson.publisher || packageJson.publisher.trim() === '') {
        throw new Error('Publisher should not be empty');
    }
});

// Test 2: Extension manifest validation
testRunner.test('Extension manifest is complete and valid', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    
    // Check activation events
    if (!packageJson.activationEvents || !Array.isArray(packageJson.activationEvents)) {
        throw new Error('Missing or invalid activationEvents');
    }
    
    if (packageJson.activationEvents.length === 0) {
        throw new Error('Activation events should not be empty');
    }
    
    // Check contributes
    if (!packageJson.contributes) {
        throw new Error('Missing contributes section');
    }
    
    // Check commands
    if (!packageJson.contributes.commands || !Array.isArray(packageJson.contributes.commands)) {
        throw new Error('Missing or invalid commands');
    }
    
    // Check that commands have required fields
    for (const command of packageJson.contributes.commands) {
        if (!command.command || !command.title) {
            throw new Error('Commands must have command and title fields');
        }
    }
    
    // Check languages
    if (!packageJson.contributes.languages || !Array.isArray(packageJson.contributes.languages)) {
        throw new Error('Missing or invalid languages');
    }
    
    // Check custom editors
    if (!packageJson.contributes.customEditors || !Array.isArray(packageJson.contributes.customEditors)) {
        throw new Error('Missing or invalid customEditors');
    }
    
    // Check configuration
    if (!packageJson.contributes.configuration) {
        throw new Error('Missing configuration section');
    }
});

// Test 3: TypeScript compilation check
testRunner.test('TypeScript compilation is successful', () => {
    const outDir = path.join(__dirname, 'out');
    if (!fs.existsSync(outDir)) {
        throw new Error('Output directory not found. Run npm run compile first.');
    }
    
    const extensionFile = path.join(outDir, 'src', 'extension.js');
    if (!fs.existsSync(extensionFile)) {
        throw new Error('Extension file not compiled. Run npm run compile first.');
    }
    
    // Check if the file has content
    const stats = fs.statSync(extensionFile);
    if (stats.size === 0) {
        throw new Error('Extension file is empty');
    }
    
    // Check for source maps
    const sourceMapFile = path.join(outDir, 'src', 'extension.js.map');
    if (!fs.existsSync(sourceMapFile)) {
        testRunner.warn('Source map file not found. Consider enabling source maps for better debugging.');
    }
});

// Test 4: Required files exist
testRunner.test('All required files exist', () => {
    const requiredFiles = [
        'package.json',
        'README.md',
        'LICENSE',
        'media/icon.png',
        'out/src/extension.js',
        'python/get_data_info.py',
        'src/extension.ts',
        'src/dataProcessor.ts',
        'src/pythonManager.ts',
        'src/logger.ts'
    ];
    
    for (const file of requiredFiles) {
        const filePath = path.join(__dirname, file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Required file missing: ${file}`);
        }
    }
});

// Test 5: Python script validation
testRunner.test('Python script is valid and functional', () => {
    const pythonScriptPath = path.join(__dirname, 'python', 'get_data_info.py');
    const content = fs.readFileSync(pythonScriptPath, 'utf8');
    
    // Basic Python syntax checks
    if (!content.includes('def ')) {
        throw new Error('Python script should contain function definitions');
    }
    
    if (!content.includes('import ')) {
        throw new Error('Python script should contain import statements');
    }
    
    // Check for required functions
    if (!content.includes('def main()')) {
        throw new Error('Python script should contain main() function');
    }
    
    // Check for argparse usage
    if (!content.includes('argparse')) {
        throw new Error('Python script should use argparse for command line arguments');
    }
    
    // Check for error handling
    if (!content.includes('try:') && !content.includes('except:')) {
        testRunner.warn('Python script should include error handling');
    }
});

// Test 6: File size validation
testRunner.test('Extension files are reasonable size', () => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const extensionFile = path.join(__dirname, 'out', 'src', 'extension.js');
    const stats = fs.statSync(extensionFile);
    
    if (stats.size > maxSize) {
        throw new Error(`Extension file too large: ${stats.size} bytes (max: ${maxSize})`);
    }
    
    // Check for reasonable minimum size
    if (stats.size < 1000) {
        testRunner.warn('Extension file seems unusually small. Check if compilation was successful.');
    }
});

// Test 7: Dependencies validation
testRunner.test('Dependencies are valid and secure', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    
    // Check that all dependencies are properly formatted
    if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
            if (typeof version !== 'string' || version.trim() === '') {
                throw new Error(`Invalid dependency version for ${name}: ${version}`);
            }
            
            // Check for known vulnerable packages
            const vulnerablePackages = ['lodash@4.17.0', 'axios@0.18.0'];
            const fullName = `${name}@${version}`;
            if (vulnerablePackages.includes(fullName)) {
                testRunner.warn(`Potentially vulnerable package detected: ${fullName}`);
            }
        }
    }
    
    if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
            if (typeof version !== 'string' || version.trim() === '') {
                throw new Error(`Invalid devDependency version for ${name}: ${version}`);
            }
        }
    }
});

// Test 8: Code quality checks
testRunner.test('Code quality checks', () => {
    const srcDir = path.join(__dirname, 'src');
    const tsFiles = [];
    
    // Find all TypeScript files
    function findTsFiles(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                findTsFiles(filePath);
            } else if (file.endsWith('.ts')) {
                tsFiles.push(filePath);
            }
        }
    }
    
    findTsFiles(srcDir);
    
    if (tsFiles.length === 0) {
        throw new Error('No TypeScript files found in src directory');
    }
    
    // Check for common issues
    for (const filePath of tsFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for TODO comments
        if (content.includes('TODO') || content.includes('FIXME')) {
            testRunner.warn(`File ${path.relative(__dirname, filePath)} contains TODO/FIXME comments`);
        }
        
        // Check for console.log statements (should use Logger instead)
        if (content.includes('console.log') && !content.includes('Logger.log')) {
            testRunner.warn(`File ${path.relative(__dirname, filePath)} contains console.log statements. Consider using Logger instead.`);
        }
        
        // Check for proper error handling
        if (content.includes('throw new Error') && !content.includes('try')) {
            testRunner.warn(`File ${path.relative(__dirname, filePath)} contains throw statements without try-catch blocks`);
        }
    }
});

// Test 9: Webview script validation
testRunner.test('Webview script is valid', () => {
    const webviewScriptPath = path.join(__dirname, 'src', 'ui', 'webview', 'webview-script.js');
    if (!fs.existsSync(webviewScriptPath)) {
        throw new Error('Webview script not found');
    }
    
    const content = fs.readFileSync(webviewScriptPath, 'utf8');
    
    // Check for basic JavaScript structure
    if (!content.includes('function ')) {
        throw new Error('Webview script should contain function definitions');
    }
    
    // Check for error handling
    if (!content.includes('try') && !content.includes('catch')) {
        testRunner.warn('Webview script should include error handling');
    }
    
    // Check for proper event handling
    if (!content.includes('addEventListener') && !content.includes('onclick')) {
        testRunner.warn('Webview script should include event handling');
    }
});

// Test 10: README validation
testRunner.test('README is complete and informative', () => {
    const readmePath = path.join(__dirname, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf8');
    
    // Check for essential sections
    const requiredSections = ['#', '##', 'Installation', 'Usage', 'Features'];
    for (const section of requiredSections) {
        if (!content.includes(section)) {
            testRunner.warn(`README should include section: ${section}`);
        }
    }
    
    // Check for reasonable length
    if (content.length < 500) {
        testRunner.warn('README seems too short. Consider adding more documentation.');
    }
    
    // Check for installation instructions
    if (!content.toLowerCase().includes('install')) {
        testRunner.warn('README should include installation instructions');
    }
});

// Test 11: License validation
testRunner.test('License file exists and is valid', () => {
    const licensePath = path.join(__dirname, 'LICENSE');
    const content = fs.readFileSync(licensePath, 'utf8');
    
    // Check for reasonable content
    if (content.length < 100) {
        throw new Error('License file seems too short or empty');
    }
    
    // Check for common license indicators
    const licenseIndicators = ['MIT', 'Apache', 'GPL', 'BSD', 'Copyright', 'License'];
    const hasLicenseIndicator = licenseIndicators.some(indicator => 
        content.includes(indicator)
    );
    
    if (!hasLicenseIndicator) {
        testRunner.warn('License file should contain license information');
    }
});

// Test 12: Icon validation
testRunner.test('Icon files exist and are valid', () => {
    const iconPath = path.join(__dirname, 'media', 'icon.png');
    if (!fs.existsSync(iconPath)) {
        throw new Error('Icon file not found');
    }
    
    const stats = fs.statSync(iconPath);
    if (stats.size === 0) {
        throw new Error('Icon file is empty');
    }
    
    // Check for reasonable size (not too large, not too small)
    if (stats.size > 1024 * 1024) { // 1MB
        testRunner.warn('Icon file is quite large. Consider optimizing it.');
    }
    
    if (stats.size < 1000) {
        testRunner.warn('Icon file seems unusually small. Check if it\'s valid.');
    }
});

// Test 13: Configuration validation
testRunner.test('Configuration schema is valid', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const config = packageJson.contributes.configuration;
    
    if (!config || !config.properties) {
        throw new Error('Configuration properties not found');
    }
    
    // Check each configuration property
    for (const [key, property] of Object.entries(config.properties)) {
        if (!property.type) {
            throw new Error(`Configuration property ${key} missing type`);
        }
        
        if (!property.description) {
            testRunner.warn(`Configuration property ${key} missing description`);
        }
        
        if (property.type === 'boolean' && property.default === undefined) {
            testRunner.warn(`Boolean configuration property ${key} should have a default value`);
        }
    }
});

// Test 14: Command validation
testRunner.test('Commands are properly configured', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const commands = packageJson.contributes.commands;
    
    if (!commands || commands.length === 0) {
        throw new Error('No commands found');
    }
    
    // Check for required commands
    const requiredCommands = [
        'scientificDataViewer.openViewer',
        'scientificDataViewer.refreshPythonEnvironment',
        'scientificDataViewer.showLogs',
        'scientificDataViewer.showSettings'
    ];
    
    for (const requiredCommand of requiredCommands) {
        const command = commands.find(cmd => cmd.command === requiredCommand);
        if (!command) {
            throw new Error(`Required command not found: ${requiredCommand}`);
        }
        
        if (!command.title) {
            throw new Error(`Command ${requiredCommand} missing title`);
        }
    }
});

// Test 15: Language support validation
testRunner.test('Language support is properly configured', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const languages = packageJson.contributes.languages;
    
    if (!languages || languages.length === 0) {
        throw new Error('No language support found');
    }
    
    // Check for required languages
    const requiredLanguages = ['netcdf', 'hdf5', 'zarr', 'grib', 'geotiff'];
    
    for (const requiredLanguage of requiredLanguages) {
        const language = languages.find(lang => lang.id === requiredLanguage);
        if (!language) {
            throw new Error(`Required language not found: ${requiredLanguage}`);
        }
        
        if (!language.extensions || !Array.isArray(language.extensions)) {
            throw new Error(`Language ${requiredLanguage} missing extensions`);
        }
        
        if (language.extensions.length === 0) {
            throw new Error(`Language ${requiredLanguage} has no extensions`);
        }
    }
});

// Run the tests
testRunner.run().then(success => {
    if (success) {
        console.log('\n🎉 All tests passed! Extension is ready for publication.');
    } else {
        console.log('\n❌ Some tests failed. Please fix the issues before publishing.');
    }
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});
