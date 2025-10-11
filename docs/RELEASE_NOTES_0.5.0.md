# Scientific Data Viewer v0.5.0 Release Notes

## 🎉 Major Release: Enhanced Export, Healthcheck System & GeoTIFF Improvements

Version 0.5.0 introduces significant enhancements to the Scientific Data Viewer extension, focusing on improved data sharing capabilities, comprehensive health monitoring, and better GeoTIFF file handling. This release transforms the extension into a more professional tool for scientific data analysis and documentation.

## ✨ What's New

### 📊 Webview Export System

- **Complete HTML Export**: Export entire data viewer content as self-contained HTML reports
- **Export Button Integration**: Added export button (🖼️) to header controls for easy access
- **Command Palette Support**: "Scientific Data Viewer: Export Webview Content" command
- **Self-contained Reports**: Generated HTML includes embedded CSS and JavaScript for standalone viewing
- **Professional Layout**: Clean, professional report layout with copy buttons for easy data extraction
- **File Management**: Proper file naming with timestamps and save dialog with options to open or reveal files
- **Browser Compatibility**: Degraded mode support for better browser compatibility
- **Theme Support**: Configurable export themes, or use current theme if not configured

### 🔍 Comprehensive Healthcheck System

- **System Diagnostics**: Complete health monitoring for Python environment, packages, and extension status
- **Command Integration**: "Scientific Data Viewer: Run Healthcheck" command for on-demand diagnostics
- **Detailed Reporting**: Comprehensive status reports covering:
  - Python interpreter detection and validation
  - Package availability and version checking
  - Extension configuration validation
- **Troubleshooting Support**: Built-in troubleshooting recommendations and solutions
- **Performance Monitoring**: System resource usage and performance metrics
- **Status Bar Integration**: Click on the extension's Status Bar Item to open the Healthcheck report

### 🗺️ Enhanced GeoTIFF Support

- **Band-to-Variables Conversion**: Multi-band GeoTIFF files automatically convert bands to separate variables
- **Configuration Option**: `scientificDataViewer.convertBandsToVariables` setting (enabled by default)
- **Improved Plotting**: Each band treated as individual variable with appropriate color scales
- **Better Readability**: Converts 3D DataArrays with band dimension to separate 2D variables
- **Clean Implementation**: Uses rioxarray's built-in `band_as_variable` parameter
- **User-Friendly**: Simple on/off configuration for all GeoTIFF formats (.tif, .tiff, .geotiff)

### ⚡ Developer Experience Improvements

- **Dev Mode Toggle**: Quick access to enable/disable dev mode without navigating settings
- **Command Integration**: "Scientific Data Viewer: Toggle Dev Mode" command
- **Global Setting Update**: Updates user's global dev mode setting with clear feedback
- **Improved Workflow**: Significantly improves development workflow when switching between modes

### 🔧 Enhanced Package Management

- **Optimized Package Detection**: New dedicated Python script for efficient package checking
- **Performance Improvements**: Single Python process execution instead of multiple calls
- **Fine-grained Control**: Differentiate between core packages (xarray) and optional packages (matplotlib)
- **Better Error Messages**: More specific error messages for missing packages with install buttons
- **JSON Output**: Structured availability data for better integration

## 🎯 User Experience Enhancements

### 📈 Improved Data Sharing

- **Professional Reports**: Generate comprehensive data analysis reports for sharing
- **Documentation Support**: Create documentation for datasets and analysis results
- **Archive Capabilities**: Save data viewer sessions for future reference
- **Presentation Ready**: Reports suitable for presentations and publications

### 🎨 UI/UX Improvements

- **Smart Plot Controls**: Intelligent hiding of plot controls in degraded mode
- **Plot Container Preservation**: Maintains plot containers even in degraded mode
- **Better Visual Hierarchy**: Improved UI consistency and visual organization
- **Enhanced Error Handling**: More user-friendly error messages and recovery options

### 🚀 Performance Optimizations

- **Package Detection**: Optimized package availability checking with dedicated Python script
- **Error Message Wrapping**: Improved error message handling and display
- **Command Quoting**: Enhanced command quoting for better space-related issue avoidance

## 🔧 Technical Improvements

### 🏗️ Architecture Enhancements

- **Code Organization**: Added export functionality to UIController with comprehensive HTML generation
- **Theme Management**: Moved theme adaptation to dedicated ThemeManager for better organization
- **Panel Management**: Consolidated panel management into single map for better efficiency
- **Message Bus Integration**: Proper webview content capture with message bus system

### 🐍 Python Integration Improvements

