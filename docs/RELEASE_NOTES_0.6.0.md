# Scientific Data Viewer v0.6.0 Release Notes

## 🎉 New Format Support: NASA CDF Files

Version 0.6.0 adds support for NASA's Common Data Format (CDF) files, addressing a long-standing request from the scientific community. This release distinguishes CDF files from NetCDF files and provides proper support for files created with `cdflib` versions 3.3.1 and 3.9.0.

## ✨ What's New

### 📊 NASA CDF Format Support

- **Native CDF Support**: Full support for NASA's Common Data Format (.cdf files)
- **cdflib Integration**: Uses `cdflib` library for reading and writing CDF files
- **Format Distinction**: Clear separation between CDF (NASA) and NetCDF formats
- **Sample Data Generation**: Updated sample data creation to use `cdflib` for authentic CDF files
- **Error Handling**: Improved error messages and troubleshooting guidance for CDF files

### 🔧 Technical Improvements

- **Dedicated Engine**: Added `cdflib` as a dedicated engine for `.cdf` file extension
- **Special Handling**: CDF files are processed using `cdflib.xarray.cdf_to_xarray()` for seamless xarray integration
- **Backward Compatibility**: NetCDF files continue to work as before with existing engines
- **Documentation Updates**: Updated all documentation to clearly distinguish CDF from NetCDF

## 📊 Supported Formats

The extension now supports the following scientific data formats:

- **NetCDF**: .nc, .netcdf, .nc4
- **CDF (NASA)**: .cdf ⭐ **NEW**
- **Zarr**: .zarr
- **HDF5**: .h5, .hdf5
- **GRIB/GRIB2**: .grib, .grib2, .grb
- **GeoTIFF**: .tif, .tiff, .geotiff
- **JPEG-2000**: .jp2, .jpeg2000

## 🚀 Getting Started with CDF Files

### Installation

To use CDF files, you'll need to install the `cdflib` package:

```bash
pip install cdflib
```

The extension will automatically detect if `cdflib` is installed and use it for `.cdf` files.

### Usage

1. **Open a CDF File**: Right-click on any `.cdf` file in the Explorer and select "Open in Data Viewer"
2. **Automatic Detection**: The extension will automatically use `cdflib` to read the file
3. **Full Functionality**: All standard features work with CDF files:
   - Browse file structure, dimensions, variables, and attributes
   - Create plots and visualizations
   - Export data and plots

### Troubleshooting

If you encounter issues with CDF files:

1. **Install cdflib**: Use the troubleshooting section in the error message to install `cdflib`
2. **Check File Format**: Ensure your `.cdf` file is a NASA CDF file (not NetCDF)
3. **Version Compatibility**: Files created with `cdflib` versions 3.3.1 and 3.9.0 are fully supported

## 🔧 Technical Details

### Format Detection

The extension now distinguishes between:

- **CDF (NASA)**: Files with `.cdf` extension that use NASA's Common Data Format
- **NetCDF**: Files with `.nc`, `.netcdf`, or `.nc4` extensions that use the NetCDF format

### Engine Selection

- **CDF files (.cdf)**: Uses `cdflib` engine exclusively
- **NetCDF files**: Continue to use `netcdf4`, `h5netcdf`, or `scipy` engines

### Sample Data

The sample data generation script now creates authentic NASA CDF files using `cdflib`, allowing users to test CDF functionality without external files.

## 🐛 Bug Fixes

- **Issue #104**: Fixed support for CDF files created with `cdflib` versions 3.3.1 and 3.9.0
- **Format Confusion**: Resolved confusion between CDF and NetCDF formats in documentation and error messages

## 📝 Changes

### Code Changes

- Updated `get_data_info.py` to use `cdflib` for `.cdf` files
- Modified `create_sample_data.py` to generate CDF files using `cdflib`
- Updated format display names to distinguish "CDF (NASA)" from "NetCDF"
- Added `cdflib` to optional dependencies in documentation

### Documentation Updates

- Updated README.md to separate CDF (NASA) from NetCDF in format table
- Added `cdflib` to optional Python dependencies list
- Updated troubleshooting section with CDF-specific installation instructions
- Clarified format distinctions in all relevant documentation

## 🙏 Acknowledgments

Special thanks to the user @fpartous who reported [Issue #104](https://github.com/etienneschalk/scientific-data-viewer/issues/104) and provided valuable feedback on CDF file support. This release addresses their specific needs for working with NASA CDF files created with `cdflib`.

---

**Download now**: [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=eschalk0.scientific-data-viewer) | [Open VSX](https://open-vsx.org/extension/eschalk0/scientific-data-viewer)

**Documentation**: [GitHub Repository](https://github.com/etienneschalk/scientific-data-viewer)

**Report Issues**: [GitHub Issues](https://github.com/etienneschalk/scientific-data-viewer/issues)
