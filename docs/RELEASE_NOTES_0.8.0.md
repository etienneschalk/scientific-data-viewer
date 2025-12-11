# Scientific Data Viewer v0.8.0 Release Notes

## 🎉 Bug Fixes and Quality of Life Improvements

Version 0.8.0 focuses on stability and reliability improvements, addressing several bugs reported by users and enhancing the overall user experience. This release includes fixes for process management, display issues, and smarter colormap handling.

## ✨ What's New

### 🎨 Smarter Colormap Selection (Issue #103)

- **Automatic Colormap Detection**: Removed hardcoded `viridis` colormap to let xarray automatically determine the most appropriate colormap based on data characteristics
- **Diverging Data Support**: Data centered around zero (e.g., temperature anomalies, wind components) now correctly uses diverging colormaps instead of sequential ones
- **Better Visualization**: Each dataset is now visualized with the most suitable color scheme for its data distribution

### ⏱️ Robust Process Management (Issue #97)

- **Process Termination on Timeout**: Resource-intensive plotting processes that timeout are now properly killed, preventing zombie processes from consuming system resources
- **Two-Layer Timeout Architecture**:
  - **Client-side (15s)**: Quick user feedback with abort request
  - **Server-side (20s)**: Safety net that kills processes even if the webview is closed
- **Process Group Killing**: Ensures both shell and Python child processes are terminated
- **Cancel All Button**: New button during "Plot All" operations showing count of active operations
- **Concurrency Limiting**: "Plot All" now processes max 5 plots simultaneously, leaving resources for cancel operations

### 📝 Full Attribute Display (Issue #108)

- **Complete Text Representations**: Attributes and data values are now fully displayed in text representations instead of showing only counts (e.g., `Attributes: (3)`)
- **HTML Unaffected**: HTML representations retain collapsed attributes since users can interactively expand them

### 🏷️ Correct Format Display (Issue #99)

- **Fixed "Format: Unknown"**: The File Information section now correctly displays the file format instead of always showing "Unknown"
- **Proper Data Path**: Updated to use the correct data path (`format_info.display_name`) from the Python backend

### 📦 Publishing Script

- **New `publish.sh` Script**: Comprehensive manual publishing script for releasing to both VS Code Marketplace and Open VSX Registry
- **Version Consistency Checks**:
  - Validates CHANGELOG.md has entry for current version
  - Checks release notes file exists (`docs/RELEASE_NOTES_X.Y.Z.md`)
  - Verifies git working directory is clean
  - Confirms on main/master branch
  - Validates/creates git tag
- **Automatic CHANGELOG Date Update**: Detects `UNRELEASED` and replaces with current date, with option to commit
- **Environment Validation**: Checks Node.js 22+ and Python 3.13+ before proceeding
- **Dry-run Mode**: Test the entire process without publishing (`./publish.sh --dry-run`)
- **Skip Options**: `--skip-vscode`, `--skip-openvsx`, `--skip-tests` for flexibility

## 🐛 Bug Fixes Summary

| Issue                                                                      | Description                                                      | Impact                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------ |
| [#97](https://github.com/etienneschalk/scientific-data-viewer/issues/97)   | Resource intensive plotting processes timeout but are not killed | High - System resources  |
| [#99](https://github.com/etienneschalk/scientific-data-viewer/issues/99)   | "Format: Unknown" always shown in File Information               | Medium - UX              |
| [#103](https://github.com/etienneschalk/scientific-data-viewer/issues/103) | Hardcoded viridis colormap prevents appropriate colormaps        | Medium - Visualization   |
| [#108](https://github.com/etienneschalk/scientific-data-viewer/issues/108) | Attributes truncated in text representations                     | Medium - Data inspection |

## 🔧 Technical Improvements

### Process Management

- **Process Tracking**: `PythonManager` now tracks active processes with unique operation IDs
- **Abort API**: New `abortProcess()` and `abortAllProcesses()` methods for controlled termination
- **Detached Processes**: Uses `detached: true` and negative PID for reliable process group termination

### Files Modified

- `src/python/PythonManager.ts` - Process tracking, server-side timeout, abort methods
- `src/python/DataProcessor.ts` - Added timeout parameter to `createPlot()`
- `src/panel/UIController.ts` - Added `abortPlot` message handler
- `src/panel/webview/webview-script.js` - Client-side timeout, Cancel All button, concurrency limiting
- `src/panel/HTMLGenerator.ts` - Cancel All button HTML
- `src/panel/webview/styles.css` - Cancel button styling
- `python/get_data_info.py` - Removed hardcoded colormap, fixed xarray display options

## 🚀 Upgrading

Simply update the extension from the VS Code Marketplace or Open VSX Registry. No configuration changes required.

### For Users Experiencing Zombie Processes

If you previously had issues with Python processes not being terminated:

1. Update to v0.8.0
2. Previous zombie processes may need to be manually killed
3. New plotting operations will properly terminate on timeout or cancellation

## 🙏 Acknowledgments

Thanks to all users who reported issues and provided feedback. This release addresses real-world problems encountered when working with large scientific datasets.

Special thanks for the bug reports:

- Issue #97: Process timeout handling
- Issue #99: Format display regression
- Issue #103: Colormap selection
- Issue #108: Attribute truncation

---

**Download now**: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=eschalk0.scientific-data-viewer) | [Open VSX](https://open-vsx.org/extension/eschalk0/scientific-data-viewer)

**Documentation**: [GitHub Repository](https://github.com/etienneschalk/scientific-data-viewer)

**Report Issues**: [GitHub Issues](https://github.com/etienneschalk/scientific-data-viewer/issues)
