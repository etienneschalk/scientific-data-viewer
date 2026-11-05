"""Stand-in for the wave height file of issue #117 (non_regression_test_plot.py)."""

import os

import numpy as np
import pandas as pd
import xarray as xr

from sample_data.common import CREATION_DATETIME


def create_sample_netcdf_issue_0117_waves():
    """Create ``hs-issue-0117.nc``, shaped like the file of issue #117.

    The original is ``hs`` cut from a MET Norway wave hindcast with
    ``isel(rlat=slice(200, 500), rlon=slice(2000, 2250))`` (see
    ``notebooks/issue-0117-select-and-slice-before-plotting.ipynb``): 24 hourly
    maps on a rotated grid, NaN over land. This one is synthetic and seeded, so
    the plots of ``python/non_regression_test_plot.py`` do not depend on a
    remote server and are the same on every machine.
    """
    output_file = "hs-issue-0117.nc"

    if os.path.exists(output_file):
        print(f"📄 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌊 Creating wave height sample (issue #117 stand-in)...")

    rng = np.random.default_rng(117)
    time = pd.date_range("2023-10-28T00:00", periods=24, freq="h")
    rlat = np.round(np.linspace(-7.0, 1.97, 300), 3)
    rlon = np.round(np.linspace(13.0, 20.47, 250), 3)
    hours = np.arange(len(time))[:, None, None]
    y = np.linspace(0, 1, len(rlat))[None, :, None]
    x = np.linspace(0, 1, len(rlon))[None, None, :]

    # A swell moving across the domain, a storm growing in the north-west,
    # and some noise; land (NaN) along the eastern edge and two islands
    swell = 1.2 + 0.6 * np.sin(2 * np.pi * (3 * x + 2 * y - hours / 12))
    storm = (0.5 + hours / 12) * np.exp(-((x - 0.25) ** 2 + (y - 0.75) ** 2) / 0.03)
    noise = rng.normal(0, 0.05, (len(time), len(rlat), len(rlon)))
    hs = (swell + storm + noise).astype(np.float32)
    land = (x[0] > 0.85 + 0.05 * np.sin(8 * np.pi * y[0])) | (
        ((x[0] - 0.6) ** 2 + (y[0] - 0.3) ** 2) < 0.004
    )
    land |= ((x[0] - 0.45) ** 2 + (y[0] - 0.55) ** 2) < 0.002
    hs[:, land] = np.nan

    ds = xr.Dataset(
        {
            "hs": (
                ["time", "rlat", "rlon"],
                hs,
                {
                    "standard_name": "sea_surface_wave_significant_height",
                    "long_name": "Total significant wave height",
                    "units": "m",
                },
            )
        },
        coords={
            "time": ("time", time, {"standard_name": "time"}),
            "rlat": (
                "rlat",
                rlat,
                {"standard_name": "grid_latitude", "units": "degrees"},
            ),
            "rlon": (
                "rlon",
                rlon,
                {"standard_name": "grid_longitude", "units": "degrees"},
            ),
        },
    )
    ds.attrs = {
        "title": "Synthetic significant wave height (issue #117 stand-in)",
        "source": "python/sample_data/waves.py, seeded; shaped like the MyWaveWAM 3 km crop of issue #117",
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
    }
    ds.to_netcdf(output_file, encoding={"hs": {"zlib": True, "complevel": 4}})
    print(f"✅ Created {output_file}")
    return output_file
