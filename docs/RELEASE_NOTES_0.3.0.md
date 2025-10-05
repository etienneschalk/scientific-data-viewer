# Scientific Data Viewer v0.3.0 Release Notes

## 🎉 Major Release: Enhanced Data Exploration & Visualization

Version 0.3.0 represents a significant milestone in the Scientific Data Viewer extension, featuring an architectural overhaul, plotting capabilities, and comprehensive DataTree support. This release transforms the extension from a basic data viewer into a more powerful scientific metadata exploration platform.

## ✨ What's New

### 🎨 Advanced Plotting System

-   **Per-Variable Plotting**: Each variable now has its own individual plot controls
-   **Multiple Simultaneous Plots**: Create and manage multiple plots at once
-   **Smart Plot Actions**: Reset, Save, Save As, and Open functionality for each plot
-   **Global Operations**: Plot All, Reset All Plots, and Save All Plots commands
-   **Export Capabilities**: Save plots as PNG
-   **VSCode Integration**: Native file dialogs and notifications for seamless workflow

### 🌳 Better DataTree Support

-   **Hierarchical Data Structures**: Full support for complex nested data organizations
-   **Group-Specific Sections**: Dedicated views for coordinates, variables, and attributes within each group
-   **Enhanced Navigation**: Click-to-navigate outline view with granular highlighting
-   **Flattened Dimensions**: Support for nested datatree groups with dimension flattening
-   **Backward Compatibility**: Seamless support for both regular datasets and DataTree structures

### 🏗️ Modular Architecture Overhaul

-   **Component-Based Design**: Better separation of UI and business logic
-   **72% Code Reduction**: Main panel code reduced from 1,500+ to ~420 lines
-   **Type-Safe Communication**: New MessageBus system for reliable component interaction
-   **Error Boundaries**: Robust error handling with component isolation
-   **State Management**: Redux-like pattern for predictable state updates (underused at the moment)

### 🎯 Enhanced User Experience

-   **Improved Navigation**: Better outline view with attributes display and precise highlighting
-   **Responsive Design**: Better handling of window resizing and dynamic content
-   **Parallelized Plot Generation**: Parallelized plot generation with progress tracking (experimental and not-optimized!)
-   **Developer Tools**: Built-in developer tools for debugging and development mode
-   **Testing Annoying Datasets**: Comprehensive testing for large datasets (many variables and attributes with long names)

## 🔧 Technical Improvements

### Code Quality

-   **Modular Architecture**: Split monolithic components into focused modules
    -   `HTMLGenerator`: Centralized HTML generation
    -   `CSSGenerator`: Modular styling system
    -   `JavaScriptGenerator`: Client-side code generation
    -   `UIController`: Separated UI logic
    -   `MessageBus`: Type-safe communication

### Error Handling

-   **Graceful Degradation**: Better error recovery and user feedback
-   **VSCode Integration**: Native notifications
-   **Component Isolation**: Error boundaries prevent cascading failures
-   **User-Friendly Messages**: Clear, actionable error descriptions

## 🐛 Bug Fixes

-   **Tree View Issues**: Fixed data structure tree view loading problems
-   **Plot Controls**: Resolved grayed-out plot button issues
-   **Layout Problems**: Fixed broken variable display structures
-   **Event Handling**: Corrected dynamic content event listener setup
-   **Memory Leaks**: Fixed memory leak in DataViewerPanel tracking
-   **File Handling**: Improved support for files with spaces in names

## 📊 Supported Formats

The extension continues to support all major scientific data formats:

-   **NetCDF**: .nc, .netcdf, .nc4, .cdf
-   **Zarr**: .zarr
-   **HDF5**: .h5, .hdf5
-   **GRIB/GRIB2**: .grib, .grib2, .grb
-   **GeoTIFF**: .tif, .tiff, .geotiff
-   **JPEG-2000**: .jp2, .jpeg2000

## 🚀 Getting Started

1. **Install the Extension**: Available on [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=eschalk0.scientific-data-viewer) and [Open VSX](https://open-vsx.org/extension/eschalk0/scientific-data-viewer)

2. **Open a Data File**: Right-click on any supported file in the Explorer and select "Open in Data Viewer"

3. **Explore Your Data**: Use the outline view to navigate through your data structure

4. **Create Visualizations**: Click the plot buttons next to variables to create visualizations

5. **Export Your Work**: Save plots as PNG files or open them in external applications

## ⚙️ Configuration

New configuration options in v0.3.0:

-   `scientificDataViewer.general.devMode`: Enable development mode with automatic logging and developer tools
-   `scientificDataViewer.matplotlibStyle`: Customize matplotlib plot styles (auto-detects VSCode theme by default to set a dark or light background in plots)

## 🔮 What's Next

This release establishes a solid foundation for future enhancements. The modular architecture makes it easier to add new features, and the comprehensive DataTree support opens up possibilities for even more complex data structures.

## 📈 Statistics

-   **83 files changed** with **15,919 additions** and **3,203 deletions**
-   **72% reduction** in main panel code complexity
-   **100+ new test cases** for better coverage
-   **Architectural overhaul** with modern patterns

## 🙏 Acknowledgments

Thank you to all users who provided feedback and contributed to this release. Your input has been invaluable in shaping the direction of the Scientific Data Viewer extension.

---

**Download now**: [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=eschalk0.scientific-data-viewer) | [Open VSX](https://open-vsx.org/extension/eschalk0/scientific-data-viewer)

**Documentation**: [GitHub Repository](https://github.com/etienneschalk/scientific-data-viewer)

**Report Issues**: [GitHub Issues](https://github.com/etienneschalk/scientific-data-viewer/issues)
