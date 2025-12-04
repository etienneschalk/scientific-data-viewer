# Implementation Proposal: Issue #106 - Timestamp Variable Selection for CDF Files

## Overview

This proposal outlines the implementation for adding timestamp variable selection and time range filtering capabilities for CDF files, allowing users to plot variables with datetime on the x-axis and filter data by time ranges.

## Requirements Summary

1. **Detect datetime variables** in CDF files (and potentially other formats)
2. **Allow selection of a datetime variable** to use as x-axis for plotting
3. **Provide time range controls** (start_datetime and end_datetime) to filter data
4. **Update plotting logic** to use selected datetime variable and apply time filtering
5. **Handle errors gracefully** and pass them back to the UI

## Architecture Changes

### 1. Python Backend (`python/get_data_info.py`)

#### 1.1 Modify `FileInfoResult` dataclass

Add a new field to track datetime variables:

```python
@dataclass(frozen=True)
class FileInfoResult:
    # ... existing fields ...
    datetime_variables: Dict[str, List[str]] = field(default_factory=dict)
    # Format: {group_name: [list of datetime variable names]}
```

#### 1.2 Add datetime detection function

```python
def is_datetime_variable(var: xr.DataArray) -> bool:
    """Check if a variable is a datetime type.

    Parameters
    ----------
    var : xr.DataArray
        Variable to check

    Returns
    -------
    bool
        True if variable is datetime type
    """
    # Check dtype for datetime64
    if np.issubdtype(var.dtype, np.datetime64):
        return True

    # Check if dtype string contains 'datetime'
    dtype_str = str(var.dtype)
    if 'datetime' in dtype_str.lower():
        return True

    return False
```

#### 1.3 Modify `get_file_info()` function

- Add optional parameters: `datetime_variable_name: Optional[str] = None`, `start_datetime: Optional[str] = None`, `end_datetime: Optional[str] = None`
- Detect and collect datetime variables from all groups
- Store datetime variables in the result
- Note: Time filtering will be applied during plotting, not during info extraction

#### 1.4 Modify `create_plot()` function

- Add optional parameters: `datetime_variable_name: Optional[str] = None`, `start_datetime: Optional[str] = None`, `end_datetime: Optional[str] = None`
- When `datetime_variable_name` is provided:
  - Load the datetime variable from the dataset
  - Parse `start_datetime` and `end_datetime` using `pd.Timestamp` (if provided)
  - Use xarray's `.sel()` method with slice notation to filter the data by time range
  - If the datetime variable is a coordinate, use `.sel()` directly on that coordinate
  - If the datetime variable is a data variable that shares a dimension with the plotted variable, set it as a coordinate first, then use `.sel()`
  - Example implementation:

    ```python
    import pandas as pd

    # Parse datetime strings
    start_ts = pd.Timestamp(start_datetime) if start_datetime else None
    end_ts = pd.Timestamp(end_datetime) if end_datetime else None

    # Get the datetime variable
    datetime_var = group[datetime_variable_name]

    # If datetime variable is not a coordinate but shares a dimension with var,
    # we can set it as a coordinate temporarily or use boolean indexing
    if datetime_variable_name not in group.coords:
        # Find common dimension
        common_dims = set(var.dims) & set(datetime_var.dims)
        if common_dims:
            dim_name = list(common_dims)[0]
            # Create boolean mask for time range filtering
            if start_ts and end_ts:
                mask = (datetime_var >= start_ts) & (datetime_var <= end_ts)
            elif start_ts:
                mask = datetime_var >= start_ts
            elif end_ts:
                mask = datetime_var <= end_ts
            else:
                mask = None

            if mask is not None:
                var = var.isel({dim_name: mask})
                datetime_var = datetime_var.isel({dim_name: mask})
    else:
        # Use .sel() if datetime is a coordinate
        # slice() accepts None for start/end, so a single call handles all cases
        var = var.sel({datetime_variable_name: slice(start_ts, end_ts)})
        datetime_var = datetime_var.sel({datetime_variable_name: slice(start_ts, end_ts)})
    ```

  - When plotting, use the datetime variable values for the x-axis
  - Apply matplotlib date formatting to x-axis using `matplotlib.dates.DateFormatter`

