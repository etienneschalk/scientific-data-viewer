# Scientific Data Viewer - VSCode Extension

<div align="center">
  <img src="media/icon.png" alt="Scientific Data Viewer Icon" width="128" height="128">
</div>

A powerful VSCode extension for viewing and analyzing scientific data files including NetCDF, Zarr, HDF5, and more. This extension provides an intuitive interface for exploring scientific datasets directly within VSCode, eliminating the need for external tools.

<div align="center">

Available on:
[VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=eschalk0.scientific-data-viewer) | [Open VSX](https://open-vsx.org/extension/eschalk0/scientific-data-viewer)

</div>

## 🚀 Features

- **Multi-format Support**: View NetCDF (.nc, .netcdf), Zarr (.zarr), and HDF5 (.h5, .hdf5) files
- **Custom Editors**: Direct file opening with dedicated NetCDF and HDF5 editors
- **Interactive Data Explorer**: Browse file structure, dimensions, variables, and attributes
- **Enhanced Variable Information**: View variable dimension names, data types, shapes, and memory usage
- **Data Visualization**: Create plots and visualizations directly in VSCode **(experimental, disabled by default)**
- **Advanced Python Integration**: Automatic Python environment detection and management
- **File Tree Integration**: Right-click on supported files in the explorer to open them
- **Command Palette Integration**: Multiple commands for data viewer operations
- **Real-time Configuration**: Immediate application of setting changes without restart
- **Status Bar Integration**: Shows current Python interpreter status
- **Comprehensive Logging**: Detailed logging system for debugging and monitoring
- **Human-readable File Sizes**: Display file and variable sizes in appropriate units (B, kB, MB, GB, TB)
- **Error Handling**: Robust error handling with user-friendly messages
- **Experimental Features**: Configurable experimental features with clear warnings

## 📸 Screenshot

<div align="center">
  <img src="media/Screenshot from 2025-09-13 17-09-58.png" alt="Scientific Data Viewer Screenshot" width="800">
</div>

## 📦 Installation

### Quick Install (Recommended)

1. **Install from VSCode Marketplace**:

   - Open VSCode
   - Go to Extensions view (`Ctrl+Shift+X`)
   - Search for "Scientific Data Viewer"
   - Click Install

2. **Install Python dependencies**:
   ```bash
   pip install xarray netCDF4 zarr h5py numpy matplotlib
   ```

### Manual Install

1. **Download the extension**:

   - Go to the [Releases page](https://github.com/etienneschalk/scientific-data-viewer/releases)
   - Download the latest `.vsix` file

2. **Install the .vsix file**:
   - Open VSCode
   - Go to Extensions view (`Ctrl+Shift+X`)
   - Click the "..." menu and select "Install from VSIX..."
   - Select the downloaded `.vsix` file

## ⚙️ Prerequisites

Before using this extension, you need:

1. **Python 3.13+** installed on your system
2. **Required Python packages**:
   - xarray
   - netCDF4
   - zarr
   - h5py
   - numpy
   - matplotlib

## 🎯 Usage

### Opening Data Files

1. **Direct File Opening**:

   - Double-click on any supported file (.nc, .netcdf, .zarr, .h5, .hdf5)
   - Files open directly in the Scientific Data Viewer

2. **From File Explorer**:

   - Right-click on any supported file (.nc, .netcdf, .zarr, .h5, .hdf5)
   - Select "Open in Scientific Data Viewer"

3. **From Command Palette**:

   - Press `<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>`
   - Type "Open Scientific Data Viewer"
   - Select a file from the file picker

4. **Auto-detection**:
   - Open any supported file in VSCode
   - The extension will detect it and offer to open it in the data viewer

### Configuring Python Environment

1. **Automatic Detection**:

   - The extension will automatically detect Python installations
   - It will check for required packages and prompt to install missing ones

2. **Manual Configuration**:

   - Press `<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>`
   - Type "Python: Select Interpreter"
   - Choose your preferred Python environment
   - The extension will automatically detect it and use it

3. **Settings**:
   - Open VSCode Settings (`Ctrl+,`)
   - Search for "Scientific Data Viewer"
   - Configure Python path and other options

### Exploring Data

The data viewer shows:

- **File Information**: Format, size, and basic metadata
- **Dimensions**: Dataset dimensions and their sizes
- **Variables**: All data variables with their types, shapes, dimension names, and memory usage
- ~~**Visualization**: Interactive plots and charts~~

The data representation is based entirely on the native xarray's Dataset HTML representation.

### Creating Visualizations (:warning: EXPERIMENTAL)

1. Select a variable from the dropdown or click on it in the variables list
2. Choose a plot type (Line Plot, Heatmap, Histogram)
3. Click "Create Plot" to generate the visualization

## ⚙️ Configuration

The extension can be configured through VSCode settings:

- `scientificDataViewer.autoRefresh`: Automatically refresh data when files change
- `scientificDataViewer.maxFileSize`: Maximum file size (MB) to load automatically
- `scientificDataViewer.defaultView`: Default view mode (default)
- `scientificDataViewer.allowMultipleTabsForSameFile`: Allow opening multiple tabs for the same file (Experimental)
- `scientificDataViewer.plottingCapabilities`: Enable plotting capabilities (Experimental)

### Available Commands

Access these commands via the Command Palette (`<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>`):

- **Open Scientific Data Viewer**: Open a file in the data viewer
- **Refresh Python Environment**: Manually refresh the Python environment
- **Show Extension Logs**: View detailed extension logs
- **Show Settings**: Open Scientific Data Viewer settings

### Feature Flags

The extension includes configuration options that act as feature flags to control specific behaviors:

- **`scientificDataViewer.allowMultipleTabsForSameFile`** (Experimental): Allow opening multiple tabs for the same file
- **`scientificDataViewer.plottingCapabilities`** (Experimental): Enable plotting capabilities
- **Settings UI**: Each setting appears as a checkbox in VSCode Settings
- **Real-time Updates**: Configuration changes take effect immediately

## 🔧 Troubleshooting

### Common Issues

1. **Python not found**:

   - Ensure Python is installed and in your PATH
   - Use the "Python: Select Interpreter" command to manually set the path

2. **Missing packages**:

   - Install required packages: `pip install xarray netCDF4 zarr h5py numpy matplotlib`
   - Or let the extension install them automatically

3. **Large files not loading**:

   - Increase the `maxFileSize` setting
   - Consider using data slicing for very large datasets

4. **Permission errors**:
   - Ensure the extension has permission to read your data files
   - Check file permissions and VSCode workspace settings

### Getting Help

- **Check the logs**: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> (Command Palette) and "Scientific Data Viewer: Show Extension Logs"
- **Report issues**: [Create an issue on the GitHub repository](https://github.com/etienneschalk/scientific-data-viewer/issues/new)
- **Ask questions**: Use the GitHub Discussions section

---

## 🛠️ Development

### Quick Start for Developers

1. **Clone and setup**:

   ```bash
   git clone https://github.com/etienneschalk/scientific-data-viewer.git
   cd scientific-data-viewer
   ./setup.sh
   ```

2. **Open in VSCode**:

   ```bash
   code .
   ```

3. **Run extension**:
   - Press `F5` to launch Extension Development Host
   - Test with sample data files

### Development Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/etienneschalk/scientific-data-viewer.git
   cd scientific-data-viewer
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Compile the extension**:

   ```bash
   npm run compile
   ```

4. **Install Python dependencies** (if not already installed):

   ```bash
   pip install xarray netCDF4 zarr h5py numpy matplotlib
   ```

5. **Open in VSCode**:

   ```bash
   code .
   ```

6. **Run the extension**:
   - Press `F5` to open a new Extension Development Host window
   - Or use `<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>` and run "Developer: Reload Window"

### Production Installation

1. **Package the extension**:

   ```bash
   npm run package
   ```

2. **Install the .vsix file**:
   - Open VSCode
   - Go to Extensions view (`Ctrl+Shift+X`)
   - Click the "..." menu and select "Install from VSIX..."
   - Select the generated `.vsix` file

### Project Structure

```
src/
├── extension.ts          # Main extension entry point and command registration
├── dataProcessor.ts      # Python integration and data processing
├── dataViewerPanel.ts    # Webview panel for data visualization
├── pythonManager.ts      # Advanced Python environment management
└── logger.ts             # Comprehensive logging utilities
```

### Python Scripts

The extension uses several Python scripts for data processing:

- **`get_data_info.py`**: Extracts file metadata, dimensions, variables, and their properties
- **`get_data_slice.py`**: Retrieves specific data slices from variables
- **`create_plot.py`**: Generates visualizations using matplotlib
- **`get_html_representation.py`**: Creates HTML representation of xarray datasets
- **`get_text_representation.py`**: Creates text representation of datasets
- **`get_show_versions.py`**: Shows Python package versions for debugging
- **`create_sample_data.py`**: Generates sample data files for testing
- **`test_data_structure.py`**: Tests data structure and format detection

Disclaimer: most visualization scripts are experimental and produce unusable plots!

### Building

```bash
# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run tests
npm test

# Lint code
npm run lint
```

### Testing

1. **Unit Tests**:

   ```bash
   npm test
   ```

2. **Integration Tests**:
   - Open the extension in development mode
   - Test with sample data files
   - Verify Python integration works correctly

### Debugging

1. **Set breakpoints** in your TypeScript code
2. **Press F5** to launch the Extension Development Host
3. **Use the debug console** to inspect variables and step through code

Note: It is recommended to run the task `start-watch-mode` for hot reload with
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> Tasks: Run Task then `start-watch-mode`.

#### About debugging the error handling

To get a clean state in the development VSCode instance, uninstall dependencies
to test the full error handling scenarios

```
python -m pip uninstall xarray netCDF4 zarr h5py numpy matplotlib rioxarray cfgrib zarr
```

Then reload the development VSCode instance window: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> Developer: Reload Window

#### See the Webview console logs

<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>: Open Webview Developer Tools

## 📦 Publishing

### Preparing for Publication

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with new features and fixes
3. **Test thoroughly** with various file types and sizes
4. **Update documentation** if needed

### Publishing to VSCode Marketplace

1. **Install vsce** (if not already installed):

   ```bash
   npm install -g vsce
   ```

2. **Login to Azure DevOps**:

   ```bash
   vsce login <publisher-name>
   ```

3. **Package the extension**:

   ```bash
   vsce package
   ```

4. **Publish**:
   ```bash
   vsce publish
   ```

### Publishing to Open VSX (for Cursor and other editors)

To make the extension available in Cursor, VSCodium, and other VSCode-compatible editors:

1. **Create Eclipse account** and sign Publisher Agreement at [open-vsx.org](https://open-vsx.org)
2. **Generate access token** from your Open VSX profile
3. **Set environment variable**: `export OPENVSX_TOKEN=your_token_here`
4. **Publish**: `npm run openvsx-publish`

See [PUBLISHING.md](PUBLISHING.md) for detailed Open VSX publishing instructions.

### Manual Publishing

1. **Create a Personal Access Token**:

   - Go to Azure DevOps
   - Create a new Personal Access Token with Marketplace permissions

2. **Login**:

   ```bash
   vsce login <publisher-name>
   # Enter your Personal Access Token when prompted
   ```

3. **Publish**:
   ```bash
   vsce publish
   ```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the [NetCDF Viewer](https://github.com/rmcd-mscb/netcdf-viewer) extension
- Built with [xarray](https://xarray.pydata.org/) for scientific data processing
- Uses [VSCode Extension API](https://code.visualstudio.com/api) for integration

## 📁 Project Structure

```
scientific-data-viewer/
├── src/                          # TypeScript source code
│   ├── extension.ts              # Main extension entry point
│   ├── dataProvider.ts           # Tree view provider for file explorer
│   ├── dataProcessor.ts          # Python integration and data processing
│   ├── dataViewerPanel.ts        # Webview panel for data visualization
│   ├── pythonManager.ts          # Python environment management
│   └── logger.ts                 # Logging utilities
├── python/                       # Python scripts for data processing
│   ├── get_data_info.py          # Extract file metadata and variable info
│   ├── get_data_slice.py         # Extract data slices from variables
│   ├── create_plot.py            # Generate visualizations
│   └── get_html_representation.py # Generate HTML representation
├── test/                         # Test files
│   ├── runTest.ts               # Test runner
│   └── suite/                   # Test suites
├── sample-data/                  # Sample data files for testing
│   ├── sample_data.nc           # NetCDF sample file
│   ├── sample_data.h5           # HDF5 sample file
│   ├── sample_data.zarr/        # Zarr sample dataset
│   └── create_sample_data.py    # Script to generate test data
├── out/                          # Compiled JavaScript output
├── node_modules/                 # Node.js dependencies
├── .vscode/                      # VSCode configuration
│   ├── launch.json              # Debug configuration
│   ├── tasks.json               # Build tasks
│   └── settings.json            # Workspace settings
├── package.json                  # Extension manifest and dependencies
├── package-lock.json            # Dependency lock file
├── tsconfig.json                # TypeScript configuration
├── tsconfig.test.json           # Test TypeScript configuration
├── .eslintrc.json               # ESLint configuration
├── language-configuration.json  # Language configuration
├── README.md                    # Main documentation
├── QUICKSTART.md               # Quick start guide
├── DEVELOPMENT.md              # Development guide
├── CONTRIBUTING.md             # Contribution guidelines
├── PUBLISHING.md               # Publishing guide
├── CHANGELOG.md                # Version history
└── setup.sh                    # Setup script
```
