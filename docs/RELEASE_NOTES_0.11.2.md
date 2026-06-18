# Scientific Data Viewer v0.11.2 Release Notes

**TL;DR** — NetCDF files with invalid CF datetime `units` no longer block the viewer: the backend retries with `decode_cf=False` and the File Information section labels degraded mode.

## Degraded mode for broken CF time units ([#136](https://github.com/etienneschalk/scientific-data-viewer/issues/136))

Some NetCDF files ship variables whose `units` attribute looks like a time axis but cannot be parsed (e.g. `(days since 2000-01-01 00:00:00)-1`). With default xarray settings, `open_datatree` raises:

`ValueError: unable to decode time units ...`

**Behaviour in 0.11.2**

1. Open with `decode_cf=True` (unchanged default).
2. If that specific error occurs, log a warning and reopen with `decode_cf=False`.
3. In the webview **File Information** section, show: **Mode: degraded (decode_cf=False)**.

Plotting uses the same open path, so plots work on these files as well (raw numeric values, no decoded datetimes).

## Manual test file

After running `python/create_sample_data.py` (or `setup.sh`), open:

`sample-data/broken_datetime_variable.nc`

You should see the degraded-mode cue and the `delta` variable metadata.
