import * as vscode from 'vscode';
import { CMD_SHOW_LOGS, SDV_EXTENSION_ID } from '../common/config';

/**
 * Show an information message with options to show settings or logs
 * @param message The message to show
 * @param showSettings Whether to show the settings button
 * @param showLogs Whether to show the logs button
 */
export function showInformationMessage(
    message: string,
    showLogs: boolean = true,
    showSettings: boolean = false
): void {
    vscode.window
        .showInformationMessage(
            message,
            'OK',
            showLogs ? 'Show Logs' : '',
            showSettings ? 'Show Settings' : ''
        )
        .then((selection) => {
            if (selection === 'Show Logs') {
                vscode.commands.executeCommand(CMD_SHOW_LOGS);
            }
            if (selection === 'Show Settings') {
                vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    SDV_EXTENSION_ID
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
    showSettings: boolean = false
): void {
    vscode.window
        .showErrorMessage(
            message,
            'OK',
            showLogs ? 'Show Logs' : '',
            showSettings ? 'Show Settings' : ''
        )
        .then((selection) => {
            if (selection === 'Show Logs') {
                vscode.commands.executeCommand(CMD_SHOW_LOGS);
            }
            if (selection === 'Show Settings') {
                vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    SDV_EXTENSION_ID
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
    uvInstallationUrl: string
) {
    vscode.window
        .showErrorMessage(
            `Failed to create extension environment: ${error}`,
            'OK',
            'Install uv',
            'Show Logs'
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
