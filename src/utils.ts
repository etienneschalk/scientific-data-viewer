import * as vscode from 'vscode';

/**
 * Quote the value if it contains a space
 * Used to to avoid issues with spaces in the path
 * @param value The value to quote if needed
 * @returns The quoted value if needed, otherwise the original value
 */
export function quoteIfNeeded(value: string): string {
    if (value.includes(' ')) {
        return `"${value}"`;
    }
    return value;
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
            showSettings ? 'Show Settings' : ''
        )
        .then((selection) => {
            if (selection === 'Show Logs') {
                vscode.commands.executeCommand('scientificDataViewer.showLogs');
            }
            if (selection === 'Show Settings') {
                vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'scientificDataViewer'
                );
            }
        });
}
