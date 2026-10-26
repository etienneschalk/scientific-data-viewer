"""Opening files as xarray DataTree/Dataset, with decode_cf fallback."""

from collections.abc import Callable
from pathlib import Path
from typing import Any

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.environment.engines import can_use_datatree
from sdv_backend.environment.packages import check_package_availability
from sdv_backend.formats.zarr import zarr_open_location
from sdv_backend.results import FileFormatInfo
from sdv_backend.types import DictOfDatasets, EngineType

# Default backend kwargs for each engine
DEFAULT_XR_OPEN_KWARGS: dict[EngineType, dict[str, Any]] = {
    "netcdf4": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "h5netcdf": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "scipy": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "zarr": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "h5py": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "cfgrib": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "rasterio": {},
    "cdflib": {},  # cdflib uses its own API, not xr.open_dataset
    "kerchunk": {
        "decode_cf": True,
    },
}


# Default backend kwargs for each engine
DEFAULT_ENGINE_BACKEND_KWARGS: dict[EngineType, dict[str, Any] | None] = {
    "netcdf4": None,
    "h5netcdf": None,
    "scipy": None,
    "zarr": None,
    "h5py": None,
    "cfgrib": {"indexpath": ""},  # Avoid intempestive .idx file creation
    "rasterio": {"mask_and_scale": False},
    "cdflib": None,  # cdflib uses its own API, not xr.open_dataset
    "kerchunk": None,
}


def _is_decode_cf_time_error(exc: BaseException) -> bool:
    return isinstance(exc, ValueError) and "unable to decode time units" in str(exc)


def _open_with_decode_cf_fallback(open_fn: Callable[[bool], Any]) -> tuple[Any, bool]:
    try:
        return open_fn(True), False
    except Exception as exc:
        if not _is_decode_cf_time_error(exc):
            raise
        logger.warning(
            f"CF time decode failed ({exc!r}); retrying with decode_cf=False"
        )
        return open_fn(False), True


def _xr_open_kwargs(engine: str, decode_cf: bool) -> dict[str, Any]:
    kwargs = DEFAULT_XR_OPEN_KWARGS[engine].copy()
    if "decode_cf" in kwargs:
        kwargs["decode_cf"] = decode_cf
    return kwargs


