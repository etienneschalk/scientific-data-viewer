# RFCs Backlog

This directory contains organized issue descriptions for the Scientific Data Viewer extension development.

## Issue List

### High Priority

- [#001: Add support for all possible formats](./001-format-support.md) - **MOSTLY IMPLEMENTED** ✅ (with known limitations) - Core functionality
- [#003: Add DataTree usage and support](./003-datatree-support.md) - **MOSTLY IMPLEMENTED** ✅ - Feature enhancement
- [#004: Stress testing with many small variables](./004-stress-testing.md) - **MOSTLY IMPLEMENTED** ✅ - Quality assurance
- [#006: Fix interpreter error message handling](./006-interpreter-error-handling.md) - Bug fix
- [#011: Export visualization functionality](./011-export-visualization.md) - **MOSTLY IMPLEMENTED** ✅ - User convenience
- [#012: Text representation with copy functionality](./012-text-representation.md) - **FULLY IMPLEMENTED** ✅ - User convenience
- [#013: Save plots to PNG](./013-save-plots-png.md) - **IMPLEMENTED** ✅ - Nice to have
- [#020: Better structured UI in template files](./020-ui-structure-improvement.md) - **MOSTLY IMPLEMENTED** ✅ - Code quality
- [#023: Support Tiling Grid S2 (Sentinel-2 SAFE)](./023-sentinel2-tiling-grid.md) - Core functionality enhancement
- [#026: Optimize Python Script Calls](./026-python-script-optimization.md) - Performance optimization
- [#029: Multiple Variables Plotting](./029-multiple-variables-plotting.md) - **STARTED IMPLEMENTATION** ✅ - Visualization enhancement
- [#035: Enhanced Error Handling System](./035-enhanced-error-handling.md) - User experience and reliability
- [#036: Outline and Breadcrumbs Navigation](./036-outline-breadcrumbs-navigation.md) - Navigation enhancement
- [#038: Multi-Plot Query Optimization](./038-multi-plot-query-optimization.md) - Performance optimization
- [#043: Remote Dataset Support (S3/Zarr)](./043-remote-dataset-support.md) - Data access enhancement
- [#047: Xarray HTML Repr UI Foundation](./047-xarray-html-repr-ui-foundation.md) - Architecture improvement
- [#050: True Outline Implementation](./050-true-outline-implementation.md) - Navigation improvement

### Medium Priority

- [#002: Allow Editor split view](./002-split-view.md) - Complex UI feature
- [#005: Export to notebook functionality](./005-export-notebook.md) - User convenience
- [#007: Lazy initialization with feature flags](./007-lazy-initialization.md) - Performance
- [#009: Optional dependencies for plotting](./009-optional-plotting-deps.md) - Architecture
- [#015: Comprehensive feature flag system](./015-feature-flags.md) - Architecture
- [#017: Better installed package detection](./017-package-detection.md) - Reliability
- [#021: Fix tree view data provider](./021-tree-view-fix.md) - Bug fix
- [#022: Improve error messages for extension readiness](./022-error-message-improvement.md) - User experience
- [#024: Support Trishna Product with Custom Scripts](./024-trishna-product-support.md) - Specialized satellite data support
- [#025: Generate Static Webview via Notebook](./025-static-webview-generation.md) - Export and visualization enhancement
- [#027: Allow User-Configurable kwargs for xarray Products](./027-custom-xarray-kwargs.md) - Advanced user feature
- [#028: Add Healthcheck System](./028-healthcheck-system.md) - Reliability and monitoring
- [#030: Export HTML Report](./030-export-html-report.md) - Export functionality
- [#031: Convert HTML to Notebook](./031-convert-html-notebook.md) - Export functionality
- [#032: Interactive Plotting Tools](./032-interactive-plotting-tools.md) - Visualization enhancement
- [#033: Flatten DataTree Variables](./033-flatten-datatree-variables.md) - DataTree support enhancement
- [#034: French Translation Support](./034-french-translation.md) - Accessibility enhancement
- [#037: Categorical Raster Plotting](./037-categorical-raster-plotting.md) - Specialized visualization
- [#039: Webview Search (Ctrl+F) Support](./039-webview-search-support.md) - User convenience
- [#041: Code Formatting Standardization](./041-code-formatting-standardization.md) - Code quality
- [#042: Enhanced Xarray HTML Representation](./042-enhanced-xarray-html-representation.md) - User experience
- [#044: Data Structure Collapse/Expand Controls](./044-data-structure-collapse-expand.md) - User experience
- [#045: Xarray Statistics Calculation](./045-xarray-statistics-calculation.md) - Data analysis
- [#049: Details Section for Attributes](./049-details-section-for-attributes.md) - UI improvement

### Low Priority

- [#008: Configurable interpreter polling period](./008-configurable-polling.md) - Configuration
- [#010: Custom scripts for visualization and rendering](./010-custom-scripts.md) - Advanced feature
- [#013: Save plots to PNG](./013-save-plots-png.md) - Nice to have
- [#014: Extract constants to configuration](./014-config-constants.md) - Code quality
- [#016: Distinct Data Vars / Coords sections in HTML](./016-distinct-sections.md) - UI improvement
- [#018: Add refresh timestamp to webview](./018-refresh-timestamp.md) - User experience
- [#019: Webview skeleton loading](./019-skeleton-loading.md) - User experience
- [#020: Better structured UI in template files](./020-ui-structure-improvement.md) - Code quality
- [#040: Xarray Color Alternation](./040-xarray-color-alternation.md) - Visual enhancement
- [#046: Data Range Display (Begin/End)](./046-data-range-display.md) - Data overview
- [#048: Attributes Wrench Icon Interface](./048-attributes-wrench-icon-interface.md) - UI enhancement
- [#051: Xarray Contrib Integration](./051-xarray-contrib-integration.md) - Ecosystem integration

## Completed RFCs

- [x] [#001: Add support for all possible formats](./001-format-support.md) - **MOSTLY IMPLEMENTED** ✅ (with known limitations)
- [x] [#012: Text representation with copy functionality](./012-text-representation.md) - **FULLY IMPLEMENTED** ✅

## Completed features (not listed in RFCs)

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
- Static webview generation
- Health monitoring

### Satellite Data Support

- Sentinel-2 SAFE format
- Trishna product support
- Tiling grid systems
- Custom satellite data processing

### Code Quality

- Constants extraction
- UI structure
- Package detection

## Notes

- RFCs are numbered sequentially for easy reference
- Priority levels are based on impact and complexity
- Each RFC includes detailed requirements and acceptance criteria
- Labels are provided for categorization and filtering
