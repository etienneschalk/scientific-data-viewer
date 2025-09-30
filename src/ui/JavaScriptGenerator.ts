import * as fs from 'fs';
import * as path from 'path';

/**
 * JavaScript generation utilities to separate client-side logic from the main panel
 */
export class JavaScriptGenerator {
    static getCode(plottingCapabilities: boolean): string {
        // Use the src/ui directory (live reload should work?)
        const jsFilePath = path.join(__dirname, '../../../src/ui', 'webview', 'webview-script.js');
        try {
            const jsContent = fs.readFileSync(jsFilePath, 'utf8');
            return jsContent;
        } catch (error) {
            console.error('Failed to read webview-script.js:', error);
            // Fallback to a minimal error message
            return `
                console.error('Failed to load webview script');
                const vscode = acquireVsCodeApi();
                const messageBus = { 
                    sendRequest: () => Promise.reject(new Error('Script not loaded')),
                    onDataLoaded: () => {},
                    onError: () => {},
                    onPythonEnvironmentChanged: () => {},
                    onUIStateChanged: () => {}
                };
            `;
        }
    }

}
