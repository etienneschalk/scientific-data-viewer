import * as fs from 'fs';
import * as path from 'path';

/**
 * CSS generation utilities to separate styles from the main panel
 */
export class CSSGenerator {
    private static cssContent: string | null = null;

    static getStyles(): string {
        if (this.cssContent === null) {
            this.loadCSS();
        }
        return this.cssContent || '';
    }

    private static loadCSS(): void {
        try {
            // Try to load from the source directory first (for development)
            let cssPath = path.join(__dirname, 'styles.css');
            
            // If not found, try the compiled output directory
            if (!fs.existsSync(cssPath)) {
                cssPath = path.join(__dirname, '..', '..', 'src', 'ui', 'styles.css');
            }
            
            this.cssContent = fs.readFileSync(cssPath, 'utf8');
        } catch (error) {
            console.error('Failed to load CSS file:', error);
            // Fallback to empty string if CSS file cannot be loaded
            this.cssContent = '';
        }
    }

}

