import { PlotLayoutReport } from './shared/plotLayout';

export type EnvironmentSource =
    'override' | 'own-uv-env' | 'python-extension' | 'system';

export interface EnvironmentInfo {
    initialized: boolean;
    ready: boolean;
    source: EnvironmentSource | null;
    path: string | null;
}

/**
 * Plot request sent by the webview and turned into `get_data_info.py plot`
 * arguments by `buildCreatePlotCliArgs`. Unset fields keep the xarray default.
 */
export interface PlotOptions {
    variable: string;
    datetimeVariableName?: string;
    startDatetime?: string;
    endDatetime?: string;
    /** Dimension index/slice per dimension (Issue #117). e.g. { time: "0:24:2", rlat: "100:120", rlon: 130 } */
    dimensionSlices?: Record<string, string | number>;
    /** Dimension name for faceted plot row (Issue #117) */
    facetRow?: string;
    /** Dimension name for faceted plot col (Issue #117) */
    facetCol?: string;
    /** xarray plot col_wrap: max columns, or 'auto' (xarray 2026.04+) */
    colWrap?: number | 'auto' | null;
    /** Dimension or coordinate for x-axis (xarray plot x=, e.g. line/2D) */
    plotX?: string;
    /** Dimension or coordinate for y-axis (xarray plot y=, e.g. 2D) */
    plotY?: string;
    /** Dimension or coordinate for hue (xarray plot hue=, e.g. multiple lines) */
    plotHue?: string;
    /** xarray plot xincrease (axes direction) */
    xincrease?: boolean;
    /** xarray plot yincrease (axes direction) */
    yincrease?: boolean;
    /** xarray plot aspect (figure size: width = aspect * size) */
    aspect?: number | null;
    /** xarray plot size (figure size: height = size in inches) */
    size?: number | null;
    /** xarray plot robust (2nd/98th percentiles for color limits) */
    robust?: boolean;
    /** Matplotlib colormap name (cmap kwarg) */
    cmap?: string;
    /** Number of bins for histogram-style plots (Issue #117) */
    bins?: number | null;
    /** Lower color scale limit (scalar-mappable plots) */
    vmin?: number | null;
    /** Upper color scale limit (scalar-mappable plots) */
    vmax?: number | null;
    /** When false, passes --no-add-colorbar */
    addColorbar?: boolean;
    /** When true, passes --add-legend (Python defaults to false when omitted) */
    addLegend?: boolean;
    /** Identifies the plot subprocess so the webview can abort it */
    operationId?: string;
}

export interface CreatePlotPythonResponse {
    result?: CreatePlotResult;
    error?: CreatePlotError;
}

export interface CreatePlotResult {
    plot_data: string;
    format_info: DataInfoFormatInfo;
    /** Final applied isel kwargs (dimension slices); values are int or string for slice */
    applied_isel_kwargs?: Record<string, number | string>;
    /** Kwargs of the xarray plot call (row, col, x, y, cmap, etc.) */
    applied_plot_kwargs?: Record<string, unknown>;
    /** Plot kind and where each dimension went, with who chose it */
    plot_layout?: PlotLayoutReport;
    /** Matplotlib style used for the plot */
    matplotlib_style?: string;
    /** Variable path that was plotted (e.g. '/temperature') */
    variable_path?: string;
}

export interface CreatePlotError {
    error: string;
    format_info: DataInfoFormatInfo;
}

export interface DataInfoResult {
    format_info: DataInfoFormatInfo;
    used_engine: string;
    decode_cf_degraded?: boolean;
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
            encoding?: { [key: string]: any };
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
            encoding?: { [key: string]: any };
            display_value?: string;
        }>;
    };
    attributes_flattened: { [groupName: string]: { [key: string]: any } };
    /** Absent when showXarrayEncodingAttributes is off. */
    encoding_flattened?: { [groupName: string]: { [key: string]: any } };
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
