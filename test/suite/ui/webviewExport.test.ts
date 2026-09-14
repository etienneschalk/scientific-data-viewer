import * as assert from 'assert';
import { HTMLGenerator } from '../../../src/panel/HTMLGenerator';
import { ThemeManager } from '../../../src/panel/ThemeManager';

/**
 * Approximates `document.documentElement.outerHTML` of a live webview:
 * VS Code injects its own head assets, sets `--vscode-*` custom properties as
 * an inline style on <html>, and tags <body> with the active theme kind. Since
 * v0.12.0 the extension's own CSS/JS are served over `vscode-resource` URIs.
 */
const CDN =
    'https://file+.vscode-resource.vscode-cdn.net/ext/src/panel/webview';

function capturedWebviewHtml(
    options: {
        themeKind?: string;
        bodyClasses?: string;
        htmlStyle?: string;
    } = {},
): string {
    const {
        themeKind = 'vscode-dark',
        bodyClasses = themeKind,
        htmlStyle = '--vscode-editor-background: #1f1f1f; --vscode-editor-foreground: #cccccc; --vscode-chat-slashCommandForeground: #40a6ff; --vscode-font-size: 14px;',
    } = options;

    return (
        `<html lang="en" style="${htmlStyle}">` +
        '<head>' +
        '<style id="_defaultStyles">@layer vscode-default { body { color: var(--vscode-editor-foreground); } }</style>' +
        '<meta charset="UTF-8">' +
        '<title>Scientific Data Viewer</title>' +
        `<link rel="stylesheet" href="${CDN}/styles.css">` +
        '</head>' +
        `<body class="${bodyClasses}" data-vscode-theme-kind="${themeKind}" ` +
        'data-vscode-theme-name="Dark Modern" data-vscode-theme-id="Default Dark Modern">' +
        '<div class="header">content</div>' +
        `<script src="${CDN}/webview-script.js"></script>` +
        '</body></html>'
    );
}

function exportHtml(captured: string, exportTheme = ''): string {
    return HTMLGenerator.inlineWebviewAssets(
        ThemeManager.applyThemeToWebviewContent(captured, exportTheme),
        false,
    );
}

