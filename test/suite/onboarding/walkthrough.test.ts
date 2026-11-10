import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    WALKTHROUGH_ID,
    getWalkthroughFullId,
} from '../../../src/onboarding/walkthrough';
import { SAMPLE_FILE_PATH_SEGMENTS } from '../../../src/onboarding/sampleFile';
import {
    ALL_REQUIREMENTS,
    requirementPackageName,
} from '../../../src/python/ExtensionVirtualEnvironmentManager';
import {
    CMD_OPEN_SAMPLE_FILE,
    CMD_OPEN_WALKTHROUGH,
    CMD_SELECT_PYTHON_INTERPRETER,
    CMD_SET_UP_EXTENSION_OWN_ENVIRONMENT,
} from '../../../src/common/config';

// out/test/suite/onboarding -> repository root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

interface WalkthroughStep {
    id: string;
    title: string;
    description: string;
    media: { markdown?: string; image?: string; svg?: string };
    completionEvents?: string[];
}

interface Manifest {
    contributes: {
        commands: { command: string }[];
        configuration: { properties: Record<string, unknown> };
        customEditors: {
            viewType: string;
            selector: { filenamePattern: string }[];
        }[];
        walkthroughs: { id: string; title: string; steps: WalkthroughStep[] }[];
    };
}

function readManifest(): Manifest {
    return JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
    ) as Manifest;
}

