import * as vscode from 'vscode';
import { detectVSCodeTheme } from './vscodeutils';

// Extension name
export const SDV_EXTENSION_ID = 'scientificDataViewer';

// Command names
export const CMD_OPEN_VIEWER = 'scientificDataViewer.openViewer';
export const CMD_OPEN_VIEWER_MULTIPLE =
    'scientificDataViewer.openViewerMultiple';
export const CMD_OPEN_VIEWER_FOLDER = 'scientificDataViewer.openViewerFolder';
export const CMD_OPEN_AS_KERCHUNK = 'scientificDataViewer.openAsKerchunk';
export const CMD_REFRESH_PYTHON_ENVIRONMENT =
    'scientificDataViewer.refreshPythonEnvironment';
export const CMD_SHOW_LOGS = 'scientificDataViewer.showLogs';
export const CMD_SHOW_SETTINGS = 'scientificDataViewer.showSettings';
export const CMD_OPEN_DEVELOPER_TOOLS =
    'scientificDataViewer.openDeveloperTools';
export const CMD_SCROLL_TO_HEADER = 'scientificDataViewer.scrollToHeader';
export const CMD_EXPAND_ALL = 'scientificDataViewer.expandAll';
export const CMD_PYTHON_INSTALL_PACKAGES =
    'scientificDataViewer.python.installPackages';
export const CMD_MANAGE_EXTENSION_OWN_ENVIRONMENT =
    'scientificDataViewer.manageExtensionOwnEnvironment';
export const CMD_EXPORT_WEBVIEW = 'scientificDataViewer.exportWebview';
export const CMD_TOGGLE_DEV_MODE = 'scientificDataViewer.toggleDevMode';
export const CMD_HEALTHCHECK = 'scientificDataViewer.healthcheck';

// Tree view ID
export const OUTLINE_TREE_VIEW_ID = 'scientificDataViewer.outline';

// Default data viewer panel ID
export const DEFAULT_DATA_VIEWER_PANEL_ID =
    'scientificDataViewer.defaultWebviewPanel';

// Configuration keys
const MAX_FILE_SIZE = 'maxFileSize';
const ALLOW_MULTIPLE_TABS_FOR_SAME_FILE = 'allowMultipleTabsForSameFile';
const DEV_MODE = 'devMode';
const MATPLOTLIB_STYLE = 'matplotlibStyle';
const WEBVIEW_EXPORT_THEME = 'webviewExportTheme';
const OVERRIDE_PYTHON_INTERPRETER = 'python.overridePythonInterpreter';
const USE_EXTENSION_OWN_ENVIRONMENT = 'python.useExtensionOwnEnvironment';
const CONVERT_BANDS_TO_VARIABLES = 'convertBandsToVariables';
const GLOBAL_DIMENSION_SLICES = 'globalDimensionSlices';
const GROUP_DIMENSION_SLICES = 'groupDimensionSlices';
const SMALL_VARIABLE_BYTES = 'smallVariableBytes';
const SMALL_VALUE_DISPLAY_MAX_LEN = 'smallValueDisplayMaxLen';
const NESTED_ATTRIBUTES_VIEW = 'nestedAttributesView';
const PLOT_TIMEOUT_MS = 'plotTimeoutMs';
const OUTLINE_ENABLED = 'outlineEnabled';
const ORDER_GROUPS_ALPHABETICALLY = 'orderGroupsAlphabetically';
const SHOW_XARRAY_ENCODING_ATTRIBUTES = 'showXarrayEncodingAttributes';
const NETCDF_ENGINE_ORDER = 'netcdfEngineOrder';
const SHOW_INHERITED_COORDINATES = 'showInheritedCoordinates';
const FACETGRID_FIGSIZE = 'facetgridFigsize';
const SHOW_LOAD_TIME_IN_LOCAL_TIME = 'showLoadTimeInLocalTime';
const DECODING_MASK_AND_SCALE = 'decoding.maskAndScale';
const DECODING_DECODE_TIMES = 'decoding.decodeTimes';
const DECODING_DECODE_COORDS = 'decoding.decodeCoords';
const DECODING_USE_CFTIME = 'decoding.useCftime';
const ENGINE_BACKEND_KWARGS = 'engineBackendKwargs';

