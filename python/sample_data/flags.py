"""NetCDF sample of CF flag variables (flag_values / flag_masks / flag_meanings).

``sample_cf_flags.nc`` holds one variable per case the viewer handles
(docs/v0.15/CF_FLAGS_PROPOSAL.md):

- ``land_cover``: ``flag_values`` with non-contiguous codes, ``flag_colors``
  and a ``_FillValue`` (the top rows) -> categorical map in the producer's
  colors;
- ``lccs_class``: 37 classes as in ESA CCI Land Cover, no colors, only some
  present -> only the present classes listed;
- ``quality_level``: GHRSST-like 0..5 levels along time -> facets, one
  colorbar;
- ``station_status``: 1D, the ``_FillValue`` 127 is also a meaning
  (``not_measured``), and one code (9) is not declared -> steps with the
  meanings on the y-axis, ``other``;
- ``pixel_flags``: ``flag_masks`` (bits) along time -> one row of panels per
  bit, one column per time;
- ``wqsf``: ``uint64`` masks including bits 62 and 63, with a ``_FillValue``
  -> one panel per bit, exact;
- ``sensor_status_qc``: CF example 3.8, masks + values, 1D -> block plot
  (one row per field, bits 2-3 a three-state mode);
- ``sst``: a data variable whose ``ancillary_variables`` names
  ``pixel_flags quality_level`` -> ``hide_flags`` (cloud, bad data...);
- ``broken_*``: specs the viewer must refuse with a note (counts that differ,
  a mixed value outside its mask, ``flag_colors`` of the wrong length, masks on
  a float variable).
"""

import os

import numpy as np
import xarray as xr

from sample_data.common import CREATION_DATETIME

FILE_NAME = "sample_cf_flags.nc"

LAND_COVER_CODES = np.array([10, 20, 30, 50, 60, 190, 200, 210], dtype=np.uint8)
LAND_COVER_MEANINGS = (
    "cropland grassland mosaic_cropland tree_cover_broadleaved "
    "tree_cover_needleleaved urban bare_areas water"
)
LAND_COVER_COLORS = "#ffff64 #ffb432 #dcf064 #006400 #003c00 #c31400 #fff5d7 #0046c8"

# ESA CCI Land Cover legend (LCCS), 37 codes
LCCS_CODES = np.array(
    [
        *(0, 10, 11, 12, 20, 30, 40, 50, 60, 61, 62, 70, 71, 72, 80, 81, 82, 90),
        *(100, 110, 120, 121, 122, 130, 140, 150, 151, 152, 153, 160, 170, 180),
        *(190, 200, 201, 202, 210),
    ],
    dtype=np.uint8,
)


