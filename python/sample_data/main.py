"""Entry point: create every sample file under sample-data/."""

import os
import traceback
import zlib
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from sample_data.broken import create_broken_files
from sample_data.disposable import (
    cleanup_disposable_files,
    create_disposable_netcdf_files,
    create_disposable_zarr_files,
)
from sample_data.geotiff import (
    create_sample_geotiff,
    create_sample_geotiff_cog,
    create_sample_geotiff_geotiff,
    create_sample_geotiff_tiff,
    create_sample_multiband_geotiff,
)
from sample_data.grib import (
    create_sample_grib,
    create_sample_grib_grb,
    create_sample_grib_grb2_file,
    create_sample_grib_grib2,
)
from sample_data.hdf5 import create_sample_hdf5, create_sample_hdf5_hdf5
from sample_data.jp2 import create_sample_jp2, create_sample_jp2_jpeg2000
from sample_data.kerchunk import create_sample_kerchunk_reference
from sample_data.netcdf import (
    create_sample_file_with_spaces,
    create_sample_netcdf,
    create_sample_netcdf4,
    create_sample_netcdf_broken_datetime_variable,
    create_sample_netcdf_cdf,
    create_sample_netcdf_compound_dtype_variable,
    create_sample_netcdf_gzip,
    create_sample_netcdf_large_4d,
    create_sample_netcdf_netcdf,
    create_sample_netcdf_no_attributes,
)
from sample_data.netcdf_encoding import create_sample_netcdf_many_encoding
from sample_data.netcdf_groups import (
    create_sample_netcdf_multiple_groups,
    create_sample_netcdf_unordered_groups,
)
from sample_data.netcdf_names import (
    create_sample_netcdf_complex_long_names,
    create_sample_netcdf_long_variable_names,
    create_sample_netcdf_many_vars,
)
from sample_data.temporal import create_temporal_datasets
from sample_data.zarr import (
    create_sample_zarr_arborescence,
    create_sample_zarr_deeply_nested_attributes,
    create_sample_zarr_inherited_coords,
    create_sample_zarr_single_group_from_dataset,
    create_sample_zarr_v3_plain_directory,
    create_sample_zarr_v3_sharded,
    create_sample_zarr_v3_zip_archive,
    create_sample_zarr_with_nested_groups_from_datatree,
    create_sample_zarr_with_nested_groups_from_zarr,
)


@dataclass(frozen=True)
class Generator:
    """One sample generator.

    ``create`` returns the created file name, a list of names, or a falsy value
    when an optional dependency is missing (then ``skipped`` is reported, if set).
    """

    create: Callable[[], str | list[str] | None]
    label: str
    skipped: str | None = None