// Default values
const DEFAULT_MAX_FILE_SIZE = 1000000000000;
const DEFAULT_ALLOW_MULTIPLE_TABS_FOR_SAME_FILE = false;
const DEFAULT_DEV_MODE = false;
const DEFAULT_MATPLOTLIB_STYLE = '';
const DEFAULT_WEBVIEW_EXPORT_THEME = '';
const DEFAULT_OVERRIDE_PYTHON_INTERPRETER = '';
const DEFAULT_USE_EXTENSION_OWN_ENVIRONMENT = false;
const DEFAULT_CONVERT_BANDS_TO_VARIABLES = true;
const DEFAULT_GLOBAL_DIMENSION_SLICES = true;
const DEFAULT_GROUP_DIMENSION_SLICES = true;
const DEFAULT_SMALL_VARIABLE_BYTES = 1000;
const DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN = 500;
const DEFAULT_NESTED_ATTRIBUTES_VIEW = true;
// Default plot timeout (ms); server and client use this so the process is killed and UX is consistent
const DEFAULT_PLOT_TIMEOUT_MS = 20000;
const DEFAULT_OUTLINE_ENABLED = true;
const DEFAULT_ORDER_GROUPS_ALPHABETICALLY = true;
const DEFAULT_SHOW_XARRAY_ENCODING_ATTRIBUTES = true;
const DEFAULT_NETCDF_ENGINE_ORDER: readonly string[] = [
    'netcdf4',
    'h5netcdf',
    'scipy',
];
const ALLOWED_NETCDF_ENGINES = new Set(DEFAULT_NETCDF_ENGINE_ORDER);
const DEFAULT_SHOW_INHERITED_COORDINATES = true;
const DEFAULT_FACETGRID_FIGSIZE: readonly number[] = [];
/** Smallest panel side in inches, as in the package.json schema */
const MIN_FACETGRID_FIGSIZE = 0.1;
const DEFAULT_SHOW_LOAD_TIME_IN_LOCAL_TIME = true;

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

/** Maximum file size in MB; 0, negative or invalid values mean no limit (the default). */
export function getMaxSize(): number {
    const value = getWorkspaceConfig().get<number>(
        MAX_FILE_SIZE,
        DEFAULT_MAX_FILE_SIZE,
    );
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : DEFAULT_MAX_FILE_SIZE;
}

export function getAllowMultipleTabsForSameFile(): boolean {
    return getWorkspaceConfig().get<boolean>(
        ALLOW_MULTIPLE_TABS_FOR_SAME_FILE,
        DEFAULT_ALLOW_MULTIPLE_TABS_FOR_SAME_FILE,
    );
}

export function getDevMode(): boolean {
    return getWorkspaceConfig().get<boolean>(DEV_MODE, DEFAULT_DEV_MODE);
}

export function getMatplotlibStyle(): string {
    const userStyle = getWorkspaceConfig().get<string>(
        MATPLOTLIB_STYLE,
        DEFAULT_MATPLOTLIB_STYLE,
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
        DEFAULT_WEBVIEW_EXPORT_THEME,
    );
}

export function getOverridePythonInterpreter(): string {
    return getWorkspaceConfig().get<string>(
        OVERRIDE_PYTHON_INTERPRETER,
        DEFAULT_OVERRIDE_PYTHON_INTERPRETER,
    );
}

export function getUseExtensionOwnEnvironment(): boolean {
    return getWorkspaceConfig().get<boolean>(
        USE_EXTENSION_OWN_ENVIRONMENT,
        DEFAULT_USE_EXTENSION_OWN_ENVIRONMENT,
    );
}

export function getConvertBandsToVariables(): boolean {
    return getWorkspaceConfig().get<boolean>(
        CONVERT_BANDS_TO_VARIABLES,
        DEFAULT_CONVERT_BANDS_TO_VARIABLES,
    );
}

export function getGlobalDimensionSlices(): boolean {
    return getWorkspaceConfig().get<boolean>(
        GLOBAL_DIMENSION_SLICES,
        DEFAULT_GLOBAL_DIMENSION_SLICES,
    );
}

export function getGroupDimensionSlices(): boolean {
    return getWorkspaceConfig().get<boolean>(
        GROUP_DIMENSION_SLICES,
        DEFAULT_GROUP_DIMENSION_SLICES,
    );
}

