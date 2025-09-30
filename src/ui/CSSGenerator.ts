import * as fs from 'fs';
import * as path from 'path';

/**
 * CSS generation utilities to separate styles from the main panel
 */
export class CSSGenerator {
    private static cssContent: string | null = null;

    static getStyles(devMode: boolean): string {
        // In dev mode, we always reload the CSS file for shorter development feedback loops.
        if (this.cssContent === null || devMode) {
            this.loadCSS();
        }
        return this.cssContent || '';
    }

    private static loadCSS(): void {
        try {
            // Try to load from the source directory first (for development)
            const cssPath = path.join(__dirname, '../../../src/ui', 'webview', 'styles.css');
            
            this.cssContent = fs.readFileSync(cssPath, 'utf8');
        } catch (error) {
            console.error('Failed to load CSS file:', error);
            // Fallback to empty string if CSS file cannot be loaded
            this.cssContent = '';
        }
    }

}

