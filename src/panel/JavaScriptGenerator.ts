import * as fs from 'fs';
import * as path from 'path';

/**
 * JavaScript generation utilities to separate client-side logic from the main panel
 */
export class JavaScriptGenerator {
    private static readonly jsPath = path.join(
        __dirname,
        '../../../src/panel/webview/webview-script.js'
    );
    private static content: string | null = null;

    static get(devMode: boolean): string {
        // In dev mode, we always reload the JS file for shorter development feedback loops.
        if (this.content === null || devMode) {
            this.load();
        }
        return this.content || '';
    }

    private static load(): void {
        try {
            // Use the src/ui directory (live reload should work)
            this.content = fs.readFileSync(this.jsPath, 'utf8');
        } catch (error) {
            console.error('Failed to read webview-script.js:', error);
            // Fallback to a minimal error message
            this.content = `
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
