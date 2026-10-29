# 🛠️ Development Guide - Scientific Data Viewer

## 🛠️ Development (original section from README.md)

### ⚡ Quick Start for Developers

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

Recommended VSCode extension: [es6-string-html](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html)

### 🔧 Development Installation

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
   pip install "xarray>=2026.4.0" matplotlib "zarr>=3"
   ```

5. **Open in VSCode**:

   ```bash
   code .
   ```

6. **Run the extension**:
   - Press `F5` to open a new Extension Development Host window
   - Or use <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> and run "Developer: Reload Window"

### 📦 Production Installation

1. **Package the extension**:

   ```bash
   npm run package
   ```

2. **Install the .vsix file**:
   - Open VSCode
   - Go to Extensions view (`Ctrl+Shift+X`)
   - Click the "..." menu and select "Install from VSIX..."
   - Select the generated `.vsix` file

### 📜 Python Scripts

The Python backend lives in the `python/sdv_backend/` package. The extension runs it
through the thin `python/get_data_info.py` entry point (equivalent to
`python -m sdv_backend` from the `python/` directory), which prints one JSON line:

```bash
python python/get_data_info.py info sample-data/sample_data.nc
python python/get_data_info.py plot sample-data/sample_data.nc /temperature --style default
```

| Module                           | Responsibility                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `cli.py`                         | Argument parsing, builds `InfoOptions` / `PlotOptions`, prints the JSON envelope                   |
| `results.py`, `serialization.py` | Result dataclasses (the JSON contract with the extension) and JSON encoding                        |
| `environment/`                   | Installed packages, xarray engine selection per extension                                          |
| `formats/`                       | Format detection (Zarr incl. zipped, Kerchunk, GeoTIFF/COG)                                        |
| `opening.py`                     | Opening as DataTree or per-group Datasets with decode_cf fallback (`OpenedData`)                   |
| `info/`                          | `get_file_info`: reprs, per-group variables/coordinates/attributes, datetime ranges                |
| `plotting/`                      | `create_plot`: variable selection, slicing, datetime filtering, drawing (`draw.py`), PNG rendering |

Dependencies point one way: `cli → info / plotting → opening → formats → environment`.

Other scripts in `python/`:

- **`create_sample_data.py`**: generates the files in `sample-data/`; the generators live in
  the `python/sample_data/` package (one module per format family: `netcdf`, `zarr`, `geotiff`, …)
- **`non_regression_test_plot.py`**: renders a gallery of plot cases for visual checks
- **`tools/golden_snapshots.py`**: records / checks the backend JSON output on `sample-data/`
  (`record` before a refactoring, `check` after it)

Run the Python tests with `pytest python/tests` (pytest config is in `python/pyproject.toml`).

Disclaimer: most visualization scripts are experimental and can produce unusable plots!

### 🏗️ Building

```bash
# Compile TypeScript and bundle the webview (out/webview/webview.js)
npm run compile

# Watch for changes (webview bundle + extension host)
npm run watch

# Typecheck extension host and webview without emitting
npm run typecheck

# Run tests
npm test

# Lint code
npm run lint
```

### 🧪 Testing

1. **Unit Tests**:

   ```bash
   npm test
   ```

2. **Integration Tests**:
   - Open the extension in development mode
   - Test with sample data files
   - Verify Python integration works correctly

### 🐛 Debugging

1. **Set breakpoints** in your TypeScript code
2. **Press F5** to launch the Extension Development Host
3. **Use the debug console** to inspect variables and step through code

Note: It is recommended to run the task `start-watch-mode` for hot reload with
<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> Tasks: Run Task then `start-watch-mode`.

Note: It is recommended to enable the `scientificDataViewer.devMode` feature flag during development. You can quickly toggle dev mode using the "Scientific Data Viewer: Toggle Dev Mode" command.

**About debugging the error handling**

To get a clean state in the development VSCode instance, uninstall dependencies
to test the full error handling scenarios

```
python -m pip uninstall xarray matplotlib numpy netCDF4 h5py rioxarray cfgrib zarr
```

Then reload the development VSCode instance window: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> Developer: Reload Window

**See the Webview console logs**

<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>: Open Webview Developer Tools

This guide provides detailed instructions for developing, testing, and maintaining the Scientific Data Viewer VSCode extension.

## Prerequisites

### Required Software

- **Node.js 22+** and npm
- **Python 3.13+** with pip
- **VSCode** (latest stable version)
- **Git** for version control

### Required Python Packages

```bash
pip install "xarray>=2026.4.0" netCDF4 "zarr>=3" h5py numpy matplotlib "h5netcdf>=1.8"
```

## Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/etienneschalk/scientific-data-viewer.git
cd scientific-data-viewer

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install "xarray>=2026.4.0" netCDF4 "zarr>=3" h5py numpy matplotlib "h5netcdf>=1.8"
```

