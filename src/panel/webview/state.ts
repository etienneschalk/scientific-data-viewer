/** Webview-wide state set from the last `dataLoaded` event. */
export const globalState = {
    currentDatasetFilePath: null as string | null,
    /** Plot timeout in ms (from extension config); used by createPlot */
    plotTimeoutMs: 20000,
};

/** Operation ids of the plots currently running (for Cancel All). */
export const activePlotOperations = new Set<string>();

/** Plot All progress: `cancelled` stops queued plots from starting. */
export const plotAllState = {
    running: false,
    cancelled: false,
};
