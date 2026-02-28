# Scientific Data Viewer v0.9.0 Release Notes

## Scalar and small array values displayed (Issue #102)

Variables and coordinates that are small (at or below 1000 bytes) now show their actual values in the UI instead of only shape, dtype, and size. This helps when you have single-value coordinates (e.g. time left after interpolation) or small metadata arrays.

- Values are loaded and displayed in the variable/coordinate details (truncated to 500 characters if long).
- No configuration required; the threshold is fixed for this release.

## Dimension slices and faceting for plotting (Issue #117)

You can subset data by dimension index or slice before plotting, and control faceted plot axes (row/col).

### Dimension Slices

- In the **Dimension Slices** section (below Time Controls in the plot controls area), each dimension of the dataset gets a text input.
- Use Python slice syntax:
  - Single index: `130`
  - Range: `100:120` (start:stop)
  - Range with step: `0:24:2` (start:stop:step)
- Slices are applied as xarray’s `isel()` before any time filtering and before plotting. Invalid slice strings produce a clear error.

### Facet row / Facet col

- **Facet row** and **Facet col** dropdowns let you choose which dimension is used for rows and columns in faceted plots (e.g. 3D/4D imshow with multiple panels).
- If not set, the extension keeps its default behavior (first/second dimension).

## Log full command for copy-paste (Issue #121)

When the extension runs a Python script (e.g. package availability check or data info), it now logs the full one-line command so you can copy-paste it into a terminal to run the same command manually. This helps when debugging environment or path issues (e.g. on Windows).

- In the extension logs, look for the line:  
  `🐍 📜 Full command (copy-paste): <pythonPath> <scriptPath> <args...>`

### Upgrading

No special steps. After updating to 0.9.0 you’ll see the new Dimension Slices section when a file is loaded, and small variables/coordinates will show values where applicable.
