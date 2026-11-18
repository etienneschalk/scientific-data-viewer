/**
 * Formatting of the "Loaded:" timestamp, shared by the webview (which updates
 * it on each load) and `HTMLGenerator` (initial page). Pure module: no DOM, no vscode.
 */

function pad(value: number, width = 2): string {
    return String(value).padStart(width, '0');
}

/**
 * Format an ISO timestamp as ISO 8601: in UTC (`2026-01-01T12:00:00.000Z`)
 * or in the local time zone with its offset (`2026-01-01T13:00:00.000+01:00`).
 */
export function formatLoadTime(
    isoString: string,
    useLocalTime: boolean,
): string {
    const date = new Date(isoString);
    if (!useLocalTime) {
        return date.toISOString();
    }
    // getTimezoneOffset() is UTC minus local time, in minutes.
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
        `.${pad(date.getMilliseconds(), 3)}` +
        `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`
    );
}
