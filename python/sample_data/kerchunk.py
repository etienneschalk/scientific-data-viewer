"""Kerchunk reference samples."""

import json
import os
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

from sample_data.common import CREATION_DATETIME, optional_pkg_available


def create_sample_kerchunk_reference(
    netcdf_path: str = "sample_data.nc",
    output_file: str = "sample_data.kerchunk.json",
):
    """Create a Kerchunk JSON reference to a local NetCDF file (v0.13 P1.5)."""
    if os.path.exists(output_file):
        print(f"🔗 Kerchunk reference {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🔗 Creating Kerchunk / virtual Zarr reference JSON...")

    if not optional_pkg_available("kerchunk"):
        print("  ❌ kerchunk not available, skipping Kerchunk reference sample.")
        print("     Install with: pip install kerchunk")
        return None

    if not os.path.exists(netcdf_path):
        print(
            f"  ❌ Target NetCDF {netcdf_path} not found; create NetCDF samples first."
        )
        return None

    from kerchunk.hdf import SingleHdf5ToZarr

    refs = SingleHdf5ToZarr(
        netcdf_path,
        netcdf_path,
        inline_threshold=4096,
    ).translate()

    with open(output_file, "w", encoding="utf-8") as handle:
        json.dump(refs, handle)

    print(f"✅ Created {output_file} → {netcdf_path}")
    return output_file


KERCHUNK_DIR = "kerchunk"
KERCHUNK_DAYS = ("2024-01-01", "2024-01-02", "2024-01-03")


def _daily_sst_dataset(day: str) -> xr.Dataset:
    """Four 6-hourly global SST fields: a warm equator and a wave travelling east."""
    lat = np.linspace(-87.5, 87.5, 36)
    lon = np.linspace(-177.5, 177.5, 72)
    time = pd.date_range(day, periods=4, freq="6h")
    phase = ((time - pd.Timestamp(KERCHUNK_DAYS[0])) / pd.Timedelta("1D")).values
    sst = (
        15
        + 12 * np.cos(np.deg2rad(lat))[None, :, None]
        + 2 * np.sin(np.deg2rad(lon)[None, None, :] + 2 * np.pi * phase[:, None, None])
    )
    return xr.Dataset(
        {
            "sst": (
                ("time", "lat", "lon"),
                sst.astype("float32"),
                {
                    "long_name": "Sea surface temperature",
                    "standard_name": "sea_surface_temperature",
                    "units": "degC",
                },
            ),
        },
        coords={
            "time": ("time", time, {"standard_name": "time"}),
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
        },
        attrs={
            "title": f"Synthetic sea surface temperature, {day}",
            "source": "python/sample_data/kerchunk.py",
            "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
        },
    )


def _write_json(path: Path, refs: dict) -> None:
    path.write_text(json.dumps(refs, indent=1, sort_keys=True), encoding="utf-8")


def create_sample_kerchunk_collection():
    """Kerchunk references of every kind, in ``kerchunk/``, to play with.

    Three daily NetCDF4 files (``sst_2024-01-0N.nc``) and references to them:

    - ``sst_2024-01-01.kerchunk.json``: one file, chunks stay in the NetCDF file;
    - ``sst_3days.kerchunk.json``: the three files combined along ``time``
      (``MultiZarrToZarr``), the usual Kerchunk use case: one virtual dataset
      of 12 time steps that reads three files;
    - ``sst_3days.ref.json``: the same, under the other name the viewer opens
      on a double click;
    - ``sst_3days_refs.json``: the same as an ordinary ``.json`` name: it opens
      only with **Open as Kerchunk / virtual Zarr** (right click);
    - ``sst_2024-01-01_inline.kerchunk.json``: every chunk inlined (base64), so
      it opens without the NetCDF files.

    Targets are relative paths (``sst_2024-01-01.nc``), resolved against the
    reference file's folder, so the folder can be moved as a whole.
    """
    output_dir = Path(KERCHUNK_DIR)
    if output_dir.exists():
        print(f"🔗 Kerchunk samples {output_dir}/ already exist. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing directory first.")
        return f"{KERCHUNK_DIR}/"

    print("🔗 Creating Kerchunk samples (single, multi-file, inline)...")

    if not optional_pkg_available("kerchunk"):
        print("  ❌ kerchunk not available, skipping Kerchunk samples.")
        print("     Install with: pip install kerchunk")
        return None

    from kerchunk.combine import MultiZarrToZarr
    from kerchunk.hdf import SingleHdf5ToZarr

    output_dir.mkdir()
    cwd = Path.cwd()
    # Run kerchunk inside the folder so the targets it records are bare names
    os.chdir(output_dir)
    try:
        netcdf_files = []
        for day in KERCHUNK_DAYS:
            name = f"sst_{day}.nc"
            _daily_sst_dataset(day).to_netcdf(
                name,
                engine="h5netcdf",
                encoding={
                    # One chunk per time step: the references point at each of them
                    "sst": {"chunksizes": (1, 36, 72), "zlib": True},
                    # Same units in every file, else the combined time axis
                    # sees 0, 6, 12, 18 three times
                    "time": {"units": f"hours since {KERCHUNK_DAYS[0]}"},
                },
            )
            netcdf_files.append(name)

        singles = [
            SingleHdf5ToZarr(name, name, inline_threshold=300).translate()
            for name in netcdf_files
        ]
        combined = MultiZarrToZarr(
            singles, concat_dims=["time"], identical_dims=["lat", "lon"]
        ).translate()
        inline = SingleHdf5ToZarr(
            netcdf_files[0], netcdf_files[0], inline_threshold=10**9
        ).translate()

        created = {
            f"sst_{KERCHUNK_DAYS[0]}.kerchunk.json": singles[0],
            "sst_3days.kerchunk.json": combined,
            "sst_3days.ref.json": combined,
            "sst_3days_refs.json": combined,
            f"sst_{KERCHUNK_DAYS[0]}_inline.kerchunk.json": inline,
        }
        for name, refs in created.items():
            _write_json(Path(name), refs)
    except Exception:
        os.chdir(cwd)
        shutil.rmtree(output_dir)
        raise
    os.chdir(cwd)

    names = [f"{KERCHUNK_DIR}/{name}" for name in [*netcdf_files, *created]]
    for name in names:
        print(f"✅ Created {name}")
    return names
