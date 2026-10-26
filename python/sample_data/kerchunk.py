"""Kerchunk reference samples."""

import json
import os

from sample_data.common import optional_pkg_available


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