export function getSmallVariableBytes(): number {
    return getWorkspaceConfig().get<number>(
        SMALL_VARIABLE_BYTES,
        DEFAULT_SMALL_VARIABLE_BYTES,
    );
}

export function getSmallValueDisplayMaxLen(): number {
    return getWorkspaceConfig().get<number>(
        SMALL_VALUE_DISPLAY_MAX_LEN,
        DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
    );
}

export function getNestedAttributesView(): boolean {
    return getWorkspaceConfig().get<boolean>(
        NESTED_ATTRIBUTES_VIEW,
        DEFAULT_NESTED_ATTRIBUTES_VIEW,
    );
}

export function getPlotTimeoutMs(): number {
    const raw = getWorkspaceConfig().get<number>(
        PLOT_TIMEOUT_MS,
        DEFAULT_PLOT_TIMEOUT_MS,
    );
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1000) {
        return DEFAULT_PLOT_TIMEOUT_MS;
    }
    return Math.min(Math.floor(raw), 600000); // cap at 10 minutes
}

export function getOutlineEnabled(): boolean {
    return getWorkspaceConfig().get<boolean>(
        OUTLINE_ENABLED,
        DEFAULT_OUTLINE_ENABLED,
    );
}

export function getOrderGroupsAlphabetically(): boolean {
    return getWorkspaceConfig().get<boolean>(
        ORDER_GROUPS_ALPHABETICALLY,
        DEFAULT_ORDER_GROUPS_ALPHABETICALLY,
    );
}

export function getShowXarrayEncodingAttributes(): boolean {
    return getWorkspaceConfig().get<boolean>(
        SHOW_XARRAY_ENCODING_ATTRIBUTES,
        DEFAULT_SHOW_XARRAY_ENCODING_ATTRIBUTES,
    );
}

export function getNetcdfEngineOrder(): string[] {
    const raw = getWorkspaceConfig().get<string[]>(NETCDF_ENGINE_ORDER, [
        ...DEFAULT_NETCDF_ENGINE_ORDER,
    ]);
    const ordered: string[] = [];
    const seen = new Set<string>();
    if (Array.isArray(raw)) {
        for (const engine of raw) {
            if (
                typeof engine === 'string' &&
                ALLOWED_NETCDF_ENGINES.has(engine) &&
                !seen.has(engine)
            ) {
                ordered.push(engine);
                seen.add(engine);
            }
        }
    }
    for (const engine of DEFAULT_NETCDF_ENGINE_ORDER) {
        if (!seen.has(engine)) {
            ordered.push(engine);
        }
    }
    return ordered;
}

export function getShowInheritedCoordinates(): boolean {
    return getWorkspaceConfig().get<boolean>(
        SHOW_INHERITED_COORDINATES,
        DEFAULT_SHOW_INHERITED_COORDINATES,
    );
}

/** Show the "Loaded:" timestamp in the local time zone instead of UTC. */
export function getShowLoadTimeInLocalTime(): boolean {
    return getWorkspaceConfig().get<boolean>(
        SHOW_LOAD_TIME_IN_LOCAL_TIME,
        DEFAULT_SHOW_LOAD_TIME_IN_LOCAL_TIME,
    );
}

export type OnOffDefault = 'default' | 'on' | 'off';
export type DecodeCoordsChoice = 'default' | 'coordinates' | 'all' | 'off';

/** xarray decoders chosen in the settings; 'default' leaves them to the engine. */
export interface DecodingSettings {
    maskAndScale: OnOffDefault;
    decodeTimes: OnOffDefault;
    decodeCoords: DecodeCoordsChoice;
    useCftime: OnOffDefault;
}

function getChoice<T extends string>(key: string, allowed: readonly T[]): T {
    const value = getWorkspaceConfig().get<string>(key, allowed[0]);
    return (allowed as readonly string[]).includes(value)
        ? (value as T)
        : allowed[0];
}

const ON_OFF_DEFAULT: readonly OnOffDefault[] = ['default', 'on', 'off'];