def open_datatree_with_fallback(
    file_path: Path,
    file_format_info: FileFormatInfo,
    convert_bands_to_variables: bool = False,
) -> "tuple[xr.DataTree | DictOfDatasets, str, bool]":
    """Open datatree or dataset with fallback to different engines.

    Attempts to open the file as a DataTree first, then falls back to
    opening as individual datasets grouped by hierarchy.

    Parameters
    ----------
    file_path : Path
        Path to the data file
    file_format_info : FileFormatInfo
        Format information for the file

    Returns
    -------
    tuple
        Tuple containing (data_structure, engine_name, decode_cf_degraded) where
        data_structure is either a DataTree or DictOfDatasets

    Raises
    ------
    ImportError
        If no engines are available for the file format
    Exception
        If all engines fail to open the file
    """
    if not file_format_info.is_supported:
        raise ImportError(
            f"No engines available for {file_format_info.extension} files. "
            f"Missing packages: {', '.join(file_format_info.missing_packages)}"
        )

    # Special handling for cdflib (NASA CDF format)
    # cdflib uses its own API, not xr.open_dataset
    if "cdflib" in file_format_info.available_engines:
        try:
            import cdflib.xarray

            logger.info("Using cdflib to open CDF file")
            xds = cdflib.xarray.cdf_to_xarray(file_path)
            # cdflib returns a Dataset, wrap it in a dict for consistency
            xds_dict: DictOfDatasets = {"/": xds}
            return xds_dict, "cdflib", False
        except Exception as exc:
            logger.error(f"Failed to open CDF file with cdflib: {exc!r}")
            # If cdflib fails and it's the only engine, raise the error
            if len(file_format_info.available_engines) == 1:
                raise exc
            # Otherwise, continue to try other engines (though there shouldn't be any for .cdf)

    # Try each available engine
    exceptions: list[Exception] = []

    for engine in file_format_info.available_engines:
        # Skip cdflib as it's handled separately above
        if engine == "cdflib":
            continue

        try:
            # Prepare backend kwargs based on configuration
            backend_kwargs = (
                DEFAULT_ENGINE_BACKEND_KWARGS[engine].copy()
                if DEFAULT_ENGINE_BACKEND_KWARGS[engine]
                else {}
            )

            # Apply band_as_variable for rasterio if configuration is enabled
            if engine == "rasterio" and convert_bands_to_variables:
                backend_kwargs["band_as_variable"] = True
                logger.info(
                    f"Using band_as_variable=True for {file_format_info.extension} file"
                )

            open_location: Any = file_path
            open_extra: dict[str, Any] = {}
            if engine == "zarr":
                open_location, open_extra = zarr_open_location(file_path)
            elif engine == "kerchunk":
                # kerchunk's xarray backend expects a string path, not pathlib.
                open_location = str(file_path)

            if can_use_datatree(engine):
                xdt_or_xds, decode_cf_degraded = _open_with_decode_cf_fallback(
                    lambda decode_cf,
                    loc=open_location,
                    extra=open_extra,
                    eng=engine,
                    bk=backend_kwargs: (
                        xr.open_datatree(
                            loc,
                            engine=eng,
                            **_xr_open_kwargs(eng, decode_cf),
                            **extra,
                            backend_kwargs=bk,
                        )
                    )
                )
                return xdt_or_xds, engine, decode_cf_degraded
            else:
                # Attempt to replace DataTree by a dict of Datasets
                if engine == "netcdf4" and check_package_availability("netCDF4"):
                    import netCDF4

                    with netCDF4.Dataset(file_path) as f:
                        groups = list(f.groups)

                    groups = ["/", *groups]
                elif engine == "h5netcdf" and check_package_availability("h5netcdf"):
                    import h5netcdf

                    with h5netcdf.File(file_path) as f:
                        groups = [str(g) for g in f.groups]

                    groups = ["/", *groups]
                else:
                    groups = ["/"]

                def open_group(
                    decode_cf: bool,
                    group: str = "/",
                    *,
                    loc: Any = open_location,
                    extra: dict[str, Any] = open_extra,
                    eng: str = engine,
                    bk: dict[str, Any] = backend_kwargs,
                ) -> xr.Dataset:
                    kwargs = _xr_open_kwargs(eng, decode_cf)
                    if extra.get("group") and group != "/":
                        raise NotImplementedError(
                            "Nested ZIP Zarr group listing is not implemented"
                        )
                    if group == "/":
                        return xr.open_dataset(
                            loc,
                            engine=eng,
                            **kwargs,
                            **extra,
                            backend_kwargs=bk,
                        )
                    return xr.open_dataset(
                        loc,
                        engine=eng,
                        **kwargs,
                        **extra,
                        backend_kwargs=bk,
                        group=group,
                    )

                root_ds, decode_cf_degraded = _open_with_decode_cf_fallback(open_group)
                xds_dict: DictOfDatasets = {"/": root_ds}
                decode_cf = not decode_cf_degraded
                for group in groups:
                    if group == "/":
                        continue
                    xds_dict[group] = open_group(decode_cf, group)
                return xds_dict, engine, decode_cf_degraded
        except NotImplementedError as exc:
            # Fallback on dataset
            logger.warning(
                f"Opening file as DataTree is not implemented with engine {engine}: {exc!r}"
            )
            logger.warning("Fallback to opening file as Dataset")
            xds, decode_cf_degraded = _open_with_decode_cf_fallback(
                lambda decode_cf, loc=open_location, extra=open_extra, eng=engine: (
                    xr.open_dataset(
                        loc,
                        engine=eng,
                        **_xr_open_kwargs(eng, decode_cf),
                        **extra,
                        backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[eng],
                    )
                )
            )
            return xds, engine, decode_cf_degraded
        except Exception as exc:
            exceptions.append(exc)
            continue

    # If all engines failed, raise the last error
    raise exceptions[-1]
