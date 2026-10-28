"""Optional package availability and version requirements."""

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as package_version
from importlib.util import find_spec

from sdv_backend._bootstrap import logger
from sdv_backend.types import EngineType

# Required packages for each engine
ENGINE_PACKAGES: dict[EngineType, str] = {
    "netcdf4": "netCDF4",
    "h5netcdf": "h5netcdf",
    "scipy": "scipy",
    "zarr": "zarr",
    "cfgrib": "cfgrib",
    "rasterio": "rioxarray",
    "cdflib": "cdflib",
    "kerchunk": "kerchunk",
}


# Minimum major version required per package, when the installed package can be
# importable but too old to work with the xarray version we target.
# xarray >= 2026.04.0 dropped support for zarr-python 2 (Zarr v2 *data* is still
# readable through zarr-python 3), so an importable zarr 2.x is not usable.
PACKAGE_MINIMUM_MAJOR_VERSIONS: dict[str, int] = {
    "zarr": 3,
}


def check_package_availability(package_name: str) -> bool:
    """Check if a Python package is available.

    Parameters
    ----------
    package_name : str
        Name of the package to check

    Returns
    -------
    bool
        True if package is available, False otherwise
    """
    logger.info(f"Checking package availability: {package_name}")
    return find_spec(package_name) is not None


def get_package_requirement(package_name: str) -> str:
    """Return the pip requirement string for a package, including any minimum version.

    Parameters
    ----------
    package_name : str
        Name of the package (e.g., 'zarr')

    Returns
    -------
    str
        Requirement usable in ``pip install`` (e.g., 'zarr>=3' or 'h5py')
    """
    minimum_major = PACKAGE_MINIMUM_MAJOR_VERSIONS.get(package_name)
    if minimum_major is None:
        return package_name
    return f"{package_name}>={minimum_major}"


def check_package_is_usable(package_name: str) -> bool:
    """Check that a package is available *and* new enough to be used.

    A package that is importable but older than its minimum supported major
    version is reported as unusable, so the caller can surface a clear
    "install this requirement" message instead of a cryptic failure later.

    Parameters
    ----------
    package_name : str
        Name of the package to check

    Returns
    -------
    bool
        True if the package is importable and satisfies its minimum version
    """
    if not check_package_availability(package_name):
        return False

    minimum_major = PACKAGE_MINIMUM_MAJOR_VERSIONS.get(package_name)
    if minimum_major is None:
        return True

    try:
        installed = package_version(package_name)
    except PackageNotFoundError:
        # Importable but without distribution metadata: assume it is usable
        # rather than hiding a working engine.
        logger.warning(
            f"Could not determine installed version of {package_name}; "
            "assuming it satisfies the minimum version"
        )
        return True

    try:
        installed_major = int(installed.split(".")[0])
    except ValueError:
        logger.warning(
            f"Could not parse version {installed!r} of {package_name}; "
            "assuming it satisfies the minimum version"
        )
        return True

    if installed_major < minimum_major:
        logger.warning(
            f"{package_name} {installed} is too old; "
            f"{get_package_requirement(package_name)} is required"
        )
        return False

    return True
