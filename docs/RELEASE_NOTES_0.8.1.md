# Scientific Data Viewer v0.8.1 Release Notes

## Support for .grb2 Extension (Issue #116)

This patch adds support for the `.grb2` file extension used by many GRIB2 (Gridded Binary Version 2) meteorological and climate data files.

### What's New

- **`.grb2` extension support**: You can now open `.grb2` files directly in the Scientific Data Viewer
  - Right-click a `.grb2` file in the Explorer → **Open in Scientific Data Viewer**
  - Double-click or use the GRIB Data Viewer custom editor for `.grb2` files
  - Same backend as other GRIB formats: uses `cfgrib` (ensure it is installed in your Python environment)

### GRIB/GRIB2 Supported Extensions

The extension now recognizes all of the following as GRIB data:

| Extension | Format |
| --------- | ------ |
| .grib     | GRIB   |
| .grib2    | GRIB2  |
| .grb      | GRIB   |
| .grb2     | GRIB2  |

### Upgrading

No action required. After updating to 0.8.1, `.grb2` files will be associated with the GRIB Data Viewer like other GRIB extensions.