suite('Webview Export Test Suite', () => {
    suite('asset inlining', () => {
        test('replaces the vscode-resource stylesheet with inline CSS', () => {
            const exported = exportHtml(capturedWebviewHtml());

            assert.ok(
                !exported.includes(`${CDN}/styles.css`),
                'unresolvable stylesheet link must not survive the export',
            );
            assert.ok(
                exported.includes('<style id="scientific-data-viewer-style">'),
                'extension CSS must be inlined',
            );
        });

        test('replaces the vscode-resource script with inline JS', () => {
            const exported = exportHtml(capturedWebviewHtml());

            assert.ok(!exported.includes(`${CDN}/webview-script.js`));
            assert.ok(exported.includes('captureWebviewContent'));
        });

        test('inlines assets served with a dev-mode cache buster', () => {
            const captured = capturedWebviewHtml().replace(
                `${CDN}/styles.css`,
                `${CDN}/styles.css?v=1750000000000`,
            );

            const exported = exportHtml(captured);

            assert.ok(!exported.includes('styles.css?v='));
            assert.ok(
                exported.includes('<style id="scientific-data-viewer-style">'),
            );
        });

        test('is a no-op when the document already carries inline assets', () => {
            const inlined = HTMLGenerator.generateMainHTML(false, null, 1);

            assert.strictEqual(
                HTMLGenerator.inlineWebviewAssets(inlined, false),
                inlined,
            );
        });
    });

    suite('no export theme configured', () => {
        test('keeps every live CSS variable, including unknown ones', () => {
            const exported = exportHtml(capturedWebviewHtml());

            assert.ok(exported.includes('--vscode-editor-background: #1f1f1f'));
            assert.ok(
                exported.includes(
                    '--vscode-chat-slashCommandForeground: #40a6ff',
                ),
                'variables outside the hardcoded set must be preserved',
            );
            assert.ok(exported.includes('--vscode-font-size: 14px'));
        });

        test('captured font variables beat the built-in fallbacks', () => {
            const htmlTag =
                /<html\b[^>]*>/i.exec(exportHtml(capturedWebviewHtml()))?.[0] ??
                '';

            assert.ok(
                htmlTag.indexOf('--vscode-font-size: 13px') <
                    htmlTag.indexOf('--vscode-font-size: 14px'),
                'the captured 14px must be declared after the 13px fallback',
            );
        });

        test('leaves the captured theme kind untouched', () => {
            const exported = exportHtml(capturedWebviewHtml());

            assert.ok(
                exported.includes('data-vscode-theme-kind="vscode-dark"'),
            );
            assert.ok(exported.includes('class="vscode-dark"'));
        });

        test('emits a well-formed document', () => {
            const exported = exportHtml(capturedWebviewHtml());

            assert.ok(exported.startsWith('<!DOCTYPE html>'));
            assert.strictEqual(
                (exported.match(/<html\b/gi) || []).length,
                1,
                'exactly one <html> tag',
            );
        });
    });

    suite('export theme configured', () => {
        test('overrides theme colors while keeping other live variables', () => {
            const exported = exportHtml(
                capturedWebviewHtml(),
                'Solarized Light',
            );

            const htmlTag = /<html\b[^>]*>/i.exec(exported)?.[0] ?? '';
            assert.ok(
                htmlTag.includes('--vscode-editor-background: #fdf6e3'),
                'theme color must be applied',
            );
            assert.ok(
                htmlTag.lastIndexOf('--vscode-editor-background: #fdf6e3') >
                    htmlTag.indexOf('--vscode-editor-background: #1f1f1f'),
                'the override must come after the captured value to win',
            );
            assert.ok(
                htmlTag.includes('--vscode-chat-slashCommandForeground'),
                'variables the theme set does not cover must survive',
            );
        });

        test('retags the body so the xarray repr follows the exported theme', () => {
            const exported = exportHtml(
                capturedWebviewHtml({ themeKind: 'vscode-dark' }),
                'Solarized Light',
            );

            assert.ok(exported.includes('class="vscode-light"'));
            assert.ok(
                exported.includes('data-vscode-theme-kind="vscode-light"'),
            );
            assert.ok(!exported.includes('"vscode-dark"'));
        });

        test('preserves non-theme body classes', () => {
            const exported = exportHtml(
                capturedWebviewHtml({
                    themeKind: 'vscode-light',
                    bodyClasses: 'vscode-light vscode-reduce-motion',
                }),
                'Default Dark+',
            );

            const bodyTag = /<body\b[^>]*>/i.exec(exported)?.[0] ?? '';
            assert.ok(bodyTag.includes('vscode-dark'));
            assert.ok(
                bodyTag.includes('vscode-reduce-motion'),
                'unrelated classes must not be dropped',
            );
            assert.ok(!bodyTag.includes('vscode-light'));
        });

        test('does not rewrite vscode-dark selectors inside stylesheets', () => {
            const captured = capturedWebviewHtml().replace(
                '<div class="header">content</div>',
                '<style>body.vscode-dark .xr-wrap { --xr-bg: #111; }</style>',
            );

            const exported = exportHtml(captured, 'Solarized Light');

            assert.ok(
                exported.includes('body.vscode-dark .xr-wrap'),
                'CSS selectors must be left alone',
            );
        });

        test('adds the theme kind to a body that carries no theme markers', () => {
            const captured =
                '<html lang="en" style="--vscode-editor-background: #1f1f1f;">' +
                '<head></head><body><p>hi</p></body></html>';

            const exported = exportHtml(captured, 'Solarized Light');

            const bodyTag = /<body\b[^>]*>/i.exec(exported)?.[0] ?? '';
            assert.ok(bodyTag.includes('class="vscode-light"'));
            assert.ok(
                bodyTag.includes('data-vscode-theme-kind="vscode-light"'),
            );
            assert.ok(
                !bodyTag.includes('$1'),
                'replacement patterns must not leak into the output',
            );
        });

        test('falls back to live variables for an unknown theme', () => {
            const exported = exportHtml(capturedWebviewHtml(), 'Nonexistent');

            assert.ok(exported.includes('--vscode-editor-background: #1f1f1f'));
        });

        test('supplies font variables when the capture has no inline style', () => {
            const captured = capturedWebviewHtml().replace(
                /<html lang="en" style="[^"]*">/,
                '<html lang="en">',
            );

            const exported = exportHtml(captured, 'Default Dark+');

            assert.ok(exported.includes('--vscode-font-family:'));
            assert.ok(exported.includes('--vscode-editor-background: #1e1e1e'));
        });
    });

    test('leaves content without an <html> tag untouched', () => {
        const fragment = '<div>no document here</div>';

        assert.strictEqual(
            ThemeManager.applyThemeToWebviewContent(fragment, 'Default Dark+'),
            fragment,
        );
    });
});
