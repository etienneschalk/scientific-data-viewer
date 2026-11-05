/**
 * Plot layout reported by the backend (`PlotLayout.to_json()` in
 * python/sdv_backend/plotting/layout.py), shared by the host, which passes
 * it on, and the webview, which shows it under the plot.
 */

export type PlotLayoutRole =
    'row' | 'col' | 'col_wrap' | 'y' | 'x' | 'hue' | 'size' | 'aspect' | 'bins';

export interface PlotLayoutChoice {
    role: PlotLayoutRole;
    value: string | number;
    /** `user`: a plot parameter; `auto`: picked by the backend */
    source: 'user' | 'auto';
}

export interface PlotLayoutReport {
    kind: 'image' | 'line' | 'histogram';
    choices: PlotLayoutChoice[];
    /** Size-1 dimensions dropped (index 0) because no parameter placed them */
    squeezed: string[];
    /** User choices that could not be used, fallbacks, with the reason */
    notes: string[];
}

/** Result of the createPlot request. */
export interface CreatePlotResponse {
    /** Base64 encoded PNG */
    plotData: string;
    layout?: PlotLayoutReport;
    /** Dimension slices applied (isel): index, or slice as "start:stop:step" */
    appliedSlices?: Record<string, number | string>;
}
