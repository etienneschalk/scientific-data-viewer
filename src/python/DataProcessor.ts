import * as vscode from 'vscode';
import * as path from 'path';
import { PythonManager } from './PythonManager';
import { Logger } from '../common/Logger';
import {
    getMatplotlibStyle,
    getSmallVariableBytes,
    getSmallValueDisplayMaxLen,
    getLazyReprLoading,
    getDataInfoCacheMaxEntries,
} from '../common/config';
import { DataInfoPythonResponse, CreatePlotPythonResponse } from '../types';
import { PerformanceTimer } from '../common/PerformanceTimer';
import { DataInfoCache } from './DataInfoCache';

export class DataProcessor {
    private static instance: DataProcessor;

    static getInstance(): DataProcessor {
        return DataProcessor.instance;
    }

    static createInstance(pythonManager: PythonManager): DataProcessor {
        DataProcessor.instance = new DataProcessor(pythonManager);
        return DataProcessor.instance;
    }

    private readonly pythonScriptsHomeDir: string;

    constructor(private pythonManager: PythonManager) {
        this.pythonScriptsHomeDir = path.join(__dirname, '../../../python');
    }

    get pythonManagerInstance(): PythonManager {
        return this.pythonManager;
    }

    async getDataInfo(
        uri: vscode.Uri,
        convertBandsToVariables: boolean = false,
        options?: { forceRefresh?: boolean; mtimeMs?: number },
    ): Promise<DataInfoPythonResponse | null> {
        const timer = new PerformanceTimer('getDataInfo');
        Logger.debug(
            `[DataProcessor] [getDataInfo] Getting data info for file: ${uri.fsPath}`,
        );
        if (!this.pythonManager.ready) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const scriptPath = path.join(
            this.pythonScriptsHomeDir,
            'get_data_info.py',
        );

        try {
            const smallVariableBytes = getSmallVariableBytes();
            const smallValueDisplayMaxLen = getSmallValueDisplayMaxLen();
            const lazyReprLoading = getLazyReprLoading();
            const cacheMaxEntries = getDataInfoCacheMaxEntries();
            const configKey = DataInfoCache.buildConfigKey({
                convertBandsToVariables,
                lazyReprLoading,
                smallVariableBytes,
                smallValueDisplayMaxLen,
            });

            let mtimeMs: number | undefined = options?.mtimeMs;
            if (mtimeMs === undefined) {
                try {
                    const stat = await vscode.workspace.fs.stat(uri);
                    mtimeMs = stat.mtime;
                } catch {
                    mtimeMs = undefined;
                }
            }

            if (
                cacheMaxEntries > 0 &&
                mtimeMs !== undefined &&
                !options?.forceRefresh
            ) {
                const cached = DataInfoCache.get(
                    filePath,
                    mtimeMs,
                    configKey,
                    cacheMaxEntries,
                );
                if (cached) {
                    timer.mark('cache-hit');
                    timer.finish('getDataInfo');
                    return cached;
                }
            }

            const args = ['info', filePath];
            if (convertBandsToVariables) {
                args.push('--convert-bands-to-variables');
            }
            if (lazyReprLoading) {
                args.push('--skip-reprs');
            }
            args.push('--small-variable-bytes', String(smallVariableBytes));
            args.push(
                '--small-value-display-max-len',
                String(smallValueDisplayMaxLen),
            );

            timer.mark('python-args-ready');
            const pythonResponse = (await this.pythonManager.executePythonFile(
                scriptPath,
                args,
                true,
            )) as DataInfoPythonResponse;
            timer.mark('python-complete');

            if (
                pythonResponse &&
                !pythonResponse.error &&
                mtimeMs !== undefined &&
                cacheMaxEntries > 0
            ) {
                DataInfoCache.set(
                    filePath,
                    mtimeMs,
                    configKey,
                    pythonResponse,
                    cacheMaxEntries,
                );
            }

            timer.finish('getDataInfo');
            return pythonResponse;
        } catch (error) {
            Logger.error(
                `[DataProcessor] [getDataInfo] 🐍 ❌ Error processing data file: ${error}`,
            );
            return null;
        }
    }

    async getRepr(
        uri: vscode.Uri,
        scope: 'root' | 'group',
        group: string | undefined,
        convertBandsToVariables: boolean = false,
    ): Promise<DataInfoPythonResponse | null> {
        const timer = new PerformanceTimer(`getRepr:${scope}`);
        if (!this.pythonManager.ready) {
            throw new Error('Python environment not ready');
        }

        const scriptPath = path.join(
            this.pythonScriptsHomeDir,
            'get_data_info.py',
        );
        const args = ['repr', uri.fsPath, '--scope', scope];
        if (convertBandsToVariables) {
            args.push('--convert-bands-to-variables');
        }
        if (scope === 'group' && group) {
            args.push('--group', group);
        }

        try {
            timer.mark('python-args-ready');
            const pythonResponse = await this.pythonManager.executePythonFile(
                scriptPath,
                args,
                true,
            );
            timer.mark('python-complete');
            timer.finish('getRepr');
            return pythonResponse as DataInfoPythonResponse;
        } catch (error) {
            Logger.error(
                `[DataProcessor] [getRepr] 🐍 ❌ Error loading repr: ${error}`,
            );
            return null;
        }
    }

    // Default server-side timeout for plot operations: 2 minutes
    // This timeout is independent of the webview and will kill the process
    // even if the user closes the tab before the webview timeout fires.
    private static readonly DEFAULT_PLOT_TIMEOUT_MS = 20000;

