# RFCs Backlog

This directory contains organized issue descriptions for the Scientific Data Viewer extension development.

## Issue List

### High Priority

- [#001: Add support for all possible formats](./001-format-support.md) - **FULLY IMPLEMENTED** ✅ - Core functionality
- [#006: Fix interpreter error message handling](./006-interpreter-error-handling.md) - Bug fix

### Medium Priority

- [#002: Allow Editor split view](./002-split-view.md) - Complex UI feature
- [#003: Add DataTree usage and support](./003-datatree-support.md) - Feature enhancement
- [#004: Stress testing with many small variables](./004-stress-testing.md) - Quality assurance
- [#005: Export to notebook functionality](./005-export-notebook.md) - User convenience
- [#007: Lazy initialization with feature flags](./007-lazy-initialization.md) - Performance
- [#009: Optional dependencies for plotting](./009-optional-plotting-deps.md) - Architecture
- [#011: Export visualization functionality](./011-export-visualization.md) - User convenience
- [#012: Text representation with copy functionality](./012-text-representation.md) - User convenience
- [#015: Comprehensive feature flag system](./015-feature-flags.md) - Architecture
- [#017: Better installed package detection](./017-package-detection.md) - Reliability
- [#021: Fix tree view data provider](./021-tree-view-fix.md) - Bug fix
- [#022: Improve error messages for extension readiness](./022-error-message-improvement.md) - User experience

### Low Priority

- [#008: Configurable interpreter polling period](./008-configurable-polling.md) - Configuration
- [#010: Custom scripts for visualization and rendering](./010-custom-scripts.md) - Advanced feature
- [#013: Save plots to PNG](./013-save-plots-png.md) - Nice to have
- [#014: Extract constants to configuration](./014-config-constants.md) - Code quality
- [#016: Distinct Data Vars / Coords sections in HTML](./016-distinct-sections.md) - UI improvement
- [#018: Add refresh timestamp to webview](./018-refresh-timestamp.md) - User experience
- [#019: Webview skeleton loading](./019-skeleton-loading.md) - User experience
- [#020: Better structured UI in template files](./020-ui-structure-improvement.md) - Code quality

## Completed RFCs

- [x] [#001: Add support for all possible formats](./001-format-support.md) - **FULLY IMPLEMENTED** ✅
- [x] Open multiple files in their single tab
- [x] Use xarray native representation of Datasets
- [x] Tab Name not updated (bug fix)
- [x] Command to show settings
- [x] Add a `xr.show_versions()` at the end for troubleshooting
- [x] Add the python interpreter path inside the Troubleshooting section

## Issue Categories

### Core Functionality

- Format support
- DataTree support
- Package detection

### User Interface

- Split view
- Text representation
- HTML sections
- Skeleton loading
- UI structure

### Performance & Architecture

- Lazy initialization
- Feature flags
- Optional dependencies
- Stress testing

### User Experience

- Export functionality
- Error handling
- Configuration options
- Custom scripts

### Code Quality

- Constants extraction
- UI structure
- Package detection

## Notes

- RFCs are numbered sequentially for easy reference
- Priority levels are based on impact and complexity
- Each RFC includes detailed requirements and acceptance criteria
- Labels are provided for categorization and filtering
