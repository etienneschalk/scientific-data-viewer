# Configuration Settings

The Scientific Data Viewer extension includes configuration options that control extension behavior. These settings allow users to enable or disable specific features, including experimental ones that might be unstable.

## Overview

Configuration settings are stored as individual properties in the VSCode extension configuration and can be modified through:

1. **VSCode Settings UI**: Go to Settings (Ctrl+,) and search for "Scientific Data Viewer" - each setting appears as a checkbox
2. **settings.json**: Edit your workspace or user settings directly
3. **Command Palette**: Use "Scientific Data Viewer: Show Feature Flags" to view current status

## Available Settings

### `allowMultipleTabsForSameFile` (Experimental)

**Type**: `boolean`  
**Default**: `false`  
**Experimental**: ⚠️ Yes

Controls whether the extension allows opening multiple tabs for the same file.

- **When `false` (default)**: The extension will focus on an existing tab if the file is already open, preventing duplicate tabs for the same file.
- **When `true`**: Each "Open in Data Viewer" action will create a new tab, even if the file is already open in another tab.

### `plottingCapabilities` (Experimental)

**Type**: `boolean`  
**Default**: `false`  
**Experimental**: ⚠️ Yes

Controls whether the extension shows plotting capabilities in the data viewer.

- **When `false` (default)**: Plotting features are hidden from the interface.
- **When `true`**: Shows the 'Create Plot' button and 'Visualization' pane in the data viewer.

#### Usage Examples

**Default behavior (single tab per file, no plotting):**
```json
{
  "scientificDataViewer.allowMultipleTabsForSameFile": false,
  "scientificDataViewer.plottingCapabilities": false
}
```

**Allow multiple tabs and enable plotting:**
```json
{
  "scientificDataViewer.allowMultipleTabsForSameFile": true,
  "scientificDataViewer.plottingCapabilities": true
}
```

#### ⚠️ Experimental Feature Warnings

These features are marked as experimental because:

**`allowMultipleTabsForSameFile`:**
- **Memory Usage**: Opening multiple tabs for the same file can increase memory consumption
- **Performance**: Multiple panels processing the same data simultaneously may impact performance
- **User Experience**: Having multiple tabs for the same file might be confusing
- **Resource Management**: The extension may not handle cleanup of multiple panels optimally

**`plottingCapabilities`:**
- **Performance**: Plot generation may be slow for large datasets
- **Memory Usage**: Plotting large datasets may consume significant memory
- **Stability**: Plot generation may fail for certain data types or sizes
- **Dependencies**: Requires matplotlib and additional Python packages

## Configuration

### Via VSCode Settings UI

1. Open VSCode Settings (Ctrl+, or Cmd+,)
2. Search for "Scientific Data Viewer"
3. Find the "Allow Multiple Tabs For Same File" setting
4. Toggle the checkbox
5. **Changes take effect immediately** - no restart required

### Via settings.json

Add the following to your `settings.json`:

```json
{
  "scientificDataViewer.allowMultipleTabsForSameFile": false
}
```

**Note**: Changes to `settings.json` are also applied immediately when the file is saved.

### Workspace vs User Settings

- **User Settings**: Apply to all workspaces
- **Workspace Settings**: Apply only to the current workspace (stored in `.vscode/settings.json`)

## Viewing Settings

### Command Palette

1. Open Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Type "Scientific Data Viewer: Show Feature Flags"
3. Press Enter to view a detailed report of all current settings

### Extension Logs

The extension will log warnings when experimental features are enabled and when configuration changes. Check the Output panel:

1. Go to View → Output
2. Select "Scientific Data Viewer" from the dropdown
3. Look for experimental feature warnings and configuration change notifications

### Runtime Notifications

When you change settings, the extension will:
- Show an immediate notification about the specific change (e.g., "Allow Multiple Tabs For Same File is now enabled")
- Show generic notifications for other configuration changes
- Log the specific change to the Output panel
- Apply the new behavior immediately

## Best Practices

### For Users

1. **Start with defaults**: Most users should stick with the default settings
2. **Enable experimental features carefully**: Only enable experimental features if you understand the risks
3. **Monitor performance**: Watch for performance issues when using experimental features
4. **Report issues**: If you encounter problems with experimental features, report them

### For Developers

1. **Use feature flags for new features**: Wrap new functionality in feature flags during development
2. **Mark experimental features**: Use the `experimental: true` flag for unstable features
3. **Provide clear documentation**: Document what each feature flag does and any risks
4. **Log warnings**: Log warnings when experimental features are enabled

## Troubleshooting

### Feature Flag Not Working

1. **Check configuration**: Ensure the feature flag is properly set in settings
2. **Restart VSCode**: Some configuration changes require a restart
3. **Check logs**: Look for errors in the extension logs
4. **Verify syntax**: Ensure JSON syntax is correct in settings.json

### Performance Issues

1. **Disable experimental features**: Turn off experimental features if experiencing issues
2. **Check memory usage**: Monitor VSCode's memory usage in Task Manager
3. **Close unused tabs**: Close data viewer tabs you're not using
4. **Report issues**: Report performance problems to the extension maintainers

## Future Feature Flags

The feature flag system is designed to be extensible. Future feature flags may include:

- `enableAdvancedVisualization`: Enable advanced plotting features
- `allowLargeFilePreview`: Allow preview of files larger than the size limit
- `enableDataExport`: Enable data export functionality
- `useExperimentalParsers`: Use experimental file format parsers

## Contributing

When adding new feature flags:

1. **Add to registry**: Update `FEATURE_FLAGS` in `featureFlagsManager.ts`
2. **Update configuration**: Add to `package.json` configuration schema
3. **Document**: Add documentation to this file
4. **Test**: Ensure the feature flag works correctly
5. **Mark experimental**: Use `experimental: true` for unstable features

## Support

If you have questions or issues with feature flags:

1. Check this documentation
2. Use the "Show Feature Flags" command to view current status
3. Check the extension logs for errors
4. Report issues on the extension's GitHub repository
