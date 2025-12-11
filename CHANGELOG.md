# Changelog

All notable changes to the Scientific Data Viewer VSCode extension will be documented in this file.

<!-- The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), -->

<!-- and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). -->

## [0.8.0] - UNRELEASED

### Fixed

- **Issue #99**: Fixed "Format: Unknown" always shown in the File Information section
  - **Root Cause**: The webview was looking for `data.format` which was never set by the Python backend; the format name is stored in `format_info.display_name`
  - **Solution**: Updated `renderFileInformation()` to use `format_info.display_name` as fallback when `format` is not set
  - **Files Modified**:
    - src/panel/webview/webview-script.js - Use format_info.display_name for format display

- **Issue #108**: Fixed attributes being truncated in text representations
  - **Root Cause**: xarray display options had `display_expand_attrs=False` and `display_expand_data=False` applied to text representations, causing attributes and data to show only counts (e.g., `Attributes: (3)`) instead of actual values
  - **Solution**: Updated `XR_TEXT_OPTIONS` to use `display_expand_attrs=True` and `display_expand_data=True` for text representations, ensuring full attribute and data display
  - **HTML Unaffected**: HTML representations retain collapsed attributes since users can interactively expand them
  - **Files Modified**:
    - python/get_data_info.py - Fixed xarray display options for text representations

- **Issue #97**: Fixed resource-intensive plotting processes that timeout but are not killed
  - **Problem**: When plotting large datasets, the request would timeout in the webview but the Python process continued running indefinitely, consuming system resources
  - **Solution**: Implemented two-layer timeout architecture with proper process termination
  - **Features Added**:
    - **Process Tracking**: PythonManager now tracks active processes with unique operation IDs
    - **Process Group Killing**: Uses `detached: true` and negative PID to kill entire process groups, ensuring both shell and Python child processes are terminated
    - **Client-side Timeout (15s)**: Webview timeout provides quick user feedback and sends abort request
    - **Server-side Timeout (20s)**: Safety net that kills processes even if the user closes the tab before client timeout fires
    - **Cancel All Button**: New button appears during Plot All operations, showing count of active operations
    - **Concurrency Limiting**: Plot All now processes max 5 plots simultaneously, leaving resources for cancel operations
    - **Cancellation Flag**: Queued plots are skipped when Cancel All is clicked
  - **Files Modified**:
    - src/python/PythonManager.ts - Process tracking, server-side timeout, abortProcess(), abortAllProcesses()
    - src/python/DataProcessor.ts - Added timeout parameter to createPlot()
    - src/panel/UIController.ts - Added abortPlot message handler
    - src/panel/webview/webview-script.js - Client-side timeout, Cancel All button, concurrency limiting
    - src/panel/HTMLGenerator.ts - Cancel All button HTML
    - src/panel/webview/styles.css - Cancel button styling
    - python/create_sample_data.py - Added large 4D NetCDF test file generator

## [0.7.0] - 2025-12-04

### Added

