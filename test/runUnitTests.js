#!/usr/bin/env node

// Unit test runner that works outside of VS Code environment
const path = require('path');
const Mocha = require('mocha');
const { glob } = require('glob');

// Mock the vscode module and DOM before any tests run
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id === 'vscode') {
        return require('./mocks/vscode.js');
    }
    return originalRequire.apply(this, arguments);
};

// Set up DOM mock
require('./mocks/dom.js');

async function runUnitTests() {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000,
        reporter: 'spec'
    });

    const testsRoot = path.resolve(__dirname, '../out/test/suite');

    try {
        const files = await glob('**/**.test.js', { cwd: testsRoot });
        console.log(`Found ${files.length} test files:`);
        files.forEach(f => console.log(`  - ${f}`));
        console.log('');

        // Add files to the test suite
        files.forEach((f) => {
            mocha.addFile(path.resolve(testsRoot, f));
        });

        // Run the mocha test
        return new Promise((resolve, reject) => {
            mocha.run((failures) => {
                if (failures > 0) {
                    console.error(`\n❌ ${failures} test(s) failed.`);
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    console.log('\n✅ All tests passed!');
                    resolve();
                }
            });
        });
    } catch (err) {
        console.error('Error running tests:', err);
        throw err;
    }
}

// Run the tests
runUnitTests()
    .then(() => {
        console.log('Unit tests completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Unit tests failed:', err.message);
        process.exit(1);
    });
