# Scientific Data Viewer v0.8.2 Release Notes

## Package availability check fix (Issue #118 follow-up)

Some users on Windows using the extension's own (uv) environment still saw "Invalid response format" and "Python environment not ready" after the 0.8.1 fix. This release further hardens the package check so the extension always receives valid output and surfaces real errors.

### What's fixed

- **Empty stdout**: The package-check script now forces line-buffered stdout and the extension runs Python with `PYTHONUNBUFFERED=1`, so piped output is not lost to buffering.
- **Exceptions before print**: If the script hits any error before writing the result, it now prints a JSON error object (`{"_error": "..."}`) and the traceback to stderr, so the extension can show a clear error instead of "Invalid response format."
- **Debugging**: When the script returns empty stdout, the extension logs stderr so you can see the Python traceback in the logs. The full executed command line is also logged for every Python script run, so you can copy-paste it to reproduce issues locally.

### Upgrading

No action required. If you were affected by the empty package-check output on Windows with "use extension own environment," updating to 0.8.2 should resolve it; if not, the new logging will make it easier to diagnose.
