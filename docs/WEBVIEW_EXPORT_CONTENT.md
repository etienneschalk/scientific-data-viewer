# 🖼️ Webview Export Content Functionality

## Presentation

I have successfully implemented the webview content export prototype as requested! This new feature captures exactly what the user sees in the webview, including any generated plots and current state.

### 🖼️ New Features Added

Webview Export Button (🖼️):

- Added to header controls next to the existing export button
- Captures the current rendered webview state
- Includes all plots, expanded sections, and user interactions

New Command:

- "Scientific Data Viewer: Export Webview Content"
- Available in Command Palette when data viewer is active
- Same functionality as the button

### 🎯 Benefits

- Exact Visual Capture: Preserves exactly what the user sees
- Plot Preservation: Includes all generated plots and visualizations
- State Preservation: Maintains expanded/collapsed sections
- Real-time Snapshot: Captures current webview state
- No Regeneration: No need to recreate content from data
- User Context: Preserves user's exploration state
- File Size: Can be large as everything is included (plots)

### 🚀 Usage

1. Open a scientific data file in the Scientific Data Viewer
2. Wait for data to load and optionally create some plots
3. Expand/collapse sections as desired
4. Click the webview export button (🖼️) OR use Command Palette → "Scientific Data Viewer: Export Webview Content"
5. Choose save location and filename
6. The exported file will contain exactly what you see in the webview

### 🔧 Technical Implementation

Content Capture Process:

1. Entrypoint
   - Option A: Extension sends captureContent message to webview
   - Option B: Users click on the webview export button
2. Webview captures document.documentElement.outerHTML
3. Webview sends captured content back to extension
4. Extension refines the HTML to ensure correct theme usage
5. Extension saves the content as HTML file

## 🌐 Degraded browser mode

### ✅ Implementation Summary

#### 1. **Conditional VSCode API Acquisition**

- Modified the VSCode API acquisition to be wrapped in a try-catch block
- Added proper detection for `acquireVsCodeApi` availability
- Gracefully falls back to degraded mode when VSCode API is not available

#### 2. **Enhanced WebviewMessageBus**

- Added `isDegradedMode` flag to track the current mode
- Modified `sendRequest` method to reject VSCode-specific requests in degraded mode
- Maintains all event listener functionality regardless of mode

#### 3. **Non-VSCode Event Listeners First**

- Reorganized initialization to set up browser-compatible features first
- Copy buttons, expand/collapse functionality work in both modes
- VSCode-specific message handlers only initialize when not in degraded mode

#### 4. **Visual Degraded Mode Indicator**

- Added a prominent "🌐 Browser Mode" indicator when in degraded mode
- Automatically hides VSCode-specific buttons (refresh, export, plot controls)
- Provides clear feedback to users about the current mode

#### 5. **Graceful Feature Degradation**

- All VSCode-dependent functions now check `messageBus.isDegradedMode`
- Functions like refresh, export, plotting, and command execution are disabled in degraded mode
- Browser-compatible features (copy, expand/collapse) continue to work

#### 6. **Compatibility Improvements**

- Removed optional chaining operators for better compatibility with older JavaScript environments
- Maintained full backward compatibility with VSCode extension usage

### 🧪 Testing Results

The implementation was thoroughly tested and confirmed to work correctly:

- **Degraded Mode**: Properly detects missing VSCode API and initializes browser-only features
- **VSCode Mode**: Maintains full functionality when VSCode API is available
- **Error Handling**: No more `acquireVsCodeApi is not defined` or `window.parent.__vscode_post_message__ is undefined` errors

### 🎯 Key Benefits

1. **No More Console Errors**: The webview now opens cleanly in browsers without JavaScript errors
2. **Preserved Functionality**: Copy buttons, expand/collapse all, and other browser-compatible features work perfectly
3. **Clear User Feedback**: Users can see they're in browser mode and understand which features are available
4. **Seamless Experience**: The transition between VSCode and browser environments is transparent
5. **Future-Proof**: The architecture supports easy addition of more browser-compatible features

The webview will now work perfectly when exported and opened in a web browser, providing a great user experience while clearly indicating the limitations of the browser environment.

## Webview Export Theme Configuration

The Scientific Data Viewer extension now supports customizing the color theme used when exporting webview content to HTML files.

### Configuration

The `webviewExportTheme` setting allows you to choose a specific theme for exported HTML files, independent of your current VS Code theme.

#### Setting Location

- **Setting Name**: `scientificDataViewer.webviewExportTheme`
- **Type**: String
- **Default**: `""` (empty - uses current VS Code theme)

#### Available Themes

Disclaimer: the proposed themes were generated and may not 100% accurately reflect the actual official themes.

- **Empty string** - Uses the current VS Code theme (default behavior)
- **Default Dark+** - VS Code's default dark theme
- **Default Light+** - VS Code's default light theme
- **Solarized Dark** - Solarized dark theme
- **Solarized Light** - Solarized light theme
- **High Contrast Dark** - High contrast dark theme for accessibility
- **High Contrast Light** - High contrast light theme for accessibility

### How to Configure

#### Via VS Code Settings UI

1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "webview export theme"
3. Select your preferred theme from the dropdown

#### Via settings.json

```json
{
  "scientificDataViewer.webviewExportTheme": "High Contrast Light"
}
```

### Usage

#### Webview Content Export

When you export webview content using the "Export Webview Content" command, the exported HTML file will use the configured theme.

### How It Works

The extension generates CSS variables that override the default VS Code theme variables in the exported HTML files. This ensures that:

1. **Live webview** - Always uses your current VS Code theme
2. **Exported files** - Use the theme specified in the configuration

### Theme Variables

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

### Examples

#### Export with Solarized Light Theme

```json
{
  "scientificDataViewer.webviewExportTheme": "Solarized Light"
}
```

#### Use Current VS Code Theme (Default)

```json
{
  "scientificDataViewer.webviewExportTheme": ""
}
```

### Notes

- This setting only affects exported HTML files, not the live webview display
- If an invalid theme name is provided, the extension falls back to "Default Dark+"
- The theme colors are predefined and may not exactly match all VS Code theme variations
- This feature is particularly useful for creating consistent documentation or reports with a specific color scheme
