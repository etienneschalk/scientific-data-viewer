# Scientific Data Viewer v0.9.0 Release Notes

## Time Controls off by default — use Dimension Slices instead

The former **time dimension selection** (Global Time Controls and Group Time Controls: datetime variable dropdown, start/end time inputs) is now **disabled by default**. In its place, the extension encourages the **Dimension Slices** feature: you can subset any dimension—including time—by index or slice (e.g. `0:24:2`, `100:120`) in the Dimension Slices section. Slices are applied as xarray’s `isel()` and work the same for time and other dimensions, without separate datetime handling. If you prefer the old datetime start/end UI, turn **Global Time Controls** and/or **Group Time Controls** back on in VS Code settings.

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

## Global and Group Plot Controls

Plot controls are improved for multi-group datasets (e.g. Zarr with many groups each having `time`, `lat`, `lon`), and you can optionally use **per-group** controls for finer control.

### Global Plot Controls

- **Time Controls**: Datetime variables are **deduplicated by name** and **sorted**. If every group has a `"time"` coordinate, the dropdown shows a single “time” option instead of one per group.
- **Dimension Slices**: Dimensions are now **merged from all groups**, not only the root. For Zarr products where the root group has no dimensions, the Dimension Slices section shows dimensions from subgroups (e.g. `time`, `lat`, `lon`) and you can slice and facet as before.

### Group Plot Controls

For each group, a collapsible **Group Plot Controls** section appears after that group’s Attributes. It is scoped to that group only:

- **Group Time Controls**: Datetime variable select, start/end time, and Clear, using only that group’s datetime variables (deduplicated and sorted).
- **Group Dimension Slices**: One row per dimension in that group, facet row/col dropdowns, and Clear.

When you plot a variable (single plot or Plot All), the extension uses **group-scoped** time and dimension-slice values if they are set for that variable’s group; otherwise it falls back to the **global** Time Controls and Dimension Slices.

**Precedence when both are set:** Group controls have **full precedence** over global for that group's variables. The extension does **not** merge global and group: for each of dimension slices, facet row, facet col, and bins, it uses either the group value or the global value. If the group has any value set for that field (e.g. one dimension slice or facet row in Group Dimension Slices), the entire group state for that field is used and the global state is ignored. If the group has nothing set, global is used. So setting both Global and Group Dimension Slices means "use only the group's values" when plotting a variable in that group.

### Feature flags

Four settings let you enable or disable each block:

- **Global Time Controls** (`scientificDataViewer.globalTimeControls`) — **OFF by default** (use Dimension Slices for time instead)
- **Global Dimension Slices** (`scientificDataViewer.globalDimensionSlices`) — ON by default
- **Group Time Controls** (`scientificDataViewer.groupTimeControls`) — **OFF by default**
- **Group Dimension Slices** (`scientificDataViewer.groupDimensionSlices`) — ON by default

Turn Time Controls back on in VS Code settings (or `.vscode/settings.json`) if you want the datetime start/end UI; turn any block off if you prefer a simpler UI.

## Log full command for copy-paste (Issue #121)

When the extension runs a Python script (e.g. package availability check or data info), it now logs the full one-line command so you can copy-paste it into a terminal to run the same command manually. This helps when debugging environment or path issues (e.g. on Windows).

- In the extension logs, look for the line:
  `🐍 📜 Full command (copy-paste): <pythonPath> <scriptPath> <args...>`

### Upgrading

After updating to 0.9.0, **Global Time Controls** and **Group Time Controls** are off by default—use **Dimension Slices** to subset time and other dimensions (e.g. `0:24:2`). You can re-enable Time Controls in settings if you prefer the datetime start/end UI. Dimension Slices and small variable/coordinate values are shown when a file is loaded; for multi-group datasets, dimensions merge across groups and each group has an optional Group Plot Controls section. Use the four settings to enable or disable each block.
