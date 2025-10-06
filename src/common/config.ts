import * as vscode from 'vscode';
import { detectVSCodeTheme } from './vscodeutils';

export function getWorkspaceConfig() {
    return vscode.workspace.getConfiguration('scientificDataViewer');
}

export function getMaxSize() {
    return vscode.workspace
        .getConfiguration('scientificDataViewer')
        .get('maxFileSize', 10000);
}

export function getAllowMultipleTabsForSameFile(): boolean {
    return getWorkspaceConfig().get<boolean>(
        'allowMultipleTabsForSameFile',
        false
    );
}

export function getDevMode(): boolean {
    return getWorkspaceConfig().get<boolean>('devMode', false);
}

export function getMatplotlibStyle(): string {
    const userStyle = getWorkspaceConfig().get<string>('matplotlibStyle', '');
    if (userStyle && userStyle.trim() !== '') {
        // Return the user-specified style
        return userStyle;
    } else {
        // Auto-detect based on VSCode theme
        return detectVSCodeTheme();
    }
}

export function getOverridePythonInterpreter(): string {
    return getWorkspaceConfig().get<string>(
        'python.overridePythonInterpreter',
        ''
    );
}

export function getUseExtensionOwnEnvironment(): boolean {
    return getWorkspaceConfig().get<boolean>(
        'python.useExtensionOwnEnvironment',
        false
    );
}

export async function updateUseExtensionOwnEnvironment(
    value: boolean
): Promise<void> {
    return await getWorkspaceConfig().update(
        'python.useExtensionOwnEnvironment',
        value,
        vscode.ConfigurationTarget.Workspace
    );
}

export function getCurrentlyInUseInterpreter(): string {
    return getWorkspaceConfig().get<string>(
        'python.currentlyInUseInterpreter',
        ''
    );
}

export async function updateCurrentlyInUseInterpreter(
    value: string | null
): Promise<void> {
    return await getWorkspaceConfig().update(
        'python.currentlyInUseInterpreter',
        value,
        vscode.ConfigurationTarget.Workspace
    );
}
