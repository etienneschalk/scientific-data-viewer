"""Sample file shipped with the extension, opened by the Getting Started walkthrough.

Small (well under 200 KB) synthetic, CF-compliant climate-like data, so that a
new user sees groups, variables, attributes and good-looking plots in a few
seconds:

- ``/``: monthly near-surface air temperature ``tas(time, lat, lon)`` on a 5°
  grid (packed as int16 with ``scale_factor`` / ``add_offset``, zlib), its
  area-weighted global mean ``tas_global_mean(time)`` and a static land area
  fraction ``sftlf(lat, lon)``;
- ``/stations``: ``tas(station, time)`` at three points of the grid (a CF
  ``timeSeries`` feature type), to show groups.

The output is deterministic: fixed seed, fixed ``history`` date, explicit
encodings and the ``netcdf4`` engine. Bytes can still differ between versions
of netCDF-C / HDF5 (``_NCProperties`` records them), so the committed file is
compared by content (``check_bundled_sample``), not by bytes.

Regenerate the committed copy with::

    python python/create_sample_data.py --bundled-sample
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

from sample_data.common import CREATION_DATETIME

SAMPLE_FILE_NAME = "sample_climate.nc"
# Shipped in the .vsix (listed in .vscodeignore), opened by the
# scientificDataViewer.openSampleFile command (src/onboarding/sampleFile.ts)
BUNDLED_SAMPLE_PATH = (
    Path(__file__).resolve().parents[2] / "media" / "samples" / SAMPLE_FILE_NAME
)

SEED = 2020
STATIONS_GROUP = "stations"
_STATIONS = [
    # name, latitude, longitude (grid cell centres)
    ("Northern mid-latitudes", 47.5, 2.5),
    ("Equatorial", 2.5, 37.5),
    ("Southern high latitudes", -62.5, -57.5),
]
_TIME_UNITS = "days since 2020-01-01"


def _land_fraction(lat2d: np.ndarray, lon2d: np.ndarray) -> np.ndarray:
    """Smooth, made-up continents (percent, rounded to integers)."""
    lat_r, lon_r = np.deg2rad(lat2d), np.deg2rad(lon2d)
    pattern = (
        np.sin(2 * lon_r + 0.6) * np.cos(lat_r - 0.3)
        + 0.6 * np.cos(3 * lon_r - 1.0) * np.sin(2 * lat_r + 0.4)
        # An Antarctica of sorts, with a smooth coast
        + 1.2 / (1 + np.exp((lat2d + 68) / 2.5))
    )
    fraction = 1 / (1 + np.exp(-6 * (pattern - 0.35)))
    return np.round(100 * fraction).astype(np.float32)


def _smooth_anomalies(
    rng: np.random.Generator, n_time: int, lat2d: np.ndarray, lon2d: np.ndarray
) -> np.ndarray:
    """Large-scale weather anomalies: a few random waves per month (K)."""
    lat_r, lon_r = np.deg2rad(lat2d), np.deg2rad(lon2d)
    anomalies = np.zeros((n_time, *lat2d.shape))
    for t in range(n_time):
        for wavenumber in (1, 2, 3, 4):
            amplitude = rng.normal(0, 1.6 / wavenumber)
            phase_lon, phase_lat = rng.uniform(0, 2 * np.pi, 2)
            anomalies[t] += (
                amplitude
                * np.cos(wavenumber * lon_r + phase_lon)
                * np.cos(lat_r)
                * np.cos(wavenumber * lat_r + phase_lat)
            )
    return anomalies


def build_onboarding_sample() -> tuple[xr.Dataset, xr.Dataset]:
    """Datasets of the root group and of the ``stations`` group."""
    rng = np.random.default_rng(SEED)

    time = pd.date_range("2020-01-01", periods=24, freq="MS")
    lat = np.arange(-87.5, 90, 5.0)
    lon = np.arange(-177.5, 180, 5.0)
    lat2d, lon2d = np.meshgrid(lat, lon, indexing="ij")
    lat_r = np.deg2rad(lat2d)

    sftlf = _land_fraction(lat2d, lon2d)
    land = sftlf / 100

    # Annual mean: warm tropics, cold poles, colder over high land masses
    annual_mean = (
        247.0 + 55.0 * np.cos(lat_r) ** 1.5 - 4.0 * land * np.abs(np.sin(lat_r))
    )
    # Seasonal cycle: opposite in each hemisphere, larger over land and
    # towards the poles; coldest in January in the north
    month_angle = 2 * np.pi * (time.month.to_numpy() - 1) / 12
    amplitude = (4.0 + 14.0 * land) * np.abs(np.sin(lat_r)) ** 0.8
    seasonal = (
        -np.sign(lat_r)[None] * amplitude[None] * np.cos(month_angle)[:, None, None]
    )
    trend = 0.03 * np.arange(len(time))[:, None, None]  # K per month
    anomalies = _smooth_anomalies(rng, len(time), lat2d, lon2d)
    tas = (annual_mean[None] + seasonal + trend + anomalies).astype(np.float32)

    weights = np.cos(np.deg2rad(lat))
    tas_global_mean = ((tas.mean(axis=2) * weights).sum(axis=1) / weights.sum()).astype(
        np.float32
    )

    time_attrs = {"standard_name": "time", "long_name": "Time", "axis": "T"}
    lat_attrs = {
        "standard_name": "latitude",
        "long_name": "Latitude",
        "units": "degrees_north",
        "axis": "Y",
    }
    lon_attrs = {
        "standard_name": "longitude",
        "long_name": "Longitude",
        "units": "degrees_east",
        "axis": "X",
    }
    root = xr.Dataset(
        {
            "tas": (
                ["time", "lat", "lon"],
                tas,
                {
                    "standard_name": "air_temperature",
                    "long_name": "Near-Surface Air Temperature",
                    "units": "K",
                    "cell_methods": "time: mean",
                    "comment": "Synthetic monthly means, not real observations",
                },
            ),
            "tas_global_mean": (
                ["time"],
                tas_global_mean,
                {
                    "standard_name": "air_temperature",
                    "long_name": "Global Mean Near-Surface Air Temperature",
                    "units": "K",
                    "cell_methods": "time: mean area: mean (weighted by cos(lat))",
                },
            ),
            "sftlf": (
                ["lat", "lon"],
                sftlf,
                {
                    "standard_name": "land_area_fraction",
                    "long_name": "Percentage of the Grid Cell Occupied by Land",
                    "units": "%",
                },
            ),
        },
        coords={
            "time": ("time", time, time_attrs),
            "lat": ("lat", lat, lat_attrs),
            "lon": ("lon", lon, lon_attrs),
        },
        attrs={
            "title": "Scientific Data Viewer sample: synthetic monthly climate",
            "summary": (
                "Two years of synthetic monthly near-surface air temperature on a"
                " global 5-degree grid, its global mean, a land area fraction and,"
                " in the 'stations' group, time series at three grid points. Made"
                " up for demonstration: not real observations."
            ),
            "Conventions": "CF-1.8",
            "institution": "Scientific Data Viewer (VS Code extension)",
            "source": "Synthetic data: python/sample_data/onboarding.py",
            "history": (
                f"{CREATION_DATETIME:%Y-%m-%dT%H:%M:%SZ} created by"
                " python/sample_data/onboarding.py"
            ),
            "references": "https://github.com/etienneschalk/scientific-data-viewer",
            "license": "MIT",
        },
    )

    names = [name for name, _, _ in _STATIONS]
    station_lat = np.array([la for _, la, _ in _STATIONS])
    station_lon = np.array([lo for _, _, lo in _STATIONS])
    lat_index = np.searchsorted(lat, station_lat)
    lon_index = np.searchsorted(lon, station_lon)
    station_tas = (
        tas[:, lat_index, lon_index].T + rng.normal(0, 0.4, (len(names), len(time)))
    ).astype(np.float32)
    stations = xr.Dataset(
        {
            "tas": (
                ["station", "time"],
                station_tas,
                {
                    "standard_name": "air_temperature",
                    "long_name": "Near-Surface Air Temperature at Stations",
                    "units": "K",
                    "cell_methods": "time: mean",
                },
            ),
        },
        coords={
            "station": ("station", np.arange(len(names), dtype=np.int32)),
            "time": ("time", time, time_attrs),
            "station_name": (
                "station",
                np.array(names, dtype=object),
                {"long_name": "Station Name", "cf_role": "timeseries_id"},
            ),
            # Not lat / lon: the group inherits the lat / lon indexes of the
            # root (xarray DataTree), which a station coordinate cannot shadow
            "station_lat": ("station", station_lat, lat_attrs),
            "station_lon": ("station", station_lon, lon_attrs),
        },
        attrs={
            "featureType": "timeSeries",
            "title": "Synthetic station series (grid point value + local noise)",
        },
    )
    return root, stations


def _encoding(ds: xr.Dataset, packed: dict[str, tuple[float, float]]) -> dict:
    """Explicit encodings: zlib everywhere, int16 packing for ``packed``."""
    encoding: dict[str, dict] = {}
    for name in ds.variables:
        variable = ds[name]
        if name == "time":
            encoding[name] = {
                "units": _TIME_UNITS,
                "calendar": "standard",
                "dtype": "int32",
            }
        elif variable.dtype.kind in "fiu":
            encoding[name] = {"zlib": True, "complevel": 6, "shuffle": True}
            if variable.dtype.kind == "f":
                encoding[name]["_FillValue"] = None
        if name in packed:
            scale_factor, add_offset = packed[name]
            encoding[name] = {
                "dtype": "int16",
                "scale_factor": scale_factor,
                "add_offset": add_offset,
                "_FillValue": np.int16(-32767),
                "zlib": True,
                "complevel": 6,
                "shuffle": True,
            }
    return encoding


def write_onboarding_sample(path: Path | str) -> Path:
    """Write the sample to ``path`` (overwritten)."""
    path = Path(path)
    root, stations = build_onboarding_sample()
    if path.exists():
        path.unlink()
    root.to_netcdf(
        path,
        mode="w",
        engine="netcdf4",
        format="NETCDF4",
        encoding=_encoding(root, {"tas": (0.01, 273.15)}),
    )
    stations.to_netcdf(
        path,
        mode="a",
        group=STATIONS_GROUP,
        engine="netcdf4",
        format="NETCDF4",
        encoding=_encoding(stations, {}),
    )
    return path


def create_sample_onboarding() -> str:
    """Generator of ``create_sample_data.py``: the sample, in the current folder."""
    if os.path.exists(SAMPLE_FILE_NAME):
        print(f"📄 NetCDF file {SAMPLE_FILE_NAME} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return SAMPLE_FILE_NAME
    print("🌍 Creating the sample file of the Getting Started walkthrough...")
    write_onboarding_sample(SAMPLE_FILE_NAME)
    print(f"✅ Created {SAMPLE_FILE_NAME}")
    return SAMPLE_FILE_NAME


def open_sample_groups(path: Path | str) -> dict[str, xr.Dataset]:
    """Decoded content of each group of a sample file (loaded, file closed)."""
    groups = {}
    for group in (None, STATIONS_GROUP):
        with xr.open_dataset(path, group=group, engine="netcdf4") as ds:
            groups[group or "/"] = ds.load()
    return groups


def check_bundled_sample(path: Path | str = BUNDLED_SAMPLE_PATH) -> list[str]:
    """Differences between the committed sample and a fresh one (empty: same)."""
    import tempfile

    path = Path(path)
    if not path.exists():
        return [f"{path} does not exist"]
    with tempfile.TemporaryDirectory() as tmp:
        fresh = open_sample_groups(write_onboarding_sample(Path(tmp) / path.name))
    committed = open_sample_groups(path)
    problems = []
    for group, expected in fresh.items():
        actual = committed.get(group)
        if actual is None or not actual.identical(expected):
            problems.append(f"group {group} of {path} differs from the generator")
    return problems


def write_bundled_sample(check: bool = False) -> int:
    """Write (or with ``check``, verify) the copy shipped with the extension."""
    if check:
        problems = check_bundled_sample()
        for problem in problems:
            print(f"❌ {problem}")
        if problems:
            print(
                "   Regenerate it: python python/create_sample_data.py --bundled-sample"
            )
            return 1
        print(f"✅ {BUNDLED_SAMPLE_PATH} matches the generator")
        return 0
    BUNDLED_SAMPLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    write_onboarding_sample(BUNDLED_SAMPLE_PATH)
    size_kib = BUNDLED_SAMPLE_PATH.stat().st_size / 1024
    print(f"✅ Wrote {BUNDLED_SAMPLE_PATH} ({size_kib:.1f} KiB)")
    return 0
