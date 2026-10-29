import * as vscode from 'vscode';
import * as path from 'path';
import { PythonManager } from './PythonManager';
import { Logger } from '../common/Logger';
import {
    getMatplotlibStyle,
    getSmallVariableBytes,
    getSmallValueDisplayMaxLen,
    getOrderGroupsAlphabetically,
    getShowXarrayEncodingAttributes,
    getNetcdfEngineOrder,
    getShowInheritedCoordinates,
    getFacetgridFigsize,
    getPlotTimeoutMs,
    uriRequestsKerchunkOpen,
} from '../common/config';
import {
    DataInfoPythonResponse,
    CreatePlotPythonResponse,
    PlotOptions,
} from '../types';
import { PerformanceTimer } from '../common/PerformanceTimer';

export interface GetDataInfoCliOptions {
    convertBandsToVariables?: boolean;
    smallVariableBytes: number;
    smallValueDisplayMaxLen: number;
    orderGroupsAlphabetically: boolean;
    showXarrayEncodingAttributes: boolean;
    netcdfEngineOrder: string[];
    showInheritedCoordinates: boolean;
    openAsKerchunk?: boolean;
}

/** Build argv for `get_data_info.py info` (exported for unit tests). */
export function buildGetDataInfoCliArgs(
    filePath: string,
    options: GetDataInfoCliOptions,
): string[] {
    const args = ['info', filePath];
    if (options.convertBandsToVariables) {
        args.push('--convert-bands-to-variables');
    }
    args.push('--small-variable-bytes', String(options.smallVariableBytes));
    args.push(
        '--small-value-display-max-len',
        String(options.smallValueDisplayMaxLen),
    );
    if (!options.orderGroupsAlphabetically) {
        args.push('--no-order-groups-alphabetically');
    }
    if (!options.showXarrayEncodingAttributes) {
        args.push('--no-show-xarray-encoding-attributes');
    }
    args.push('--netcdf-engine-order', options.netcdfEngineOrder.join(','));
    if (!options.showInheritedCoordinates) {
        args.push('--no-show-inherited-coordinates');
    }
    if (options.openAsKerchunk) {
        args.push('--open-as-kerchunk');
    }
    return args;
}

export interface CreatePlotCliOptions {
    style: string;
    convertBandsToVariables?: boolean;
    netcdfEngineOrder: string[];
    showInheritedCoordinates: boolean;
    openAsKerchunk?: boolean;
    facetgridFigsize?: [number, number] | null;
}

function isNonEmpty(value: string | null | undefined): value is string {
    return value !== undefined && value !== null && value.trim() !== '';
}

function isPositiveInteger(value: number | null | undefined): value is number {
    return (
        value !== undefined &&
        value !== null &&
        Number.isInteger(value) &&
        value >= 1
    );
}

function isFiniteNumber(value: number | null | undefined): value is number {
    return value !== undefined && value !== null && Number.isFinite(value);
}

/** Build argv for `get_data_info.py plot` (exported for unit tests). */
export function buildCreatePlotCliArgs(
    filePath: string,
    plot: PlotOptions,
    options: CreatePlotCliOptions,
): string[] {
    const args = ['plot', filePath, plot.variable, '--style', options.style];
    if (options.convertBandsToVariables) {
        args.push('--convert-bands-to-variables');
    }
    const stringFlags: Array<[string, string | null | undefined]> = [
        ['--datetime-variable', plot.datetimeVariableName],
        ['--start-datetime', plot.startDatetime],
        ['--end-datetime', plot.endDatetime],
        ['--facet-row', plot.facetRow],
        ['--facet-col', plot.facetCol],
        ['--plot-x', plot.plotX],
        ['--plot-y', plot.plotY],
        ['--plot-hue', plot.plotHue],
        ['--cmap', plot.cmap?.trim()],
    ];
    for (const [flag, value] of stringFlags) {
        if (isNonEmpty(value)) {
            args.push(flag, value);
        }
    }
    if (plot.dimensionSlices && Object.keys(plot.dimensionSlices).length > 0) {
        args.push('--dimension-slices', JSON.stringify(plot.dimensionSlices));
    }
    if (plot.colWrap === 'auto') {
        args.push('--col-wrap', 'auto');
    } else if (isPositiveInteger(plot.colWrap)) {
        args.push('--col-wrap', String(plot.colWrap));
    }
    if (plot.xincrease !== undefined && plot.xincrease !== null) {
        args.push('--xincrease', plot.xincrease ? 'true' : 'false');
    }
    if (plot.yincrease !== undefined && plot.yincrease !== null) {
        args.push('--yincrease', plot.yincrease ? 'true' : 'false');
    }
    if (isFiniteNumber(plot.aspect) && plot.aspect > 0) {
        args.push('--aspect', String(plot.aspect));
    }
    if (isFiniteNumber(plot.size) && plot.size > 0) {
        args.push('--size', String(plot.size));
    }
    if (plot.robust === true) {
        args.push('--robust');
    }
    if (isPositiveInteger(plot.bins)) {
        args.push('--bins', String(plot.bins));
    }
    if (isFiniteNumber(plot.vmin)) {
        args.push('--vmin', String(plot.vmin));
    }
    if (isFiniteNumber(plot.vmax)) {
        args.push('--vmax', String(plot.vmax));
    }
    if (plot.addColorbar === false) {
        args.push('--no-add-colorbar');
    }
    if (plot.addLegend === true) {
        args.push('--add-legend');
    }
    args.push('--netcdf-engine-order', options.netcdfEngineOrder.join(','));
    if (!options.showInheritedCoordinates) {
        args.push('--no-show-inherited-coordinates');
    }
    if (options.openAsKerchunk) {
        args.push('--open-as-kerchunk');
    }
    if (options.facetgridFigsize) {
        args.push(
            '--facetgrid-figsize',
            `${options.facetgridFigsize[0]},${options.facetgridFigsize[1]}`,
        );
    }
    return args;
}

