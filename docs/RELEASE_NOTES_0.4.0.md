# Scientific Data Viewer v0.4.0 Release Notes

## 🎉 Major Release: Extension Virtual Environment with uv Support

Version 0.4.0 introduces a significant enhancement to the Scientific Data Viewer extension by adding support for a semi-standalone virtual environment managed by `uv`, providing better isolation and Python 3.13 support. This release transforms the extension from a Python extension-dependent tool into a more self-contained solution while maintaining full backward compatibility.

## ✨ What's New

### 🐍 Extension Virtual Environment System

- **uv Integration**: New virtual environment system using `uv` for Python 3.13 installation and management
- **Semi-Standalone Operation**: Extension can run independently with only `uv` as a requirement
- **Isolated Storage**: Environment stored in VSCode's extension storage space for complete isolation
- **Fallback Support**: Gracefully falls back to Python extension behavior if `uv` is unavailable
- **Management Commands**: Complete CRUD operations for extension environment through intuitive UI

### ⚙️ Enhanced Configuration System

- **`scientificDataViewer.python.overridePythonInterpreter`**: Override Python interpreter path (highest priority)
- **`scientificDataViewer.python.useExtensionOwnEnvironment`**: Enable extension's own uv virtual environment
- **`scientificDataViewer.python.currentlyInUseInterpreter`**: Read-only tracking of active interpreter
- **Priority Order**: Clear precedence system for interpreter selection

### 🎯 Improved User Experience

- **Quick Pick Interface**: Replaced notification dialogs with intuitive quick pick menus for uv environment management
- **Status Bar Integration**: Shows virtual environment type and interpreter information
- **Split View Support**: Works for files opened via file explorer (webviewPanel reuse)
- **Better Error Handling**: Improved error messages and recovery mechanisms

## 🔧 Technical Improvements

### 🏗️ New Architecture Components

- **`ExtensionVirtualEnvironmentManager`**: Core virtual environment management (701 lines)
- **`ScientificDataEditorProvider`**: Handles file editor integration
- **`utils.ts`**: Utility functions for path handling and quoting
- **Refactored PythonManager**: Complete rewrite with improved initialization flow

### 📁 Code Quality Enhancements

- **API Surface Reduction**: PythonManager API simplified and streamlined
- **Better Error Handling**: Enhanced error recovery for missing `uv` installation
- **Path Quoting**: Fixed path quoting issues for spawn calls
- **Test Updates**: All test suites updated to reflect new API changes

### 🧪 Testing and Reliability

- **Comprehensive Testing**: Updated all test suites for new architecture
- **Error Scenarios**: Better handling of edge cases and missing dependencies
- **Compilation Fixes**: Resolved test compilation issues

## 🐛 Bug Fixes

- **Path Handling**: Fixed path quoting issues for passing paths as args in spawn calls
- **Environment Detection**: Improved Python interpreter detection and validation
- **UI Consistency**: Better handling of environment switching and refresh scenarios
- **Test Infrastructure**: Fixed compilation issues and removed obsolete tests

## 📊 Configuration Priority System

The extension now uses a clear priority system for Python interpreter selection:

1. **`overridePythonInterpreter`** (manual override - highest precedence)
2. **Extension environment** (if uv available and enabled)
3. **Python extension interpreter** (fallback)
4. **System Python** (final fallback)

## 🎮 New Commands

| Command                                                        | Description                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Scientific Data Viewer: Manage Extension Virtual Environment` | Create, update, delete, and view extension environment information |

## ⚙️ New Settings

### Python Environment Settings

- **`scientificDataViewer.python.overridePythonInterpreter`**

  - Type: `string`
  - Default: `""`
  - Description: Override Python interpreter path (takes precedence over all other options)

- **`scientificDataViewer.python.useExtensionOwnEnvironment`**

  - Type: `boolean`
  - Default: `false`
  - Description: Use the extension's own virtual environment (requires uv)

- **`scientificDataViewer.python.currentlyInUseInterpreter`**
  - Type: `string`
  - Default: `""`
  - Description: Currently active Python interpreter path (read-only, updated automatically)

## 🚀 Getting Started with Extension Environment

1. **Install uv**: Follow the [uv installation guide](https://docs.astral.sh/uv/getting-started/installation/)

2. **Enable Extension Environment**:

   - Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
   - Type "Scientific Data Viewer: Show Settings"
   - Check "Scientific Data Viewer > Python > Use Extension Own Environment"

3. **Manage Environment**:
   - Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
   - Type "Scientific Data Viewer: Manage Extension Virtual Environment"
   - Choose from: Create, Update, Delete, or View Information

## ⚠️ Known Issues

- **Data Structure TreeView**: Not shown for manually created Webviews in Cursor (occurs sometimes)
- **Environment Switching**: Some edge cases may require manual refresh (Ctrl+Shift+P -> SDV: Refresh) so that the status bar reflects the correct state, eg when deleting manually a virtual environment

## 🔄 Breaking Changes

- **PythonManager API**: Reduced API surface (some methods made private)
- **UIController**: Constructor signature changed
- **Test Interfaces**: Updated test interfaces to match new architecture

## 📈 Impact

This release significantly improves the extension's Python environment management capabilities:

- **Better Isolation**: Extension environment won't interfere with other projects
- **Python 3.13 Support**: Latest Python version for optimal performance
- **Almost Self-Contained**: Minimal external dependencies (only requires uv)
- **Backward Compatible**: Falls back gracefully when uv is not available
- **User Control**: Clear configuration options and management commands

## 📊 Statistics

- **23 files changed** with **2,419 additions** and **1,623 deletions**
- **Net change**: +796 lines
- **New Components**: 3 major new TypeScript files
- **API Simplification**: Reduced PythonManager complexity
- **Test Coverage**: Updated all test suites

## 🔮 What's Next

This release establishes a solid foundation for future enhancements:

- **Enhanced Environment Management**: More sophisticated environment switching
- **Performance Improvements**: Optimized Python environment operations
- **Better Integration**: Improved VSCode and Cursor compatibility
- **Advanced Features**: More sophisticated data processing capabilities

## 🙏 Acknowledgments

Thank you to all users who provided feedback and contributed to this release.

---

**Download now**: [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=eschalk0.scientific-data-viewer) | [Open VSX](https://open-vsx.org/extension/eschalk0/scientific-data-viewer)

**Documentation**: [GitHub Repository](https://github.com/etienneschalk/scientific-data-viewer)

**Report Issues**: [GitHub Issues](https://github.com/etienneschalk/scientific-data-viewer/issues)