#### 1.5 Update CLI argument parser

Add new optional arguments to the `plot` mode:

```python
parser.add_argument(
    "--datetime-variable",
    default=None,
    help="Name of datetime variable to use as x-axis"
)
parser.add_argument(
    "--start-datetime",
    default=None,
    help="Start datetime for filtering (ISO format string)"
)
parser.add_argument(
    "--end-datetime",
    default=None,
    help="End datetime for filtering (ISO format string)"
)
```

### 2. TypeScript Types (`src/types.ts`)

#### 2.1 Update `DataInfoResult` interface

```typescript
export interface DataInfoResult {
  // ... existing fields ...
  datetime_variables?: { [groupName: string]: string[] };
}
```

#### 2.2 Update `CreatePlotRequest` interface (if exists)

```typescript
export interface CreatePlotRequest {
  variable: string;
  plotType: string;
  datetimeVariableName?: string;
  startDatetime?: string;
  endDatetime?: string;
}
```

### 3. TypeScript Backend (`src/python/DataProcessor.ts`)

#### 3.1 Modify `createPlot()` method

Add optional datetime parameters:

```typescript
async createPlot(
    uri: vscode.Uri,
    variable: string,
    plotType: string = 'auto',
    convertBandsToVariables: boolean = false,
    datetimeVariableName?: string,
    startDatetime?: string,
    endDatetime?: string,
): Promise<CreatePlotPythonResponse | null>
```

Update the args array to include these parameters when provided:

```typescript
if (datetimeVariableName) {
  args.push('--datetime-variable', quoteIfNeeded(datetimeVariableName));
}
if (startDatetime) {
  args.push('--start-datetime', quoteIfNeeded(startDatetime));
}
if (endDatetime) {
  args.push('--end-datetime', quoteIfNeeded(endDatetime));
}
```

### 4. UI Controller (`src/panel/UIController.ts`)

#### 4.1 Modify `handleCreatePlot()` method

Accept datetime parameters from the request and pass them to `dataProcessor.createPlot()`:

```typescript
private async handleCreatePlot(
    request: CreatePlotRequest,
): Promise<CreatePlotResponse> {
    // ... existing code ...
    const plotData = await this.dataProcessor.createPlot(
        fileUri,
        request.variable,
        request.plotType,
        convertBandsToVariables,
        request.datetimeVariableName,
        request.startDatetime,
        request.endDatetime,
    );
    // ... rest of the code ...
}
```

### 5. Message Bus (`src/panel/communication/MessageBus.ts`)

#### 5.1 Update `createPlot()` method

```typescript
async createPlot(
    variable: string,
    plotType: string,
    datetimeVariableName?: string,
    startDatetime?: string,
    endDatetime?: string,
): Promise<string> {
    return this.sendRequest(COMMANDS.CREATE_PLOT, {
        variable,
        plotType,
        datetimeVariableName,
        startDatetime,
        endDatetime,
    });
}
```

### 6. HTML Generation (`src/panel/HTMLGenerator.ts`)

#### 6.1 Modify `generatePlottingSections()` method

Add Time Controls subsection:

