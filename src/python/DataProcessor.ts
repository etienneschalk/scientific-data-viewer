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
        convertBandsToVariables: boolean = false
    ): Promise<DataInfoPythonResponse | null> {
        Logger.debug(
            `[DataProcessor] [getDataInfo] Getting data info for file: ${uri.fsPath}`
        );
        if (!this.pythonManager.ready) {
            throw new Error('Python environment not ready');
        }

        const filePath = quoteIfNeeded(uri.fsPath);
        const scriptPath = quoteIfNeeded(
            path.join(this.pythonScriptsHomeDir, 'get_data_info.py')
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
                true
            );
            // Return the result even if it contains an error field
            // The caller can check for result.error to handle errors
            return pythonResponse as DataInfoPythonResponse;
        } catch (error) {
            Logger.error(
                `[DataProcessor] [getDataInfo] 🐍 ❌ Error processing data file: ${error}`
            );
            return null;
        }
    }

    async createPlot(
        uri: vscode.Uri,
        variable: string,
        plotType: string = 'auto',
        convertBandsToVariables: boolean = false
    ): Promise<CreatePlotPythonResponse | null> {
        if (!this.pythonManager.ready) {
            throw new Error('Python environment not ready');
        }

        const filePath = quoteIfNeeded(uri.fsPath);
        const scriptPath = quoteIfNeeded(
            path.join(this.pythonScriptsHomeDir, 'get_data_info.py')
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

        try {
            Logger.info(
                `[DataProcessor] [createPlot] Creating plot for variable '${variable}' with type '${plotType}' and style '${style}'`
            );

            // Execute Python script and capture both stdout and stderr
            const pythonResponse = await this.pythonManager.executePythonFile(
                scriptPath,
                args,
                true
            );
            // Return the result even if it contains an error field
            // The caller can check for result.error to handle errors
            return pythonResponse as CreatePlotPythonResponse;
        } catch (error) {
            Logger.error(
                `[DataProcessor] [createPlot] Error creating plot: ${error}`
            );
            throw error;
        }
    }
}
