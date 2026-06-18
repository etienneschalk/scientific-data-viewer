# Scientific Data Viewer v0.11.2 Release Notes

**TL;DR** — Degraded `decode_cf` fallback for broken CF time units ([#136](https://github.com/etienneschalk/scientific-data-viewer/issues/136)); HTML-escaped attribute values for compound dtypes ([#137](https://github.com/etienneschalk/scientific-data-viewer/issues/137)).

## Degraded mode for broken CF time units ([#136](https://github.com/etienneschalk/scientific-data-viewer/issues/136))

Some NetCDF files ship variables whose `units` attribute looks like a time axis but cannot be parsed (e.g. `(days since 2000-01-01 00:00:00)-1`). With default xarray settings, `open_datatree` raises:

`ValueError: unable to decode time units ...`

**Behaviour in 0.11.2**

1. Open with `decode_cf=True` (unchanged default).
2. If that specific error occurs, log a warning and reopen with `decode_cf=False`.
3. In the webview **File Information** section, show: **Mode: degraded (decode_cf=False)**.

Plotting uses the same open path, so plots work on these files as well (raw numeric values, no decoded datetimes).

**Manual test:** `sample-data/broken_datetime_variable.nc`

## Attribute display: escape HTML special characters ([#137](https://github.com/etienneschalk/scientific-data-viewer/issues/137))

Compound / structured dtypes (NumPy [structured arrays](https://numpy.org/doc/stable/user/basics.rec.html), NetCDF [user-defined types](https://docs.unidata.ucar.edu/netcdf-c/4.9.3/user_defined_types.html)) expose encoding metadata whose string form contains `<` (e.g. `'<i4'`). Unescaped values were parsed as HTML tags, so the visible attribute text was truncated at the first angle bracket while the `title` tooltip stayed correct.

Flat attribute rows (group, variable, coordinate) now use the existing webview `escapeHtml()` helper.

**Manual test:** `sample-data/compound_dtype_variable.nc` — expand variable **`pets`** → **`__xarray_encoding.dtype`**; the full dtype string should display.
