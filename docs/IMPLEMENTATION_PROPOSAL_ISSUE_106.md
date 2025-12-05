# Implementation: Issue #106 - Timestamp Variable Selection for CDF Files

## Overview

This document describes the **completed implementation** for adding timestamp variable selection and time range filtering capabilities for CDF files (and other xarray-supported formats), allowing users to plot variables with datetime on the x-axis and filter data by time ranges.

## Requirements Summary

1. ✅ **Detect datetime variables** in CDF files (and other formats)
2. ✅ **Allow selection of a datetime variable** to use as x-axis for plotting
3. ✅ **Provide time range controls** (start_datetime and end_datetime) to filter data
4. ✅ **Update plotting logic** to use selected datetime variable and apply time filtering
5. ✅ **Handle errors gracefully** and pass them back to the UI

## Architecture Changes

### 1. Python Backend (`python/get_data_info.py`)

#### 1.1 Modified `FileInfoResult` dataclass

Added a new field to track datetime variables with min/max values:

```python
@dataclass(frozen=True)
class FileInfoResult:
    # ... existing fields ...
    datetime_variables: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    # Format: {group_name: [{"name": var_name, "min": min_value, "max": max_value}, ...]}
```

#### 1.2 Added `is_datetime_variable()` function

Comprehensive datetime detection function that checks:
- `datetime64` dtype
- Dtype string containing 'datetime'
- CF-convention time coordinates (numeric with time units like "days since", "hours since", etc.)
- `standard_name="time"` attribute
- Common variable names ("time", "timestamp", "datetime", "date", "t") with units or standard_name

```python
def is_datetime_variable(var: xr.DataArray) -> bool:
    """Check if a variable is a datetime type."""
    # Check dtype for datetime64
    if np.issubdtype(var.dtype, np.datetime64):
        return True
    
    # Check if dtype string contains 'datetime'
    dtype_str = str(var.dtype)
    if "datetime" in dtype_str.lower():
        return True
    
    # Check for CF-convention time coordinates
    attrs = var.attrs
    if "units" in attrs:
        units = str(attrs["units"]).lower()
        if "since" in units and any(time_unit in units for time_unit in 
                                     ["day", "hour", "minute", "second", "year", "month"]):
            return True
    
    # Check for standard_name indicating time
    if "standard_name" in attrs and str(attrs["standard_name"]).lower() == "time":
        return True
    
    # Check if variable name suggests it's a time variable
    var_name_lower = str(var.name).lower() if hasattr(var, "name") else ""
    if var_name_lower in ["time", "timestamp", "datetime", "date", "t"]:
        if "units" in attrs or "standard_name" in attrs:
            return True
    
    return False
```

#### 1.3 Modified `get_file_info()` function

- Detects datetime variables from all groups (both coordinates and data variables)
- Computes min and max values for each datetime variable (in ISO format)
- Stores datetime variables with their min/max in the result
- Handles empty arrays gracefully (returns None for min/max)
- Catches exceptions when computing min/max and logs warnings

#### 1.4 Added `check_monotonicity()` function

Uses pandas Index methods for efficient monotonicity checking:

```python
def check_monotonicity(var: xr.DataArray) -> Literal["increasing", "decreasing", "non_monotonic"]:
    """Check if a variable is monotonic increasing, decreasing, or non-monotonic."""
    if var.size < 2:
        return "increasing"
    
    import pandas as pd
    index = pd.Index(var.values)
    
    if index.is_monotonic_increasing:
        return "increasing"
    elif index.is_monotonic_decreasing:
        return "decreasing"
    else:
        return "non_monotonic"
```

#### 1.5 Modified `create_plot()` function

**Key Features:**
- Accepts optional parameters: `datetime_variable_name`, `start_datetime`, `end_datetime`
- Handles datetime variable paths including group paths (e.g., "/time" or "group/time")
- Uses `.name` instead of `.stem` to preserve dots in variable names
- Supports cross-group datetime variables
- Checks monotonicity before using `.sel()` with slice
- Handles three cases:
  1. **Monotonic increasing**: Uses `slice(start_ts, end_ts)` directly
  2. **Monotonic decreasing**: Swaps start/end times to use `slice(end_ts, start_ts)`
  3. **Non-monotonic**: Falls back to boolean indexing with `isel()`
- Handles cases where datetime variable shares no common dimensions (logs warning, sets `datetime_var = None`)
- Verifies shape compatibility before plotting 1D time series
- Conditionally adds start/end time to plot suptitle only if datetime variable is actually used

**Implementation details:**

