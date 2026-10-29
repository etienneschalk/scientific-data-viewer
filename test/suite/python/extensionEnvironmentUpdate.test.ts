import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    ALL_REQUIREMENTS,
    ENVIRONMENT_CONSTRAINTS,
    ExtensionVirtualEnvironmentManager,
    UvNotAvailableError,
} from '../../../src/python/ExtensionVirtualEnvironmentManager';

/**
 * Automatic update of the extension's own uv environment when a new extension
 * version requires it (ENVIRONMENT_REVISION / requirements change).
 * uv is never called: the install step is stubbed.
 */
suite('Extension environment update on new version', () => {
    let storage: string;

    /** Fake environment folder with a Python executable, as left by a previous session. */
    function makeExistingEnvironment(): ExtensionVirtualEnvironmentManager {
        const envPath = path.join(storage, 'python-environment');
        const bin =
            process.platform === 'win32'
                ? path.join(envPath, 'Scripts')
                : path.join(envPath, 'bin');
        fs.mkdirSync(bin, { recursive: true });
        fs.writeFileSync(
            path.join(
                bin,
                process.platform === 'win32' ? 'python.exe' : 'python',
            ),
            '',
        );
        return new ExtensionVirtualEnvironmentManager(storage);
    }

    function writeState(
        manager: ExtensionVirtualEnvironmentManager,
        state: object,
    ): void {
        fs.writeFileSync(
            path.join(manager.retrieve().path, 'sdv-environment.json'),
            JSON.stringify(state),
        );
    }

    /** Replace the uv install step; returns a counter of calls. */
    function stubInstall(
        manager: ExtensionVirtualEnvironmentManager,
        behaviour: 'succeed' | 'fail',
    ): { calls: number } {
        const counter = { calls: 0 };
        (manager as any).uvInstallRequiredPackages = async () => {
            counter.calls += 1;
            if (behaviour === 'fail') {
                throw new Error('network unreachable');
            }
        };
        return counter;
    }

    setup(() => {
        storage = fs.mkdtempSync(path.join(os.tmpdir(), 'sdv-env-test-'));
    });

    teardown(() => {
        fs.rmSync(storage, { recursive: true, force: true });
    });

    test('no environment: nothing to update', () => {
        const manager = new ExtensionVirtualEnvironmentManager(storage);
        assert.strictEqual(manager.exists, false);
        assert.strictEqual(manager.getUpdateReason(), null);
    });

    test('environment from an older version (no state file) needs an update', () => {
        const manager = makeExistingEnvironment();
        assert.strictEqual(manager.exists, true);
        assert.strictEqual(manager.ready, false);
        assert.match(
            manager.getUpdateReason() ?? '',
            /older extension version/,
        );
    });

    test('recorded current state: up to date', async () => {
        const manager = makeExistingEnvironment();
        await manager.recordEnvironmentState();
        assert.strictEqual(manager.getUpdateReason(), null);
        assert.strictEqual(
            manager.readEnvironmentState()?.revision,
            manager.ENVIRONMENT_REVISION,
        );
    });

    test('lower recorded revision needs an update', async () => {
        const manager = makeExistingEnvironment();
        await manager.recordEnvironmentState();
        const state = manager.readEnvironmentState()!;
        writeState(manager, {
            ...state,
            revision: manager.ENVIRONMENT_REVISION - 1,
        });
        assert.match(manager.getUpdateReason() ?? '', /older than required/);
    });

    test('changed requirements need an update even without a revision bump', async () => {
        const manager = makeExistingEnvironment();
        await manager.recordEnvironmentState();
        const state = manager.readEnvironmentState()!;
        writeState(manager, {
            ...state,
            requirements: ['xarray', 'matplotlib'],
        });
        assert.match(
            manager.getUpdateReason() ?? '',
            /required packages changed/,
        );
    });

    test('environment recorded by a newer extension version is left alone', async () => {
        const manager = makeExistingEnvironment();
        await manager.recordEnvironmentState();
        const state = manager.readEnvironmentState()!;
        writeState(manager, {
            ...state,
            revision: manager.ENVIRONMENT_REVISION + 1,
            requirements: ['something-else'],
        });
        assert.strictEqual(manager.getUpdateReason(), null);
    });

    test('corrupt state file is treated as an older environment', () => {
        const manager = makeExistingEnvironment();
        fs.writeFileSync(
            path.join(manager.retrieve().path, 'sdv-environment.json'),
            '{not json',
        );
        assert.match(
            manager.getUpdateReason() ?? '',
            /older extension version/,
        );
    });

    test('up-to-date environment is reused without reinstalling', async () => {
        const manager = makeExistingEnvironment();
        await manager.recordEnvironmentState();
        const install = stubInstall(manager, 'succeed');

        const result = await manager.prepareExisting();

        assert.strictEqual(install.calls, 0);
        assert.deepStrictEqual(result, { updateReason: null, updated: false });
        assert.strictEqual(manager.ready, true);
    });

    test('outdated environment is upgraded once and recorded', async () => {
        const manager = makeExistingEnvironment();
        const install = stubInstall(manager, 'succeed');

        const result = await manager.prepareExisting();

        assert.strictEqual(install.calls, 1);
        assert.strictEqual(result.updated, true);
        assert.strictEqual(manager.ready, true);
        assert.strictEqual(manager.getUpdateReason(), null);

        // Next session: nothing to do
        const nextSession = new ExtensionVirtualEnvironmentManager(storage);
        const nextInstall = stubInstall(nextSession, 'succeed');
        await nextSession.prepareExisting();
        assert.strictEqual(nextInstall.calls, 0);
    });

    test('failed upgrade keeps the previous environment and retries next start', async () => {
        const manager = makeExistingEnvironment();
        stubInstall(manager, 'fail');
        // The previous environment can still import the core packages
        (manager as any).hasCorePackages = async () => true;

        const result = await manager.prepareExisting();

        assert.strictEqual(result.updated, false);
        assert.match(result.error ?? '', /network unreachable/);
        assert.strictEqual(manager.ready, true, 'old environment stays usable');
        assert.notStrictEqual(
            manager.getUpdateReason(),
            null,
            'state not recorded, so the update is retried',
        );
        assert.ok(
            fs.existsSync(manager.retrieve().pythonPath),
            'environment not deleted',
        );
    });
    test('failed upgrade of an unusable environment does not mark it ready', async () => {
        const manager = makeExistingEnvironment();
        stubInstall(manager, 'fail');
        // e.g. a creation interrupted before the packages were installed
        (manager as any).hasCorePackages = async () => false;

        const result = await manager.prepareExisting();

        assert.strictEqual(result.updated, false);
        assert.strictEqual(manager.ready, false);
        assert.strictEqual(manager.pythonPath, null);
    });

    test('requirements reach uv unmodified (no shell, no quoting)', async () => {
        const manager = makeExistingEnvironment();
        const calls: string[][] = [];
        (manager as any).isUvAvailable = async () => true;
        (manager as any).runUv = async (args: string[]) => {
            calls.push(args);
            return { code: 0, stdout: '', stderr: '' };
        };
        const pythonPath = path.join(storage, 'dir with spaces', 'python');

        await manager.uvInstallPackages(pythonPath, ALL_REQUIREMENTS, true);

        assert.deepStrictEqual(calls, [
            [
                'pip',
                'install',
                '--python',
                pythonPath,
                '--upgrade',
                ...ALL_REQUIREMENTS,
            ],
        ]);
        assert.ok(ALL_REQUIREMENTS.includes('xarray>=2026.4.0'));
    });

    test('v0.13.0 revision 1 environments are updated (eccodeslib pin)', () => {
        const manager = makeExistingEnvironment();
        // State written by the first v0.13 builds, before the eccodeslib pin
        writeState(manager, {
            revision: 1,
            requirements: [...ALL_REQUIREMENTS],
            updatedAt: '2026-10-28T16:23:24.798Z',
        });
        assert.ok(ENVIRONMENT_CONSTRAINTS.includes('eccodeslib<2.48'));
        assert.match(manager.getUpdateReason() ?? '', /older than required/);
    });

    test('installs into the extension environment carry the constraints', async () => {
        const manager = makeExistingEnvironment();
        const calls: string[][] = [];
        (manager as any).isUvAvailable = async () => true;
        (manager as any).runUv = async (args: string[]) => {
            calls.push(args);
            return { code: 0, stdout: '', stderr: '' };
        };
        const envPython = manager.retrieve().pythonPath;

        await manager.uvInstallPackages(envPython, ['cfgrib']);

        assert.deepStrictEqual(calls, [
            [
                'pip',
                'install',
                '--python',
                envPython,
                'cfgrib',
                ...ENVIRONMENT_CONSTRAINTS,
            ],
        ]);
    });

    test('uv install failure and missing uv are reported', async () => {
        const manager = makeExistingEnvironment();
        (manager as any).isUvAvailable = async () => true;
        (manager as any).runUv = async () => ({
            code: 2,
            stdout: '',
            stderr: 'No solution found',
        });
        await assert.rejects(
            manager.uvInstallPackages('/python', ['xarray']),
            /No solution found/,
        );

        (manager as any).isUvAvailable = async () => false;
        await assert.rejects(
            manager.uvInstallPackages('/python', ['xarray']),
            UvNotAvailableError,
        );
    });

    test('environment operations are serialised', async () => {
        const manager = makeExistingEnvironment();
        let running = 0;
        let maxRunning = 0;
        (manager as any).uvInstallRequiredPackages = async () => {
            running += 1;
            maxRunning = Math.max(maxRunning, running);
            await new Promise((resolve) => setTimeout(resolve, 20));
            running -= 1;
        };

        await Promise.all([
            manager.prepareExisting(),
            manager.update(),
            manager.update(),
        ]);

        assert.strictEqual(maxRunning, 1);
    });

    test('create() does nothing when the environment is already ready', async () => {
        const manager = makeExistingEnvironment();
        await manager.recordEnvironmentState();
        await manager.prepareExisting();
        let uvChecks = 0;
        (manager as any).isUvAvailable = async () => {
            uvChecks += 1;
            return true;
        };

        await manager.create();

        assert.strictEqual(uvChecks, 0);
        assert.strictEqual(manager.ready, true);
    });

    test('last update time comes from the state file', async () => {
        const manager = makeExistingEnvironment();
        assert.strictEqual(manager.getLastUpdated(), null);
        await manager.recordEnvironmentState();
        const lastUpdated = manager.getLastUpdated();
        assert.ok(lastUpdated instanceof Date);
        assert.ok(Math.abs(Date.now() - lastUpdated.getTime()) < 60000);
    });
});
