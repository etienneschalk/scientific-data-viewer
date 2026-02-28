export type EnvironmentSource =
    | 'override'
    | 'own-uv-env'
    | 'python-extension'
    | 'system';

export interface EnvironmentInfo {
    initialized: boolean;
    ready: boolean;
    source: EnvironmentSource | null;
    path: string | null;
}

export interface ExtensionVirtualEnvironment {
    path: string;
    pythonPath: string;
    isCreated: boolean;
    isInitialized: boolean;
    packages: string[];
    lastUpdated: Date;
    createdWithUv?: boolean;
}

export interface CreatePlotPythonResponse {
    result?: CreatePlotResult;
    error?: CreatePlotError;
}

export interface CreatePlotResult {
    plot_data: string;
    format_info: DataInfoFormatInfo;
}

export interface CreatePlotError {
    error: string;
    format_info: DataInfoFormatInfo;
}
export interface DataInfoResult {
    format: string;
    format_info: DataInfoFormatInfo;
    used_engine: string;
    fileSize: number;
    xarray_html_repr: string;
    xarray_text_repr: string;
    xarray_show_versions: string;
    // New datatree fields
    dimensions_flattened: { [groupName: string]: { [key: string]: number } };
    coordinates_flattened: {
        [groupName: string]: Array<{
            name: string;
            dtype: string;
            shape: number[];
            dimensions: string[];
            size_bytes: number;
            attributes?: { [key: string]: any };
            display_value?: string;
        }>;
    };
    variables_flattened: {
        [groupName: string]: Array<{
            name: string;
            dtype: string;
            shape: number[];
            dimensions: string[];
            size_bytes: number;
            attributes?: { [key: string]: any };
            display_value?: string;
        }>;
    };
    attributes_flattened: { [groupName: string]: { [key: string]: any } };
    xarray_html_repr_flattened: { [groupName: string]: string };
    xarray_text_repr_flattened: { [groupName: string]: string };
    datetime_variables?: {
        [groupName: string]: Array<{
            name: string;
            min?: string;
            max?: string;
        }>;
    };
}

export interface DataInfoError {
    error: string;
    error_type: string;
    suggestion: string;
    format_info: DataInfoFormatInfo;
    xarray_show_versions: string;
}

export interface DataInfoPythonResponse {
    result?: DataInfoResult;
    error?: DataInfoError;
}
export interface DataInfoFormatInfo {
    extension: string;
    display_name: string;
    available_engines: string[];
    missing_packages: string[];
    is_supported: boolean;
}

export interface DataInfoResult {
    format: string;
    format_info: DataInfoFormatInfo;
    used_engine: string;
    fileSize: number;
    xarray_html_repr: string;
    xarray_text_repr: string;
    xarray_show_versions: string;
    // New datatree fields
    dimensions_flattened: { [groupName: string]: { [key: string]: number } };
    coordinates_flattened: {
        [groupName: string]: Array<{
            name: string;
            dtype: string;
            shape: number[];
            dimensions: string[];
            size_bytes: number;
            attributes?: { [key: string]: any };
            display_value?: string;
        }>;
    };
    variables_flattened: {
        [groupName: string]: Array<{
            name: string;
            dtype: string;
            shape: number[];
            dimensions: string[];
            size_bytes: number;
            attributes?: { [key: string]: any };
            display_value?: string;
        }>;
    };
    attributes_flattened: { [groupName: string]: { [key: string]: any } };
    xarray_html_repr_flattened: { [groupName: string]: string };
    xarray_text_repr_flattened: { [groupName: string]: string };
    datetime_variables?: {
        [groupName: string]: Array<{
            name: string;
            min?: string;
            max?: string;
        }>;
    };
}

export interface DataInfoError {
    error: string;
    error_type: string;
    suggestion: string;
    format_info: DataInfoFormatInfo;
    xarray_show_versions: string;
}

export interface ErrorHandler {
    (error: Error, context?: any): void;
}

export interface ErrorContext {
    component: any;
    operation: string;
    data?: any;
    userAction?: string;
}

export interface HeaderItem {
    label: string;
    level: number;
    id: string;
    line?: number;
    children: HeaderItem[];
}