G = Generator
SECTIONS: list[tuple[str, list[Generator]]] = [
    (
        "📁 Creating NetCDF files...",
        [
            G(create_sample_netcdf, "NetCDF"),
            G(create_sample_netcdf4, "NetCDF4"),
            G(create_sample_netcdf_cdf, "CDF (NASA)"),
            G(create_sample_netcdf_netcdf, "NetCDF NETCDF"),
            G(create_sample_netcdf_many_vars, "NetCDF (Many Variables)"),
            G(
                create_sample_netcdf_multiple_groups,
                "NetCDF Multiple Groups",
                "NetCDF Multiple Groups (netCDF4 not available)",
            ),
            G(
                create_sample_netcdf_unordered_groups,
                "NetCDF (Unordered Groups)",
                "NetCDF Unordered Groups (netCDF4 not available)",
            ),
            G(create_sample_netcdf_long_variable_names, "NetCDF (Long Variable Names)"),
            G(create_sample_netcdf_complex_long_names, "NetCDF (Complex Long Names)"),
            # Large 4D dataset for timeout testing (issue #97)
            G(create_sample_netcdf_large_4d, "NetCDF (Large 4D - Timeout Test)"),
            G(create_sample_netcdf_many_encoding, "NetCDF (Many Encoding)"),
            G(create_sample_netcdf_no_attributes, "NetCDF (No Attributes)"),
            G(
                create_sample_netcdf_broken_datetime_variable,
                "NetCDF (Broken Datetime Units)",
            ),
            G(create_sample_netcdf_compound_dtype_variable, "NetCDF (Compound Dtype)"),
            G(create_sample_netcdf_gzip, "NetCDF (gzip / filters)"),
        ],
    ),
    (
        "📁 Creating HDF5 files...",
        [
            G(create_sample_hdf5, "HDF5"),
            G(create_sample_hdf5_hdf5, "HDF5 HDF5"),
        ],
    ),
    (
        "📁 Creating GRIB files...",
        [
            G(create_sample_grib, "GRIB", "GRIB (cfgrib not available)"),
            G(create_sample_grib_grib2, "GRIB2", "GRIB2 (eccodes not available)"),
            G(create_sample_grib_grb, "GRIB GRB", "GRIB GRB (eccodes not available)"),
            G(
                create_sample_grib_grb2_file,
                "GRIB GRB2",
                "GRIB GRB2 (eccodes not available)",
            ),
        ],
    ),
    (
        "📁 Creating GeoTIFF files...",
        [
            G(create_sample_geotiff, "GeoTIFF", "GeoTIFF (rioxarray not available)"),
            G(
                create_sample_geotiff_tiff,
                "GeoTIFF TIFF",
                "GeoTIFF TIFF (rioxarray not available)",
            ),
            G(
                create_sample_geotiff_geotiff,
                "GeoTIFF GEOTIFF",
                "GeoTIFF GEOTIFF (rioxarray not available)",
            ),
            G(
                create_sample_multiband_geotiff,
                "Multi-band GeoTIFF",
                "Multi-band GeoTIFF (rioxarray not available)",
            ),
            G(
                create_sample_geotiff_cog,
                "Cloud Optimized GeoTIFF (COG)",
                "COG GeoTIFF (rasterio not available)",
            ),
        ],
    ),
    (
        "📁 Creating JPEG-2000 files...",
        [
            G(create_sample_jp2, "JPEG-2000", "JPEG-2000 (rioxarray not available)"),
            G(
                create_sample_jp2_jpeg2000,
                "JPEG-2000 JPEG2000",
                "JPEG-2000 JPEG2000 (rioxarray not available)",
            ),
        ],
    ),
    (
        "📁 Creating Zarr files...",
        [
            G(
                create_sample_zarr_single_group_from_dataset,
                "Zarr",
                "Zarr (zarr not available)",
            ),
            G(
                create_sample_zarr_with_nested_groups_from_zarr,
                "Nested Zarr",
                "Nested Zarr (zarr not available)",
            ),
            G(
                create_sample_zarr_with_nested_groups_from_datatree,
                "xr.DataTree Zarr",
                "xr.DataTree Zarr (zarr or datatree not available)",
            ),
            G(
                create_sample_zarr_arborescence,
                "Zarr Arborescence",
                "Zarr Arborescence (zarr or xarray not available)",
            ),
            G(
                create_sample_zarr_inherited_coords,
                "Zarr Inherited Coords",
                "Zarr Inherited Coords (zarr or xarray not available)",
            ),
            G(
                create_sample_zarr_deeply_nested_attributes,
                "Zarr deeply nested attrs (Issue #120)",
                "Zarr deeply nested attrs (zarr not available)",
            ),
        ],
    ),
    (
        "📁 Creating v0.13 Zarr / Kerchunk samples...",
        [
            G(
                create_sample_zarr_v3_plain_directory,
                "Zarr v3 (unsuffixed directory)",
                "Zarr v3 unsuffixed directory (zarr not available)",
            ),
            G(
                create_sample_zarr_v3_sharded,
                "Zarr v3 (sharded)",
                "Zarr v3 sharded (zarr not available)",
            ),
            G(
                create_sample_zarr_v3_zip_archive,
                "Zarr v3 (ZIP archive)",
                "Zarr v3 ZIP (zarr not available)",
            ),
            G(
                create_sample_kerchunk_reference,
                "Kerchunk (virtual Zarr)",
                "Kerchunk reference (kerchunk not available)",
            ),
        ],
    ),
    (
        "📄 Creating file with spaces in name...",
        [G(create_sample_file_with_spaces, "File with Spaces")],
    ),
    (
        "💥 Creating broken files for error handling...",
        [G(create_broken_files, "Broken File")],
    ),
    (
        "📅 Creating temporal test datasets (temporal-datasets/)...",
        [G(create_temporal_datasets, "Temporal")],
    ),
]

DISPOSABLE = [
    G(create_disposable_netcdf_files, "Disposable NetCDF"),
    G(create_disposable_zarr_files, "Disposable Zarr"),
]


def seed_for(generator: Generator) -> int:
    """Stable numpy seed per generator, so each file is reproducible on its own
    (independent of which generators ran before it)."""
    return zlib.crc32(generator.create.__name__.encode())


class Report:
    def __init__(self) -> None:
        self.created: list[tuple[str, str]] = []
        self.skipped: list[str] = []
        self.failed: list[str] = []

    def print_summary(self) -> None:
        print("\n" + "=" * 80)
        print(f"\n📊 Created {len(self.created)} files:")
        for filename, format_name in self.created:
            print(f"  • {filename} ({format_name} format)")
        if self.skipped:
            print(f"\n⚠️  Skipped {len(self.skipped)} formats (missing dependencies):")
            for format_name in self.skipped:
                print(f"  • {format_name}")
        if self.failed:
            print(f"\n❌ {len(self.failed)} generator(s) failed:")
            for name in self.failed:
                print(f"  • {name}")
            return
        print("\n✅ Sample data files created successfully!")
        print("\n🎯 You can now test the VSCode extension with these files!")
        print("   Right-click on any file in VS Code and select 'Open in Data Viewer'")

    def run(self, generator: Generator) -> None:
        np.random.seed(seed_for(generator))
        try:
            result = generator.create()
        except Exception:
            name = generator.create.__name__
            print(f"\n❌ {name} failed:\n{traceback.format_exc()}")
            self.failed.append(f"{generator.label} ({name})")
            return
        if not result:
            if generator.skipped:
                self.skipped.append(generator.skipped)
            return
        for filename in result if isinstance(result, list) else [result]:
            self.created.append((filename, generator.label))


def main(do_create_disposable_files: bool = False) -> int:
    """Create all sample data files; returns 1 if any generator failed."""
    print("🔬 Creating sample scientific data files for VSCode extension testing...")
    print("=" * 80)

    os.makedirs("sample-data", exist_ok=True)
    os.chdir("sample-data")

    report = Report()
    for title, generators in SECTIONS:
        print(f"\n{title}")
        for generator in generators:
            report.run(generator)

    if do_create_disposable_files:
        print("\n🗑️ Creating disposable files for deletion testing...")
        cleanup_disposable_files()
        for generator in DISPOSABLE:
            report.run(generator)
    else:
        print("\n🗑️ Skipping disposable files for deletion testing...")

    report.print_summary()
    return 1 if report.failed else 0
