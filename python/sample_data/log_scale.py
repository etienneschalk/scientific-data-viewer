"""NetCDF sample for the log color scale (``norm = log``) and seaborn colormaps.

``sample_log_scale.nc`` holds one variable per case of the log scale
(``plotting/norm.py``); a linear scale draws most of them as one flat color.

- ``chlorophyll``: lognormal ``(time, lat, lon)`` concentration over six
  orders of magnitude (0.005 to 2000 mg m-3), NaN over land (a disc), exact
  zeros in a corner (no bloom) -> log colors, facets with one colorbar, a
  note counting the zeros;
- ``particle_count``: 1D lognormal series with a zero -> log y-axis, a gap;
- ``net_flux``: values of both signs -> only the positive ones on a log
  scale, xarray's diverging colormap avoided;
- ``depth_negative``: only values <= 0 -> the log scale is ignored with a
  note.

Added for the cases the first four do not reach:

- ``photon_counts``: ``uint16`` counts with many zeros -> integers on a log
  scale (zeros counted in the note);
- ``rain_rate``: rain bands of 1 to 20 mm h-1, small storm cores of
  several hundred, dry (0) elsewhere -> ``robust`` (the cores above the
  limit, an arrow), the dry area left out;
- ``aerosol_tiny``: 1e-12 to 1e-6 -> colorbar labels of tiny values;
- ``no2_column_huge``: 1e14 to 1e17 molecules cm-2 -> colorbar labels of
  huge values;
- ``backscatter_with_inf``: ``+inf``, ``-inf`` and NaN among positive values
  -> only finite values counted and drawn;
- ``constant_positive``: every value 3.0 -> a log norm with vmin = vmax;
- ``chlorophyll_profile``: 1D along ``depth`` (positive down) -> with
  ``y = depth`` the values are on x: log x-axis;
- ``chlorophyll_packed``: chlorophyll stored as ``int32`` with
  ``scale_factor`` and ``_FillValue = -1`` -> log scale on the decoded
  values; with ``maskAndScale`` off, the raw integers and the fill values
  (counted as <= 0);
- ``water_class``: CF flag variable (``flag_values`` / ``flag_meanings``) ->
  log scale ignored with a note (drawn by meaning);
- ``is_bloom``: booleans -> log scale ignored with a note (not numbers).
  (Dates would do too, but a 2D date variable cannot be plotted at all.)

A histogram of any variable ignores the log scale with a note.

Random values use numpy's global seed, set by ``main.py`` (one stable seed
per generator). New variables draw their random values after the first four,
so those keep the values the manual test plan quotes.
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
    grid = ("lat", "lon")

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

    # --- Variables added later: random draws after the four above ---

    # Photon counts: a bright source in a dark sky, Poisson noise, many zeros
    source = np.exp(-((lat2 - 10.0) ** 2 + (lon2 + 20.0) ** 2) / (2 * 6.0**2))
    expected = 0.3 + 3.0e4 * source
    photon_counts = np.random.poisson(expected).astype(np.uint16)

    # Rain: a few rain bands (light rain, dry elsewhere) and small storm
    # cores of several hundred mm h-1
    def blobs(n: int, radius: tuple[float, float], peak: tuple[float, float]):
        field = np.zeros(lat2.shape)
        for _ in range(n):
            clat, clon = np.random.uniform(-28, 28), np.random.uniform(-58, 18)
            r = np.random.uniform(*radius)
            a = np.random.uniform(*peak)
            field += a * np.exp(-((lat2 - clat) ** 2 + (lon2 - clon) ** 2) / (2 * r**2))
        return field

    bands = blobs(9, (4.0, 9.0), (2.0, 15.0))
    cores = blobs(5, (0.8, 1.5), (200.0, 800.0))
    rain = (bands + cores) * np.random.lognormal(0.0, 0.3, lat2.shape)
    rain[bands < 1.0] = 0.0  # dry

    aerosol_tiny = 10 ** (
        -9.0 + 2.5 * np.sin(np.radians(lat2) * 3.0) * np.cos(np.radians(lon2) * 2.0)
    ) * np.random.lognormal(0.0, 0.2, lat2.shape)
    no2_column_huge = 10 ** (
        14.5 + 2.0 * np.exp(-((lat2 - 20.0) ** 2 + (lon2 - 5.0) ** 2) / 200.0)
    ) * np.random.lognormal(0.0, 0.3, lat2.shape)

    backscatter = 10 ** np.random.normal(-3.0, 0.8, lat2.shape)
    backscatter[10, 10:20] = np.inf
    backscatter[30, 10:20] = -np.inf
    backscatter[50, 10:20] = np.nan

    constant = np.full(lat2.shape, 3.0)

    # Deep chlorophyll maximum around 60 m, nearly nothing below 150 m
    profile_depth = np.arange(0.0, 300.0, 5.0)
    profile = 0.05 + 2.0 * np.exp(-(((profile_depth - 60.0) / 20.0) ** 2))
    profile = (
        profile
        * np.exp(-profile_depth / 120.0)
        * 10 ** np.random.normal(0.0, 0.05, profile_depth.size)
    )

    # chlorophyll of the first month, packed in int32 (NaN = fill value)
    packed_source = chlorophyll[0].copy()

    water_class = np.select(
        [land, chlorophyll[0] > 1.0, chlorophyll[0] > 0.1],
        [3, 2, 1],
        default=0,
    ).astype(np.int8)

    is_bloom = np.nan_to_num(chlorophyll[0]) > 1.0

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
                grid,
                net_flux,
                {"long_name": "Net flux (both signs)", "units": "W m-2"},
            ),
            "depth_negative": (
                grid,
                depth,
                {"long_name": "Sea floor height (all values below 0)", "units": "m"},
            ),
            "photon_counts": (
                grid,
                photon_counts,
                {
                    "long_name": "Photon counts (integers, many zeros)",
                    "units": "count",
                },
            ),
            "rain_rate": (
                grid,
                rain,
                {
                    "long_name": "Rain rate (rain bands, storm cores, dry elsewhere)",
                    "standard_name": "rainfall_rate",
                    "units": "mm h-1",
                },
            ),
            "aerosol_tiny": (
                grid,
                aerosol_tiny,
                {
                    "long_name": "Aerosol mass mixing ratio (1e-12 to 1e-6)",
                    "units": "kg kg-1",
                },
            ),
            "no2_column_huge": (
                grid,
                no2_column_huge,
                {
                    "long_name": "NO2 tropospheric column (1e14 to 1e17)",
                    "units": "molecules cm-2",
                },
            ),
            "backscatter_with_inf": (
                grid,
                backscatter,
                {
                    "long_name": "Backscatter with +inf, -inf and NaN rows",
                    "units": "m-1 sr-1",
                },
            ),
            "constant_positive": (
                grid,
                constant,
                {"long_name": "Constant field (every value 3)", "units": "1"},
            ),
            "chlorophyll_profile": (
                ("depth",),
                profile,
                {
                    "long_name": "Chlorophyll-a profile (plot with y = depth)",
                    "units": "mg m-3",
                },
            ),
            "chlorophyll_packed": (
                grid,
                packed_source,
                {
                    "long_name": "Chlorophyll-a, packed in int32 (scale_factor)",
                    "units": "mg m-3",
                },
            ),
            "water_class": (
                grid,
                water_class,
                {
                    "long_name": "Water class (CF flag variable)",
                    "flag_values": np.array([0, 1, 2, 3], dtype=np.int8),
                    "flag_meanings": "oligotrophic mesotrophic eutrophic land",
                },
            ),
            "is_bloom": (
                grid,
                is_bloom,
                {"long_name": "Bloom (chlorophyll above 1 mg m-3; booleans)"},
            ),
        },
        coords={
            "time": time,
            "lat": ("lat", lat, {"units": "degrees_north"}),
            "lon": ("lon", lon, {"units": "degrees_east"}),
            "sample": np.arange(count.size),
            "depth": (
                "depth",
                profile_depth,
                {"units": "m", "positive": "down", "standard_name": "depth"},
            ),
        },
        attrs={
            "title": "Values over several orders of magnitude (norm = log)",
            "Conventions": "CF-1.10",
            "history": f"{CREATION_DATETIME.isoformat()} created by sample_data/log_scale.py",
        },
    )


# chlorophyll_packed on disk: int32 = round(value / 1e-4), NaN -> -1
PACKED_ENCODING = {
    "dtype": "int32",
    "scale_factor": 1.0e-4,
    "add_offset": 0.0,
    "_FillValue": np.int32(-1),
}


def create_sample_netcdf_log_scale() -> str:
    """Write ``sample_log_scale.nc`` (NetCDF-4)."""
    if os.path.exists(FILE_NAME):
        print(f"🔧 NetCDF file {FILE_NAME} already exists. Skipping creation.")
        return FILE_NAME
    print("🔧 Creating sample NetCDF file for the log color scale...")
    ds = build_log_scale_dataset()
    ds.to_netcdf(
        FILE_NAME,
        engine="netcdf4",
        format="NETCDF4",
        encoding={"chlorophyll_packed": PACKED_ENCODING},
    )
    return FILE_NAME
