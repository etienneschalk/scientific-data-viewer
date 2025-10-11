# Merge Commit Summary

## Title

feat: improve package detection and remove Sentinel-1 SAFE support

## Description

This merge introduces significant improvements to package availability detection and removes untested Sentinel-1 SAFE format support to streamline the codebase.

## Key Improvements

### Package Management Enhancements

- Added dedicated `check_package_availability.py` script for efficient multi-package checking
- Implemented fine-grained package management distinguishing core (xarray) vs optional (matplotlib) packages
- Enhanced error messages with direct install buttons for missing packages
- Improved security with better command quoting

### Code Quality Improvements

- Optimized package detection using batch checking instead of individual package checks
- Enhanced TypeScript type definitions for structured responses
- Improved error handling and response structure for plot creation and data info
- Updated all test mocks to match new response structures

### Code Cleanup

- Removed untested Sentinel-1 SAFE format support and related dependencies
- Updated documentation (RFCs) to reflect Sentinel-1 SAFE removal
- Cleaned up sample data generation code

## Impact

- **Performance**: Reduced Python process overhead through batch package checking
- **User Experience**: More specific error messages and streamlined package installation
- **Maintainability**: Cleaner codebase with removed unused features
- **Security**: Enhanced command quoting prevents potential security issues

## Breaking Changes

- Sentinel-1 SAFE (.safe) files no longer supported
- Plot creation and data info responses now use structured format

## Files Modified

- 15+ files updated across Python scripts, TypeScript source, tests, and documentation
- 1 new file: `python/check_package_availability.py`
- Multiple test files updated for new response structures

## Commits Merged

12 commits from `41-bug-better-installed-package-detection` branch including package detection optimizations, error handling improvements, and Sentinel-1 SAFE removal.

## Testing

- All existing tests updated and passing
- New package availability checking validated
- Error handling scenarios tested with improved user feedback
