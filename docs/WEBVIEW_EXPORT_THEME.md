# Webview Export Theme Configuration

The Scientific Data Viewer extension now supports customizing the color theme used when exporting webview content to HTML files.

## Configuration

The `webviewExportTheme` setting allows you to choose a specific theme for exported HTML files, independent of your current VS Code theme.

### Setting Location

- **Setting Name**: `scientificDataViewer.webviewExportTheme`
- **Type**: String
- **Default**: `""` (empty - uses current VS Code theme)

### Available Themes

- **Empty string** - Uses the current VS Code theme (default behavior)
- **Default Dark+** - VS Code's default dark theme
- **Default Light+** - VS Code's default light theme
- **Monokai Dark** - Monokai color scheme
- **Solarized Dark** - Solarized dark theme
- **Solarized Light** - Solarized light theme
- **High Contrast Dark** - High contrast theme for accessibility

## How to Configure

### Via VS Code Settings UI

1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "webview export theme"
3. Select your preferred theme from the dropdown

### Via settings.json

```json
{
  "scientificDataViewer.webviewExportTheme": "Monokai"
}
```

## Usage

### HTML Report Export

When you export an HTML report using the "Export HTML Report" command, the exported file will use the configured theme.

### Webview Content Export

When you export webview content using the "Export Webview" command, the exported HTML file will use the configured theme.

## How It Works

The extension generates CSS variables that override the default VS Code theme variables in the exported HTML files. This ensures that:

1. **Live webview** - Always uses your current VS Code theme
2. **Exported files** - Use the theme specified in the configuration

## Theme Variables

The following CSS variables are overridden when a theme is selected:

- `--vscode-foreground`
- `--vscode-editor-background`
- `--vscode-editor-foreground`
- `--vscode-panel-background`
- `--vscode-panel-border`
- `--vscode-button-background`
- `--vscode-button-foreground`
- `--vscode-input-background`
- `--vscode-input-foreground`
- `--vscode-input-border`
- `--vscode-list-hoverBackground`
- `--vscode-list-activeSelectionBackground`
- `--vscode-list-activeSelectionForeground`
- `--vscode-list-inactiveSelectionBackground`
- `--vscode-list-inactiveSelectionForeground`
- `--vscode-errorForeground`
- `--vscode-descriptionForeground`
- `--vscode-textCodeBlock-background`
- `--vscode-textPreformat-foreground`

## Examples

### Export with Monokai Theme

```json
{
  "scientificDataViewer.webviewExportTheme": "Monokai"
}
```

### Export with Solarized Light Theme

```json
{
  "scientificDataViewer.webviewExportTheme": "Solarized Light"
}
```

### Use Current VS Code Theme (Default)

```json
{
  "scientificDataViewer.webviewExportTheme": ""
}
```

## Notes

- This setting only affects exported HTML files, not the live webview display
- If an invalid theme name is provided, the extension falls back to "Default Dark+"
- The theme colors are predefined and may not exactly match all VS Code theme variations
- This feature is particularly useful for creating consistent documentation or reports with a specific color scheme