    async createPlot(
        uri: vscode.Uri,
        variable: string,
        plotType: string = 'auto',
        convertBandsToVariables: boolean = false,
        datetimeVariableName?: string,
        startDatetime?: string,
        endDatetime?: string,
        dimensionSlices?: Record<string, string | number>,
        facetRow?: string,
        facetCol?: string,
        colWrap?: number,
        plotX?: string,
        plotY?: string,
        plotHue?: string,
        xincrease?: boolean,
        yincrease?: boolean,
        aspect?: number,
        size?: number,
        robust?: boolean,
        cmap?: string,
        bins?: number,
        vmin?: number,
        vmax?: number,
        /** When false, passes --no-add-colorbar (default true: show colorbar when applicable). */
        addColorbar?: boolean,
        /** When true, passes --add-legend (webview defaults on; Python `create_plot` still defaults false when the flag is omitted from CLI). */
        addLegend?: boolean,
        operationId?: string,
        timeoutMs: number = DataProcessor.DEFAULT_PLOT_TIMEOUT_MS,
    ): Promise<CreatePlotPythonResponse | null> {
        if (!this.pythonManager.ready) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const scriptPath = path.join(
            this.pythonScriptsHomeDir,
            'get_data_info.py',
        );

        // Get the matplotlib style (either from user setting or auto-detected)
        const style = getMatplotlibStyle();

        // Use the new merged CLI with 'plot' mode and style parameter
        const args = ['plot', filePath, variable, plotType, '--style', style];

        if (convertBandsToVariables) {
            args.push('--convert-bands-to-variables');
        }

        if (datetimeVariableName && datetimeVariableName.trim() !== '') {
            args.push('--datetime-variable', datetimeVariableName);
        }
        if (startDatetime && startDatetime.trim() !== '') {
            args.push('--start-datetime', startDatetime);
        }
        if (endDatetime && endDatetime.trim() !== '') {
            args.push('--end-datetime', endDatetime);
        }
        if (dimensionSlices && Object.keys(dimensionSlices).length > 0) {
            args.push('--dimension-slices', JSON.stringify(dimensionSlices));
        }
        if (facetRow && facetRow.trim() !== '') {
            args.push('--facet-row', facetRow);
        }
        if (facetCol && facetCol.trim() !== '') {
            args.push('--facet-col', facetCol);
        }
        if (
            colWrap !== null &&
            colWrap !== undefined &&
            Number.isInteger(colWrap) &&
            colWrap >= 1
        ) {
            args.push('--col-wrap', String(colWrap));
        }
        if (plotX && plotX.trim() !== '') {
            args.push('--plot-x', plotX);
        }
        if (plotY && plotY.trim() !== '') {
            args.push('--plot-y', plotY);
        }
        if (plotHue && plotHue.trim() !== '') {
            args.push('--plot-hue', plotHue);
        }
        if (xincrease !== undefined) {
            args.push('--xincrease', xincrease ? 'true' : 'false');
        }
        if (yincrease !== undefined) {
            args.push('--yincrease', yincrease ? 'true' : 'false');
        }
        if (aspect !== undefined && Number.isFinite(aspect) && aspect > 0) {
            args.push('--aspect', String(aspect));
        }
        if (size !== undefined && Number.isFinite(size) && size > 0) {
            args.push('--size', String(size));
        }
        if (robust === true) {
            args.push('--robust');
        }
        if (cmap && cmap.trim() !== '') {
            args.push('--cmap', cmap.trim());
        }
        if (
            bins !== null &&
            bins !== undefined &&
            Number.isInteger(bins) &&
            bins >= 1
        ) {
            args.push('--bins', String(bins));
        }
        if (vmin !== undefined && Number.isFinite(vmin)) {
            args.push('--vmin', String(vmin));
        }
        if (vmax !== undefined && Number.isFinite(vmax)) {
            args.push('--vmax', String(vmax));
        }
        if (addColorbar === false) {
            args.push('--no-add-colorbar');
        }
        if (addLegend === true) {
            args.push('--add-legend');
        }

        try {
            Logger.info(
                `[DataProcessor] [createPlot] Creating plot for variable '${variable}' with type '${plotType}' and style '${style}'`,
            );
            Logger.info(
                `[DataProcessor] [createPlot] Time controls: datetimeVariableName='${datetimeVariableName}', startDatetime='${startDatetime}', endDatetime='${endDatetime}'`,
            );
            if (cmap && cmap.trim() !== '') {
                Logger.info(
                    `[DataProcessor] [createPlot] Colormap: ${cmap.trim()}`,
                );
            }
            if (operationId) {
                Logger.info(
                    `[DataProcessor] [createPlot] Operation ID: ${operationId}, Server timeout: ${timeoutMs}ms`,
                );
            }

            // Execute Python script and capture both stdout and stderr
            // Pass the operation ID for tracking and potential abort
            // Pass the server-side timeout that will kill the process even if webview is closed
            const pythonResponse = await this.pythonManager.executePythonFile(
                scriptPath,
                args,
                true,
                operationId,
                timeoutMs,
            );
            // Return the result even if it contains an error field
            // The caller can check for result.error to handle errors
            return pythonResponse as CreatePlotPythonResponse;
        } catch (error) {
            Logger.error(
                `[DataProcessor] [createPlot] Error creating plot: ${error}`,
            );
            throw error;
        }
    }

    /**
     * Abort an active plot operation
     * @param operationId The ID of the plot operation to abort
     * @returns true if the operation was aborted, false otherwise
     */
    abortPlot(operationId: string): boolean {
        Logger.info(
            `[DataProcessor] [abortPlot] Aborting plot operation: ${operationId}`,
        );
        return this.pythonManager.abortProcess(operationId);
    }

    /**
     * Check if a plot operation is currently active
     * @param operationId The ID of the plot operation to check
     * @returns true if the operation is active, false otherwise
     */
    isPlotOperationActive(operationId: string): boolean {
        return this.pythonManager.isOperationActive(operationId);
    }
}
