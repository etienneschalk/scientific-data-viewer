import * as vscode from 'vscode';
import { Logger } from '../common/Logger';

/**
 * Sample file shipped with the extension (listed in .vscodeignore), generated
 * by python/sample_data/onboarding.py
 * (`python python/create_sample_data.py --bundled-sample`).
 */
export const SAMPLE_FILE_PATH_SEGMENTS = [
    'media',
    'samples',
    'sample_climate.nc',
] as const;

/** Custom editor of NetCDF files (package.json contributes.customEditors). */
export const SAMPLE_FILE_VIEW_TYPE = 'netcdfEditor';

/** Folder of globalStorageUri where the sample is copied before opening. */
export const SAMPLE_STORAGE_FOLDER = 'samples';

/** The sample as shipped, in the extension's install folder. */
export function getBundledSampleUri(extensionUri: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(extensionUri, ...SAMPLE_FILE_PATH_SEGMENTS);
}

/**
 * Copy the bundled sample to the extension's global storage (when missing or
 * different) and return the copy.
 *
 * The viewer never writes to the data file, but saving a plot writes the image
 * next to it: in the install folder, it could fail (read-only installs) and
 * would be deleted with the next extension update.
 */
export async function prepareSampleFile(
    extensionUri: vscode.Uri,
    globalStorageUri: vscode.Uri,
): Promise<vscode.Uri> {
    const source = getBundledSampleUri(extensionUri);
    const folder = vscode.Uri.joinPath(globalStorageUri, SAMPLE_STORAGE_FOLDER);
    const target = vscode.Uri.joinPath(
        folder,
        SAMPLE_FILE_PATH_SEGMENTS[SAMPLE_FILE_PATH_SEGMENTS.length - 1],
    );
    const content = await vscode.workspace.fs.readFile(source);
    let existing: Uint8Array | undefined;
    try {
        existing = await vscode.workspace.fs.readFile(target);
    } catch {
        existing = undefined;
    }
    if (!existing || !Buffer.from(existing).equals(Buffer.from(content))) {
        await vscode.workspace.fs.createDirectory(folder);
        await vscode.workspace.fs.writeFile(target, content);
        Logger.info(`🎓 Sample file copied to ${target.fsPath}`);
    }
    return target;
}

/** Open the sample file in the NetCDF custom editor. */
export async function openSampleFile(
    extensionUri: vscode.Uri,
    globalStorageUri: vscode.Uri,
): Promise<vscode.Uri> {
    const sample = await prepareSampleFile(extensionUri, globalStorageUri);
    await vscode.commands.executeCommand(
        'vscode.openWith',
        sample,
        SAMPLE_FILE_VIEW_TYPE,
    );
    return sample;
}
