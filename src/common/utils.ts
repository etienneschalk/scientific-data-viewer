/**
 * Quote the value if it contains a space
 * Used to to avoid issues with spaces in the path
 * @param value The value to quote if needed
 * @returns The quoted value if needed, otherwise the original value
 */
export function quoteIfNeeded(value: string): string {
    if (value.includes(' ')) {
        return `"${value}"`;
    }
    return value;
}

/**
 * Quote a string for safe passing as a single shell argument (e.g. JSON).
 * Escapes internal double quotes and backslashes so the shell passes one argument.
 * Use for values that contain ", {, }, etc. so the shell does not split them.
 */
export function quoteForShell(value: string): string {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

/**
 * Format configuration value based on type
 */
export function formatConfigValue(value: any): string {
    switch (typeof value) {
        case 'boolean':
            return value ? 'enabled 🟢' : 'disabled 🔴';
        case 'number':
            return `${value}`;
        case 'string':
            return `"${value}"`;
        default:
            return String(value);
    }
}
