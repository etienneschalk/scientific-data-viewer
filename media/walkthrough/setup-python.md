# Set up Python

Scientific Data Viewer reads files with [xarray](https://xarray.dev), in a Python
process. It needs an interpreter that has xarray and the engines for your formats.
Choose one of the two ways below. This step is checked once the viewer finds a
Python with xarray.

## Let the extension manage Python (recommended for a first try)

**Let the Extension Manage Python (uv)** creates a private environment in the
extension's storage, with Python 3.13 and the packages of the table below (all but
`kerchunk`). It then turns on `scientificDataViewer.python.useExtensionOwnEnvironment`.

- It needs [uv](https://docs.astral.sh/uv/getting-started/installation/) on your
  machine. If uv is missing, you are offered a link to install it.
- The first creation downloads packages and can take a few minutes. A notification
  shows its progress.
- Your own interpreters are never modified. Manage the environment later with
  **Scientific Data Viewer: Manage Extension Virtual Environment**.

## Use my own interpreter

**Use My Own Interpreter** opens **Python: Select Interpreter** when the
[Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
is installed. Without it, set `scientificDataViewer.python.overridePythonInterpreter`
to the path of a Python executable.

- If the extension was using its own environment, it stops using it (the environment
  is kept: turn `useExtensionOwnEnvironment` on again to come back to it).
- If `overridePythonInterpreter` is set, that interpreter always wins: the button
  opens the setting so you can change or clear it.

The interpreter needs Python 3.10 or newer, and these packages:

| Purpose                 | Packages                                    |
| ----------------------- | ------------------------------------------- |
| Required                | `xarray>=2024.10`, `matplotlib` (plots)     |
| NetCDF / HDF5 (sample)  | `netCDF4`, `h5netcdf>=1.8`, `h5py`, `scipy` |
| Zarr                    | `zarr>=3`                                   |
| GRIB                    | `cfgrib`                                    |
| GeoTIFF / JPEG-2000     | `rioxarray`                                 |
| NASA CDF                | `cdflib`                                    |
| Kerchunk (experimental) | `kerchunk`                                  |

To open the sample file, `xarray`, `netCDF4` and `matplotlib` are enough:

```sh
pip install xarray netCDF4 matplotlib
```

When a file needs a package that is missing, the viewer names it and offers an
**Install** button. `kerchunk` is not part of the extension-managed environment:
install it that way when you open a Kerchunk file.

**Run the healthcheck** reports the interpreter in use and which of these packages
it finds.
