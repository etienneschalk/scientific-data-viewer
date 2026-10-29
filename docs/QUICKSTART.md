# Quick Start Guide - Scientific Data Viewer

Get up and running with the Scientific Data Viewer VSCode extension in minutes!

## 🚀 Installation

### Option 1: Development Installation (Recommended for contributors)

```bash
# Clone the repository
git clone https://github.com/etienneschalk/scientific-data-viewer.git
cd scientific-data-viewer

# Run the setup script
./setup.sh
```

### Option 2: Manual Installation

```bash
# Install dependencies
npm install
pip install xarray netCDF4 zarr h5py numpy matplotlib h5netcdf

# Compile the extension
npm run compile

# Open in VSCode
code .
```

## 🎯 First Steps

### 1. Launch the Extension

1. **Open VSCode** with the project
2. **Press F5** to launch Extension Development Host
3. **Wait for the new VSCode window** to open

### 2. Test with Sample Data

1. **Create sample data**:

   ```bash
   # from the repository root (writes ./sample-data/)
   python python/create_sample_data.py
   ```

2. **Open a sample file**:
   - **Direct opening**: Double-click on `sample_data.nc` in the file explorer
   - **Context menu**: Right-click on `sample_data.nc` and select "Open in Scientific Data Viewer"
   - **Command palette**: Press `Ctrl+Shift+P`, type "Open Scientific Data Viewer", and select the file

### 3. Explore the Interface

- **File Information**: View format, size, and metadata
- **Dimensions**: Browse dataset dimensions with sizes
- **Variables**: Explore data variables with types, shapes, and memory usage
- **Visualization**: Create plots and charts (experimental feature)
- **Status Bar**: Check Python interpreter status
- **Logs**: View detailed extension logs via Command Palette

## 🔧 Configuration

### Python Environment

The extension will automatically detect Python installations. If needed:

1. **Press Ctrl+Shift+P**
2. **Type "Python: Select Interpreter"**
3. **Choose your Python environment**

### Settings

Access settings via **File → Preferences → Settings**:

- **Max File Size**: Set limit for automatic loading (MB)
- **Use Extension Own Environment**: let the extension manage its own Python environment with uv
- **Override Python Interpreter**: use a specific interpreter

The full list is in the README (**Settings** section), or run "Scientific Data Viewer: Show Settings".

### Available Commands

Access via **Command Palette** (`Ctrl+Shift+P`):

- **Open Scientific Data Viewer**: Open a file in the data viewer
- **Refresh Python Environment**: Manually refresh the Python environment
- **Show Extension Logs**: View detailed extension logs
- **Show Settings**: Open Scientific Data Viewer settings

## 📁 Supported File Types

NetCDF, NASA CDF, HDF5, Zarr (folders and ZIP archives), GRIB, GeoTIFF / COG, JPEG-2000 and Kerchunk references (experimental). See the **Supported Formats** table in the README for the extensions and the Python packages each one needs.

## 🎨 Features

### Data Exploration

- **File structure** browsing
- **Variable inspection** with types and shapes
- **Dimension analysis** with sizes
- **Attribute viewing** for metadata

### Visualization

- **Plots** chosen by xarray from the variable's dimensions (experimental), with dimension slices, facets and colour controls

### Python Integration

- **Automatic** Python detection via Python extension API
- **Package management** with auto-installation
- **Environment** validation and status monitoring
- **Error handling** and user feedback
- **Real-time** interpreter change detection
- **Status bar** integration showing current interpreter

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Loading

```bash
# Check compilation
npm run compile

# Check for errors
npm run lint
```

#### Python Not Found

```bash
# Check Python installation
python3 --version

# Install required packages
pip install xarray netCDF4 zarr h5py numpy matplotlib
```

#### Data Not Loading

- **Check file format** is supported
- **Verify file permissions**
- **Try with sample data** first
- **Check Python packages** are installed

### Getting Help

1. **Check logs**: View → Output → "Scientific Data Viewer"
2. **Review documentation**: README.md and DEVELOPMENT.md
3. **Create issue**: GitHub Issues page
4. **Ask questions**: GitHub Discussions

## 🧪 Testing

### Run Tests

```bash
# Run all tests (from a VS Code terminal: env -u ELECTRON_RUN_AS_NODE npm test)
npm test

# Python backend
pytest python/tests
```

### Test with Sample Data

```bash
# Create test data (from the repository root)
python python/create_sample_data.py

# Test different file types
# - sample-data/sample_data.nc (NetCDF)
# - sample-data/sample_zarr_single_group_from_dataset.zarr (Zarr)
# - sample-data/sample_data.h5 (HDF5)
```

## 🚀 Development

### Watch Mode

```bash
# Auto-compile on changes
npm run watch
```

### Debugging

1. **Set breakpoints** in TypeScript files
2. **Press F5** to launch Extension Development Host
3. **Use debug console** to inspect variables

### Code Style

```bash
# Check code style
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

## 📦 Building

### Create Package

```bash
# Create .vsix package
npm run package
```

### Install Package

```bash
# Install the package locally for testing
code --install-extension scientific-data-viewer-<version>.vsix
```

Note: for Cursor users, the command seems to do nothing.
Try installing using the command palette: Ctrl+Shift+P,
then Extensions: Install from VSIX... and select the vsix file.
The extension should now be installed locally in Cursor.

## 🎉 Next Steps

### For Users

1. **Explore sample data** files
2. **Try different** visualization types
3. **Configure settings** for your workflow
4. **Report issues** or suggest features

### For Developers

1. **Read DEVELOPMENT.md** for detailed guide
2. **Check CONTRIBUTING.md** for contribution guidelines
3. **Review code structure** in src/ directory
4. **Add tests** for new features

### For Publishers

1. **Read PUBLISHING.md** for marketplace guide
2. **Test thoroughly** before publishing
3. **Update documentation** as needed
4. **Monitor user feedback**

## 📚 Additional Resources

- **README.md**: Complete documentation
- **DEVELOPMENT.md**: Development guide
- **CONTRIBUTING.md**: Contribution guidelines
- **PUBLISHING.md**: Publishing guide
- **CHANGELOG.md**: Version history

## 🤝 Support

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Documentation**: Comprehensive guides and examples

---

**Happy coding! 🚀**

If you encounter any issues or have questions, don't hesitate to reach out through GitHub Issues or Discussions.
