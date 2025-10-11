import * as vscode from 'vscode';
import { detectVSCodeTheme } from './vscodeutils';

// Extension name
export const SDV_EXTENSION_ID = 'scientificDataViewer';

// Command names
export const CMD_OPEN_VIEWER = 'scientificDataViewer.openViewer';
export const CMD_OPEN_VIEWER_MULTIPLE = 'scientificDataViewer.openViewerMultiple';
export const CMD_OPEN_VIEWER_FOLDER = 'scientificDataViewer.openViewerFolder';
export const CMD_REFRESH_PYTHON_ENVIRONMENT = 'scientificDataViewer.refreshPythonEnvironment';
export const CMD_SHOW_LOGS = 'scientificDataViewer.showLogs';
export const CMD_SHOW_SETTINGS = 'scientificDataViewer.showSettings';
export const CMD_OPEN_DEVELOPER_TOOLS = 'scientificDataViewer.openDeveloperTools';
export const CMD_SCROLL_TO_HEADER = 'scientificDataViewer.scrollToHeader';
export const CMD_EXPAND_ALL = 'scientificDataViewer.expandAll';
export const CMD_PYTHON_INSTALL_PACKAGES = 'scientificDataViewer.python.installPackages';
export const CMD_MANAGE_EXTENSION_OWN_ENVIRONMENT = 'scientificDataViewer.manageExtensionOwnEnvironment';
export const CMD_EXPORT_WEBVIEW = 'scientificDataViewer.exportWebview';
export const CMD_TOGGLE_DEV_MODE = 'scientificDataViewer.toggleDevMode';
export const CMD_HEALTHCHECK = 'scientificDataViewer.healthcheck';

// Tree view ID
export const OUTLINE_TREE_VIEW_ID = 'scientificDataViewer.outline';

// Default data viewer panel ID
export const DEFAULT_DATA_VIEWER_PANEL_ID = 'scientificDataViewer.defaultWebviewPanel';

// Configuration keys
const MAX_FILE_SIZE = 'maxFileSize';
const ALLOW_MULTIPLE_TABS_FOR_SAME_FILE = 'allowMultipleTabsForSameFile';
const DEV_MODE = 'devMode';
const MATPLOTLIB_STYLE = 'matplotlibStyle';
const WEBVIEW_EXPORT_THEME = 'webviewExportTheme';
const OVERRIDE_PYTHON_INTERPRETER = 'python.overridePythonInterpreter';
const USE_EXTENSION_OWN_ENVIRONMENT = 'python.useExtensionOwnEnvironment';
const CONVERT_BANDS_TO_VARIABLES = 'convertBandsToVariables';

// Default values
const DEFAULT_MAX_FILE_SIZE = 1000000000000;
const DEFAULT_ALLOW_MULTIPLE_TABS_FOR_SAME_FILE = false;
const DEFAULT_DEV_MODE = false;
const DEFAULT_MATPLOTLIB_STYLE = '';
const DEFAULT_WEBVIEW_EXPORT_THEME = '';
const DEFAULT_OVERRIDE_PYTHON_INTERPRETER = '';
const DEFAULT_USE_EXTENSION_OWN_ENVIRONMENT = false;
const DEFAULT_CONVERT_BANDS_TO_VARIABLES = true;

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

export function getWebviewExportTheme(): string {
    return getWorkspaceConfig().get<string>(
        WEBVIEW_EXPORT_THEME,
        DEFAULT_WEBVIEW_EXPORT_THEME
    );
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

export function getConvertBandsToVariables(): boolean {
    return getWorkspaceConfig().get<boolean>(
        CONVERT_BANDS_TO_VARIABLES,
        DEFAULT_CONVERT_BANDS_TO_VARIABLES
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

export async function updateDevMode(value: boolean): Promise<void> {
    return await getWorkspaceConfig().update(
        DEV_MODE,
        value,
        vscode.ConfigurationTarget.Global
    );
}
