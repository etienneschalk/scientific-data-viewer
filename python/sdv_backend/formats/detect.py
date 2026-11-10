"""File format detection from path/extension."""

from collections.abc import Sequence
from pathlib import Path

from sdv_backend._bootstrap import logger
from sdv_backend.environment.engines import (
    FORMAT_ENGINE_MAP,
    get_available_engines,
    get_missing_packages,
)
from sdv_backend.formats.kerchunk import (
    kerchunk_json_error,
    looks_like_kerchunk_filename,
    looks_like_kerchunk_parquet,
)
from sdv_backend.formats.zarr import (
    detect_zarr_format_version,
    is_zarr_store,
    looks_like_zip,
    zip_zarr_root_prefix,
)
from sdv_backend.results import FileFormatInfo
from sdv_backend.types import SupportedExtensionType

# Format display names
FORMAT_DISPLAY_NAMES: dict[SupportedExtensionType, str] = {
    ".nc": "NetCDF",
    ".nc4": "NetCDF4",
    ".netcdf": "NetCDF",
    ".cdf": "CDF (NASA)",
    #
    ".zarr": "Zarr",
    #
    ".h5": "HDF5",
    ".hdf5": "HDF5",
    #
    ".grib": "GRIB",
    ".grib2": "GRIB2",
    ".grb": "GRIB",
    ".grb2": "GRIB2",
    #
    ".tif": "GeoTIFF",
    ".tiff": "GeoTIFF",
    ".geotiff": "GeoTIFF",
    #
    ".jp2": "JPEG-2000",
    ".jpeg2000": "JPEG-2000",
    ".kerchunk": "Kerchunk (virtual Zarr)",
}


def detect_file_format(
    file_path: Path,
    netcdf_engine_order: Sequence[str] | str | None = None,
    open_as_kerchunk: bool = False,
) -> FileFormatInfo:
    """Detect file format and return format information.

    Parameters
    ----------
    file_path : Path
        Path to the data file
    netcdf_engine_order : sequence of str or str, optional
        Preferred NetCDF engine order for ``.nc`` / ``.nc4`` / ``.netcdf``.
    open_as_kerchunk : bool
        Treat JSON/Parquet as Kerchunk virtual Zarr even without a special name.

    Returns
    -------
    FileFormatInfo
        Information about the detected file format including available engines
    """
    ext: str = file_path.suffix.lower()
    zip_store = looks_like_zip(file_path)
    if zip_store:
        prefix = zip_zarr_root_prefix(file_path)
        if prefix is None:
            # Explorer offers Open on every .zip (VS Code cannot sniff archives).
            # Distinguish "not a Zarr store" from "missing zarr package".
            return FileFormatInfo(
                extension=".zip",
                display_name="ZIP",
                available_engines=[],
                missing_packages=[],
            )
        logger.info(
            f"Detected Zarr store inside ZIP {file_path}"
            + (f" at prefix {prefix!r}" if prefix else " (archive root)")
        )
        ext = ".zarr"
    elif open_as_kerchunk or looks_like_kerchunk_filename(file_path):
        if looks_like_kerchunk_parquet(file_path):
            ext = ".kerchunk"
            logger.info(f"Opening Parquet as Kerchunk references: {file_path}")
        else:
            invalid = kerchunk_json_error(file_path)
            if invalid is not None:
                logger.info(invalid)
                return FileFormatInfo(
                    extension=".kerchunk",
                    display_name="Kerchunk (virtual Zarr)",
                    available_engines=[],
                    missing_packages=[],
                )
            ext = ".kerchunk"
            logger.info(f"Detected Kerchunk reference JSON: {file_path}")
    elif ext not in FORMAT_ENGINE_MAP and is_zarr_store(file_path):
        logger.info(f"Detected Zarr store without a .zarr suffix: {file_path}")
        ext = ".zarr"
    display_name: str = FORMAT_DISPLAY_NAMES.get(ext, "Unknown")
    if ext == ".zarr":
        # Zarr v2 and v3 differ in metadata, sharding and codecs, so report
        # which one is on disk rather than a bare "Zarr".
        zarr_version = detect_zarr_format_version(file_path)
        if zarr_version is not None:
            display_name = f"{display_name} v{zarr_version}"
        if zip_store:
            display_name = f"{display_name} (ZIP)"
    available_engines: list[str] = get_available_engines(ext, netcdf_engine_order)
    missing_packages: list[str] = get_missing_packages(ext)

    return FileFormatInfo(
        extension=ext,
        display_name=display_name,
        available_engines=available_engines,
        missing_packages=missing_packages,
    )
