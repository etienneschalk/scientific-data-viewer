# Changelog

All notable changes to the Scientific Data Viewer VSCode extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Comprehensive Test Suite**: Complete unit test coverage for all core components
  - DataProcessor tests with mock Python environment and error handling scenarios
  - DataViewerPanel tests with webview panel management and data processing
  - Logger tests with output channel management and log level handling
  - PythonManager tests with extension API integration and environment detection
  - Integration tests for component interaction and concurrent operations
- **Test Infrastructure**: Robust testing framework with proper mocking and cleanup
- **Error Recovery Testing**: Tests for handling Python environment failures and recovery
- **Concurrent Operations Testing**: Validation of thread-safe operations and resource management

### Technical Improvements

- Enhanced test coverage for edge cases and error scenarios
- Improved test isolation and cleanup procedures
- Mock implementations for VSCode API dependencies
- Comprehensive error handling validation in test scenarios

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
