import * as vscode from 'vscode';
import { detectVSCodeTheme } from './vscodeutils';

// Extension name
export const SDV_EXTENSION_ID = 'scientificDataViewer';
export const SDV_EXTENSION_NAME = 'Scientific Data Viewer'

// Command names
export const CMD_OPEN_VIEWER = 'scientificDataViewer.openViewer';
export const CMD_OPEN_VIEWER_FOLDER = 'scientificDataViewer.openViewerFolder';
export const CMD_REFRESH_PYTHON_ENVIRONMENT = 'scientificDataViewer.refreshPythonEnvironment';
export const CMD_SHOW_LOGS = 'scientificDataViewer.showLogs';
export const CMD_SHOW_SETTINGS = 'scientificDataViewer.showSettings';
export const CMD_OPEN_DEVELOPER_TOOLS = 'scientificDataViewer.openDeveloperTools';
export const CMD_SCROLL_TO_HEADER = 'scientificDataViewer.scrollToHeader';
export const CMD_EXPAND_ALL = 'scientificDataViewer.expandAll';
export const CMD_PYTHON_INSTALL_PACKAGES = 'scientificDataViewer.python.installPackages';
export const CMD_MANAGE_EXTENSION_OWN_ENVIRONMENT = 'scientificDataViewer.manageExtensionOwnEnvironment';

// Tree view ID
export const OUTLINE_TREE_VIEW_ID = 'scientificDataViewer.outline';

// Default data viewer panel ID
export const DEFAULT_DATA_VIEWER_PANEL_ID = 'scientificDataViewer.defaultWebviewPanel';

// Configuration keys
const MAX_FILE_SIZE = 'maxFileSize';
const ALLOW_MULTIPLE_TABS_FOR_SAME_FILE = 'allowMultipleTabsForSameFile';
const DEV_MODE = 'devMode';
const MATPLOTLIB_STYLE = 'matplotlibStyle';
const OVERRIDE_PYTHON_INTERPRETER = 'python.overridePythonInterpreter';
const USE_EXTENSION_OWN_ENVIRONMENT = 'python.useExtensionOwnEnvironment';
const CURRENTLY_IN_USE_INTERPRETER = 'python.currentlyInUseInterpreter';

// Default values
const DEFAULT_MAX_FILE_SIZE = 10000;
const DEFAULT_ALLOW_MULTIPLE_TABS_FOR_SAME_FILE = false;
const DEFAULT_DEV_MODE = false;
const DEFAULT_MATPLOTLIB_STYLE = '';
const DEFAULT_OVERRIDE_PYTHON_INTERPRETER = '';
const DEFAULT_USE_EXTENSION_OWN_ENVIRONMENT = false;
const DEFAULT_CURRENTLY_IN_USE_INTERPRETER = '';

// Configuration functions
export function getUseExtensionOwnEnvironmentConfigFullKey(): string {
    return `${SDV_EXTENSION_ID}.${USE_EXTENSION_OWN_ENVIRONMENT}`;
}

export function getOverridePythonInterpreterConfigFullKey(): string {
    return `${SDV_EXTENSION_ID}.${OVERRIDE_PYTHON_INTERPRETER}`;
}

export function getWorkspaceConfig() {
    return vscode.workspace.getConfiguration(SDV_EXTENSION_ID);
}

export function getMaxSize(): number {
    return getWorkspaceConfig().get<number>(
        MAX_FILE_SIZE,
        DEFAULT_MAX_FILE_SIZE
    );
}

export function getAllowMultipleTabsForSameFile(): boolean {
    return getWorkspaceConfig().get<boolean>(
        ALLOW_MULTIPLE_TABS_FOR_SAME_FILE,
        DEFAULT_ALLOW_MULTIPLE_TABS_FOR_SAME_FILE
    );
}

export function getDevMode(): boolean {
    return getWorkspaceConfig().get<boolean>(DEV_MODE, DEFAULT_DEV_MODE);
}

export function getMatplotlibStyle(): string {
    const userStyle = getWorkspaceConfig().get<string>(
        MATPLOTLIB_STYLE,
        DEFAULT_MATPLOTLIB_STYLE
    );
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
        OVERRIDE_PYTHON_INTERPRETER,
        DEFAULT_OVERRIDE_PYTHON_INTERPRETER
    );
}

export function getUseExtensionOwnEnvironment(): boolean {
    return getWorkspaceConfig().get<boolean>(
        USE_EXTENSION_OWN_ENVIRONMENT,
        DEFAULT_USE_EXTENSION_OWN_ENVIRONMENT
    );
}

export async function updateUseExtensionOwnEnvironment(
    value: boolean
): Promise<void> {
    return await getWorkspaceConfig().update(
        USE_EXTENSION_OWN_ENVIRONMENT,
        value,
        vscode.ConfigurationTarget.Workspace
    );
}

export function getCurrentlyInUseInterpreter(): string {
    return getWorkspaceConfig().get<string>(
        CURRENTLY_IN_USE_INTERPRETER,
        DEFAULT_CURRENTLY_IN_USE_INTERPRETER
    );
}

export async function updateCurrentlyInUseInterpreter(
    value: string | null
): Promise<void> {
    return await getWorkspaceConfig().update(
        CURRENTLY_IN_USE_INTERPRETER,
        value,
        vscode.ConfigurationTarget.Workspace
    );
}
