/** Injected at build time from package.json `contributes.languages` (scripts/build-webview.mjs). */
declare const __SUPPORTED_EXTENSIONS__: string[];

export const SUPPORTED_EXTENSIONS: string[] =
    typeof __SUPPORTED_EXTENSIONS__ !== 'undefined'
        ? __SUPPORTED_EXTENSIONS__
        : [];

const MAX_ATTR_DISPLAY_STR_LENGTH = 999999;

/** Escape any value for use in HTML text or a double/single-quoted attribute. */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/** Escape then turn newlines into <br> (for multi-line messages). */
export function escapeHtmlMultiline(value: unknown): string {
    return escapeHtml(value).replace(/\n/g, '<br>');
}

export function formatFileSize(bytes: number): string {
    const sizes = ['B', 'kB', 'MB', 'GB', 'TB'];
    if (bytes === 0) {
        return '0 B';
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Attribute values arrive as JSON: strings, numbers, booleans, null, arrays
 * or nested objects. Non-strings are shown as their JSON text.
 */
export function attributeValueStrings(value: unknown): {
    valueStr: string;
    displayStr: string;
} {
    let valueStr: string | undefined;
    if (typeof value === 'string') {
        valueStr = value;
    } else {
        try {
            valueStr = JSON.stringify(value);
        } catch {
            valueStr = undefined;
        }
        if (valueStr === undefined) {
            valueStr = String(value);
        }
    }
    const displayStr =
        valueStr.length > MAX_ATTR_DISPLAY_STR_LENGTH
            ? valueStr.slice(0, MAX_ATTR_DISPLAY_STR_LENGTH) + '…'
            : valueStr;
    return { valueStr, displayStr };
}

/** Make one path segment safe for a relative file name (no separators, no `..`). */
export function sanitizePathSegment(segment: string): string {
    // eslint-disable-next-line no-control-regex
    const cleaned = segment.replace(/[<>:"|?*\\/\u0000-\u001f]/g, '_');
    return cleaned === '' || cleaned === '.' || cleaned === '..'
        ? '_'
        : cleaned;
}

/**
 * Default relative path for a saved plot:
 * `sdv-plots/<data file name>/<group>/<variable>_<timestamp>.png`.
 * The data file path may use `/` or `\` (Windows).
 */
export function generateDefaultFileName(
    datasetFilePath: string,
    variablePath: string,
): string {
    const fileName = sanitizePathSegment(
        datasetFilePath.split(/[\\/]/).pop() || 'data',
    );
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const variableSegments = variablePath
        .split('/')
        .filter((segment) => segment !== '')
        .map(sanitizePathSegment);
    if (variableSegments.length === 0) {
        variableSegments.push('plot');
    }
    return `${['sdv-plots', fileName, ...variableSegments].join('/')}_${timestamp}.png`;
}

/** Replace the children of `element` with `text`, one line per <br>. */
export function setMultilineText(element: HTMLElement, text: string): void {
    element.textContent = '';
    String(text)
        .split('\n')
        .forEach((line, index) => {
            if (index > 0) {
                element.appendChild(document.createElement('br'));
            }
            element.appendChild(document.createTextNode(line));
        });
}

/**
 * First element matching `selector` whose `data-<key>` equals `value`.
 * Compares in JS, so file-derived values never end up in a selector.
 */
export function findByData<T extends HTMLElement = HTMLElement>(
    root: ParentNode,
    selector: string,
    key: string,
    value: string,
): T | null {
    for (const element of Array.from(root.querySelectorAll<T>(selector))) {
        if (element.dataset[key] === value) {
            return element;
        }
    }
    return null;
}

export function clampPlotTimeout(timeoutMs: unknown): number {
    return typeof timeoutMs === 'number' &&
        Number.isFinite(timeoutMs) &&
        timeoutMs >= 1000
        ? Math.min(Math.floor(timeoutMs), 600000)
        : 20000;
}

let uniqueIdCounter = 0;
export function uniqueId(prefix: string): string {
    uniqueIdCounter += 1;
    return `${prefix}-${uniqueIdCounter}`;
}
