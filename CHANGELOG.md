# Changelog

All notable changes to the Scientific Data Viewer VSCode extension will be documented in this file.

<!-- The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), -->

<!-- and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). -->

## [0.2.0] - 2025-09-14

### Added

- **Comprehensive Format Support**: Full support for all xarray-compatible scientific data formats
  - **GRIB/GRIB2**: Complete support with proper eccodes integration
  - **GeoTIFF**: Enhanced support with improved error handling
  - **JPEG2000**: Support for .jp2 and .jpeg2000 files
  - **Sentinel-1 SAFE**: Support for .safe files (UNTESTED)
  - **Enhanced Zarr**: Improved support for complex nested Zarr xarray-compatible datasets
  - **DataTree Support**: Better handling of hierarchical data structures
- **Comprehensive Test Suite**: Complete unit test coverage for all core components
  - DataProcessor tests with mock Python environment and error handling scenarios
  - DataViewerPanel tests with webview panel management and data processing
  - Logger tests with output channel management and log level handling
  - PythonManager tests with extension API integration and environment detection
  - Integration tests for component interaction and concurrent operations
- **Enhanced Sample Data Generator**: Comprehensive test data creation for all supported formats
  - GRIB file creation using eccodes
  - GeoTIFF generation with proper metadata
  - Multi-format sample data for testing
- **Open VSX Publishing Support**: Extension now available in Cursor, VSCodium, and other editors
  - New `openvsx-publish` npm script
  - Comprehensive publishing documentation
  - Cross-platform editor compatibility

### Enhanced

- **Logging System**: Complete overhaul with emoji-based visual indicators
  - Meaningful emojis for all log messages
  - Improved error tracking and debugging
  - Better initialization sequence logging
- **Error Handling**: Streamlined and more robust error management
  - Better dependency notification system
  - Improved Python environment error recovery
  - Enhanced user feedback for missing dependencies
- **WebView Rendering**: Simplified and more efficient data display
  - Better DataTree support for hierarchical data
  - Improved HTML generation for complex datasets
  - Always-visible Dimensions and Variables sections
- **Python Environment Management**: Reduced core dependencies
  - Removed numpy requirement from core package
  - Simplified dependency handling
  - Better Python path detection

### Technical Improvements

- **Code Refactoring**: Major API simplification and cleanup
  - Removed unused methods (getDataSlice, getVariableList, etc.)
  - Streamlined data processing pipeline
  - Better separation of concerns
- **Test Infrastructure**: Robust testing framework with proper mocking and cleanup
  - Enhanced test coverage for edge cases and error scenarios
  - Improved test isolation and cleanup procedures
  - Mock implementations for VSCode API dependencies
  - Comprehensive error handling validation in test scenarios
- **Documentation**: Enhanced RFC documentation and implementation tracking
  - RFC #001 marked as fully implemented
  - Comprehensive implementation summaries
  - Better status tracking for features

### Fixed

- **GRIB File Creation**: Resolved bugs in GRIB file generation
- **Dependency Handling**: Improved missing dependency notifications
- **Data Processing**: Removed duplicate getData calls
- **Test Suite**: Repaired and enhanced all test cases

## [0.1.0] - 2025-09-13

### Added

- **Custom Editors**: Direct file opening with dedicated NetCDF and HDF5 editors
- **Advanced Python Integration**: Automatic Python environment detection via Python extension API
- **Command Palette Integration**: Multiple commands for data viewer operations
- **Real-time Configuration**: Immediate application of setting changes without restart
- **Status Bar Integration**: Shows current Python interpreter status
- **Comprehensive Logging**: Detailed logging system for debugging and monitoring
- **Error Handling**: Robust error handling with user-friendly messages
- **Experimental Features**: Configurable experimental features with clear warnings
- **Multi-format Support**: Support for NetCDF (.nc, .netcdf), Zarr (.zarr), and HDF5 (.h5, .hdf5) files
- **Interactive Data Exploration**: Browse file structure, dimensions, variables, and attributes
- **Enhanced Variable Information**: View variable dimension names, data types, shapes, and memory usage
- **Data Visualization**: Create plots and visualizations directly in VSCode (experimental)
- **File Tree Integration**: Right-click on supported files in the explorer to open them
- **Human-readable File Sizes**: Display file and variable sizes in appropriate units (B, kB, MB, GB, TB)
- **Python Environment Management**: Automatic Python package installation and validation
- **Real-time File Watching**: Auto-refresh when files change
- **Comprehensive Documentation**: Complete documentation and testing setup

### Technical Details

- Built with TypeScript and VSCode Extension API
- Uses xarray for scientific data processing
- Integrates with VSCode Python extension for environment management
- Webview-based data visualization interface
- Support for large file handling with configurable limits
- Custom editor providers for direct file opening
- Real-time configuration management
- Comprehensive error handling and logging

### Configuration Options

- `scientificDataViewer.autoRefresh`: Automatically refresh data when files change
- `scientificDataViewer.maxFileSize`: Maximum file size (MB) to load automatically
- `scientificDataViewer.defaultView`: Default view mode
- `scientificDataViewer.allowMultipleTabsForSameFile`: Allow multiple tabs for same file **(Experimental)**
- `scientificDataViewer.plottingCapabilities`: Enable plotting capabilities **(Experimental)**

### Available Commands

- **Open Scientific Data Viewer**: Open a file in the data viewer
- **Refresh Python Environment**: Manually refresh the Python environment
- **Show Extension Logs**: View detailed extension logs
- **Show Settings**: Open Scientific Data Viewer settings

### Known Issues

- Large files (>500MB) may take time to load
- Some complex NetCDF files may not display all attributes correctly
- Plot generation may fail for very large datasets (experimental feature)
- Experimental features may cause unexpected behavior

### Future Enhancements

- Support for additional file formats (GRIB, TIFF, etc.)
- Enhanced visualization options (3D plots, animations)
- Data export functionality
- Performance improvements for large files
- Additional experimental features
- Unit test coverage improvements
