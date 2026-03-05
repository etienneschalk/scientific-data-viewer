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
            launchArgs: [
                '--disable-extensions',
                '--no-sandbox',
                '--disable-gpu',
            ],
            // So the child process emits extension debug/info logs to stderr and CI can show them
            extensionTestsEnv: {
                SCIENTIFIC_DATA_VIEWER_VERBOSE_LOGS: '1',
            },
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
