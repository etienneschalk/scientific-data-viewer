/**
 * The xarray HTML repr switches to its dark palette on `body.vscode-dark` or
 * `body[data-theme="dark"]`. VS Code tags High Contrast (dark) with
 * `vscode-high-contrast` only, so the repr would stay light on a black page:
 * set `data-theme="dark"` there, and keep it in sync when the user switches
 * theme (VS Code rewrites the body classes in place, without a reload).
 */
function syncXarrayDarkMode(): void {
    const body = document.body;
    const isHighContrastDark =
        body.classList.contains('vscode-high-contrast') &&
        !body.classList.contains('vscode-high-contrast-light');
    if (isHighContrastDark) {
        body.dataset.theme = 'dark';
    } else {
        delete body.dataset.theme;
    }
}

export function watchThemeKind(): void {
    syncXarrayDarkMode();
    new MutationObserver(syncXarrayDarkMode).observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
    });
}
