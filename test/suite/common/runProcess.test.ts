import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    formatCommandForDisplay,
    runProcess,
} from '../../../src/common/runProcess';

/** Run the extension host's own binary as Node.js. */
const NODE = process.execPath;
const NODE_ENV = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };

suite('runProcess Test Suite', () => {
    let cwd: string;

    setup(() => {
        cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdv-run-process-'));
    });

    teardown(() => {
        fs.rmSync(cwd, { recursive: true, force: true });
    });

    test('arguments reach the program unmodified (no shell)', async () => {
        const args = [
            'xarray>=2026.4.0',
            'zarr>=3',
            'path with spaces/python',
            '"quoted"',
            '$HOME',
            'a|b;c&d',
        ];
        const result = await runProcess(
            NODE,
            [
                '-e',
                'console.log(JSON.stringify(process.argv.slice(1)))',
                ...args,
            ],
            { cwd, env: NODE_ENV },
        );

        assert.strictEqual(result.code, 0, result.stderr);
        assert.deepStrictEqual(JSON.parse(result.stdout), args);
        // No shell redirection: `>=...` did not create files
        assert.deepStrictEqual(fs.readdirSync(cwd), []);
    });

    test('collects stdout / stderr and streams chunks', async () => {
        const chunks: string[] = [];
        const result = await runProcess(
            NODE,
            [
                '-e',
                'process.stdout.write("out"); process.stderr.write("err"); process.exit(3)',
            ],
            { env: NODE_ENV, onStderr: (chunk) => chunks.push(chunk) },
        );
        assert.strictEqual(result.code, 3);
        assert.strictEqual(result.stdout, 'out');
        assert.strictEqual(result.stderr, 'err');
        assert.deepStrictEqual(chunks, ['err']);
        assert.strictEqual(result.timedOut, false);
        assert.strictEqual(result.aborted, false);
    });

    test('timeout stops the process', async () => {
        const start = Date.now();
        const result = await runProcess(
            NODE,
            ['-e', 'setTimeout(() => {}, 60000)'],
            { env: NODE_ENV, timeoutMs: 200 },
        );
        assert.strictEqual(result.timedOut, true);
        assert.notStrictEqual(result.signal, null);
        assert.ok(Date.now() - start < 10000);
    });

    test('abort signal stops the process', async () => {
        const controller = new AbortController();
        const running = runProcess(
            NODE,
            ['-e', 'setTimeout(() => {}, 60000)'],
            { env: NODE_ENV, signal: controller.signal },
        );
        setTimeout(() => controller.abort(), 100);
        const result = await running;
        assert.strictEqual(result.aborted, true);
        assert.strictEqual(result.timedOut, false);
    });

    test('rejects when the command does not exist', async () => {
        await assert.rejects(
            runProcess('sdv-command-that-does-not-exist', ['--version']),
            (error: NodeJS.ErrnoException) => error.code === 'ENOENT',
        );
    });

    test('formatCommandForDisplay quotes what a shell would interpret', () => {
        assert.strictEqual(
            formatCommandForDisplay('uv', [
                'pip',
                'install',
                '--python',
                '/a b/python',
                'xarray>=2026.4.0',
                'h5py',
            ]),
            'uv pip install --python "/a b/python" "xarray>=2026.4.0" h5py',
        );
    });
});
