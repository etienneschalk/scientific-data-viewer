import * as fs from 'fs';
import * as path from 'path';

/**
 * Files the webview loads, as path segments relative to the extension root.
 * The live webview requests them over `asWebviewUri`; exported HTML and
 * documents generated without a webview inline their content instead.
 * The script is the esbuild bundle of src/panel/webview/*.ts
 * (scripts/build-webview.mjs, run by `npm run compile` / `npm run watch`).
 */
export const WEBVIEW_STYLESHEET = ['src', 'panel', 'webview', 'styles.css'];
export const WEBVIEW_SCRIPT = ['out', 'webview', 'webview.js'];

// Compiled to out/src/panel/, three levels below the extension root.
const EXTENSION_ROOT = path.join(__dirname, '..', '..', '..');

const cache = new Map<string, string>();

/**
 * Read a webview asset (cached; dev mode re-reads it on every call so edits
 * show up on reload). Returns '' and logs when the file cannot be read.
 */
export function readWebviewAsset(segments: string[], devMode: boolean): string {
    const filePath = path.join(EXTENSION_ROOT, ...segments);
    const cached = cache.get(filePath);
    if (cached !== undefined && !devMode) {
        return cached;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        cache.set(filePath, content);
        return content;
    } catch (error) {
        console.error(`Failed to read webview asset ${filePath}:`, error);
        return '';
    }
}
