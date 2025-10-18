import * as fs from 'fs';
import * as path from 'path';

/**
 * CSS generation utilities to separate styles from the main panel
 */
export class CSSGenerator {
    private static readonly cssPath = path.join(
        __dirname,
        '../../../src/panel/webview/styles.css',
    );
    private static content: string | null = null;

    static get(devMode: boolean): string {
        // In dev mode, we always reload the CSS file for shorter development feedback loops.
        if (this.content === null || devMode) {
            this.load();
        }
        return this.content || '';
    }

    private static load(): void {
        try {
            // Try to load from the source directory first (for development)
            this.content = fs.readFileSync(this.cssPath, 'utf8');
        } catch (error) {
            console.error('Failed to load CSS file:', error);
            // Fallback to empty string if CSS file cannot be loaded
            this.content = '';
        }
    }
}
