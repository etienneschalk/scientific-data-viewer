# Pull Request: Release 0.8.1 – .grb2 support, uv reinstall fix, Windows package check fix

## Summary

This PR bundles three fixes and one feature for release 0.8.1:

- **#116** – Add support for the `.grb2` file extension (GRIB2).
- **#115** – Fix extension own environment (uv) failing after uninstall/reinstall when an existing env remains.
- **#118** – Fix uv standalone environment / package availability check failing on Windows (“Invalid response format”).

Closes #116, #115, #118.

---

## Issue #116 – Support for .grb2 extension

### Summary

Adds support for the `.grb2` file extension so that GRIB2 files using this extension can be opened in the Scientific Data Viewer.

### Changes

- **package.json** – Added `.grb2` to explorer context menu `when` clauses, GRIB language `extensions`, and GRIB Data Viewer custom editor `selector`; version set to `0.8.1`.
- **src/panel/webview/webview-script.js** – Added `'.grb2'` to `SUPPORTED_EXTENSIONS_HARDOCDED`.
- **python/get_data_info.py** – Added `".grb2"` to `SupportedExtensionType`, `SUPPORTED_EXTENSIONS`, `FORMAT_ENGINE_MAP` (cfgrib), and `FORMAT_DISPLAY_NAMES` (GRIB2).
- **Docs** – CHANGELOG, README, blog-article, release notes (including new `RELEASE_NOTES_0.8.1.md`), and older release notes updated for GRIB extension lists.
- **test/suite/extension.test.ts** – Assertion that GRIB language contribution includes `.grb2`.

---

## Issue #115 – uv env creation when path already exists (reinstall)

### Summary

When “use extension own environment” (uv) is enabled and the user uninstalls then reinstalls the extension, a previous uv virtual environment can still exist at the same globalStorage path. The extension then failed to create the env because `uv venv` reported “A virtual environment already exists at … Use `--clear` to replace it”.

### Solution

Pass `--clear` to `uv venv` when creating the extension virtual environment so an existing env at that path is replaced instead of causing failure.

### Changes

- **src/python/ExtensionVirtualEnvironmentManager.ts** – In `uvCreateVirtualEnvironment()`, add `'--clear'` to the `uv venv` spawn arguments; comment added to document the reinstall case.
- **CHANGELOG.md** – “Fixed” entry under [0.8.1] for Issue #115.

---

## Issue #118 – uv standalone environment / package check on Windows

### Summary

On Windows 0.8.0, with “use extension own environment” (uv) enabled, the extension could report “Invalid response format from package availability check” and “Python environment not ready! Missing core packages: xarray” even after the uv env and packages were created successfully. The package availability script’s JSON output was not being received correctly by the Node side when stdout was piped.

### Root cause

When stdout is connected to a pipe (e.g. Node spawning Python), Windows uses full buffering. The script’s small JSON output could stay in the buffer and not be flushed before the process exited, so the parent received empty or incomplete stdout and JSON parsing failed.

### Solution

1. **python/check_package_availability.py** – Use `print(json.dumps(availability), flush=True)` so output is flushed to the pipe on Windows.
2. **src/python/PythonManager.ts** – In `executePythonFileUnchecked`, normalize stdout before `JSON.parse`: strip UTF-8 BOM and trim whitespace. In `checkPackagesAvailability`, if the result is a string (parse had failed), try parsing the trimmed/BOM-stripped string and use the result if it is a valid object (belt-and-suspenders for BOM/whitespace).
3. **Debug logging** – Log raw package-check result type and preview, and log stdout when JSON parse fails, to simplify future diagnosis (e.g. on Windows).

### Changes

- **python/check_package_availability.py** – `print(..., flush=True)` and comment referencing Issue #118.
- **src/python/PythonManager.ts** – Normalize stdout (BOM strip + trim) before parse; recovery parse when result is string; debug/error logging for package check result and parse failures.
- **CHANGELOG.md** – Document Issue #118 fix under [0.8.1] (and in release notes as needed).

---

## Documentation and version

- **CHANGELOG.md** – [0.8.1] entry with Added (#116) and Fixed (#115, #118).
- **docs/RELEASE_NOTES_0.8.1.md** – Release notes for 0.8.1 covering .grb2 support and the #115 / #118 fixes.
- **Version** – `0.8.1` in package.json.

---

## Testing

- [ ] **#116** – Run extension tests; open a `.grb2` file via Explorer context menu and custom editor; confirm it opens as GRIB2.
- [ ] **#115** – Install extension, enable “use own env”, then uninstall (leave or simulate existing `python-environment`), reinstall, enable “use own env” again; confirm extension initializes and uv env is created/replaced without “virtual environment already exists” error.
- [ ] **#118** – On Windows (or CI): install extension, enable “use own env”, open a supported file; confirm package check succeeds and no “Invalid response format” / “Missing core packages” error.

---

## Checklist

- [x] CHANGELOG updated for #116, #115, #118
- [x] Version 0.8.1 in package.json
- [x] Release notes (RELEASE_NOTES_0.8.1.md) updated
- [x] README/docs updated for .grb2
- [x] Test added for .grb2 in extension contributions
- [ ] Manual/CI testing as above where possible
