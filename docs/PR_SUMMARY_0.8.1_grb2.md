# Pull Request: Add support for .grb2 extension (Issue #116)

## Summary

Adds support for the `.grb2` file extension so that GRIB2 files using this extension can be opened in the Scientific Data Viewer. Closes #116.

## Changes

### Code

- **package.json**
  - Added `.grb2` to explorer context menu `when` clauses (openViewer, openViewerMultiple)
  - Added `.grb2` to GRIB language `extensions`
  - Added `*.grb2` to GRIB Data Viewer custom editor `selector`
  - Bumped version to `0.8.1`

- **src/panel/webview/webview-script.js**
  - Added `'.grb2'` to `SUPPORTED_EXTENSIONS_HARDOCDED`

- **python/get_data_info.py**
  - Added `".grb2"` to `SupportedExtensionType`, `SUPPORTED_EXTENSIONS`, `FORMAT_ENGINE_MAP` (cfgrib), and `FORMAT_DISPLAY_NAMES` (GRIB2)

### Documentation

- **CHANGELOG.md** – New `[0.8.1] - 2026-02-25` entry for Issue #116
- **README.md** – GRIB row updated to include `.grb2`
- **blog-article.md** – GRIB extensions table updated to include `.grb2`
- **docs/RELEASE_NOTES_0.7.0.md**, **RELEASE_NOTES_0.6.0.md**, **RELEASE_NOTES_0.3.0.md** – GRIB/GRIB2 extension lists updated for consistency
- **docs/RELEASE_NOTES_0.8.1.md** – New release notes for 0.8.1

### Tests

- **test/suite/extension.test.ts** – New assertion that GRIB language contribution includes `.grb2`

## Testing

- [ ] Run extension tests: `npm test`
- [ ] Manually open a `.grb2` file via Explorer context menu and custom editor
- [ ] Confirm file opens and is recognized as GRIB2 (Python backend with cfgrib)

## Checklist

- [x] CHANGELOG updated
- [x] Version bumped to 0.8.1 (patch)
- [x] Release notes added (docs/RELEASE_NOTES_0.8.1.md)
- [x] README and other docs updated
- [x] Test added for .grb2 in extension contributions
