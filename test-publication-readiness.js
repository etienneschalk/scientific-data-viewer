#!/usr/bin/env node

/**
 * Publication Readiness Test Script for Scientific Data Viewer Extension
 * 
 * This script performs comprehensive checks to ensure the extension is ready for publication.
 * It validates version numbers, package configuration, code quality, and more.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

// Utility functions
function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logTest(testName, status, message = '') {
    const statusColor = status === 'PASS' ? colors.green : 
                       status === 'FAIL' ? colors.red : colors.yellow;
    const statusSymbol = status === 'PASS' ? '✓' : 
                        status === 'FAIL' ? '✗' : '⚠';
    
    log(`${statusSymbol} ${testName}: ${message}`, statusColor);
    
    results.tests.push({ name: testName, status, message });
    if (status === 'PASS') results.passed++;
    else if (status === 'FAIL') results.failed++;
    else results.warnings++;
}

function checkFileExists(filePath, description) {
    try {
        if (fs.existsSync(filePath)) {
            logTest(description, 'PASS', `File exists: ${filePath}`);
            return true;
        } else {
            logTest(description, 'FAIL', `File missing: ${filePath}`);
            return false;
        }
    } catch (error) {
        logTest(description, 'FAIL', `Error checking file: ${error.message}`);
        return false;
    }
}

function checkFileContent(filePath, description, validator) {
    try {
        if (!fs.existsSync(filePath)) {
            logTest(description, 'FAIL', `File missing: ${filePath}`);
            return false;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const result = validator(content);
        
        if (result.valid) {
            logTest(description, 'PASS', result.message || 'Content validation passed');
            return true;
        } else {
            logTest(description, 'FAIL', result.message || 'Content validation failed');
            return false;
        }
    } catch (error) {
        logTest(description, 'FAIL', `Error reading file: ${error.message}`);
        return false;
    }
}

function runCommand(command, description) {
    try {
        const output = execSync(command, { encoding: 'utf8', cwd: process.cwd() });
        logTest(description, 'PASS', 'Command executed successfully');
        return { success: true, output };
    } catch (error) {
        logTest(description, 'FAIL', `Command failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Test functions
function testPackageJson() {
    log('\n📦 Testing package.json configuration...', colors.cyan);
    
    checkFileContent('./package.json', 'package.json exists', (content) => {
        try {
            const pkg = JSON.parse(content);
            
            // Check required fields
            const requiredFields = ['name', 'displayName', 'description', 'version', 'publisher', 'main'];
            const missingFields = requiredFields.filter(field => !pkg[field]);
            
            if (missingFields.length > 0) {
                return { valid: false, message: `Missing required fields: ${missingFields.join(', ')}` };
            }
            
            // Check version format (semantic versioning)
            const versionRegex = /^\d+\.\d+\.\d+$/;
            if (!versionRegex.test(pkg.version)) {
                return { valid: false, message: `Invalid version format: ${pkg.version}. Expected format: x.y.z` };
            }
            
            // Check if version is 0.3.0 (expected for this release)
            if (pkg.version !== '0.3.0') {
                return { valid: false, message: `Version should be 0.3.0, found: ${pkg.version}` };
            }
            
            // Check publisher
            if (pkg.publisher !== 'eschalk0') {
                return { valid: false, message: `Publisher should be 'eschalk0', found: ${pkg.publisher}` };
            }
            
            // Check engines
            if (!pkg.engines || !pkg.engines.vscode) {
                return { valid: false, message: 'Missing VSCode engine requirement' };
            }
            
            // Check Node.js engine
            if (!pkg.engines.node || !pkg.engines.node.includes('22')) {
                return { valid: false, message: 'Node.js engine should support version 22' };
            }
            
            return { valid: true, message: `Version ${pkg.version} is valid` };
        } catch (error) {
            return { valid: false, message: `Invalid JSON: ${error.message}` };
        }
    });
}

function testChangelog() {
    log('\n📝 Testing CHANGELOG.md...', colors.cyan);
    
    checkFileContent('./CHANGELOG.md', 'CHANGELOG.md exists', (content) => {
        // Check if 0.3.0 entry exists
        if (!content.includes('## [0.3.0]')) {
            return { valid: false, message: 'Missing 0.3.0 changelog entry' };
        }
        
        // Check if changelog has proper format
        if (!content.includes('### Added') && !content.includes('### Enhanced') && !content.includes('### Fixed')) {
            return { valid: false, message: 'Changelog missing proper section headers' };
        }
        
        return { valid: true, message: 'Changelog has 0.3.0 entry with proper format' };
    });
}

function testReadme() {
    log('\n📖 Testing README.md...', colors.cyan);
    
    checkFileContent('./README.md', 'README.md exists', (content) => {
        // Check for essential sections
        const requiredSections = ['# Scientific Data Viewer', '## 🚀 Features', '## 📦 Installation', '## ⚙️ Prerequisites'];
        const missingSections = requiredSections.filter(section => !content.includes(section));
        
        if (missingSections.length > 0) {
            return { valid: false, message: `Missing required sections: ${missingSections.join(', ')}` };
        }
        
        // Check for installation instructions
        if (!content.includes('pip install') && !content.includes('npm install')) {
            return { valid: false, message: 'Missing installation instructions' };
        }
        
        return { valid: true, message: 'README has all required sections' };
    });
}

function testCodeQuality() {
    log('\n🔍 Testing code quality...', colors.cyan);
    
    // Check if TypeScript compiles
    const compileResult = runCommand('npm run compile', 'TypeScript compilation');
    if (!compileResult.success) {
        return;
    }
    
    // Check for linting errors
    const lintResult = runCommand('npm run lint', 'ESLint check');
    if (!lintResult.success) {
        logTest('ESLint check', 'WARN', 'Linting issues found - review before publishing');
    }
}

function testDependencies() {
    log('\n📚 Testing dependencies...', colors.cyan);
    
    checkFileContent('./package.json', 'Dependencies check', (content) => {
        const pkg = JSON.parse(content);
        
        // Check if all required dependencies are present
        const requiredDeps = ['axios', 'jsdom'];
        const missingDeps = requiredDeps.filter(dep => !pkg.dependencies || !pkg.dependencies[dep]);
        
        if (missingDeps.length > 0) {
            return { valid: false, message: `Missing required dependencies: ${missingDeps.join(', ')}` };
        }
        
        // Check if devDependencies include necessary tools
        const requiredDevDeps = ['@vscode/vsce', 'typescript', 'eslint'];
        const missingDevDeps = requiredDevDeps.filter(dep => !pkg.devDependencies || !pkg.devDependencies[dep]);
        
        if (missingDevDeps.length > 0) {
            return { valid: false, message: `Missing required dev dependencies: ${missingDevDeps.join(', ')}` };
        }
        
        return { valid: true, message: 'All required dependencies present' };
    });
}

function testFileStructure() {
    log('\n📁 Testing file structure...', colors.cyan);
    
    const requiredFiles = [
        './package.json',
        './README.md',
        './CHANGELOG.md',
        './LICENSE',
        './src/extension.ts',
        './src/dataProcessor.ts',
        './src/dataViewerPanel.ts',
        './src/pythonManager.ts',
        './src/logger.ts',
        './out/src/extension.js',
        './media/icon.png'
    ];
    
    requiredFiles.forEach(file => {
        checkFileExists(file, `Required file: ${file}`);
    });
}

function testPythonScripts() {
    log('\n🐍 Testing Python scripts...', colors.cyan);
    
    const pythonScripts = [
        './python/get_data_info.py',
        './python/create_sample_data.py'
    ];
    
    pythonScripts.forEach(script => {
        checkFileExists(script, `Python script: ${script}`);
    });
}

function testBuildOutput() {
    log('\n🔨 Testing build output...', colors.cyan);
    
    const buildFiles = [
        './out/src/extension.js',
        './out/src/dataProcessor.js',
        './out/src/dataViewerPanel.js',
        './out/src/pythonManager.js',
        './out/src/logger.js'
    ];
    
    buildFiles.forEach(file => {
        checkFileExists(file, `Build output: ${file}`);
    });
}

function testVersionConsistency() {
    log('\n🔄 Testing version consistency...', colors.cyan);
    
    checkFileContent('./package.json', 'Version consistency', (content) => {
        const pkg = JSON.parse(content);
        const version = pkg.version;
        
        // Check if version appears in README
        const readmeContent = fs.readFileSync('./README.md', 'utf8');
        if (readmeContent.includes(version)) {
            return { valid: true, message: `Version ${version} is consistent across files` };
        } else {
            return { valid: false, message: `Version ${version} not found in README.md` };
        }
    });
}

function testNodeVersion() {
    log('\n🟢 Testing Node.js version...', colors.cyan);
    
    try {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion >= 22) {
            logTest('Node.js version', 'PASS', `Node.js ${nodeVersion} is compatible`);
        } else {
            logTest('Node.js version', 'FAIL', `Node.js ${nodeVersion} is not compatible. Required: >=22.0.0`);
        }
    } catch (error) {
        logTest('Node.js version', 'FAIL', `Error checking Node.js version: ${error.message}`);
    }
}

function testPythonEnvironment() {
    log('\n🐍 Testing Python environment...', colors.cyan);
    
    try {
        // Check if Python 3.13 is available
        const pythonVersion = execSync('python3 --version', { encoding: 'utf8' }).trim();
        if (pythonVersion.includes('3.13')) {
            logTest('Python version', 'PASS', `Python ${pythonVersion} is available`);
        } else {
            logTest('Python version', 'WARN', `Python ${pythonVersion} found, but 3.13 is recommended`);
        }
        
        // Check if virtual environment exists
        if (fs.existsSync('./.venv')) {
            logTest('Python virtual environment', 'PASS', 'Virtual environment exists');
        } else {
            logTest('Python virtual environment', 'WARN', 'Virtual environment not found - using system Python');
        }
    } catch (error) {
        logTest('Python environment', 'WARN', `Python not found or not accessible: ${error.message}`);
    }
}

function testPackageScripts() {
    log('\n📜 Testing package scripts...', colors.cyan);
    
    const scripts = ['compile', 'package', 'test', 'lint'];
    
    scripts.forEach(script => {
        try {
            execSync(`npm run ${script} --dry-run`, { encoding: 'utf8' });
            logTest(`Script: ${script}`, 'PASS', 'Script is available');
        } catch (error) {
            logTest(`Script: ${script}`, 'FAIL', `Script failed: ${error.message}`);
        }
    });
}

function testVSIXPackage() {
    log('\n📦 Testing VSIX package creation...', colors.cyan);
    
    try {
        // Clean up any existing .vsix files first
        const existingVsix = fs.readdirSync('.').filter(file => file.endsWith('.vsix'));
        existingVsix.forEach(file => {
            try {
                fs.unlinkSync(file);
                log(`Cleaned up existing .vsix file: ${file}`, colors.yellow);
            } catch (error) {
                // Ignore cleanup errors
            }
        });
        
        // Try to create a new package
        const packageResult = runCommand('npm run package', 'VSIX package creation');
        if (packageResult.success) {
            // Check if .vsix file was created
            const vsixFiles = fs.readdirSync('.').filter(file => file.endsWith('.vsix'));
            if (vsixFiles.length > 0) {
                const vsixFile = vsixFiles[0];
                const stats = fs.statSync(vsixFile);
                const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
                logTest('VSIX package', 'PASS', `Package created: ${vsixFile} (${sizeInMB} MB)`);
            } else {
                logTest('VSIX package', 'FAIL', 'No .vsix file created');
            }
        }
    } catch (error) {
        logTest('VSIX package', 'FAIL', `Package creation failed: ${error.message}`);
    }
}

function testSecurityChecks() {
    log('\n🔒 Testing security checks...', colors.cyan);
    
    // Check for potential security issues
    checkFileContent('./package.json', 'Security check - no hardcoded secrets', (content) => {
        const pkg = JSON.parse(content);
        
        // Check for common secret patterns (but exclude legitimate uses)
        const secretPatterns = [
            { pattern: 'password', exclude: ['keywords'] },
            { pattern: 'secret', exclude: ['keywords'] },
            { pattern: 'api_key', exclude: [] },
            { pattern: 'access_token', exclude: [] },
            { pattern: 'private_key', exclude: [] }
        ];
        
        for (const { pattern, exclude } of secretPatterns) {
            if (content.toLowerCase().includes(pattern)) {
                // Check if it's in an excluded context
                const isExcluded = exclude.some(excludePattern => 
                    content.toLowerCase().includes(excludePattern)
                );
                
                if (!isExcluded && content.includes('"')) {
                    return { valid: false, message: `Potential hardcoded secret found containing '${pattern}'` };
                }
            }
        }
        
        return { valid: true, message: 'No obvious hardcoded secrets found' };
    });
}

function testDocumentation() {
    log('\n📚 Testing documentation completeness...', colors.cyan);
    
    const docFiles = [
        './README.md',
        './CHANGELOG.md',
        './CONTRIBUTING.md',
        './DEVELOPMENT.md',
        './PUBLISHING.md',
        './QUICKSTART.md'
    ];
    
    docFiles.forEach(file => {
        checkFileExists(file, `Documentation: ${file}`);
    });
}

function printSummary() {
    log('\n' + '='.repeat(60), colors.bright);
    log('📊 PUBLICATION READINESS SUMMARY', colors.bright);
    log('='.repeat(60), colors.bright);
    
    log(`\n✅ Passed: ${results.passed}`, colors.green);
    log(`❌ Failed: ${results.failed}`, colors.red);
    log(`⚠️  Warnings: ${results.warnings}`, colors.yellow);
    
    const total = results.passed + results.failed + results.warnings;
    const successRate = ((results.passed / total) * 100).toFixed(1);
    
    log(`\n📈 Success Rate: ${successRate}%`, colors.cyan);
    
    if (results.failed === 0) {
        log('\n🎉 Extension is ready for publication!', colors.green);
        log('You can proceed with packaging and publishing.', colors.green);
    } else {
        log('\n⚠️  Extension needs attention before publication.', colors.yellow);
        log('Please fix the failed tests before proceeding.', colors.yellow);
    }
    
    if (results.warnings > 0) {
        log('\n💡 Consider addressing warnings for better quality.', colors.blue);
    }
    
    log('\n' + '='.repeat(60), colors.bright);
}

// Main execution
async function main() {
    log('🚀 Scientific Data Viewer - Publication Readiness Test', colors.bright);
    log('='.repeat(60), colors.bright);
    
    // Run all tests
    testPackageJson();
    testChangelog();
    testReadme();
    testFileStructure();
    testDependencies();
    testPythonScripts();
    testBuildOutput();
    testVersionConsistency();
    testNodeVersion();
    testPythonEnvironment();
    testCodeQuality();
    testPackageScripts();
    testSecurityChecks();
    testDocumentation();
    testVSIXPackage();
    
    // Print summary
    printSummary();
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run the tests
main().catch(error => {
    log(`\n💥 Test runner failed: ${error.message}`, colors.red);
    process.exit(1);
});