export function getDecodingSettings(): DecodingSettings {
    return {
        maskAndScale: getChoice(DECODING_MASK_AND_SCALE, ON_OFF_DEFAULT),
        decodeTimes: getChoice(DECODING_DECODE_TIMES, ON_OFF_DEFAULT),
        decodeCoords: getChoice(DECODING_DECODE_COORDS, [
            'default',
            'coordinates',
            'all',
            'off',
        ] as const),
        useCftime: getChoice(DECODING_USE_CFTIME, ON_OFF_DEFAULT),
    };
}

/** `{engine: {key: value}}` of extra xarray backend_kwargs. */
export type EngineBackendKwargs = Record<string, Record<string, unknown>>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * engineBackendKwargs from the **user** settings only. The setting is
 * machine-scoped, so VS Code already ignores workspace values; reading the
 * global value also guards against a cloned repository passing keywords to
 * xarray. Which keys are honoured is decided by the backend (allowlist in
 * `sdv_backend/decoding.py`); here only the shape is checked.
 */
export function getEngineBackendKwargs(): EngineBackendKwargs {
    const value = getWorkspaceConfig().inspect<unknown>(
        ENGINE_BACKEND_KWARGS,
    )?.globalValue;
    const result: EngineBackendKwargs = {};
    if (!isPlainObject(value)) {
        return result;
    }
    for (const [engine, kwargs] of Object.entries(value)) {
        if (isPlainObject(kwargs) && Object.keys(kwargs).length > 0) {
            result[engine] = kwargs;
        }
    }
    return result;
}

/** FacetGrid panel size (width, height) in inches, or null when unset. */
export function getFacetgridFigsize(): [number, number] | null {
    const raw = getWorkspaceConfig().get<number[]>(FACETGRID_FIGSIZE, [
        ...DEFAULT_FACETGRID_FIGSIZE,
    ]);
    if (!Array.isArray(raw) || raw.length !== 2) {
        return null;
    }
    const width = raw[0];
    const height = raw[1];
    if (
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width < MIN_FACETGRID_FIGSIZE ||
        height < MIN_FACETGRID_FIGSIZE
    ) {
        return null;
    }
    return [width, height];
}

/** Query flag used when a generic JSON/Parquet file is opened as Kerchunk. */
export const KERCHUNK_OPEN_QUERY = 'openAs=kerchunk';

export function uriRequestsKerchunkOpen(uri: vscode.Uri): boolean {
    return new URLSearchParams(uri.query).get('openAs') === 'kerchunk';
}

export function withKerchunkOpenQuery(uri: vscode.Uri): vscode.Uri {
    if (uriRequestsKerchunkOpen(uri)) {
        return uri;
    }
    const query = uri.query
        ? `${uri.query}&${KERCHUNK_OPEN_QUERY}`
        : KERCHUNK_OPEN_QUERY;
    return uri.with({ query });
}

/**
 * Plain object of extension config flags for the webview (feature flags and display options).
 * Use this instead of passing WorkspaceConfiguration so the webview receives a predictable object.
 */
export function getExtensionConfigForWebview(): Record<string, unknown> {
    return {
        globalDimensionSlices: getGlobalDimensionSlices(),
        groupDimensionSlices: getGroupDimensionSlices(),
        nestedAttributesView: getNestedAttributesView(),
        plotTimeoutMs: getPlotTimeoutMs(),
        outlineEnabled: getOutlineEnabled(),
        orderGroupsAlphabetically: getOrderGroupsAlphabetically(),
        showXarrayEncodingAttributes: getShowXarrayEncodingAttributes(),
        netcdfEngineOrder: getNetcdfEngineOrder(),
        showInheritedCoordinates: getShowInheritedCoordinates(),
        showLoadTimeInLocalTime: getShowLoadTimeInLocalTime(),
        decoding: getDecodingSettings(),
        engineBackendKwargs: getEngineBackendKwargs(),
    };
}

/**
 * Write useExtensionOwnEnvironment in the user (global) settings, which works
 * with or without an open folder. A workspace value, if any, still wins.
 */
export async function updateUseExtensionOwnEnvironment(
    value: boolean,
): Promise<void> {
    return await getWorkspaceConfig().update(
        USE_EXTENSION_OWN_ENVIRONMENT,
        value,
        vscode.ConfigurationTarget.Global,
    );
}

export async function updateDevMode(value: boolean): Promise<void> {
    return await getWorkspaceConfig().update(
        DEV_MODE,
        value,
        vscode.ConfigurationTarget.Global,
    );
}