### 2. Build the Extension

```bash
# Compile TypeScript and bundle the webview (out/webview/webview.js)
npm run compile

# Watch for changes during development (webview bundle + extension host)
npm run watch
```

### 3. Run in Development Mode

1. Open the project in VSCode: `code .`
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VSCode window

## Project Architecture

### Core Components

See [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) for the modules of `src/` and how they talk to each other, and the backend section below for `python/sdv_backend/`.

### Data Flow

1. **File Detection**: User opens/clicks on supported file or uses custom editors
2. **Python Integration**: Extension connects to Python environment via Python extension API
3. **Data Processing**: Python scripts process the file using xarray
4. **Visualization**: Webview displays processed data and plots **(experimental)**
5. **Configuration**: Real-time configuration updates and error handling
6. **Logging**: Comprehensive logging throughout the process

### Key Technologies

- **VSCode Extension API**: Core extension functionality, custom editors, webview
- **TypeScript**: Main development language
- **xarray**: Scientific data processing
- **Python subprocess**: Communication with Python environment
- **Webview API**: Data visualization interface
- **Python Extension API**: Integration with VSCode Python extension
- **Configuration API**: Real-time settings management
- **Logging API**: Comprehensive logging and debugging

## Development Workflow

### 1. Making Changes

```bash
# Start watch mode for automatic compilation
npm run watch

# In another terminal, run tests
npm test

# Check code style
npm run lint
```

### 2. Testing

#### Unit Tests

```bash
# Run all tests (inside a VS Code instance; from a VS Code terminal: env -u ELECTRON_RUN_AS_NODE npm test)
npm test
```

#### Integration Testing

1. **Create sample data**:

   ```bash
   # from the repository root; existing files are kept
   python python/create_sample_data.py
   # regenerate everything (files no generator produces are left untouched)
   python python/create_sample_data.py --overwrite
   ```

   Generation is reproducible: random data is seeded per generator and
   timestamps are fixed, so `--overwrite` yields the same data every time.

2. **Test with sample files**:
   - Open sample NetCDF, Zarr, or HDF5 files
   - Verify data loading and visualization
   - Test different file sizes and formats

#### Manual Testing Checklist

- [ ] Extension activates correctly
- [ ] Python environment detection works
- [ ] File context menu appears for supported files
- [ ] Data viewer opens and displays file information
- [ ] Variables and dimensions are shown correctly
- [ ] Plot generation works for different plot types
- [ ] Error handling works for invalid files
- [ ] Large files are handled appropriately

### 3. Debugging

#### VSCode Debugging

1. **Set breakpoints** in TypeScript files
2. **Press F5** to launch Extension Development Host
3. **Use debug console** to inspect variables
4. **Step through code** using debug controls

#### Python Script Debugging

1. **Log to stderr** in the backend (`python/sdv_backend/`); stdout is reserved for the JSON result
2. **Check VSCode Output panel** for Python output
3. **Use Python debugger** if needed

#### Common Debug Scenarios

- **Python not found**: Check Python path configuration
- **Package missing**: Verify Python package installation
- **File not loading**: Check file permissions and format
- **Plot not generating**: Verify matplotlib installation

## Code Style Guidelines

### TypeScript

- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and interfaces
- Add **JSDoc comments** for public functions
- Use **strict typing** - avoid `any` when possible
- Keep functions **small and focused**

### Python Scripts

- Use **snake_case** for variables and functions
- Add **docstrings** for functions
- Handle **exceptions** gracefully
- Use **type hints** when possible

### File Organization

