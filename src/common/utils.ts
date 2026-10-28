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
