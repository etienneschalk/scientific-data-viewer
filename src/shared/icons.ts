/**
 * 16px line icons of the viewer, as inline SVG markup (no font or image to
 * load under the webview CSP). Shared by the host-generated page skeleton and
 * the webview bundle; stroke, color and size come from `.sdv-icon` in
 * styles.css, so icons follow the text color of their container.
 */
function icon(body: string): string {
    return `<svg class="sdv-icon" viewBox="0 0 16 16" aria-hidden="true">${body}</svg>`;
}

export const ICONS = {
    export: icon('<path d="M8 2.5v7.5M5 7l3 3 3-3M3 11.5v2h10v-2"/>'),
    collapseAll: icon(
        '<rect x="4.5" y="4.5" width="9" height="9" rx="1.5"/><path d="M2.5 11V3.5a1 1 0 0 1 1-1H11M6.75 9h4.5"/>',
    ),
    expandAll: icon(
        '<rect x="4.5" y="4.5" width="9" height="9" rx="1.5"/><path d="M2.5 11V3.5a1 1 0 0 1 1-1H11M6.75 9h4.5M9 6.75v4.5"/>',
    ),
    refresh: icon(
        '<path d="M13 8a5 5 0 1 1-1.46-3.54"/><path d="M8.75 4.5h2.8V1.7"/>',
    ),
    clock: icon('<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.25l2 1.25"/>'),
    warning: icon(
        '<path d="M8 2.25 14.25 13H1.75z"/><path d="M8 6.5v3M8 11.25v.25"/>',
    ),
    stop: icon(
        '<circle cx="8" cy="8" r="6"/><rect x="6" y="6" width="4" height="4" rx=".5"/>',
    ),
    error: icon(
        '<circle cx="8" cy="8" r="6"/><path d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5"/>',
    ),
    lightbulb: icon(
        '<path d="M5.75 11.5c0-1.6-2.25-2.6-2.25-5a4.5 4.5 0 0 1 9 0c0 2.4-2.25 3.4-2.25 5z"/><path d="M6.25 13.75h3.5"/>',
    ),
    install: icon(
        '<path d="M8 1.75 13.5 4.5v7L8 14.25 2.5 11.5v-7z"/><path d="M2.5 4.5 8 7.25l5.5-2.75M8 7.25v7"/>',
    ),
    settings: icon(
        '<path d="M2.5 4.5h2M7.5 4.5h6M2.5 8h6.5M12 8h1.5M2.5 11.5h1M6.5 11.5h7"/><circle cx="6" cy="4.5" r="1.5"/><circle cx="10.5" cy="8" r="1.5"/><circle cx="5" cy="11.5" r="1.5"/>',
    ),
    output: icon(
        '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M4.75 6.25 6.5 8l-1.75 1.75M8 10h3"/>',
    ),
    linkExternal: icon(
        '<path d="M9.5 2.5h4v4M13.5 2.5l-6 6M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3"/>',
    ),
    globe: icon(
        '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c-2.2 2.2-2.2 9.8 0 12M8 2c2.2 2.2 2.2 9.8 0 12"/>',
    ),
};