- **Structured Responses**: Better structured response format for plot creation and data info
- **Error Wrapping**: Improved error message wrapping and handling in Python scripts
- **Type Safety**: Enhanced type definitions for better TypeScript integration
- **Test Coverage**: Updated test mocks to match new response structures

### 🧪 Testing and Quality

- **Test Updates**: Comprehensive test coverage for new export functionality
- **Mock Improvements**: Updated test mocks to match new response structures
- **Error Scenarios**: Better handling of edge cases and error conditions
- **Code Quality**: Enhanced error handling and recovery mechanisms

## 🐛 Bug Fixes

- **Plot Container Issues**: Fixed plot container preservation in degraded mode
- **Error Message Handling**: Improved error message wrapping and display
- **Command Quoting**: Fixed space-related issues in command execution
- **Package Detection**: Resolved issues with package availability checking
- **UI Consistency**: Fixed various UI consistency issues and visual bugs

## 🗑️ Removed Features

### Configuration Cleanup

- **`scientificDataViewer.currentlyInUseInterpreter`**: Removed unused read-only setting
  - Reason: Not actually used as Python interpreter resolution is performed live

### Format Support Cleanup

- **Sentinel-1 SAFE Support**: Removed untested Sentinel-1 SAFE (.safe) format support
  - Reason: Was never tested and implementing it would be a nice-to-have for later
  - Cleanup: Removed related dependencies and sample data generation
  - Documentation: Updated RFCs to reflect removal

## ⚙️ New Settings

### Export Configuration

- **`scientificDataViewer.webviewExportTheme`**
  - Type: `string`
  - Default: `""` (uses current VS Code theme)
  - Description: Theme to use when exporting webview content
  - Options: Default Dark+, Default Light+, Solarized Dark, Solarized Light, High Contrast Dark, High Contrast Light

### GeoTIFF Configuration

- **`scientificDataViewer.convertBandsToVariables`**
  - Type: `boolean`
  - Default: `true`
  - Description: Convert bands of GeoTIFF rasters to variables for better readability
  - Supported formats: .tif, .tiff, .geotiff

## 🎮 New Commands

| Command                                          | Description                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `Scientific Data Viewer: Export Webview Content` | Export the active Scientific Data Viewer as a self-contained HTML report |
| `Scientific Data Viewer: Toggle Dev Mode`        | Quickly enable/disable dev mode without navigating settings              |
| `Scientific Data Viewer: Run Healthcheck`        | Run comprehensive system diagnostics and health checks                   |

## 📊 Statistics

- **24 issues closed** in the v0.5.0 milestone
- **8 major pull requests** merged
- **50+ commits** since v0.4.0
- **New Components**: Export system, healthcheck system, enhanced GeoTIFF support
- **Code Quality**: Improved error handling, better architecture, enhanced testing

## 🔮 What's Next

This release establishes a solid foundation for future enhancements:

- **Enhanced Export Options**: More export formats and customization options
- **Advanced Health Monitoring**: Real-time monitoring and alerting capabilities
- **Improved GeoTIFF Support**: Additional raster format enhancements
- **Better Integration**: Enhanced VSCode and Cursor compatibility
- **Performance Improvements**: Further optimization for large datasets

## ⚠️ Known Issues

- **Data Structure TreeView**: Not shown for manually created Webviews in Cursor (occurs sometimes)
- **Environment Switching**: Some edge cases may require manual refresh (Ctrl+Shift+P -> SDV: Refresh) so that the status bar reflects the correct state, eg when deleting manually a virtual environment

## 🔄 Breaking Changes

- **Configuration Settings**: Removed `scientificDataViewer.currentlyInUseInterpreter` setting
- **Format Support**: Removed Sentinel-1 SAFE (.safe) format support
- **API Changes**: Some internal API changes for better error handling and type safety

## 📈 Impact

This release significantly improves the extension's capabilities:

- **Professional Workflow**: Better integration with research and documentation workflows
- **Enhanced Reliability**: Comprehensive health monitoring and better error handling
- **Improved GeoTIFF Support**: Better handling of multi-band raster data
- **Better Developer Experience**: Improved development workflow and debugging capabilities
- **Enhanced Data Sharing**: Professional report generation for collaboration and documentation

## 🙏 Acknowledgments

Thank you to all users who provided feedback and contributed to this release.

---

**Download now**: [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=eschalk0.scientific-data-viewer) | [Open VSX](https://open-vsx.org/extension/eschalk0/scientific-data-viewer)

**Documentation**: [GitHub Repository](https://github.com/etienneschalk/scientific-data-viewer)

**Report Issues**: [GitHub Issues](https://github.com/etienneschalk/scientific-data-viewer/issues)
