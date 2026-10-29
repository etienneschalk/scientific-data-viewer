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
 * Automatic recreation of the extension's own uv environment when a new
 * extension version requires it (ENVIRONMENT_REVISION / requirements change).
 * uv is never called: the uv steps are stubbed.
 */
suite('Extension environment update on new version', () => {
    let storage: string;
    /** File only present in the environment of the previous session. */
    const OLD_FILE = 'left-by-previous-version.txt';

    function envPath(): string {
        return path.join(storage, 'python-environment');
    }

    function backupPath(): string {
        return envPath() + '.previous';
    }

    /** Folder with a Python executable, as created by `uv venv`. */
    function makePython(folder: string): void {
        const bin =
            process.platform === 'win32'
                ? path.join(folder, 'Scripts')
                : path.join(folder, 'bin');
        fs.mkdirSync(bin, { recursive: true });
        fs.writeFileSync(
            path.join(
                bin,
                process.platform === 'win32' ? 'python.exe' : 'python',
            ),
            '',
        );
    }

    /** Fake environment folder with a Python executable, as left by a previous session. */
    function makeExistingEnvironment(): ExtensionVirtualEnvironmentManager {
        makePython(envPath());
        fs.writeFileSync(path.join(envPath(), OLD_FILE), '');
        return new ExtensionVirtualEnvironmentManager(storage);
    }

    /**
     * Replace the uv steps of an environment creation; `uv venv` creates the
     * Python executable. Returns a counter of package installs.
     */
    function stubUv(
        manager: ExtensionVirtualEnvironmentManager,
        install: 'succeed' | 'fail',
    ): { installs: number } {
        const counter = { installs: 0 };
        const stubbed = manager as any;
        stubbed.isUvAvailable = async () => true;
        stubbed.uvInstallPython = async () => {};
        stubbed.uvCreateVirtualEnvironment = async (folder: string) =>
            makePython(folder);
        stubbed.uvInstallRequiredPackages = async () => {
            counter.installs += 1;
            if (install === 'fail') {
                throw new Error('network unreachable');
            }
        };
        return counter;
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
        const uv = stubUv(manager, 'succeed');

        const result = await manager.prepareExisting();

        assert.strictEqual(uv.installs, 0);
        assert.deepStrictEqual(result, { updateReason: null, updated: false });
        assert.strictEqual(manager.ready, true);
        assert.ok(fs.existsSync(path.join(envPath(), OLD_FILE)));
    });

    test('outdated environment is deleted, recreated once and recorded', async () => {
        const manager = makeExistingEnvironment();
        const uv = stubUv(manager, 'succeed');

        const result = await manager.prepareExisting();

        assert.strictEqual(uv.installs, 1);
        assert.strictEqual(result.updated, true);
        assert.strictEqual(manager.ready, true);
        assert.strictEqual(manager.getUpdateReason(), null);
        assert.ok(
            !fs.existsSync(path.join(envPath(), OLD_FILE)),
            'nothing left from the previous environment',
        );
        assert.ok(!fs.existsSync(backupPath()), 'backup removed');

        // Next session: nothing to do
        const nextSession = new ExtensionVirtualEnvironmentManager(storage);
        const nextUv = stubUv(nextSession, 'succeed');
        await nextSession.prepareExisting();
        assert.strictEqual(nextUv.installs, 0);
    });

    test('failed recreation restores the previous environment and retries next start', async () => {
        const manager = makeExistingEnvironment();
        stubUv(manager, 'fail');
        // The previous environment can still import the core packages
        (manager as any).hasCorePackages = async () => true;

        const result = await manager.prepareExisting();

        assert.strictEqual(result.updated, false);
        assert.match(result.error ?? '', /network unreachable/);
        assert.strictEqual(manager.ready, true, 'old environment stays usable');
        assert.notStrictEqual(
            manager.getUpdateReason(),
            null,
            'state not recorded, so the recreation is retried',
        );
        assert.ok(
            fs.existsSync(path.join(envPath(), OLD_FILE)),
            'previous environment restored',
        );
        assert.ok(!fs.existsSync(backupPath()), 'backup moved back');
    });

    test('missing uv keeps the previous environment', async () => {
        const manager = makeExistingEnvironment();
        (manager as any).isUvAvailable = async () => false;
        (manager as any).hasCorePackages = async () => true;

        const result = await manager.prepareExisting();

        assert.match(result.error ?? '', /uv is not available/);
        assert.strictEqual(manager.ready, true);
        assert.ok(fs.existsSync(path.join(envPath(), OLD_FILE)));
    });

    test('failed recreation of an unusable environment does not mark it ready', async () => {
        const manager = makeExistingEnvironment();
        stubUv(manager, 'fail');
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
        stubUv(manager, 'succeed');
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

    test('recreate() rebuilds an up-to-date environment from scratch', async () => {
        const manager = makeExistingEnvironment();
        await manager.recordEnvironmentState();
        await manager.prepareExisting();
        const uv = stubUv(manager, 'succeed');

        await manager.recreate();

        assert.strictEqual(uv.installs, 1);
        assert.strictEqual(manager.ready, true);
        assert.ok(!fs.existsSync(path.join(envPath(), OLD_FILE)));
    });

    test('interrupted recreation: the previous environment is restored at next start', () => {
        // VS Code closed while the new environment was being installed
        makePython(backupPath());
        fs.writeFileSync(path.join(backupPath(), OLD_FILE), '');
        makePython(envPath());

        const manager = new ExtensionVirtualEnvironmentManager(storage);

        assert.ok(fs.existsSync(path.join(envPath(), OLD_FILE)));
        assert.ok(!fs.existsSync(backupPath()));
        assert.strictEqual(manager.exists, true);
        assert.notStrictEqual(manager.getUpdateReason(), null, 'retried');
    });

    test('interrupted recreation: a completed new environment is kept', async () => {
        const manager = makeExistingEnvironment();
        await manager.recordEnvironmentState();
        // VS Code closed before the previous environment was deleted
        makePython(backupPath());

        const nextSession = new ExtensionVirtualEnvironmentManager(storage);

        assert.ok(!fs.existsSync(backupPath()), 'leftover backup removed');
        assert.strictEqual(nextSession.getUpdateReason(), null);
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
