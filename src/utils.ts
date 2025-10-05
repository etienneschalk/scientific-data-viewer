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