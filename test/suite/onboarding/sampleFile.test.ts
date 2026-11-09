import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    SAMPLE_FILE_PATH_SEGMENTS,
    SAMPLE_STORAGE_FOLDER,
    getBundledSampleUri,
    prepareSampleFile,
} from '../../../src/onboarding/sampleFile';

// out/test/suite/onboarding -> repository root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

suite('Onboarding sample file Test Suite', () => {
    let storageDir: string;

    setup(() => {
        storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdv-sample-'));
    });

    teardown(() => {
        fs.rmSync(storageDir, { recursive: true, force: true });
    });

    test('getBundledSampleUri points into the extension folder', () => {
        const uri = getBundledSampleUri(vscode.Uri.file(REPO_ROOT));
        assert.strictEqual(
            uri.fsPath,
            path.join(REPO_ROOT, ...SAMPLE_FILE_PATH_SEGMENTS),
        );
    });

    test('prepareSampleFile copies the sample to the global storage', async () => {
        const copy = await prepareSampleFile(
            vscode.Uri.file(REPO_ROOT),
            vscode.Uri.file(storageDir),
        );
        assert.strictEqual(
            copy.fsPath,
            path.join(storageDir, SAMPLE_STORAGE_FOLDER, 'sample_climate.nc'),
        );
        assert.ok(
            fs
                .readFileSync(copy.fsPath)
                .equals(
                    fs.readFileSync(
                        path.join(REPO_ROOT, ...SAMPLE_FILE_PATH_SEGMENTS),
                    ),
                ),
        );
    });

    test('prepareSampleFile keeps an identical copy and restores a changed one', async () => {
        const extensionUri = vscode.Uri.file(REPO_ROOT);
        const storageUri = vscode.Uri.file(storageDir);
        const copy = await prepareSampleFile(extensionUri, storageUri);

        const past = new Date(2000, 0, 1);
        fs.utimesSync(copy.fsPath, past, past);
        await prepareSampleFile(extensionUri, storageUri);
        assert.strictEqual(
            fs.statSync(copy.fsPath).mtime.getTime(),
            past.getTime(),
            'an identical copy should not be rewritten',
        );

        fs.writeFileSync(copy.fsPath, 'not a NetCDF file');
        await prepareSampleFile(extensionUri, storageUri);
        assert.ok(
            fs
                .readFileSync(copy.fsPath)
                .equals(
                    fs.readFileSync(
                        path.join(REPO_ROOT, ...SAMPLE_FILE_PATH_SEGMENTS),
                    ),
                ),
            'a changed copy should be replaced',
        );
    });
});
