import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { setPackageJson } from '../../src/common/vscodeutils';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000,
    });

    const testsRoot = path.resolve(__dirname, '..');

    // Set mock package.json
    setPackageJson(createMockPackageJSON());

    try {
        const files = await glob('**/**.test.js', { cwd: testsRoot });

        // Add files to the test suite
        files.forEach((f: string) =>
            mocha.addFile(path.resolve(testsRoot, f))
        );

        // Run the mocha test
        return new Promise<void>((resolve, reject) => {
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        });
    } catch (err) {
        console.error(err);
        throw err;
    }
}

function createMockPackageJSON() {
    return {
        name: '[MOCK] name',
        displayName: '[MOCK] displayName',
        description: '[MOCK description]',
        version: '[MOCK] version',
        publisher: '[MOCK] publisher',
        icon: '[MOCK] icon',
        engines: {
            vscode: '[MOCK] vscode',
            node: '[MOCK] node',
        },
        extensionDependencies: [],
        categories: [],
        keywords: [],
        activationEvents: [],
        main: '[MOCK] main',
        contributes: {
            commands: [],
            menus: {
                'explorer/context': [],
                commandPalette: [],
                'view/title': [],
            },
            languages: [],
            views: {
                explorer: [],
            },
            customEditors: [],
            configuration: {
                title: '[MOCK] title',
                properties: {},
            },
        },
        scripts: {},
        devDependencies: {},
        dependencies: {},
        repository: {
            type: '[MOCK] type',
            url: '[MOCK] url',
        },
        homepage: '[MOCK] homepage',
        bugs: {
            url: '[MOCK] url',
        },
    };
}
