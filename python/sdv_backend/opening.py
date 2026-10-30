"""Opening files as xarray DataTree/Dataset, with decode_cf fallback."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Literal, cast

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.environment.engines import can_use_datatree
from sdv_backend.formats.kerchunk import kerchunk_refs_with_absolute_paths
from sdv_backend.formats.zarr import zarr_open_location
from sdv_backend.results import FileFormatInfo
from sdv_backend.types import DictOfDatasets

# Engines that do not take xarray's decode_cf (cdflib has its own API).
_ENGINES_WITHOUT_DECODE_CF: frozenset[str] = frozenset({"rasterio", "cdflib"})


# backend_kwargs passed to xarray, per engine
ENGINE_BACKEND_KWARGS: dict[str, dict[str, Any]] = {
    "cfgrib": {"indexpath": ""},  # Avoid intempestive .idx file creation
    "rasterio": {"mask_and_scale": False},
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
    return {} if engine in _ENGINES_WITHOUT_DECODE_CF else {"decode_cf": decode_cf}


def _open_with_engine(
    file_path: Path,
    engine: str,
    file_format_info: FileFormatInfo,
    convert_bands_to_variables: bool,
) -> "tuple[xr.DataTree | DictOfDatasets, bool]":
    """Open with one xarray engine: a DataTree, or ``{"/": Dataset}`` for engines
    without group support (GRIB, rasterio, kerchunk)."""
    backend_kwargs = dict(ENGINE_BACKEND_KWARGS.get(engine, {}))
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
        # JSON references: resolve relative target paths against the
        # reference file's folder. Otherwise kerchunk's xarray backend
        # expects a string path, not pathlib.
        open_location = (
            kerchunk_refs_with_absolute_paths(file_path)
            if file_path.suffix.lower() == ".json"
            else str(file_path)
        )

    open_fn = xr.open_datatree if can_use_datatree(engine) else xr.open_dataset
    opened, decode_cf_degraded = _open_with_decode_cf_fallback(
        lambda decode_cf: open_fn(
            open_location,
            engine=engine,
            **_xr_open_kwargs(engine, decode_cf),
            **open_extra,
            backend_kwargs=backend_kwargs,
        )
    )
    data = opened if isinstance(opened, xr.DataTree) else {"/": opened}
    return data, decode_cf_degraded


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
            data, decode_cf_degraded = _open_with_engine(
                file_path, engine, file_format_info, convert_bands_to_variables
            )
        except Exception as exc:
            exceptions.append(exc)
            continue
        return data, engine, decode_cf_degraded

    # If all engines failed, raise the last error
    raise exceptions[-1]


@dataclass
class OpenedData:
    """A file opened either as a DataTree or as a dict of per-group Datasets.

    Use with ``contextlib.closing`` so the underlying files are always closed.
    """

    data: xr.DataTree | DictOfDatasets
    used_engine: str
    decode_cf_degraded: bool

    @classmethod
    def open(
        cls,
        file_path: Path,
        file_format_info: FileFormatInfo,
        convert_bands_to_variables: bool = False,
    ) -> "OpenedData":
        """Open with engine fallback (see ``open_datatree_with_fallback``)."""
        data, used_engine, decode_cf_degraded = open_datatree_with_fallback(
            file_path, file_format_info, convert_bands_to_variables
        )
        return cls(data, used_engine, decode_cf_degraded)

    @property
    def is_tree(self) -> bool:
        return can_use_datatree(self.used_engine) and isinstance(self.data, xr.DataTree)

    @property
    def tree(self) -> xr.DataTree:
        return cast("xr.DataTree", self.data)

    @property
    def datasets(self) -> DictOfDatasets:
        return cast("DictOfDatasets", self.data)

    def group(
        self, group_name: PurePosixPath | str, inherit: bool | Literal["all_coords"]
    ) -> xr.Dataset:
        """Dataset of one group; ``inherit`` is DataTree ``to_dataset(inherit=...)``."""
        if self.is_tree:
            return self.tree[str(group_name)].to_dataset(inherit=inherit)
        return self.datasets[str(group_name)]

    def close(self) -> None:
        if self.is_tree:
            self.tree.close()
            return
        for group, xds in self.datasets.items():
            logger.info(f"Close {group=}")
            xds.close()
