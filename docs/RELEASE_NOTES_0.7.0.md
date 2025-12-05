# Scientific Data Viewer v0.7.0 Release Notes

## 🎉 New Feature: Timestamp Variable Selection and Time Range Filtering

Version 0.7.0 introduces comprehensive support for datetime variable selection and time-based filtering, allowing users to plot variables with datetime on the x-axis and filter data by time ranges. This feature works with CDF files and all other xarray-supported formats.

## ✨ What's New

### ⏰ Datetime Variable Selection and Time Filtering

- **Automatic Datetime Detection**: Automatically detects datetime variables in data files using multiple methods:
  - `datetime64` dtype detection
  - CF-convention time coordinates (e.g., "days since 2000-01-01")
  - `standard_name="time"` attribute
  - Common variable names (time, timestamp, datetime, date, t)
- **Time Range Filtering**: Filter data by specifying start and end datetime values
- **Monotonicity Handling**: Intelligently handles monotonic increasing, decreasing, and non-monotonic datetime sequences
- **Cross-Group Support**: Works with datetime variables in different groups than the plotted variable
- **Min/Max Pre-filling**: Automatically pre-fills time range inputs with min/max values from detected datetime variables

### 🎨 Enhanced User Interface

- **Time Controls Section**: New dedicated UI section for datetime variable selection and time filtering
- **Dual Input Methods**:
  - Native HTML5 `datetime-local` picker for easy date/time selection
  - Text input for pasting dates in various formats (YYYY-MM-DD HH:MM:SS)
- **Bidirectional Binding**: Text and datetime-local inputs stay synchronized
- **Smart Visibility**: Time controls automatically hide when no datetime variables are found
- **Clear Controls**: One-click button to clear all time filter settings

### 📊 Plot Enhancements

- **Conditional Suptitle**: Plot titles now include start/end time information only when datetime filtering is actually used
- **Full Date Display**: X-axis now shows complete date and time information instead of just hours
- **Robust Error Handling**: Graceful handling of edge cases (invalid datetimes, missing variables, shape mismatches, etc.)

## 🔧 Technical Improvements

### Python Backend

- **Enhanced Datetime Detection**: Comprehensive detection algorithm covering multiple datetime formats
- **Monotonicity Checking**: Uses pandas Index methods for efficient monotonicity detection
- **Smart Filtering Logic**:
  - Monotonic increasing: Uses xarray's `.sel()` with slice notation
  - Monotonic decreasing: Automatically swaps start/end times for correct filtering
  - Non-monotonic: Falls back to boolean indexing for accurate filtering
- **Cross-Group Support**: Handles datetime variables from different groups than plotted variables
- **Variable Name Preservation**: Correctly handles variable names containing dots (e.g., "temperature.hourly")

### TypeScript/JavaScript Frontend

- **Timezone Preservation**: All datetime conversions preserve local time without unexpected timezone shifts
- **State Management**: Robust state management for time controls with min/max value tracking
- **Error Handling**: Comprehensive error handling and user feedback

### Testing

- **Comprehensive Test Suite**: 27 Python unit tests covering all 16 identified edge cases
- **Integration Tests**: TypeScript tests for datetime parameter handling
- **Automated Testing**: Python datetime tests integrated into setup script

## 📊 Supported Formats

All datetime features work with:

- **NetCDF**: .nc, .netcdf, .nc4
- **CDF (NASA)**: .cdf
- **Zarr**: .zarr
- **HDF5**: .h5, .hdf5
- **GRIB/GRIB2**: .grib, .grib2, .grb
- **GeoTIFF**: .tif, .tiff, .geotiff
- **JPEG-2000**: .jp2, .jpeg2000

## 🚀 Getting Started with Time Filtering

### Basic Usage

1. **Open a Data File**: Right-click on any supported file and select "Open in Data Viewer"
2. **Select Datetime Variable**: In the "Time Controls" section, choose a datetime variable from the dropdown
3. **Set Time Range**:
   - Use the datetime picker for easy selection
   - Or paste dates directly into the text input (e.g., "2020-01-01 12:30:00")
4. **Create Plot**: Click "Plot" on any variable - the plot will automatically use the selected datetime for the x-axis and apply the time filter

### Advanced Features

- **Monotonic Decreasing Data**: The system automatically handles decreasing time sequences
- **Non-Monotonic Data**: Works correctly with shuffled or irregular time data
- **Cross-Group Datetime**: Select datetime variables from different groups than your plotted variable
- **Variable Names with Dots**: Supports variable names like "temperature.hourly" correctly

## 🐛 Bug Fixes

- **Issue #106**: Implemented timestamp variable selection and time range filtering
- **Timezone Issues**: Fixed timezone conversion problems in datetime input handling
- **Variable Name Parsing**: Fixed issue with variable names containing dots being truncated
- **Cross-Group Variables**: Fixed handling of datetime variables from different groups
- **Monotonicity**: Fixed filtering for monotonic decreasing and non-monotonic datetime sequences

## 📝 Edge Cases Handled

The implementation robustly handles 16 identified edge cases:

1. ✅ Invalid datetime strings
2. ✅ Empty datetime arrays
3. ✅ Timezone issues
4. ✅ Shape mismatches
5. ✅ Multiple common dimensions
6. ✅ Start > End for monotonic decreasing
7. ✅ Empty result after filtering
8. ✅ Datetime variable with NaN values
9. ✅ CF-convention time variables
10. ✅ Variable names with dots
11. ✅ Cross-group datetime variables
12. ✅ Non-monotonic datetime
13. ✅ Monotonic decreasing datetime
14. ✅ No common dimensions
15. ✅ Datetime variable not found
16. ✅ No datetime variables in file

## 🔧 Technical Details

### Datetime Detection

The system uses a multi-step detection process:

1. Checks for `datetime64` dtype
2. Checks dtype string for "datetime"
3. Checks for CF-convention units (e.g., "days since", "hours since")
4. Checks for `standard_name="time"` attribute
5. Checks for common variable names with units or standard_name

### Filtering Strategy

- **Monotonic Increasing**: Uses `xarray.sel()` with `slice(start, end)`
- **Monotonic Decreasing**: Uses `xarray.sel()` with `slice(end, start)` (swapped)
- **Non-Monotonic**: Uses boolean indexing with `xarray.isel()` for accurate filtering

### API Changes

- **New CLI Arguments**: `--datetime-variable`, `--start-datetime`, `--end-datetime`
- **New Data Structure**: `FileInfoResult.datetime_variables` with min/max values
- **New TypeScript Interfaces**: Updated `CreatePlotRequest` and `DataInfoResult` interfaces

## 📚 Documentation

- **Implementation Documentation**: Comprehensive documentation in `docs/IMPLEMENTATION_PROPOSAL_ISSUE_106.md`
- **Test Coverage**: 27 Python unit tests + TypeScript integration tests
- **Edge Case Documentation**: All edge cases documented with handling strategies

## 🙏 Acknowledgments

This release implements [Issue #106](https://github.com/etienneschalk/scientific-data-viewer/issues/106), adding timestamp variable selection and time range filtering capabilities. The implementation includes comprehensive edge case handling and robust error management.

---

**Download now**: [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=eschalk0.scientific-data-viewer) | [Open VSX](https://open-vsx.org/extension/eschalk0.scientific-data-viewer)

**Documentation**: [GitHub Repository](https://github.com/etienneschalk/scientific-data-viewer)

**Report Issues**: [GitHub Issues](https://github.com/etienneschalk/scientific-data-viewer/issues)