```typescript
static generatePlottingSections(): string {
    return /*html*/ `
    <div class="info-section">
        <details class="sticky-group-details" id="section-global-plot-controls">
            <summary><h3>Global Plot Controls</h3></summary>
            <div class="global-plot-controls">
                <button id="createAllPlotsButton" class="plot-control-button" title="Not optimized for large datasets, can cause crashes">⚠️ Plot All</button>
                <button id="resetAllPlotsButton" class="plot-control-button">Reset All Plots</button>
                <button id="saveAllPlotsButton" class="plot-control-button">Save All Plots</button>
            </div>
            <div id="createAllPlotsProgress" class="plot-progress hidden">
                Progress: 0/0 (0%)
            </div>

            <!-- Time Controls Subsection -->
            <div class="time-controls-section">
                <h4>Time Controls</h4>
                <div class="time-controls-row">
                    <label for="datetimeVariableSelect">Select Datetime Variable:</label>
                    <select id="datetimeVariableSelect" class="datetime-variable-select">
                        <option value="">None (use record number)</option>
                        <!-- Options will be populated dynamically -->
                    </select>
                </div>
                <div class="time-controls-row">
                    <label for="startDatetimeInput">Start Time:</label>
                    <input type="datetime-local" id="startDatetimeInput" class="datetime-input" />
                </div>
                <div class="time-controls-row">
                    <label for="endDatetimeInput">End Time:</label>
                    <input type="datetime-local" id="endDatetimeInput" class="datetime-input" />
                </div>
                <div class="time-controls-row">
                    <button id="clearTimeControlsButton" class="plot-control-button">Clear Time Controls</button>
                </div>
            </div>
        </details>
    </div>`;
}
```

### 7. JavaScript/Webview (`src/panel/webview/webview-script.js`)

#### 7.1 Add state management for time controls

```javascript
const globalTimeControlsState = {
  datetimeVariableName: null,
  startDatetime: null,
  endDatetime: null,
};
```

#### 7.2 Populate datetime variable select

In `displayDataInfo()` function, after data is loaded:

```javascript
function populateDatetimeVariables(data) {
  const select = document.getElementById('datetimeVariableSelect');
  if (!select) return;

  // Clear existing options except "None"
  select.innerHTML = '<option value="">None (use record number)</option>';

  if (!data.result || !data.result.datetime_variables) {
    return;
  }

  // Collect all datetime variables from all groups
  const datetimeVars = [];
  for (const [groupName, vars] of Object.entries(
    data.result.datetime_variables,
  )) {
    for (const varName of vars) {
      const fullPath = groupName === '/' ? varName : `${groupName}/${varName}`;
      datetimeVars.push({
        name: varName,
        fullPath: fullPath,
        group: groupName,
      });
    }
  }

  // Add options
  datetimeVars.forEach(({ name, fullPath }) => {
    const option = document.createElement('option');
    option.value = fullPath;
    option.textContent = name;
    select.appendChild(option);
  });
}
```

#### 7.3 Add event listeners for time controls

```javascript
function setupTimeControlsEventListeners() {
  const datetimeSelect = document.getElementById('datetimeVariableSelect');
  const startInput = document.getElementById('startDatetimeInput');
  const endInput = document.getElementById('endDatetimeInput');
  const clearButton = document.getElementById('clearTimeControlsButton');

  if (datetimeSelect) {
    datetimeSelect.addEventListener('change', (e) => {
      globalTimeControlsState.datetimeVariableName = e.target.value || null;
    });
  }

  if (startInput) {
    startInput.addEventListener('change', (e) => {
      globalTimeControlsState.startDatetime = e.target.value || null;
    });
  }

  if (endInput) {
    endInput.addEventListener('change', (e) => {
      globalTimeControlsState.endDatetime = e.target.value || null;
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      globalTimeControlsState.datetimeVariableName = null;
      globalTimeControlsState.startDatetime = null;
      globalTimeControlsState.endDatetime = null;
      if (datetimeSelect) datetimeSelect.value = '';
      if (startInput) startInput.value = '';
      if (endInput) endInput.value = '';
    });
  }
}
```

#### 7.4 Update `handleCreateVariablePlot()` function

