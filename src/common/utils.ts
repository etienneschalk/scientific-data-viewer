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
