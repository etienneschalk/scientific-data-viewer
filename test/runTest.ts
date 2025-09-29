import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the test runner
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            version: '1.74.0', // Use a compatible VS Code version
            launchArgs: []
        });
    } catch (err) {
        console.error('Failed to run tests');
        console.error('Error details:', err);
        process.exit(1);
    }
}

main();