```python
# Parse datetime strings
start_ts = pd.Timestamp(start_datetime) if start_datetime else None
end_ts = pd.Timestamp(end_datetime) if end_datetime else None

# Handle datetime variable path (may include group path)
datetime_path = PurePosixPath(datetime_variable_name)
datetime_group_name = datetime_path.parent
datetime_var_name = datetime_path.name  # Use .name to preserve dots

# Get datetime variable (handles cross-group cases)
# ... (group resolution logic)

# Check if datetime is a coordinate
if datetime_var_name not in datetime_group.coords:
    # Use boolean indexing for non-coordinate datetime variables
    # ... (boolean mask logic)
else:
    # Check monotonicity before using .sel() with slice
    monotonicity = check_monotonicity(datetime_var)
    if monotonicity == "non_monotonic":
        # Fall back to boolean indexing
        # ... (boolean mask logic)
    else:
        # For monotonic decreasing, swap start and end times
        if monotonicity == "decreasing":
            slice_start = end_ts
            slice_end = start_ts
        else:
            slice_start = start_ts
            slice_end = end_ts
        
        var = var.sel({datetime_var_name: slice(slice_start, slice_end)})
        datetime_var = datetime_var.sel({datetime_var_name: slice(slice_start, slice_end)})
```

#### 1.6 Updated CLI argument parser

Added new optional arguments to the `plot` mode:

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

#### 2.1 Updated `DataInfoResult` interface

```typescript
export interface DataInfoResult {
  // ... existing fields ...
  datetime_variables?: { 
    [groupName: string]: Array<{ 
      name: string; 
      min?: string; 
      max?: string 
    }> 
  };
}
```

#### 2.2 Updated `CreatePlotRequest` interface

```typescript
export interface CreatePlotRequest {
  variable: string;
  plotType: string;
  datetimeVariableName?: string;
  startDatetime?: string;
  endDatetime?: string;
}
```

### 3. TypeScript Backend

#### 3.1 Modified `DataProcessor.createPlot()` method

Added optional datetime parameters and passes them to Python CLI:

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

