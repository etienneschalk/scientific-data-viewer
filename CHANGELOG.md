# Changelog

All notable changes to the Scientific Data Viewer VSCode extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Scientific Data Viewer extension
- Support for NetCDF (.nc, .netcdf) files
- Support for Zarr (.zarr) files  
- Support for HDF5 (.h5, .hdf5) files
- Interactive data exploration interface
- File structure browser with dimensions and variables
- Basic data visualization (line plots, heatmaps, histograms)
- Python environment integration and management
- Automatic Python package installation
- File tree integration with right-click context menu
- Command palette integration
- Real-time file watching and auto-refresh
- Configurable settings for Python path and behavior
- Comprehensive documentation and README

### Technical Details
- Built with TypeScript and VSCode Extension API
- Uses xarray for scientific data processing
- Integrates with existing Python environments
- Webview-based data visualization interface
- Support for large file handling with configurable limits

## [0.1.0] - 2024-01-XX

### Added
- Initial release
- Core functionality for viewing scientific data files
- Multi-format support (NetCDF, Zarr, HDF5)
- Python integration with automatic environment detection
- Interactive data exploration and visualization
- VSCode marketplace publishing capability

### Known Issues
- Large files (>100MB) may take time to load
- Some complex NetCDF files may not display all attributes correctly
- Plot generation may fail for very large datasets

### Future Enhancements
- Support for additional file formats (GRIB, TIFF, etc.)
- Enhanced visualization options (3D plots, animations)
- Data export functionality
- Performance improvements for large files
- Better error handling and user feedback
- Unit test coverage improvements
