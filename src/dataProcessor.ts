import * as vscode from 'vscode';
import * as path from 'path';
import { PythonManager } from './pythonManager';
import { Logger } from './logger';

export interface DataInfo {
    format: string;
    dimensions?: { [key: string]: number };
    variables?: Array<{
        name: string;
        dtype: string;
        shape: number[];
        dimensions: string[];
        size_bytes: number;
        attributes?: { [key: string]: any };
    }>;
    attributes?: { [key: string]: any };
    fileSize?: number;
    error?: string;
}

export interface DataSlice {
    variable: string;
    data: any;
    shape: number[];
    dtype: string;
}

export class DataProcessor {
    constructor(private pythonManager: PythonManager) { }

    get pythonManagerInstance(): PythonManager {
        return this.pythonManager;
    }

    async getDataInfo(uri: vscode.Uri): Promise<DataInfo | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const scriptPath = path.join(__dirname, '..', 'python', 'get_data_info.py');

        try {
            const result = await this.pythonManager.executePythonFile(scriptPath, [filePath]);
            if (result.error) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            Logger.error(`Error processing data file: ${error}`);
            return null;
        }
    }

    async getDataSlice(uri: vscode.Uri, variable: string, sliceSpec?: any): Promise<DataSlice | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const scriptPath = path.join(__dirname, '..', 'python', 'get_data_slice.py');
        const args = [filePath, variable];

        if (sliceSpec) {
            args.push(JSON.stringify(sliceSpec));
        }

        try {
            const result = await this.pythonManager.executePythonFile(scriptPath, args);
            if (result.error) {
                throw new Error(result.error);
            }
            return result;
        } catch (error) {
            Logger.error(`Error getting data slice: ${error}`);
            return null;
        }
    }

    async getVariableList(uri: vscode.Uri): Promise<string[]> {
        const dataInfo = await this.getDataInfo(uri);
        if (!dataInfo || !dataInfo.variables) {
            return [];
        }
        return dataInfo.variables.map(v => v.name);
    }

    async getDimensionList(uri: vscode.Uri): Promise<string[]> {
        const dataInfo = await this.getDataInfo(uri);
        if (!dataInfo || !dataInfo.dimensions) {
            return [];
        }
        return Object.keys(dataInfo.dimensions);
    }

    async createPlot(uri: vscode.Uri, variable: string, plotType: string = 'line'): Promise<string | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const scriptPath = path.join(__dirname, '..', 'python', 'create_plot.py');
        const args = [filePath, variable, plotType];

        try {
            Logger.info(`Creating plot for variable '${variable}' with type '${plotType}'`);

            // Execute Python script and capture both stdout and stderr
            const result = await this.pythonManager.executePythonFileWithLogs(scriptPath, args);

            if (typeof result === 'string' && result.startsWith('iVBOR')) {
                Logger.info(`Plot created successfully for variable '${variable}'`);
                return result; // Base64 image data
            } else if (result.error) {
                throw new Error(result.error);
            }
            return null;
        } catch (error) {
            Logger.error(`Error creating plot: ${error}`);
            return null;
        }
    }

    async getHtmlRepresentation(uri: vscode.Uri): Promise<string | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const scriptPath = path.join(__dirname, '..', 'python', 'get_html_representation.py');
        const args = [filePath];

        try {
            const result = await this.pythonManager.executePythonFile(scriptPath, args);
            if (result.error) {
                throw new Error(result.error);
            }
            return result.html || null;
        } catch (error) {
            Logger.error(`Error getting HTML representation: ${error}`);
            return null;
        }
    }

    async getTextRepresentation(uri: vscode.Uri): Promise<string | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const filePath = uri.fsPath;
        const scriptPath = path.join(__dirname, '..', 'python', 'get_text_representation.py');
        const args = [filePath];

        try {
            const result = await this.pythonManager.executePythonFile(scriptPath, args);
            if (result.error) {
                throw new Error(result.error);
            }
            return result.text || null;
        } catch (error) {
            Logger.error(`Error getting text representation: ${error}`);
            return null;
        }
    }

    async getShowVersions(): Promise<string | null> {
        if (!this.pythonManager.isReady()) {
            throw new Error('Python environment not ready');
        }

        const scriptPath = path.join(__dirname, '..', 'python', 'get_show_versions.py');
        const args: string[] = [];

        try {
            const result = await this.pythonManager.executePythonFile(scriptPath, args);
            if (result.error) {
                throw new Error(result.error);
            }
            return result.versions || null;
        } catch (error) {
            Logger.error(`Error getting show versions: ${error}`);
            return null;
        }
    }
}
