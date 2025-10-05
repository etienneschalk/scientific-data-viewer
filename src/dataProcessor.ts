import * as vscode from 'vscode';
import * as path from 'path';
import { PythonManager } from './pythonManager';
import { Logger } from './logger';
import { quoteIfNeeded } from './utils';

export interface DataInfo {
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
        }>;
    };
    attributes_flattened: { [groupName: string]: { [key: string]: any } };
    xarray_html_repr_flattened: { [groupName: string]: string };
    xarray_text_repr_flattened: { [groupName: string]: string };
}
export interface DataInfoError {
    error: string;
    error_type: string;
    suggestion: string;
    format_info: DataInfoFormatInfo;
    xarray_show_versions: string;
}

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
        this.pythonScriptsHomeDir = path.join(__dirname, '../..', 'python');
    }

    private detectVSCodeTheme(): string {
        // Get the current VSCode theme
        const currentTheme = vscode.window.activeColorTheme;

        // Check if it's a dark theme
        if (currentTheme.kind === vscode.ColorThemeKind.Dark) {
            Logger.info(
                'Detected dark VSCode theme, using dark_background style'
            );
            return 'dark_background';
        } else {
            Logger.info('Detected light VSCode theme, using default style');
            return 'default';
        }
    }

    private getMatplotlibStyle(): string {
        // Get the user setting
        const config = vscode.workspace.getConfiguration(
            'scientificDataViewer'
        );
        const userStyle = config.get<string>('matplotlibStyle', '');

        if (userStyle && userStyle.trim() !== '') {
            Logger.info(`Using user-specified matplotlib style: ${userStyle}`);
            return userStyle;
        } else {
            // Auto-detect based on VSCode theme
            return this.detectVSCodeTheme();
        }
    }

    get pythonManagerInstance(): PythonManager {
        return this.pythonManager;
    }

    async getDataInfo(uri: vscode.Uri): Promise<DataInfo | null> {
        Logger.debug(`[getDataInfo] Getting data info for file: ${uri.fsPath}`);
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = quoteIfNeeded(uri.fsPath);
        const scriptPath = quoteIfNeeded(
            path.join(this.pythonScriptsHomeDir, 'get_data_info.py')
        );

        try {
            // Use the new merged CLI with 'info' mode
            const result = await this.pythonManager.executePythonFile(
                scriptPath,
                ['info', filePath],
                true
            );
            // Return the result even if it contains an error field
            // The caller can check for result.error to handle errors
            return result;
        } catch (error) {
            Logger.error(`🐍 ❌ Error processing data file: ${error}`);
            return null;
        }
    }

    async createPlot(
        uri: vscode.Uri,
        variable: string,
        plotType: string = 'auto'
    ): Promise<string | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = quoteIfNeeded(uri.fsPath);
        const scriptPath = quoteIfNeeded(
            path.join(this.pythonScriptsHomeDir, 'get_data_info.py')
        );

        // Get the matplotlib style (either from user setting or auto-detected)
        const style = this.getMatplotlibStyle();

        // Use the new merged CLI with 'plot' mode and style parameter
        const args = [
            'plot',
            filePath,
            quoteIfNeeded(variable),
            plotType,
            '--style',
            quoteIfNeeded(style),
        ];

        try {
            Logger.info(
                `Creating plot for variable '${variable}' with type '${plotType}' and style '${style}'`
            );

            // Execute Python script and capture both stdout and stderr
            const result = await this.pythonManager.executePythonFile(
                scriptPath,
                args,
                true
            );

            if (typeof result === 'string' && result.startsWith('iVBOR')) {
                Logger.info(
                    `Plot created successfully for variable '${variable}'`
                );
                return result; // Base64 image data
            } else if (result.error) {
                throw new Error(result.error);
            }
            return null;
        } catch (error) {
            Logger.error(`Error creating plot: ${error}`);
            throw error;
        }
    }
}
