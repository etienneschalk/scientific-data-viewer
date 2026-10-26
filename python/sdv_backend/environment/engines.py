"""xarray engine selection per file extension."""

from collections.abc import Sequence

import xarray as xr

from sdv_backend.environment.packages import (
    ENGINE_PACKAGES,
    check_package_is_usable,
    get_package_requirement,
)
from sdv_backend.types import EngineType, SupportedExtensionType

# Format to engine mapping based on xarray documentation
FORMAT_ENGINE_MAP: dict[SupportedExtensionType, list[EngineType]] = {
    # Built-in formats
    ".nc": ["netcdf4", "h5netcdf", "scipy"],
    ".nc4": ["netcdf4", "h5netcdf"],
    ".netcdf": ["netcdf4", "h5netcdf", "scipy"],
    ".cdf": ["cdflib"],  # NASA CDF format, not NetCDF
    #
    ".zarr": ["zarr"],
    #
    ".h5": ["h5netcdf", "h5py", "netcdf4"],
    ".hdf5": ["h5netcdf", "h5py", "netcdf4"],
    #
    ".grib": ["cfgrib"],
    ".grib2": ["cfgrib"],
    ".grb": ["cfgrib"],
    ".grb2": ["cfgrib"],
    #
    ".tif": ["rasterio"],
    ".tiff": ["rasterio"],
    ".geotiff": ["rasterio"],
    #
    ".jp2": ["rasterio"],
    ".jpeg2000": ["rasterio"],
    #
    # Synthetic extension: never from a lone `.json` suffix. Set when the
    # filename is `*.kerchunk.json` / `*.ref.json`, or `--open-as-kerchunk`.
    ".kerchunk": ["kerchunk"],
}


# User-configurable try-order for classic NetCDF suffixes only (not NASA .cdf).
NETCDF_ENGINE_ORDER_EXTENSIONS: frozenset[str] = frozenset({".nc", ".nc4", ".netcdf"})


DEFAULT_NETCDF_ENGINE_ORDER: tuple[str, ...] = ("netcdf4", "h5netcdf", "scipy")


ALLOWED_NETCDF_ENGINES: frozenset[str] = frozenset(DEFAULT_NETCDF_ENGINE_ORDER)


# We try to use DataTree when possible, but for some, do not attempt as the failure is certain.
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET: dict[str, bool] = dict.fromkeys(
    ENGINE_PACKAGES, False
)


DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["cfgrib"] = True


DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["rasterio"] = True


DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["cdflib"] = True  # cdflib uses its own API


DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["kerchunk"] = True  # no DataTree backend


def normalize_netcdf_engine_order(
    netcdf_engine_order: Sequence[str] | str | None = None,
) -> list[str]:
    """Return a validated NetCDF engine try-order.

    Unknown names are dropped. Engines omitted from the user list are appended
    in the xarray default order so files still open when a preferred engine is
    missing.
    """
    if netcdf_engine_order is None:
        parts: list[str] = []
    elif isinstance(netcdf_engine_order, str):
        parts = [
            item.strip() for item in netcdf_engine_order.split(",") if item.strip()
        ]
    else:
        parts = [str(item).strip() for item in netcdf_engine_order if str(item).strip()]

    ordered: list[str] = []
    seen: set[str] = set()
    for engine in parts:
        if engine in ALLOWED_NETCDF_ENGINES and engine not in seen:
            ordered.append(engine)
            seen.add(engine)
    for engine in DEFAULT_NETCDF_ENGINE_ORDER:
        if engine not in seen:
            ordered.append(engine)
    return ordered


def _engines_for_extension(
    file_extension: str,
    netcdf_engine_order: Sequence[str] | str | None = None,
) -> list[str]:
    """Engine try-order for a suffix, applying netcdfEngineOrder when relevant."""
    mapped = list(FORMAT_ENGINE_MAP.get(file_extension, []))
    if file_extension not in NETCDF_ENGINE_ORDER_EXTENSIONS:
        return mapped
    preferred = [
        engine
        for engine in normalize_netcdf_engine_order(netcdf_engine_order)
        if engine in mapped
    ]
    remainder = [engine for engine in mapped if engine not in preferred]
    return preferred + remainder


def get_available_engines(
    file_extension: str,
    netcdf_engine_order: Sequence[str] | str | None = None,
) -> list[str]:
    """Get available engines for a file extension.

    Parameters
    ----------
    file_extension : str
        File extension (e.g., '.nc', '.zarr')
    netcdf_engine_order : sequence of str or str, optional
        Preferred order for ``.nc`` / ``.nc4`` / ``.netcdf`` only.

    Returns
    -------
    List[str]
        List of available xarray engines for the file extension
    """
    available_engines: list[str] = []
    for engine in _engines_for_extension(file_extension, netcdf_engine_order):
        package_name: str = ENGINE_PACKAGES.get(engine, engine)
        if check_package_is_usable(package_name):
            available_engines.append(engine)

    return available_engines


def get_missing_packages(file_extension: str) -> list[str]:
    """Get missing packages required for a file extension.

    Parameters
    ----------
    file_extension : str
        File extension (e.g., '.nc', '.zarr')

    Returns
    -------
    List[str]
        List of missing packages required for the file extension
    """
    if file_extension not in FORMAT_ENGINE_MAP:
        return []

    missing_packages: list[str] = []
    for engine in FORMAT_ENGINE_MAP[file_extension]:
        package_name: str = ENGINE_PACKAGES.get(engine, engine)
        if not check_package_is_usable(package_name):
            missing_packages.append(get_package_requirement(package_name))

    return missing_packages


def can_use_datatree(engine: str) -> bool:
    """Check if DataTree can be used with the given engine.

    Parameters
    ----------
    engine : str
        xarray engine name

    Returns
    -------
    bool
        True if DataTree can be used, False otherwise
    """
    return (
        hasattr(xr, "open_datatree")
        and not DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET[engine]
    )
