"""Create the dataset shown in the viewer screenshots (take-screenshots.mjs).

Small and seeded, so screenshots of different versions show the same data
and every plot renders in a few seconds: a root group with a 1D, a 2D and a
3D variable plus CF attributes, and an ``ocean`` child group.

Usage: python make_fixture.py <output.nc> <broken.nc>
(the second file is not NetCDF, for the error page screenshot)
"""

import sys

import numpy as np
import pandas as pd
import xarray as xr


def make_dataset() -> xr.DataTree:
    rng = np.random.default_rng(20260101)
    time = pd.date_range("2025-01-01", periods=12, freq="MS")
    lat = np.linspace(-87.5, 87.5, 36)
    lon = np.linspace(-177.5, 177.5, 72)
    lat2d, lon2d = np.meshgrid(np.deg2rad(lat), np.deg2rad(lon), indexing="ij")
    season = np.sin(2 * np.pi * np.arange(12) / 12)[:, None, None]

    temperature = (
        14
        + 16 * np.cos(lat2d)[None]
        - 6 * np.sin(lat2d)[None] * season
        + 2 * np.sin(3 * lon2d)[None] * np.cos(lat2d)[None]
        + rng.normal(0, 0.6, (12, 36, 72))
    )
    elevation = 2500 * np.cos(2 * lon2d) * np.cos(lat2d) ** 2 + 600 * np.sin(4 * lat2d)
    coords = {
        "time": ("time", time, {"long_name": "Time"}),
        "lat": ("lat", lat, {"units": "degrees_north", "long_name": "Latitude"}),
        "lon": ("lon", lon, {"units": "degrees_east", "long_name": "Longitude"}),
    }
    root = xr.Dataset(
        {
            "temperature": (
                ("time", "lat", "lon"),
                temperature.astype("float32"),
                {
                    "units": "degC",
                    "long_name": "Near-surface air temperature",
                    "standard_name": "air_temperature",
                },
            ),
            "elevation": (
                ("lat", "lon"),
                elevation.astype("float32"),
                {"units": "m", "long_name": "Surface elevation"},
            ),
            "global_mean_temperature": (
                "time",
                temperature.mean(axis=(1, 2)).astype("float32"),
                {"units": "degC", "long_name": "Global mean temperature"},
            ),
        },
        coords=coords,
        attrs={
            "title": "Scientific Data Viewer screenshot dataset",
            "institution": "Synthetic data",
            "source": "scripts/screenshots/make_fixture.py",
            "Conventions": "CF-1.8",
        },
    )
    ocean = xr.Dataset(
        {
            "sea_surface_temperature": (
                ("time", "lat", "lon"),
                (temperature * 0.8 + 2).astype("float32"),
                {"units": "degC", "long_name": "Sea surface temperature"},
            ),
        },
        attrs={"description": "Ocean variables"},
    )
    return xr.DataTree.from_dict({"/": root, "/ocean": ocean})


def main() -> None:
    output, broken = sys.argv[1], sys.argv[2]
    make_dataset().to_netcdf(output)
    with open(broken, "w", encoding="utf-8") as file:
        file.write("This is not a NetCDF file.\n")


if __name__ == "__main__":
    main()
