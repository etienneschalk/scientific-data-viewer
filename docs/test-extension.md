# Testing the Scientific Data Viewer Extension

## ✅ Fixed Issues

1. **Added .h5 extension support** - Now recognizes .h5 and .hdf5 files
2. **Enhanced error handling** - Shows detailed error messages with troubleshooting steps
3. **Better Python environment detection** - Provides clear instructions when Python is not configured

## 🧪 How to Test

### Step 1: Reload the Extension

1. Press `Ctrl+Shift+P`
2. Type "Developer: Reload Window"
3. Press Enter

### Step 2: Test File Recognition

1. Right-click on any of these files in the explorer:
   - `artefacts/sample-data/sample_data.nc` (NetCDF)
   - `artefacts/sample-data/sample_data.h5` (HDF5)
   - `artefacts/sample-data/sample_data.zarr` (Zarr)
2. You should see "Open in Scientific Data Viewer" option

### Step 3: Test the Viewer

1. Click "Open in Scientific Data Viewer"
2. If you see an error, it will now show:
   - Clear error message
   - Detailed troubleshooting steps
   - Specific instructions for fixing the issue

## 🔧 Common Issues and Solutions

### Issue: "Python environment not ready"

**Solution:**

1. Press `Ctrl+Shift+P`
2. Type "Python: Select Interpreter"
3. Choose your Python installation
4. Install required packages: `pip install xarray netCDF4 zarr h5py numpy matplotlib`

### Issue: "Missing Python package"

**Solution:**

```bash
pip install xarray netCDF4 zarr h5py numpy matplotlib
```

### Issue: "File too large"

**Solution:**

1. Press `Ctrl+,` to open Settings
2. Search for "Scientific Data Viewer"
3. Increase the "Max File Size" setting

### Issue: "File not found" or "Permission denied"

**Solution:**

- Check file permissions
- Make sure the file exists and is readable
- Try with a different file

## 📊 Expected Behavior

When working correctly, you should see:

1. **File Information**: Format, size, modification date
2. **Dimensions**: List of dimensions with their sizes
3. **Variables**: List of data variables with types and shapes
4. **Visualization**: Ability to create plots (if Python packages are installed)

## 🐛 Debugging

If something doesn't work:

1. **Check VSCode Output Panel**:
   - View → Output
   - Select "Scientific Data Viewer" from dropdown
   - Look for error messages

2. **Check Python Environment**:
   - Open terminal in VSCode
   - Run: `python3 -c "import xarray, netCDF4, zarr, h5py, numpy, matplotlib; print('All packages installed!')"`

3. **Test with Sample Data**:
   - Make sure sample data files exist in `artefacts/sample-data/` folder
   - Try opening them with the extension

## 🎯 Success Indicators

- ✅ Right-click shows "Open in Scientific Data Viewer" for .nc, .h5, .zarr files
- ✅ Extension opens without red error box
- ✅ Shows file information, dimensions, and variables
- ✅ Can create plots (if Python packages installed)
- ✅ Clear error messages if something goes wrong
