# Scientific Data Viewer v0.12.1 Release Notes

**TL;DR** — **Export Webview Content** produced unstyled HTML (default serif on a white background) and ignored `webviewExportTheme`. The theme was not broken by a VS Code API change: v0.12.0 started loading CSS/JS over `asWebviewUri` URLs that do not resolve outside the editor, and the exporter still looked for an inline style tag that no longer exists. This patch inlines those assets at export time, keeps the captured `--vscode-*` variables, and retags the body so the xarray HTML repr follows the exported theme.

## What's actually wrong

Commit `b8d1380` ("Add metadata cache, external webview assets") switched the webview from inlining its CSS/JS to serving them via `asWebviewUri`. The live panel now emits something like:

```html
<link
  rel="stylesheet"
  href="https://file+.vscode-resource.vscode-cdn.net/…/styles.css"
/>
<script src="https://file+.vscode-resource.vscode-cdn.net/…/webview-script.js"></script>
```

Those `vscode-resource` URLs resolve to nothing once the file leaves VS Code or Cursor. Two things follow:

1. The exported HTML has **no stylesheet at all**, so you get default serif on a white background.
2. `ThemeManager` injected its theme variables by string-replacing `<style id="scientific-data-viewer-style">`, which no longer exists in the captured document. The `.replace()` silently did nothing, so `scientificDataViewer.webviewExportTheme` was ignored too.

The inline stylesheet branch in `HTMLGenerator` is now only a test fallback. The live panel uses external assets for caching; only the **exported** file needs to be self-contained.

## On the VS Code side

The theming contract in current VS Code (`vs/workbench/contrib/webview/browser/pre/index.html` and `themeing.ts`) is unchanged:

- `--vscode-*` custom properties still go on `document.documentElement.style` (the inline `style` attribute of `<html>`).
- The theme kind still lands on `<body>` as a class plus `data-vscode-theme-*` attributes.

Two evolutions did make the old exporter fragile, so 0.12.1 addresses them:

- **The variable set keeps growing.** `themeing.ts` now exports a size registry (`sizeValueToCss`) on top of the color registry. The old exporter threw away the `<html>` inline style entirely and rebuilt 19 hardcoded colors, so every other variable was lost.
- **`<body>` can carry extra classes.** VS Code adds `vscode-reduce-motion` and `vscode-using-screen-reader`. The old `replaceAll('"vscode-dark"', …)` relied on the class attribute containing exactly one class, so it broke for those users, and it never handled `vscode-high-contrast`.

## The fix

`HTMLGenerator.inlineWebviewAssets()` swaps the `vscode-resource` `<link>` / `<script src>` back to inline content at export time (with a function replacer, so `$&` sequences in the CSS/JS stay literal). The live panel keeps its caching benefit; only the exported file is made self-contained.

`ThemeManager` now preserves the captured `--vscode-*` declarations and appends the theme overrides to that same inline declaration rather than emitting a `:root` rule — an inline style on `<html>` outranks `:root`, so this is what makes the override actually win while everything uncovered keeps its live value. Verified ordering in a real export with **Solarized Light** selected:

```
--vscode-font-size: 13px              ← built-in fallback
--vscode-editor-background: #1f1f1f   ← captured
--vscode-textLink-foreground: #4daafc ← captured, previously dropped
--vscode-font-size: 14px              ← captured, beats the fallback
--vscode-editor-background: #fdf6e3   ← Solarized Light, wins
```

Theme kind rewriting is now scoped to the `<body>` open tag, preserving unrelated classes. That also removes the reason for the quoted-string trick, so `body.vscode-dark` selectors inside the xarray CSS are no longer at risk of being clobbered.

`test/suite/ui/webviewExport.test.ts` covers the pipeline (asset inlining, live-variable preservation, export-theme overrides, body retagging, CSS selector safety).

## The regex thing (and why a real parser would be sturdier)

The export still walks the captured markup with regular expressions instead of parsing HTML.

What that means in practice: we look for `<html …>`, peel the `style="…"` attribute off it, look for `<body …>`, rewrite its `class` / `data-vscode-theme-*` attributes, and swap the `<link href="…/styles.css">` / `<script src="…/webview-script.js">` tags for inline `<style>` / `<script>` blocks.

That is fine **as long as the document looks like the one this extension generates**. VS Code injects a predictable `<html style="--vscode-…">` and a predictable `<body class="vscode-dark" …>`. Our own assets have known filenames. The tests feed exactly that shape.

It is not a real HTML parser. Regex does not understand nested quotes, unexpected attribute order, or a `<body>` that is not a single open tag. A `$` in the CSS/JS file used to be dangerous too (JavaScript's `String.replace` treats `$&` as "the matched text"), which is why the inliner uses a function replacer rather than a string.

If we ever generate a "true" standalone export from scratch (the comment in the old `ThemeManager`), the cleaner approach is to do the rewrite in the webview with `DOMParser` / `cloneNode` and write attributes through the DOM. Until then, regex over a document we control is enough, and the tests pin the shapes we care about.

## Upgrading

No breaking changes and no settings migration. After updating to **0.12.1**:

1. Open a scientific data file.
2. Click **Export Webview Content** (🖼️) or use the command palette.
3. Open the saved `.html` in a browser.

The file should look like the live webview (dark/light colors, extension CSS, xarray repr). If `scientificDataViewer.webviewExportTheme` is set (for example `Solarized Light`), the exported file uses that palette instead of the live editor theme.

## Summary of changes

| Area      | Change                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| **Fixed** | Exported HTML inlines CSS/JS instead of leaving dead `vscode-resource` URLs            |
| **Fixed** | Captured `--vscode-*` variables are kept; `webviewExportTheme` merges on top of them   |
| **Fixed** | Theme kind class and `data-vscode-theme-*` rewritten on `<body>` only                  |
| **Tests** | `test/suite/ui/webviewExport.test.ts`                                                  |
| **Files** | `src/panel/HTMLGenerator.ts`, `src/panel/ThemeManager.ts`, `src/panel/UIController.ts` |
| **Docs**  | `docs/WEBVIEW_EXPORT_CONTENT.md`, `CHANGELOG.md`                                       |
