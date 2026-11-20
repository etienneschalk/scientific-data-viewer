"""NetCDF sample for the log color scale (``norm = log``).

``sample_log_scale.nc`` holds variables spanning several orders of magnitude,
the case a linear scale draws as one flat color:

- ``chlorophyll``: lognormal ``(time, lat, lon)`` concentration over six
  orders of magnitude (0.005 to 2000 mg m-3), NaN over land (a disc), exact zeros in a corner (no
  bloom) -> log colors, facets with one colorbar, a note counting the zeros;
- ``particle_count``: 1D lognormal series with a zero -> log y-axis, a gap;
- ``net_flux``: values of both signs -> only the positive ones on a log
  scale, xarray's diverging colormap avoided;
- ``depth_negative``: only values <= 0 -> the log scale is ignored with a
  note.

Random values use numpy's global seed, set by ``main.py`` (one stable seed
per generator).
"""

import os

import numpy as np
import pandas as pd
import xarray as xr

from sample_data.common import CREATION_DATETIME

FILE_NAME = "sample_log_scale.nc"


def build_log_scale_dataset() -> xr.Dataset:
    lat = np.linspace(-30.0, 30.0, 61)
    lon = np.linspace(-60.0, 20.0, 81)
    time = pd.date_range("2024-03-01", periods=4, freq="MS")
    lat2, lon2 = np.meshgrid(lat, lon, indexing="ij")

    # A bloom along the coast (east), oligotrophic gyre (west): log10 from -2 to 2
    log10_chl = (
        -1.5
        + 2.8 * np.exp(-(((lon2 - 5.0) / 18.0) ** 2))
        + 0.6 * np.cos(np.radians(lat2) * 4.0)
    )
    chlorophyll = np.empty((time.size, lat.size, lon.size))
    for i in range(time.size):
        noise = np.random.normal(0.0, 0.25, lat2.shape)
        chlorophyll[i] = 10 ** (log10_chl + noise + 0.3 * i)
    land = ((lat2 - 5.0) ** 2 + (lon2 - 15.0) ** 2) < 8.0**2
    chlorophyll[:, land] = np.nan
    chlorophyll[:, :6, :8] = 0.0  # no bloom: exact zeros

    count = 10 ** np.random.normal(2.0, 1.2, 120)
    count[17] = 0.0
    net_flux = np.random.normal(0.0, 1.0, lat2.shape) * 10 ** (np.abs(lat2) / 15.0)
    depth = -np.abs(np.random.normal(500.0, 300.0, lat2.shape))

    return xr.Dataset(
        {
            "chlorophyll": (
                ("time", "lat", "lon"),
                chlorophyll.astype(np.float32),
                {
                    "long_name": "Chlorophyll-a concentration",
                    "standard_name": "mass_concentration_of_chlorophyll_a_in_sea_water",
                    "units": "mg m-3",
                },
            ),
            "particle_count": (
                ("sample",),
                count,
                {"long_name": "Particle count", "units": "1"},
            ),
            "net_flux": (
                ("lat", "lon"),
                net_flux,
                {"long_name": "Net flux (both signs)", "units": "W m-2"},
            ),
            "depth_negative": (
                ("lat", "lon"),
                depth,
                {"long_name": "Sea floor height (all values below 0)", "units": "m"},
            ),
        },
        coords={
            "time": time,
            "lat": ("lat", lat, {"units": "degrees_north"}),
            "lon": ("lon", lon, {"units": "degrees_east"}),
            "sample": np.arange(count.size),
        },
        attrs={
            "title": "Values over several orders of magnitude (norm = log)",
            "Conventions": "CF-1.10",
            "history": f"{CREATION_DATETIME.isoformat()} created by sample_data/log_scale.py",
        },
    )


def create_sample_netcdf_log_scale() -> str:
    """Write ``sample_log_scale.nc`` (NetCDF-4)."""
    if os.path.exists(FILE_NAME):
        print(f"🔧 NetCDF file {FILE_NAME} already exists. Skipping creation.")
        return FILE_NAME
    print("🔧 Creating sample NetCDF file for the log color scale...")
    ds = build_log_scale_dataset()
    ds.to_netcdf(FILE_NAME, engine="netcdf4", format="NETCDF4")
    return FILE_NAME
