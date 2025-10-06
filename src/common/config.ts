import * as vscode from 'vscode';

function getWorkspaceConfig() {
    return vscode.workspace.getConfiguration('scientificDataViewer.python');
}

export function getOverridePythonInterpreter(): string {
    return getWorkspaceConfig().get<string>('overridePythonInterpreter', '');
}

export function getUseExtensionOwnEnvironment(): boolean {
    return getWorkspaceConfig().get<boolean>(
        'useExtensionOwnEnvironment',
        false
    );
}

export function getCurrentlyInUseInterpreter(): string {
    return getWorkspaceConfig().get<string>('currentlyInUseInterpreter', '');
}

export async function updateCurrentlyInUseInterpreter(value: string | null): Promise<void> {
    return await getWorkspaceConfig().update(
        'currentlyInUseInterpreter',
        value,
        vscode.ConfigurationTarget.Workspace
    );
}

export async function updateUseExtensionOwnEnvironment(value: boolean): Promise<void> {
    return await getWorkspaceConfig().update(
        'useExtensionOwnEnvironment',
        value,
        vscode.ConfigurationTarget.Workspace
    );
}