// In implementation:
if (datetimeVariableName && datetimeVariableName.trim() !== '') {
    args.push('--datetime-variable', quoteIfNeeded(datetimeVariableName));
}
if (startDatetime && startDatetime.trim() !== '') {
    args.push('--start-datetime', quoteIfNeeded(startDatetime));
}
if (endDatetime && endDatetime.trim() !== '') {
    args.push('--end-datetime', quoteIfNeeded(endDatetime));
}
```

#### 3.2 Updated `UIController.handleCreatePlot()` method

Accepts datetime parameters from the request and passes them to `dataProcessor.createPlot()`.

#### 3.3 Updated `MessageBus.createPlot()` method

Updated signature to accept and forward datetime parameters.

### 4. UI Implementation

#### 4.1 HTML Generation (`src/panel/HTMLGenerator.ts`)

Added Time Controls subsection with:
- Datetime variable select dropdown
- Start time input (both `datetime-local` and text input)
- End time input (both `datetime-local` and text input)
- Clear button
- Hidden by default (shown only when datetime variables are found)

#### 4.2 JavaScript/Webview (`src/panel/webview/webview-script.js`)

**State Management:**
```javascript
const globalTimeControlsState = {
    datetimeVariableName: null,
    startDatetime: null,
    endDatetime: null,
    datetimeVarsMap: new Map(), // Map fullPath -> {name, fullPath, group, min, max}
};
```

**Key Functions:**
- `populateDatetimeVariables(data)`: Populates dropdown and stores min/max values. Hides time controls if no datetime variables found.
- `setupTimeControlsEventListeners()`: Sets up bidirectional binding between `datetime-local` and text inputs. Pre-fills min/max when datetime variable is selected.
- `convertDatetimeLocalToText()`: Converts "YYYY-MM-DDTHH:mm" to "YYYY-MM-DD HH:MM:SS"
- `convertTextToDatetimeLocal()`: Parses text input directly (avoids timezone conversion issues)
- `convertDatetimeLocalToISO()`: Converts to ISO format preserving local time (no UTC conversion)

**Timezone Handling:**
- All datetime conversions preserve local time without timezone shifts
- Text input parsing avoids `new Date()` constructor to prevent UTC interpretation
- ISO conversion formats directly without timezone conversion

#### 4.3 CSS Styling (`src/panel/webview/styles.css`)

Added comprehensive styling for time controls section, including:
- `.time-controls-section`: Container styling
- `.time-controls-row`: Flex layout for controls
- `.datetime-variable-select`, `.datetime-input`, `.datetime-text-input`: Input styling
- Focus states and VSCode theme integration

## Edge Cases Handled

### 1. Invalid Datetime Strings
- **Handling**: `pd.Timestamp()` raises exception, caught in try/except block
- **Result**: Returns `CreatePlotError` with descriptive message

### 2. Empty Datetime Arrays
- **Handling**: Size checks in `check_monotonicity()` and min/max computation
- **Result**: Returns "increasing" for empty/single-value arrays, None for min/max

### 3. Timezone Issues
- **Handling**: All UI conversions preserve local time, avoid `new Date()` timezone interpretation
- **Result**: No unexpected timezone shifts

### 4. Shape Mismatches
- **Handling**: Verified before plotting 1D time series (line 1177)
- **Result**: Falls back to default plotting with warning

### 5. Multiple Common Dimensions
- **Handling**: Uses `next(iter(common_dims))` to select first common dimension
- **Result**: Works correctly for typical time dimension scenarios

### 6. Start > End for Monotonic Decreasing
- **Handling**: After swapping, if user's start > end (from their perspective), slice returns empty
- **Result**: Correctly returns empty plot (expected behavior)

### 7. Empty Result After Filtering
- **Handling**: xarray/matplotlib handle empty arrays gracefully
- **Result**: Empty plot displayed (no crash)

### 8. Datetime Variable with NaN Values
- **Handling**: pandas Index methods handle NaN values appropriately
- **Result**: Monotonicity check works correctly

### 9. CF-Convention Time Variables
- **Handling**: Detected by `is_datetime_variable()`, rely on xarray's `decode_cf=True`
- **Result**: Properly detected and handled

### 10. Variable Names with Dots
- **Handling**: Uses `PurePosixPath.name` instead of `.stem` to preserve dots
- **Result**: Variable names like "temperature.hourly" are preserved correctly

### 11. Cross-Group Datetime Variables
- **Handling**: Resolves group path, retrieves datetime variable from correct group
- **Result**: Works for datetime variables in different groups than plotted variable

### 12. Non-Monotonic Datetime
- **Handling**: Detected by `check_monotonicity()`, falls back to boolean indexing
- **Result**: Correctly filters non-monotonic time data

### 13. Monotonic Decreasing Datetime
- **Handling**: Detected, swaps start/end times for slice
- **Result**: Correctly filters decreasing time sequences

### 14. No Common Dimensions
- **Handling**: Checks for common dimensions, logs warning, sets `datetime_var = None`
- **Result**: Plot proceeds without datetime (no crash)

### 15. Datetime Variable Not Found
- **Handling**: Checks existence in coords and data_vars, returns error if not found
- **Result**: Returns `CreatePlotError` with descriptive message

### 16. No Datetime Variables in File
- **Handling**: Time controls section is hidden
- **Result**: Clean UI, no confusion

## Error Handling

### Python Backend

- ✅ Invalid datetime strings: Caught by `pd.Timestamp()`, returns `CreatePlotError`
- ✅ Datetime variable not found: Returns `CreatePlotError` with descriptive message
- ✅ Datetime range out of bounds: Returns empty plot (handled by xarray)
- ✅ No common dimensions: Logs warning, continues without datetime
- ✅ Shape mismatches: Logs warning, falls back to default plotting
- ✅ Empty arrays: Handled gracefully throughout

### Frontend

- ✅ Invalid datetime formats: Text input parsing returns empty string if invalid
- ✅ No datetime variables: Time controls section is hidden
- ✅ Error messages: Displayed in plot error containers
- ✅ State synchronization: Bidirectional binding ensures consistency

## Testing Considerations

1. ✅ **CDF files with datetime variables**: Tested with sample CDF files
2. ✅ **Files without datetime variables**: Time controls hidden, works as before
3. ✅ **Invalid datetime strings**: Returns error message
4. ✅ **Datetime ranges outside data bounds**: Returns empty plot
5. ✅ **Monotonic decreasing datetime**: Correctly swaps start/end
6. ✅ **Non-monotonic datetime**: Falls back to boolean indexing
7. ✅ **Cross-group datetime variables**: Correctly resolves and uses
8. ✅ **Variable names with dots**: Preserved correctly
9. ✅ **Timezone handling**: No unexpected shifts
10. ✅ **"Plot All" functionality**: Passes datetime parameters to all plots
11. ✅ **Text input and datetime-local binding**: Bidirectional sync works
12. ✅ **Min/max pre-filling**: Works when selecting datetime variable

## Implementation Status

✅ **COMPLETED** - All requirements have been implemented and tested.

## Key Improvements Over Original Proposal

1. **Enhanced datetime detection**: Added CF-convention support and common name detection
2. **Min/max computation**: Provides helpful defaults for time range inputs
3. **Monotonicity handling**: Properly handles increasing, decreasing, and non-monotonic data
4. **Cross-group support**: Works with datetime variables in different groups
5. **Bidirectional input binding**: Both datetime-local and text inputs with sync
6. **Timezone preservation**: No unexpected timezone conversions
7. **Comprehensive error handling**: Handles all edge cases gracefully
8. **Conditional suptitle**: Only shows start/end time if datetime is actually used
9. **Variable name preservation**: Handles dots in variable names correctly

## Future Enhancements

1. Support for relative time ranges (e.g., "last 24 hours")
2. Support for multiple datetime variables selection
3. Timezone-aware datetime handling (explicit timezone support)
4. Validation for start_datetime > end_datetime (currently handled by empty result)
5. Performance optimization for large datetime arrays
6. Support for irregular time grids with interpolation

## Notes

- The implementation works for all xarray-supported formats, not just CDF files
- The time filtering uses xarray's `.sel()` method with slice notation for monotonic data, and boolean indexing for non-monotonic data
- Datetime pickers use native HTML5 `datetime-local` input type for better UX
- Text inputs allow users to paste dates in various formats
- Error messages are clear and actionable for users
- The implementation is robust and handles all identified edge cases