/**
 * Upper bound for one `info` subprocess. Loading has no user setting (unlike
 * plotting); this only guards against a hung interpreter or remote store.
 */
export const DATA_INFO_TIMEOUT_MS = 5 * 60 * 1000;

export class DataProcessor {
    private readonly scriptPath: string;

    constructor(private pythonManager: PythonManager) {
        this.scriptPath = path.join(
            __dirname,
            '../../../python',
            'get_data_info.py',
        );
    }

    get pythonManagerInstance(): PythonManager {
        return this.pythonManager;
    }

    /**
     * Run `get_data_info.py info`. Resolves with the backend response, which
     * may carry a structured `error`; rejects when the subprocess fails.
     */
    async getDataInfo(
        uri: vscode.Uri,
        convertBandsToVariables: boolean = false,
    ): Promise<DataInfoPythonResponse> {
        const timer = new PerformanceTimer('getDataInfo');
        Logger.debug(
            `[DataProcessor] [getDataInfo] Getting data info for file: ${uri.fsPath}`,
        );
        if (!this.pythonManager.ready) {
            throw new Error('Python environment not ready');
        }

        const args = buildGetDataInfoCliArgs(uri.fsPath, {
            convertBandsToVariables,
            smallVariableBytes: getSmallVariableBytes(),
            smallValueDisplayMaxLen: getSmallValueDisplayMaxLen(),
            orderGroupsAlphabetically: getOrderGroupsAlphabetically(),
            showXarrayEncodingAttributes: getShowXarrayEncodingAttributes(),
            netcdfEngineOrder: getNetcdfEngineOrder(),
            showInheritedCoordinates: getShowInheritedCoordinates(),
            openAsKerchunk: uriRequestsKerchunkOpen(uri),
        });
        timer.mark('python-args-ready');

        try {
            const pythonResponse = (await this.pythonManager.executePythonFile(
                this.scriptPath,
                args,
                true,
                undefined,
                DATA_INFO_TIMEOUT_MS,
            )) as DataInfoPythonResponse;
            timer.finish('getDataInfo');
            return pythonResponse;
        } catch (error) {
            Logger.error(
                `[DataProcessor] [getDataInfo] 🐍 ❌ Error processing data file: ${error}`,
            );
            throw error;
        }
    }

    /**
     * Run `get_data_info.py plot`. `timeoutMs` kills the subprocess even if
     * the webview that asked for the plot is closed.
     */
    async createPlot(
        uri: vscode.Uri,
        plot: PlotOptions,
        convertBandsToVariables: boolean = false,
        timeoutMs: number = getPlotTimeoutMs(),
    ): Promise<CreatePlotPythonResponse> {
        if (!this.pythonManager.ready) {
            throw new Error('Python environment not ready');
        }

        const style = getMatplotlibStyle();
        const args = buildCreatePlotCliArgs(uri.fsPath, plot, {
            style,
            convertBandsToVariables,
            netcdfEngineOrder: getNetcdfEngineOrder(),
            showInheritedCoordinates: getShowInheritedCoordinates(),
            openAsKerchunk: uriRequestsKerchunkOpen(uri),
            facetgridFigsize: getFacetgridFigsize(),
        });

        Logger.info(
            `[DataProcessor] [createPlot] Creating plot for variable '${plot.variable}' with style '${style}' (operation: ${plot.operationId ?? 'none'}, timeout: ${timeoutMs}ms)`,
        );
        try {
            return (await this.pythonManager.executePythonFile(
                this.scriptPath,
                args,
                true,
                plot.operationId,
                timeoutMs,
            )) as CreatePlotPythonResponse;
        } catch (error) {
            Logger.error(
                `[DataProcessor] [createPlot] Error creating plot: ${error}`,
            );
            throw error;
        }
    }

    /**
     * Abort an active plot operation
     * @returns true if the operation was aborted, false otherwise
     */
    abortPlot(operationId: string): boolean {
        Logger.info(
            `[DataProcessor] [abortPlot] Aborting plot operation: ${operationId}`,
        );
        return this.pythonManager.abortProcess(operationId);
    }
}
