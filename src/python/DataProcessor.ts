import * as vscode from 'vscode';
import * as path from 'path';
import { PythonManager } from './PythonManager';
import { Logger } from '../common/Logger';
import { quoteIfNeeded } from '../common/utils';
import { getMatplotlibStyle } from '../common/config';
import { DataInfoPythonResponse, CreatePlotPythonResponse } from '../types';

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
    ): Promise<DataInfoPythonResponse | null> {
        Logger.debug(
            `[DataProcessor] [getDataInfo] Getting data info for file: ${uri.fsPath}`,
        );
        if (!this.pythonManager.ready) {
            throw new Error('Python environment not ready');
        }

        const filePath = quoteIfNeeded(uri.fsPath);
        const scriptPath = quoteIfNeeded(
            path.join(this.pythonScriptsHomeDir, 'get_data_info.py'),
        );

        try {
            // Use the new merged CLI with 'info' mode
            const args = ['info', filePath];
            if (convertBandsToVariables) {
                args.push('--convert-bands-to-variables');
            }

            const pythonResponse = await this.pythonManager.executePythonFile(
                scriptPath,
                args,
                true,
            );
            // Return the result even if it contains an error field
            // The caller can check for result.error to handle errors
            return pythonResponse as DataInfoPythonResponse;
        } catch (error) {
            Logger.error(
                `[DataProcessor] [getDataInfo] 🐍 ❌ Error processing data file: ${error}`,
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
        operationId?: string,
        timeoutMs: number = DataProcessor.DEFAULT_PLOT_TIMEOUT_MS,
    ): Promise<CreatePlotPythonResponse | null> {
        if (!this.pythonManager.ready) {
            throw new Error('Python environment not ready');
        }

        const filePath = quoteIfNeeded(uri.fsPath);
        const scriptPath = quoteIfNeeded(
            path.join(this.pythonScriptsHomeDir, 'get_data_info.py'),
        );

        // Get the matplotlib style (either from user setting or auto-detected)
        const style = getMatplotlibStyle();

        // Use the new merged CLI with 'plot' mode and style parameter
        const args = [
            'plot',
            filePath,
            quoteIfNeeded(variable),
            plotType,
            '--style',
            quoteIfNeeded(style),
        ];

        if (convertBandsToVariables) {
            args.push('--convert-bands-to-variables');
        }

        if (datetimeVariableName && datetimeVariableName.trim() !== '') {
            args.push(
                '--datetime-variable',
                quoteIfNeeded(datetimeVariableName),
            );
        }
        if (startDatetime && startDatetime.trim() !== '') {
            args.push('--start-datetime', quoteIfNeeded(startDatetime));
        }
        if (endDatetime && endDatetime.trim() !== '') {
            args.push('--end-datetime', quoteIfNeeded(endDatetime));
        }

        try {
            Logger.info(
                `[DataProcessor] [createPlot] Creating plot for variable '${variable}' with type '${plotType}' and style '${style}'`,
            );
            Logger.info(
                `[DataProcessor] [createPlot] Time controls: datetimeVariableName='${datetimeVariableName}', startDatetime='${startDatetime}', endDatetime='${endDatetime}'`,
            );
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