```javascript
async function handleCreateVariablePlot(variable) {
  // ... existing code ...

  // Get time control values
  const datetimeVariableName = globalTimeControlsState.datetimeVariableName;
  const startDatetime = globalTimeControlsState.startDatetime;
  const endDatetime = globalTimeControlsState.endDatetime;

  try {
    const plotData = await messageBus.createPlot(
      variable,
      plotType,
      datetimeVariableName,
      startDatetime,
      endDatetime,
    );
    displayVariablePlot(variable, plotData);
  } catch (error) {
    // ... error handling ...
  }
}
```

#### 7.5 Update `handleCreateAllPlots()` function

Similar updates to pass datetime parameters to all plot requests.

#### 7.6 Add datetime conversion helper

```javascript
function convertDatetimeLocalToISO(datetimeLocal) {
  // datetime-local format: "YYYY-MM-DDTHH:mm"
  // Need to convert to ISO format for Python
  if (!datetimeLocal) return null;

  // Add seconds if not present
  let isoString = datetimeLocal;
  if (!isoString.includes(':')) {
    isoString += ':00';
  }

  // Ensure we have proper format
  return new Date(isoString).toISOString();
}
```

### 8. CSS Styling (`src/panel/webview/styles.css`)

#### 8.1 Add styles for time controls

```css
.time-controls-section {
  margin-top: 20px;
  padding: 15px;
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
}

.time-controls-section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: var(--vscode-foreground);
}

.time-controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.time-controls-row label {
  min-width: 180px;
  color: var(--vscode-foreground);
}

.datetime-variable-select,
.datetime-input {
  flex: 1;
  background-color: var(--vscode-dropdown-background);
  color: var(--vscode-dropdown-foreground);
  border: 1px solid var(--vscode-dropdown-border);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

.datetime-variable-select:focus,
.datetime-input:focus {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: -1px;
}
```

## Implementation Steps

1. **Phase 1: Python Backend**
   - Add datetime detection function
   - Modify `get_file_info()` to detect and return datetime variables
   - Modify `create_plot()` to accept datetime parameters and implement filtering
   - Update CLI argument parser
   - Test with sample CDF files

2. **Phase 2: TypeScript Types and Backend**
   - Update type definitions
   - Modify `DataProcessor` methods
   - Update `UIController` to pass parameters
   - Update `MessageBus` interface

3. **Phase 3: UI Implementation**
   - Update HTML generation
   - Add JavaScript event handlers
   - Add CSS styling
   - Test UI interactions

4. **Phase 4: Integration and Testing**
   - End-to-end testing with CDF files
   - Error handling validation
   - Edge case testing (empty ranges, invalid datetimes, etc.)

## Error Handling

### Python Backend

- Validate datetime strings using `pd.Timestamp` with try/except
- Return `CreatePlotError` with descriptive error messages
- Handle cases where datetime variable doesn't exist
- Handle cases where datetime range is out of bounds (return empty plot)

### Frontend

- Display error messages in plot error containers
- Validate datetime inputs before sending requests
- Show user-friendly error messages for invalid datetime formats

## Testing Considerations

1. **Test with CDF files containing datetime variables**
2. **Test with files without datetime variables** (should work as before)
3. **Test with invalid datetime strings** (should show error)
4. **Test with datetime ranges outside data bounds** (should return empty plot)
5. **Test with start_datetime > end_datetime** (should show error)
6. **Test "Plot All" functionality with time controls**

## Future Enhancements

1. Support for other datetime formats (not just datetime64)
2. Support for time zone handling
3. Support for relative time ranges (e.g., "last 24 hours")
4. Support for multiple datetime variables selection
5. Extend to other file formats (NetCDF, etc.)

## Notes

- The implementation focuses on CDF files as specified in the issue, but the datetime detection can work for any format that xarray supports
- The time filtering uses xarray's `.sel()` method with slice notation, which is the idiomatic xarray approach for time-based selection
- Datetime pickers use native HTML5 `datetime-local` input type for better UX
- Error messages should be clear and actionable for users
- When a datetime variable is selected but is not already a coordinate, it will need to be set as a coordinate or used with `.swap_dims()` to enable proper time-based selection
