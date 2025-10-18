import * as vscode from 'vscode';
import { CMD_SHOW_LOGS, SDV_EXTENSION_ID } from '../common/config';
import { CustomEditor, PackageJson } from '../package-types';

/**
 * Show an information message with options to show settings or logs
 * @param message The message to show
 * @param showSettings Whether to show the settings button
 * @param showLogs Whether to show the logs button
 */
export function showInformationMessage(
    message: string,
    showLogs: boolean = true,
    showSettings: boolean = false,
): void {
    vscode.window
        .showInformationMessage(
            message,
            'OK',
            showLogs ? 'Show Logs' : '',
            showSettings ? 'Show Settings' : '',
        )
        .then((selection) => {
            if (selection === 'Show Logs') {
                vscode.commands.executeCommand(CMD_SHOW_LOGS);
            }
            if (selection === 'Show Settings') {
                vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    SDV_EXTENSION_ID,
                );
            }
        });
}

/**
 * Show an error message with options to show settings or logs
 * @param message The message to show
 * @param showSettings Whether to show the settings button
 * @param showLogs Whether to show the logs button
 */
export function showErrorMessage(
    message: string,
    showLogs: boolean = true,
    showSettings: boolean = false,
): void {
    vscode.window
        .showErrorMessage(
            message,
            'OK',
            showLogs ? 'Show Logs' : '',
            showSettings ? 'Show Settings' : '',
        )
        .then((selection) => {
            if (selection === 'Show Logs') {
                vscode.commands.executeCommand(CMD_SHOW_LOGS);
            }
            if (selection === 'Show Settings') {
                vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    SDV_EXTENSION_ID,
                );
            }
        });
}

/**
 * Propose to install uv
 * @param error The error to show
 * @param uvInstallationUrl
 */
export function showErrorMessageAndProposeHelpToInstallUv(
    error: any,
    uvInstallationUrl: string,
) {
    vscode.window
        .showErrorMessage(
            `Failed to create extension environment: ${error}`,
            'OK',
            'Install uv',
            'Show Logs',
        )
        .then((selection) => {
            if (selection === 'Install uv') {
                vscode.env.openExternal(vscode.Uri.parse(uvInstallationUrl));
            }
            if (selection === 'Show Logs') {
                vscode.commands.executeCommand(CMD_SHOW_LOGS);
            }
        });
}

/**
 * Detect the VSCode theme
 * @returns The theme name
 */
export function detectVSCodeTheme(): string {
    // Get the current VSCode theme
    const currentTheme = vscode.window.activeColorTheme;

    // Check if it's a dark theme
    if (currentTheme.kind === vscode.ColorThemeKind.Dark) {
        return 'dark_background';
    } else {
        return 'default';
    }
}

// Package JSON - Store it to access various information from the package.json file
let _packageJson: PackageJson;

export function setPackageJson(packageJson: PackageJson) {
    _packageJson = packageJson;
}

export function getPackageJson(): PackageJson {
    return _packageJson;
}

export function getPackageJsonFromExtensionContext(
    context: vscode.ExtensionContext,
): PackageJson {
    // Important: We need to cast to PackageJson to avoid type errors
    // when accessing the package.json file
    // This means we trust the PackageJson interface to be correct.
    return context.extension.packageJSON as PackageJson;
}

// TODO Should use this function everywhere the version is printed
// It should also be added to the Troubleshooting section
export function getVersion(): string {
    return getPackageJson().version;
}

export function getDisplayName(): string {
    return getPackageJson().displayName;
}

function getCustomEditors(): CustomEditor[] {
    return getPackageJson().contributes.customEditors;
}

export function getCustomEditorViewTypes(): string[] {
    return getCustomEditors().map((editor) => editor.viewType);
}

export function getAllSupportedExtensions(ids?: string[]): string[] {
    const languages = getPackageJson().contributes.languages;
    const allSupportedExtensions = languages
        .filter((el) => !ids || ids.includes(el.id))
        .flatMap((el) => el.extensions);
    return allSupportedExtensions;
}

export function getShowDialogFilters(ids?: string[]): {
    [name: string]: string[];
} {
    const languages = getPackageJson().contributes.languages;
    const filters: { [name: string]: string[] } = {
        'Scientific Data Files': getAllSupportedExtensions(ids).map((ext) =>
            ext.slice(1),
        ),
        ...Object.fromEntries(
            languages
                .filter((el) => !ids || ids.includes(el.id))
                .map((el) => [
                    el.aliases[0],
                    el.extensions.map((ext) => ext.slice(1)),
                ]),
        ),
    };
    return filters;
}