- **One class per file**
- **Related functionality grouped together**
- **Clear separation of concerns**
- **Consistent naming conventions**

## Testing Strategy

### Unit Tests

- **Test individual functions** in isolation
- **Mock external dependencies** (Python, file system)
- **Test error conditions** and edge cases
- **Aim for high coverage** (>80%)

### Integration Tests

- **Test Python integration** with real Python environment
- **Test file processing** with sample data files
- **Test webview communication** between extension and frontend
- **Test configuration** and settings

### End-to-End Tests

- **Test complete user workflows**
- **Test with various file types and sizes**
- **Test error handling** and recovery
- **Test performance** with large files

## Performance Considerations

### Large File Handling

- **Implement data slicing** for large datasets
- **Use lazy loading** where possible
- **Add progress indicators** for long operations
- **Set configurable file size limits**

### Memory Management

- **Close datasets** after processing
- **Limit data loaded** into memory
- **Use streaming** for very large files
- **Implement garbage collection** strategies

### Python Performance

- **Optimize Python scripts** for speed
- **Use efficient data structures**
- **Minimize data copying**
- **Use parallel processing** when appropriate

## Error Handling

### Extension Errors

- **Catch and log** all errors
- **Provide user-friendly** error messages
- **Implement graceful degradation**
- **Add retry mechanisms** where appropriate

### Python Errors

- **Handle Python script failures**
- **Parse error messages** from Python
- **Provide helpful error context**
- **Suggest solutions** when possible

### File Errors

- **Validate file formats** before processing
- **Handle corrupted files** gracefully
- **Check file permissions**
- **Provide clear error messages**

## Configuration Management

### Settings

- **Use VSCode configuration API**
- **Provide sensible defaults**
- **Validate configuration values**
- **Update settings** when needed

### Python Environment

- **Detect Python installations** automatically
- **Validate Python packages**
- **Handle environment changes**
- **Provide configuration options**

## Documentation

### Code Documentation

- **JSDoc comments** for TypeScript functions
- **Python docstrings** for Python functions
- **README files** for major components
- **Inline comments** for complex logic

### User Documentation

- **README.md** with installation and usage instructions
- **CHANGELOG.md** with version history
- **CONTRIBUTING.md** with contribution guidelines
- **API documentation** for extension API

## Release Process

### Pre-Release

1. **Update version** in package.json
2. Run `npm install`
3. **Update CHANGELOG.md** with new features
4. **Run full test suite**
5. **Test with sample data files**
6. **Update documentation**

### Release

1. **Package extension**: `npm run package`
2. **Test .vsix file** locally
3. **Publish to marketplace**: `npm run publish` and `npm run openvsx-publish`
4. **Create GitHub release**
5. **Update documentation**

### Post-Release

1. **Monitor for issues**
2. **Respond to user feedback**
3. **Plan next release**
4. **Update roadmap**

## Troubleshooting

### Common Issues

#### Extension Not Loading

- Check VSCode version compatibility
- Verify TypeScript compilation
- Check for syntax errors
- Review extension logs

#### Python Integration Issues

- Verify Python installation
- Check package installation
- Validate Python path
- Test Python scripts manually

#### Data Loading Problems

- Check file format support
- Verify file permissions
- Test with sample files
- Review error messages

#### Performance Issues

- Check file size limits
- Monitor memory usage
- Optimize Python scripts
- Consider data slicing

### Getting Help

- **Check logs** in VSCode Output panel
- **Review error messages** carefully
- **Test with sample data** files
- **Search existing issues** on GitHub
- **Create new issue** with detailed information

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed contribution guidelines.

### Quick Start

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## Resources

### VSCode Extension Development

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Extension Samples](https://github.com/Microsoft/vscode-extension-samples)
- [Extension Guidelines](https://code.visualstudio.com/api/extension-guides/overview)

### Scientific Data Processing

- [xarray Documentation](https://xarray.pydata.org/)
- [NetCDF Documentation](https://www.unidata.ucar.edu/software/netcdf/)
- [Zarr Documentation](https://zarr.readthedocs.io/)

### Python Integration

- [Node.js Child Process](https://nodejs.org/api/child_process.html)
- [Python subprocess](https://docs.python.org/3/library/subprocess.html)