/** Glob of .vscodeignore (`*`, `**`) as a regular expression. */
function globToRegExp(glob: string): RegExp {
    let pattern = '';
    for (let i = 0; i < glob.length; i++) {
        const char = glob[i];
        if (char === '*' && glob[i + 1] === '*') {
            pattern += '.*';
            i++;
        } else if (char === '*') {
            pattern += '[^/]*';
        } else {
            pattern += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${pattern}$`);
}

/** True when an allow-list (`!`) pattern of .vscodeignore matches the file. */
function isPackaged(relativePath: string): boolean {
    const lines = fs
        .readFileSync(path.join(REPO_ROOT, '.vscodeignore'), 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('!'));
    return lines.some((line) => globToRegExp(line.slice(1)).test(relativePath));
}

/** Media files of a step (markdown, image or svg; image may be themed). */
function stepMediaPaths(step: WalkthroughStep): string[] {
    const media = step.media as Record<string, unknown>;
    const paths: string[] = [];
    for (const key of ['markdown', 'svg', 'image']) {
        const value = media[key];
        if (typeof value === 'string') {
            paths.push(value);
        } else if (value && typeof value === 'object') {
            paths.push(...Object.values(value as Record<string, string>));
        }
    }
    return paths;
}

/** Commands named by `command:` links of a markdown text. */
function linkedCommands(markdown: string): string[] {
    return [...markdown.matchAll(/\(command:([\w.]+)/g)].map((m) => m[1]);
}

suite('Onboarding walkthrough Test Suite', () => {
    const manifest = readManifest();
    const contributedCommands = new Set(
        manifest.contributes.commands.map((c) => c.command),
    );
    const walkthrough = manifest.contributes.walkthroughs?.find(
        (w) => w.id === WALKTHROUGH_ID,
    );

    test('package.json contributes the Getting Started walkthrough', () => {
        assert.ok(walkthrough, `walkthrough ${WALKTHROUGH_ID} not found`);
        assert.deepStrictEqual(
            walkthrough.steps.map((s) => s.id),
            ['setUpPython', 'openSampleFile', 'exploreAndPlot', 'learnMore'],
        );
        assert.strictEqual(
            getWalkthroughFullId('eschalk0.scientific-data-viewer'),
            'eschalk0.scientific-data-viewer#gettingStarted',
        );
    });

    test('every step media exists and is packaged', () => {
        for (const step of walkthrough!.steps) {
            const media = stepMediaPaths(step);
            assert.ok(media.length > 0, `step ${step.id} has no media`);
            for (const file of media) {
                assert.ok(
                    fs.existsSync(path.join(REPO_ROOT, file)),
                    `step ${step.id}: ${file} does not exist`,
                );
                assert.ok(
                    isPackaged(file),
                    `step ${step.id}: ${file} is not in the .vscodeignore allow-list`,
                );
            }
        }
    });

    test('every command link and completion event names a contributed command or setting', () => {
        const settings = manifest.contributes.configuration.properties;
        for (const step of walkthrough!.steps) {
            const markdown = stepMediaPaths(step)
                .filter((file) => file.endsWith('.md'))
                .map((file) =>
                    fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'),
                )
                .join('\n');
            for (const command of linkedCommands(
                `${step.description}\n${markdown}`,
            )) {
                assert.ok(
                    contributedCommands.has(command),
                    `step ${step.id}: command:${command} is not contributed`,
                );
            }
            for (const event of step.completionEvents ?? []) {
                const [kind, value] = event.split(/:(.*)/s);
                if (kind === 'onCommand') {
                    assert.ok(
                        contributedCommands.has(value),
                        `step ${step.id}: ${event} names no contributed command`,
                    );
                } else if (kind === 'onSettingChanged') {
                    assert.ok(
                        value in settings,
                        `step ${step.id}: ${event} names no contributed setting`,
                    );
                } else {
                    assert.fail(`step ${step.id}: unexpected event ${event}`);
                }
            }
        }
    });

    test('the onboarding commands are contributed', () => {
        for (const command of [
            CMD_OPEN_SAMPLE_FILE,
            CMD_SET_UP_EXTENSION_OWN_ENVIRONMENT,
            CMD_SELECT_PYTHON_INTERPRETER,
            CMD_OPEN_WALKTHROUGH,
        ]) {
            assert.ok(
                contributedCommands.has(command),
                `${command} missing from package.json`,
            );
        }
    });

    test('the Python step lists every package of the extension environment', () => {
        const text = fs.readFileSync(
            path.join(REPO_ROOT, 'media', 'walkthrough', 'setup-python.md'),
            'utf8',
        );
        for (const requirement of ALL_REQUIREMENTS) {
            const name = requirementPackageName(requirement);
            assert.ok(
                text.includes(`\`${name}`),
                `setup-python.md does not mention ${name}`,
            );
        }
    });

    test('the sample file exists, is packaged and opens in a custom editor', () => {
        const relative = SAMPLE_FILE_PATH_SEGMENTS.join('/');
        const absolute = path.join(REPO_ROOT, ...SAMPLE_FILE_PATH_SEGMENTS);
        assert.ok(fs.existsSync(absolute), `${relative} does not exist`);
        const size = fs.statSync(absolute).size;
        assert.ok(size < 64 * 1024, `${relative} is ${size} bytes`);
        // HDF5 signature: NetCDF-4 file
        const signature = fs.readFileSync(absolute).subarray(0, 8);
        assert.deepStrictEqual(
            [...signature],
            [0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a],
        );
        assert.ok(isPackaged(relative), `${relative} is not packaged`);
        const netcdfEditor = manifest.contributes.customEditors.find(
            (e) => e.viewType === 'netcdfEditor',
        );
        assert.ok(
            netcdfEditor?.selector.some((s) => s.filenamePattern === '*.nc'),
        );
    });

    test('the onboarding commands are registered once the extension is active', async () => {
        const extension = vscode.extensions.getExtension(
            'eschalk0.scientific-data-viewer',
        );
        if (!extension) {
            // Not loaded in this test host (see extension.test.ts)
            return;
        }
        await extension.activate();
        const commands = await vscode.commands.getCommands(true);
        for (const command of [
            CMD_OPEN_SAMPLE_FILE,
            CMD_SET_UP_EXTENSION_OWN_ENVIRONMENT,
            CMD_SELECT_PYTHON_INTERPRETER,
            CMD_OPEN_WALKTHROUGH,
        ]) {
            assert.ok(commands.includes(command), `${command} not registered`);
        }
    });
});