- **Timestamp Variable Selection and Time Range Filtering**: Comprehensive support for datetime variable selection and time-based filtering (Issue #106)
  - **Automatic Datetime Detection**: Multi-method detection including datetime64 dtype, CF-convention time coordinates, standard_name attributes, and common variable names
  - **Time Range Filtering**: Filter data by specifying start and end datetime values
  - **Monotonicity Handling**: Intelligently handles monotonic increasing, decreasing, and non-monotonic datetime sequences
  - **Cross-Group Support**: Works with datetime variables in different groups than the plotted variable
  - **Min/Max Pre-filling**: Automatically pre-fills time range inputs with min/max values from detected datetime variables
  - **Dual Input Methods**: Native HTML5 datetime-local picker and text input for pasting dates
  - **Bidirectional Binding**: Text and datetime-local inputs stay synchronized
  - **Smart Visibility**: Time controls automatically hide when no datetime variables are found
  - **Files Modified**:
    - python/get_data_info.py - Added datetime detection, monotonicity checking, and time filtering logic
    - src/types.ts - Updated DataInfoResult and CreatePlotRequest interfaces
    - src/python/DataProcessor.ts - Added datetime parameters to createPlot method
    - src/panel/UIController.ts - Added datetime parameter handling
    - src/panel/communication/MessageBus.ts - Updated createPlot signature
    - src/panel/HTMLGenerator.ts - Added time controls UI section
    - src/panel/webview/webview-script.js - Added time controls state management and event handlers
    - src/panel/webview/styles.css - Added time controls styling
    - python/create_sample_data.py - Added sample CDF file with unordered time variable
- **Comprehensive Test Suite**: 27 Python unit tests covering all 16 identified edge cases
  - python/test_datetime_edge_cases.py - Complete test coverage for datetime functionality
  - test/suite/datetimeEdgeCases.test.ts - TypeScript integration tests
  - setup.sh - Integrated Python datetime tests into setup process

### Enhanced

- **Plot Titles**: Conditional suptitle includes start/end time information only when datetime filtering is actually used
- **X-Axis Display**: Full date and time information displayed on x-axis instead of just hours
- **Error Handling**: Comprehensive error handling for all edge cases (invalid datetimes, missing variables, shape mismatches, etc.)
- **Variable Name Handling**: Correctly handles variable names containing dots (e.g., "temperature.hourly")

### Fixed

- **Issue #106**: Implemented timestamp variable selection and time range filtering
- **Timezone Issues**: Fixed timezone conversion problems in datetime input handling
- **Variable Name Parsing**: Fixed issue with variable names containing dots being truncated (changed from `.stem` to `.name`)
- **Cross-Group Variables**: Fixed handling of datetime variables from different groups
- **Monotonicity**: Fixed filtering for monotonic decreasing and non-monotonic datetime sequences
- **Python 3.8 Compatibility**: Changed `str | None` to `Optional[str]` for Python 3.8 support

### Technical Improvements

- **Monotonicity Detection**: Uses pandas Index methods (`is_monotonic_increasing`, `is_monotonic_decreasing`) for efficient checking
- **Filtering Strategy**:
  - Monotonic increasing: Uses `xarray.sel()` with slice notation
  - Monotonic decreasing: Automatically swaps start/end times
  - Non-monotonic: Falls back to boolean indexing
- **Timezone Preservation**: All datetime conversions preserve local time without unexpected timezone shifts
- **Comprehensive Edge Case Handling**: 16 edge cases identified and handled robustly

## [0.6.0] - 2025-12-02

### Added

- **NASA CDF Format Support**: Full support for NASA's Common Data Format (.cdf files)
  - **cdflib Integration**: Uses `cdflib` library for reading and writing CDF files
  - **Format Distinction**: Clear separation between CDF (NASA) and NetCDF formats in all documentation and error messages
  - **Dedicated Engine**: Added `cdflib` as a dedicated engine for `.cdf` file extension
  - **Special Handling**: CDF files are processed using `cdflib.xarray.cdf_to_xarray()` for seamless xarray integration
  - **Sample Data Generation**: Updated sample data creation to use `cdflib` for authentic CDF files
  - **Troubleshooting Support**: Added CDF-specific installation instructions in error messages
  - **Files Modified**:
    - python/get_data_info.py - Added cdflib engine and special handling for CDF files
    - python/create_sample_data.py - Updated to generate CDF files using cdflib
    - src/panel/webview/webview-script.js - Added cdflib installation option in troubleshooting section
    - README.md - Updated format table to distinguish CDF from NetCDF
    - docs/RELEASE_NOTES_0.6.0.md - Comprehensive documentation of CDF support
- **Pre-commit Configuration**: Comprehensive code quality and formatting automation
- **GitHub Actions Workflow**: Streamlined CI/CD pipeline with `pr-validation.yml`
  - **Comprehensive Validation**: Single workflow covering all quality checks
  - **Node.js 22 Support**: Updated to current LTS version
  - **Python 3.13 Support**: Latest Python version for testing
  - **Virtual Display Testing**: Xvfb integration for headless testing
  - **Security Auditing**: npm audit integration for dependency security
  - **Concurrency Control**: Prevents multiple runs of same PR validation
- **TypeScript Configuration**: Enhanced build configuration
  - **Pre-commit TypeScript Config**: Separate `tsconfig.pre-commit.json` for faster type checking
  - **Improved Formatting**: Better code organization and formatting standards

### Enhanced

- **Format Support**: Added NASA CDF format to supported formats list
- **Error Handling**: Improved error messages and troubleshooting guidance for CDF files
- **Documentation**: Updated all documentation to clearly distinguish CDF from NetCDF
- **Developer Experience**: Streamlined development workflow with automated quality checks
- **Code Quality**: Consistent formatting and linting across TypeScript and Python codebases
- **CI/CD Pipeline**: Faster, more reliable continuous integration with comprehensive validation
- **Security**: Automated secret detection and dependency security auditing

### Fixed

- **Issue #104**: Fixed support for CDF files
- **Format Confusion**: Resolved confusion between CDF and NetCDF formats in documentation and error messages

### Technical Improvements

- **ESLint Migration**: Migrated from `.eslintrc.json` to `.eslintrc.js` for better configuration flexibility
- **Pre-commit Hooks**: Comprehensive pre-commit configuration with 10+ quality checks
- **Workflow Optimization**: Single workflow replacing multiple separate CI jobs
- **Type Safety**: Enhanced TypeScript configuration with separate pre-commit type checking
- **Engine Architecture**: Enhanced engine selection logic to support format-specific engines (cdflib for CDF)

## [0.5.0] - 2025-01-08

### Added

- **Export Webview Content**: Complete data viewer content export as self-contained HTML reports
  - **Export Button**: Added export button (🖼️) to header controls in data viewer panel
  - **Command Palette Integration**: "Scientific Data Viewer: Export Webview Content" command
  - **Self-contained Reports**: Generated HTML includes embedded CSS and JavaScript for standalone viewing: "Browser Mode". Copy, Expand All and Collapse All buttons works in this mode.
  - **Complete Data Export**: Includes all visualizations, data tables, metadata, and technical information
  - **Professional Layout**: Clean, professional report layout with copy buttons for easy data extraction
  - **File Management**: Proper file naming with timestamps and save dialog with options to open or reveal files
  - **Use Cases**: Share data analysis results, create documentation, archive sessions, generate reports
  - **Files Modified**:
    - src/common/config.ts - Added CMD_EXPORT_WEBVIEW constant
    - package.json - Added command definition and menu integration
    - src/panel/HTMLGenerator.ts - Added webview export button (🖼️)
    - src/panel/UIController.ts - Added webview export functionality and content capture
    - src/DataViewerPanel.ts - Added exportWebview() method
    - src/extension.ts - Added command handler
    - src/panel/webview/webview-script.js - Added content capture functionality
- **Dev Mode Toggle Command**: Quick access to enable/disable dev mode without navigating settings
  - **Command Palette Integration**: "Scientific Data Viewer: Toggle Dev Mode" command
  - **Global Setting Update**: Updates user's global dev mode setting
  - **User Feedback**: Clear messages about dev mode state changes
  - **Developer Experience**: Significantly improves workflow when switching between development and usage
  - **Files Modified**:
    - src/common/config.ts - Added updateDevMode function and CMD_TOGGLE_DEV_MODE constant
    - package.json - Added command definition and menu integration
    - src/extension.ts - Added command handler with proper error handling
- **Package Availability Detection**: New Python script for efficient package checking
  - **Dedicated Script**: `python/check_package_availability.py` for checking multiple packages at once
  - **JSON Output**: Returns structured availability data for better integration
  - **Performance**: Optimized package detection with single Python process execution (instead of calling N times a script for N dependencies)
  - **Error Handling**: Robust error handling for package availability checks
- **GeoTIFF Band-to-Variables Conversion**: Improved multi-band GeoTIFF file handling
  - **Configuration Option**: `scientificDataViewer.convertBandsToVariables` boolean setting (enabled by default)
  - **Better Readability**: Converts 3D DataArrays with band dimension to separate 2D variables
  - **Improved Plotting**: Each band treated as individual variable with appropriate color scales
  - **Supported Formats**: Works with .tif, .tiff, and .geotiff files
  - **Clean Implementation**: Uses rioxarray's built-in [`band_as_variable`](https://corteva.github.io/rioxarray/html/rioxarray.html#rioxarray.open_rasterio) parameter
  - **User-Friendly**: Simple on/off configuration for all GeoTIFF formats
  - **Backward Compatible**: Existing functionality preserved when disabled
  - **Files Modified**:
    - package.json - Added configuration option
    - src/common/config.ts - Added getter function
    - src/python/DataProcessor.ts - Updated to pass configuration
    - src/panel/UIController.ts - Added configuration logic
    - python/get_data_info.py - Implemented band conversion
    - python/create_sample_data.py - Added test data creation

### Enhanced

- **User Experience**: Improved data sharing and documentation capabilities
- **Professional Workflow**: Better integration with research and documentation workflows
- **Package Management**: Improved package detection and installation workflow
  - **Fine-grained Control**: Differentiate between core packages (xarray) and optional packages (matplotlib)
  - **Better Error Messages**: More specific error messages for missing packages
  - **Help Buttons**: Added install buttons for missing packages directly in error messages
  - **More Command Quoting**: Improved command quoting for better avoidance of space-related issues when calling commands in package installation

### Technical Improvements

- **Code Organization**: Added export functionality to UIController with comprehensive HTML generation
- **Error Handling**: Robust error handling for export operations with user-friendly feedback
- **Testing**: Added test coverage for export functionality
- **Python Script Optimization**: Enhanced Python script structure and error handling
  - **Structured Responses**: Better structured response format for plot creation and data info
  - **Error Wrapping**: Improved error message wrapping and handling
  - **Type Safety**: Enhanced type definitions for better TypeScript integration
  - **Test Updates**: Updated test mocks to match new response structures

### Removed

- **Configuration Settings**:
  - `scientificDataViewer.currentlyInUseInterpreter`: Currently active Python interpreter path (read-only, updated automatically)
    - Reason: It was not actually used, nor necessary, as python interpreter resolution is performed live.
- **Sentinel-1 SAFE Support**: Removed untested Sentinel-1 SAFE (.safe) format support
  - **Reason**: Was never tested and implementing it would be a nice-to-have for later
  - **Cleanup**: Removed related dependencies and sample data generation
  - **Documentation**: Updated RFCs to reflect removal

## [0.4.0] - 2025-10-06

### Added

- **Extension Virtual Environment**: Semi-standalone virtual environment stored in VSCode extension storage
  - **uv Required**: Only works if `uv` is installed on the system
  - **Python 3.13**: Uses uv to install and use Python 3.13 for latest features and performance
  - **Isolated Storage**: Stored in VSCode's extension storage space
  - **Fallback Support**: Falls back to Python extension behavior if uv is not available
  - **Management Commands**: Create, manage, update, and delete extension environment
  - **Status Display**: Shows extension environment status and creation tool in status bar
- **Virtual Environment Management Command**:
  - `Manage Extension Virtual Environment`: Create, update, delete extension environment
- **Configuration Settings**:
  - `scientificDataViewer.overridePythonInterpreter`: Override Python interpreter path (takes precedence over all other options)
  - `scientificDataViewer.python.useExtensionOwnEnvironment`: Activate the use extension's own virtual environment with `uv`
  - `scientificDataViewer.currentlyInUseInterpreter`: Currently active Python interpreter path (read-only, updated automatically)
- **Split View**:
  - Works for files opened via the file explorer, because the webviewPanel is reused (`ScientificDataEditorProvider`)
  - Does not work with files/dirs opened via command nor context menu, because the webviewPanel is created from scratch

### Enhanced

- **Enhanced Status Bar**: Shows virtual environment type and interpreter information

### Removed

- Plotting Capabilities extension feature flag (always on)

### Technical Improvements

- Refactor zones of the code.

### Known Bugs

- Data Structure TreeView is not shown for manually created Webviews in Cursor. See when clause of `scientificDataViewer.outline`.
  - When VSCode doc: https://code.visualstudio.com/api/references/when-clause-contexts
  - Related: https://forum.cursor.com/t/webview-panels-and-commands-not-supported-in-cursor-breaks-extensions/115748

### Fixed

## [0.3.0] - 2025-10-03

### Added

- **Enhanced Data Structure Navigation**: Improved outline view functionality
  - Attributes display for coordinates and variables in outline
  - Granular highlighting for individual attributes with precise navigation
- **Comprehensive DataTree Support**: Full support for hierarchical data structures with group-specific sections
  - Group-specific coordinates, variables, and attributes display
  - Flattened dimensions support for nested datatree groups
  - Enhanced plotting capabilities for nested variables
  - Backward compatibility with regular datasets
- **Advanced Plotting System**: Per-variable plotting capabilities
  - Individual plot controls for each variable
  - Multiple simultaneous plots support
  - Per-variable plot actions (Reset, Save, Save As, Open)
  - Global plot operations (Plot All, Reset All Plots, Save All Plots)
  - Enhanced plot management with VSCode notifications
- **Export and Visualization Features**: Complete visualization export capabilities
  - Save plot functionality with file dialog integration
  - "Save Plot As" with smart filename generation
  - Open plot in new tab with external app fallback
  - PNG export support with configurable resolution
  - VSCode-native file operations and notifications
- **Stress Testing Support**: Comprehensive testing infrastructure for large datasets
  - Test data generator for 100+ variables and attributes
  - Enhanced text representation with size limits
- **Modular Architecture**: Complete UI architecture overhaul
  - Split monolithic DataViewerPanel into focused generator classes
  - HTMLGenerator, CSSGenerator, and JavaScriptGenerator modules
  - Centralized state management with Redux-like pattern
  - Type-safe communication system with MessageBus
  - Component-based UI system with lifecycle management
  - Error boundary system for robust error handling
  - Note: The codebase can still be improved, and the need for an UI framework emerges.

### Enhanced

- **User Interface Improvements**: Better visual feedback and navigation
  - Simplified highlighting with improved visual layout
  - Better icon positioning and spacing in outline view
  - Enhanced scroll functionality with sticky header offset
  - Tree view navigation
- **User Experience**: Improved interface and workflow
  - Per-variable plot controls with intuitive positioning
  - Responsive design (for window resize)
  - Event delegation for efficient dynamic content handling
  - Non-blocking notifications and better error feedback (eg for installing packages)
- **Performance**: Performance improvements
  - Parallelized plot generation with progress tracking
  - Efficient event handling for multiple plot instances
  - Optimized text representation for large datasets
- **Code Quality**: Major architectural improvements
  - 72% reduction in main panel code (1,500+ to ~420 lines)
  - Separation of concerns between UI and business logic
  - Type-safe message system with timeout handling
  - Comprehensive error recovery mechanisms
- **DataTree Integration**: Enhanced hierarchical data support
  - Group-specific sections for coordinates, variables, and attributes
  - Flattened dimensions display for nested structures
  - Enhanced plotting with full variable paths (group/variable)

### Technical Improvements

- **Code Quality**: Enhanced implementation details
  - Simplified Data Structure view for xarray HTML and Text representations
  - Enhanced HeaderExtractor with attributes display for coordinates and variables
  - Improved plotting strategy and 2D classic plotting support
- **Architecture Refactoring**: Complete modularization of UI components
  - HTMLGenerator: Centralized HTML generation utilities
  - CSSGenerator: Modular CSS organization and styling
  - JavaScriptGenerator: Client-side code generation
  - UIController: Separated UI logic from business logic
  - MessageBus: Type-safe communication system
- **State Management**: Centralized, immutable state updates
  - Redux-like pattern for state management
  - Type-safe request/response pattern
  - Component-specific and global error recovery
  - Validation and error handling throughout
  - Note: The current state management system is not used fully.
  - Note: Plot generation is independent of current state management.
- **Error Handling**: Robust error management system
  - Error boundary system for component isolation
  - Per-variable error messages and recovery
  - VSCode integration for user notifications
  - Graceful fallback mechanisms
- **Testing Infrastructure**: Enhanced stress testing capabilities
  - Sample data generator for 100+ variables
  - Performance testing with large datasets
  - Text representation optimization
  - Memory usage monitoring

### Fixed

- **Data Structure Tree View**: Resolved loading issues
  - Fixed data structure tree view not loading for right-click opened files
  - Fixed tree view scrolling for attributes with details elements
  - Fixed treeview navigation with proper IDs for TXT and HTML group representations
  - Improved timing issues in DataViewerPanel constructor
- **Plot Controls**: Resolved issues with grayed-out plot buttons
- **Layout Issues**: Fixed broken variable display structure
- **Event Handling**: Corrected event listener setup for dynamic content
- **Alert Usage**: Replaced all alert() calls with VSCode notifications
- **UI Elements**: Hidden useless divs and removed unnecessary code
- **Display Issues**: Various display fixes for better visual presentation

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
