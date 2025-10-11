# Pull Request Summary: Package Detection Improvements and Sentinel-1 SAFE Removal

## Overview

This PR improves package availability detection, enhances error handling for missing packages, and removes untested Sentinel-1 SAFE format support to streamline the codebase.

## Key Changes

### 🚀 New Features

- **Dedicated Package Detection Script**: Added `python/check_package_availability.py` for efficient multi-package availability checking
- **Fine-grained Package Management**: Differentiated between core packages (xarray) and optional packages (matplotlib)
- **Enhanced Error Messages**: Added specific error messages and install buttons for missing packages

### 🔧 Technical Improvements

- **Optimized Package Checking**: Replaced individual package checks with batch checking using dedicated Python script
- **Better Type Safety**: Enhanced TypeScript type definitions for structured responses
- **Improved Error Handling**: Better error wrapping and structured response format for plot creation and data info
- **Security Enhancements**: Improved command quoting for package installation

### 🧹 Code Cleanup

- **Removed Sentinel-1 SAFE Support**: Eliminated untested Sentinel-1 SAFE format support and related dependencies
- **Updated Documentation**: Modified RFCs to reflect Sentinel-1 SAFE removal
- **Test Updates**: Updated test mocks to match new response structures

## Files Changed

### New Files

- `python/check_package_availability.py` - Dedicated package availability checking script

### Modified Files

- `src/python/PythonManager.ts` - Enhanced package detection with batch checking
- `src/python/DataProcessor.ts` - Updated response handling for structured data
- `src/panel/UIController.ts` - Improved error handling for plot creation
- `src/panel/webview/webview-script.js` - Enhanced error messages with install buttons
- `src/types.ts` - Added new type definitions for structured responses
- `python/get_data_info.py` - Improved error handling and response structure
- `python/create_sample_data.py` - Removed Sentinel-1 SAFE sample generation
- `setup.sh` - Removed xarray-sentinel dependency
- `docs/rfc/001-format-support.md` - Updated to reflect Sentinel-1 SAFE removal
- `docs/rfc/023-sentinel2-tiling-grid.md` - Updated to reflect Sentinel-1 SAFE removal
- `CHANGELOG.md` - Added new features and improvements
- Multiple test files - Updated to match new response structures

## Benefits

- **Better User Experience**: More specific error messages and direct install buttons for missing packages
- **Improved Performance**: Batch package checking reduces Python process overhead
- **Code Simplification**: Removed untested features to focus on core functionality
- **Enhanced Security**: Better command quoting prevents potential security issues
- **Better Maintainability**: Cleaner codebase with removed unused features

## Breaking Changes

- **Sentinel-1 SAFE Support Removed**: Users relying on .safe files will need to use alternative formats
- **Response Structure Changes**: Plot creation and data info responses now have structured format

## Testing

- All existing tests updated to match new response structures
- Package availability checking tested with new dedicated script
- Error handling scenarios validated with improved error messages

## Commits Included

- 708311f - Meaningful title
- 427f238 - Fine grain matplotlib, not required, with help button
- 419bc28 - Differentiate matplotlib and xarray required
- 711d15d - fix: update test mocks to match CreatePlotPythonResponse structure
- 2edf173 - Wrap erorr message py script
- 549aaa5 - Wrap error message for plot
- 7a65e84 - Quoting security
- bee0385 - Update PythonManager.ts with package detection improvements
- b047919 - Changelog
- 369b717 - Remove support for Sentinel safe
- f98b0f6 - Some promise removal in test
- 6e05ff3 - feat: optimize package availability checking with dedicated Python script
