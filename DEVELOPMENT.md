# Development Guide - Scientific Data Viewer

This guide provides detailed instructions for developing, testing, and maintaining the Scientific Data Viewer VSCode extension.

## Prerequisites

### Required Software

- **Node.js 16+** and npm
- **Python 3.7+** with pip
- **VSCode** (latest stable version)
- **Git** for version control

### Required Python Packages

```bash
pip install xarray netCDF4 zarr h5py numpy matplotlib h5netcdf
```

## Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd scientific-data-viewer

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install xarray netCDF4 zarr h5py numpy matplotlib h5netcdf
```

### 2. Build the Extension

```bash
# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch
```

### 3. Run in Development Mode

1. Open the project in VSCode: `code .`
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VSCode window

## Project Architecture

### Core Components

```
src/
├── extension.ts          # Main entry point, command registration, custom editors
├── dataProcessor.ts      # Python integration, data processing
├── dataViewerPanel.ts    # Webview panel for data visualization
├── pythonManager.ts      # Advanced Python environment management
└── logger.ts             # Comprehensive logging utilities
```

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
# Run all tests
npm test

# Run specific test file
npx mocha out/test/suite/extension.test.js
```

#### Integration Testing

1. **Create sample data**:
   ```bash
   cd sample-data
   python python/create_sample_data.py
   ```

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

1. **Add print statements** to Python scripts in `dataProcessor.ts`
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
2. **Update CHANGELOG.md** with new features
3. **Run full test suite**
4. **Test with sample data files**
5. **Update documentation**

### Release

1. **Package extension**: `npm run package`
2. **Test .vsix file** locally
3. **Publish to marketplace**: `npm run publish`
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

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

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