def build_cf_flags_dataset(seed: int = 0) -> tuple[xr.Dataset, dict]:
    """The sample dataset and its encoding (used by the tests too)."""
    rng = np.random.default_rng(seed)
    ny, nx, nt = 30, 45, 3
    lat = np.linspace(-58, 58, ny)
    lon = np.linspace(-88, 88, nx)
    yy, xx = np.meshgrid(lat, lon, indexing="ij")
    field = np.sin(xx / 25) + np.cos(yy / 18) + 0.4 * rng.standard_normal((ny, nx))

    def classes(codes: np.ndarray, count: int) -> np.ndarray:
        edges = np.quantile(field, np.linspace(0, 1, count + 1)[1:-1])
        return codes[np.digitize(field, edges)]

    land_cover = classes(LAND_COVER_CODES, len(LAND_COVER_CODES))
    land_cover[yy > 45] = 255
    lccs = classes(LCCS_CODES[[1, 4, 7, 11, 18, 23, 32, 36]], 8)

    quality = np.empty((nt, ny, nx), dtype=np.int8)
    for t in range(nt):
        clouds = np.sin((xx + 30 * t) / 15) * np.cos(yy / 12)
        quality[t] = np.digitize(clouds, [-0.6, -0.2, 0.2, 0.6]) + 1
    quality[:, :2, :] = -128  # fill
    quality[:, -1, :] = 0  # declared no_data

    n_obs = 48
    station = rng.choice(np.array([0, 1, 2], np.int8), size=n_obs, p=[0.7, 0.2, 0.1])
    station[10:14] = 127  # fill value, also the meaning "not_measured"
    station[30] = 9  # not declared
    obs_time = np.datetime64("2026-01-01T00", "ns") + np.arange(n_obs) * np.timedelta64(
        30, "m"
    )

    bits = np.zeros((nt, ny, nx), dtype=np.uint8)
    for t in range(nt):
        cloud = (np.sin((xx + 30 * t) / 15) * np.cos(yy / 12)) > 0.4
        shadow = np.roll(cloud, (2, 3), axis=(0, 1)) & ~cloud
        layers = [cloud, shadow, np.abs(yy) > 50, rng.random((ny, nx)) < 0.02]
        bits[t] = sum(layer.astype(np.uint8) << i for i, layer in enumerate(layers))

    wqsf_masks = np.array([1 << i for i in (0, 1, 2, 23, 62, 63)], dtype=np.uint64)
    wqsf = np.zeros((ny, nx), dtype=np.uint64)
    for i, mask in enumerate(wqsf_masks):
        wqsf |= np.where(rng.random((ny, nx)) < 0.2 + 0.1 * i, mask, np.uint64(0))
    wqsf[0, :] = np.uint64(0xFFFFFFFFFFFFFFFF)  # fill

    sst = (
        15 + 12 * np.cos(np.radians(yy)) + 0.3 * rng.standard_normal((nt, ny, nx))
    ).astype(np.float32)

    n_status = 60
    status = (rng.random(n_status) < 0.1) * 1 | (rng.random(n_status) < 0.05) * 2
    status = (status | np.repeat(np.array([0, 4, 8, 12], np.int8), 15)).astype(np.int8)

    def var(dims, data, **attrs):
        return (dims, data, attrs)

    ds = xr.Dataset(
        {
            "land_cover": var(
                ("lat", "lon"),
                land_cover,
                long_name="Land cover class",
                standard_name="land_cover_lccs",
                flag_values=LAND_COVER_CODES,
                flag_meanings=LAND_COVER_MEANINGS,
                flag_colors=LAND_COVER_COLORS,
            ),
            "lccs_class": var(
                ("lat", "lon"),
                lccs,
                long_name="Land cover class defined in LCCS",
                flag_values=LCCS_CODES,
                flag_meanings=" ".join(f"lccs_{code}" for code in LCCS_CODES),
            ),
            "quality_level": var(
                ("time", "lat", "lon"),
                quality,
                long_name="Quality level of the SST pixel",
                flag_values=np.arange(6, dtype=np.int8),
                flag_meanings="no_data bad_data worst_quality low_quality "
                "acceptable_quality best_quality",
            ),
            "station_status": var(
                ("obs_time",),
                station,
                long_name="Station status",
                standard_name="status_flag",
                flag_values=np.array([0, 1, 2, 127], np.int8),
                flag_meanings="nominal degraded maintenance not_measured",
            ),
            "pixel_flags": var(
                ("time", "lat", "lon"),
                bits,
                long_name="Pixel classification flags",
                standard_name="status_flag",
                flag_masks=np.array([1, 2, 4, 8], np.uint8),
                flag_meanings="cloud cloud_shadow snow_ice invalid",
            ),
            "wqsf": var(
                ("lat", "lon"),
                wqsf,
                long_name="Water quality and science flags (Sentinel-3 like)",
                flag_masks=wqsf_masks,
                flag_meanings="invalid water land highglint ocl_fail cloud",
            ),
            "sensor_status_qc": var(
                ("status_time",),
                status,
                long_name="Sensor status (CF example 3.8)",
                flag_masks=np.array([1, 2, 12, 12, 12], np.int8),
                flag_values=np.array([1, 2, 4, 8, 12], np.int8),
                flag_meanings="low_battery hardware_fault offline_mode "
                "calibration_mode maintenance_mode",
            ),
            "sst": var(
                ("time", "lat", "lon"),
                sst,
                long_name="Sea surface temperature",
                standard_name="sea_surface_temperature",
                units="degC",
                ancillary_variables="pixel_flags quality_level",
            ),
            "broken_count": var(
                ("lat", "lon"),
                classes(np.arange(3, dtype=np.int8), 3),
                long_name="flag_values and flag_meanings counts differ",
                flag_values=np.arange(3, dtype=np.int8),
                flag_meanings="low high",
            ),
            "broken_mixed": var(
                ("lat", "lon"),
                classes(np.arange(4, dtype=np.int8), 4),
                long_name="Mixed values outside their masks",
                flag_values=np.arange(4, dtype=np.int8),
                flag_masks=np.array([1, 2, 4, 8], np.int8),
                flag_meanings="good questionable bad missing",
            ),
            "broken_colors": var(
                ("lat", "lon"),
                classes(np.arange(3, dtype=np.int8), 3),
                long_name="flag_colors of the wrong length (ignored, flags kept)",
                flag_values=np.arange(3, dtype=np.int8),
                flag_meanings="low medium high",
                flag_colors="#00ff00 #ff0000",
            ),
            "broken_float_masks": var(
                ("lat", "lon"),
                field.astype(np.float32),
                long_name="flag_masks on a float variable",
                flag_masks=np.array([1, 2], np.float32),
                flag_meanings="a b",
            ),
        },
        coords={
            "lat": (
                "lat",
                lat,
                {"units": "degrees_north", "standard_name": "latitude"},
            ),
            "lon": (
                "lon",
                lon,
                {"units": "degrees_east", "standard_name": "longitude"},
            ),
            "time": ("time", np.arange(nt), {"long_name": "time index"}),
            "obs_time": ("obs_time", obs_time),
            "status_time": ("status_time", np.arange(n_status)),
        },
        attrs={
            "title": "CF flag variables",
            "Conventions": "CF-1.11",
            "history": f"{CREATION_DATETIME.isoformat()} created by sample_data/flags.py",
        },
    )
    encoding = {
        "land_cover": {"_FillValue": np.uint8(255)},
        "lccs_class": {"_FillValue": None},
        "quality_level": {"_FillValue": np.int8(-128)},
        "station_status": {"_FillValue": np.int8(127)},
        "wqsf": {"_FillValue": np.uint64(0xFFFFFFFFFFFFFFFF)},
        "obs_time": {"units": "minutes since 2026-01-01", "dtype": "int32"},
    }
    return ds, encoding


def create_sample_netcdf_cf_flags() -> str:
    """Write ``sample_cf_flags.nc`` (NetCDF-4)."""
    if os.path.exists(FILE_NAME):
        print(f"🔧 NetCDF file {FILE_NAME} already exists. Skipping creation.")
        return FILE_NAME
    print("🔧 Creating sample NetCDF file with CF flag variables...")
    ds, encoding = build_cf_flags_dataset()
    ds.to_netcdf(FILE_NAME, engine="netcdf4", format="NETCDF4", encoding=encoding)
    return FILE_NAME
