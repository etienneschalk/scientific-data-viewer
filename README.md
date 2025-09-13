# Scientific Data Viewer - VSCode Extension

A powerful VSCode extension for viewing and analyzing scientific data files including NetCDF, Zarr, HDF5, and more. This extension provides an intuitive interface for exploring scientific datasets directly within VSCode, eliminating the need for external tools.

## Features

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

## Prerequisites

Before using this extension, you need:

1. **Python 3.7+** installed on your system
2. **Required Python packages**:
   - xarray
   - netCDF4
   - zarr
   - h5py
   - numpy
   - matplotlib

## Installation

### Development Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
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
   - Or use `Ctrl+Shift+P` and run "Developer: Reload Window"

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

## Usage

### Opening Data Files

1. **Direct File Opening**:
   - Double-click on any supported file (.nc, .netcdf, .zarr, .h5, .hdf5)
   - Files open directly in the Scientific Data Viewer

2. **From File Explorer**:
   - Right-click on any supported file (.nc, .netcdf, .zarr, .h5, .hdf5)
   - Select "Open in Scientific Data Viewer"

3. **From Command Palette**:
   - Press `Ctrl+Shift+P`
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
   - Press `Ctrl+Shift+P`
   - Type "Python: Select Interpreter"
   - Choose your preferred Python environment

3. **Settings**:
   - Open VSCode Settings (`Ctrl+,`)
   - Search for "Scientific Data Viewer"
   - Configure Python path and other options

### Exploring Data

The data viewer provides several views:

- **File Information**: Format, size, and basic metadata
- **Dimensions**: Dataset dimensions and their sizes
- **Variables**: All data variables with their types, shapes, dimension names, and memory usage
- **Visualization**: Interactive plots and charts

### Creating Visualizations

1. Select a variable from the dropdown or click on it in the variables list
2. Choose a plot type (Line Plot, Heatmap, Histogram)
3. Click "Create Plot" to generate the visualization

## Configuration

The extension can be configured through VSCode settings:

- `scientificDataViewer.autoRefresh`: Automatically refresh data when files change
- `scientificDataViewer.maxFileSize`: Maximum file size (MB) to load automatically
- `scientificDataViewer.defaultView`: Default view mode (default)
- `scientificDataViewer.allowMultipleTabsForSameFile`: Allow opening multiple tabs for the same file (Experimental)
- `scientificDataViewer.plottingCapabilities`: Enable plotting capabilities (Experimental)

### Available Commands

Access these commands via the Command Palette (`Ctrl+Shift+P`):

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

For detailed information about feature flags, see [FEATURE_FLAGS.md](FEATURE_FLAGS.md).

## Development

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

## Publishing

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

## Troubleshooting

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

- **Check the logs**: Open the Output panel and select "Scientific Data Viewer"
- **Report issues**: Create an issue on the GitHub repository
- **Ask questions**: Use the GitHub Discussions section

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by the [NetCDF Viewer](https://github.com/rmcd-mscb/netcdf-viewer) extension
- Built with [xarray](https://xarray.pydata.org/) for scientific data processing
- Uses [VSCode Extension API](https://code.visualstudio.com/api) for integration

## Project Structure

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

## Quick Start

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
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

## Changelog

### 0.1.0 (Current)
- **Custom Editors**: Direct file opening with dedicated NetCDF and HDF5 editors
- **Advanced Python Integration**: Automatic Python environment detection and management
- **Command Palette Integration**: Multiple commands for data viewer operations
- **Real-time Configuration**: Immediate application of setting changes without restart
- **Status Bar Integration**: Shows current Python interpreter status
- **Comprehensive Logging**: Detailed logging system for debugging and monitoring
- **Error Handling**: Robust error handling with user-friendly messages
- **Experimental Features**: Configurable experimental features with clear warnings
- **Enhanced Variable Information**: Added dimension names and memory usage display for each variable
- **Improved File Size Display**: Added human-readable file size formatting (B, kB, MB, GB, TB)
- **Better Data Structure**: Updated data processing to include dimension names and byte sizes
- **Multi-format Support**: Support for NetCDF, Zarr, and HDF5 files
- **Interactive Data Exploration**: Browse file structure, dimensions, variables, and attributes
- **Data Visualization**: Create plots and visualizations directly in VSCode (experimental)
- **Python Environment Integration**: Uses existing Python environment with xarray, netCDF4, and other scientific libraries
- **File Tree Integration**: Right-click on supported files in the explorer to open them
- **Comprehensive Documentation**: Complete documentation and testing setup
