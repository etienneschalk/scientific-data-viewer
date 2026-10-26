"""Shared type aliases."""

from typing import Literal

import xarray as xr

# </JSON Serialization Section>

DictOfDatasets = dict[str, xr.Dataset]


SupportedExtensionType = Literal[
    ".nc",
    ".nc4",
    ".netcdf",
    ".cdf",
    ".zarr",
    ".h5",
    ".hdf5",
    ".grib",
    ".grib2",
    ".grb",
    ".grb2",
    ".tif",
    ".tiff",
    ".geotiff",
    ".jp2",
    ".jpeg2000",
    ".kerchunk",
]


EngineType = Literal[
    "netcdf4",
    "h5netcdf",
    "scipy",
    "zarr",
    "h5py",
    "cfgrib",
    "rasterio",
    "cdflib",
    "kerchunk",
]


# --- Plot execution: kwargs bundle, dispatcher, and strategies (create_plot) ---

ColWrap = int | Literal["auto"] | None
