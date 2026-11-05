"""Opening files as xarray DataTree/Dataset, with engine and time-decoding fallbacks.

Which decoders and ``backend_kwargs`` are passed is decided in
``sdv_backend.decoding``; each open returns an ``OpenReport`` saying how the
file was opened (shown in the viewer's Troubleshooting section).
"""

import warnings
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Literal, cast

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.decoding import (
    KIND_KWARG,
    SOURCE_FALLBACK,
    SOURCE_RAW,
    SOURCE_SETTING,
    DecodingOptions,
    ResolvedOpen,
    format_open_call,
    resolve_open_kwargs,
)
from sdv_backend.environment.engines import can_use_datatree
from sdv_backend.formats.kerchunk import kerchunk_refs_with_absolute_paths
from sdv_backend.formats.zarr import zarr_open_location
from sdv_backend.results import EngineFailure, FileFormatInfo, OpenKwarg, OpenReport
from sdv_backend.types import DictOfDatasets

# Engines whose open_dataset forwards unknown keywords (kerchunk passes them to
# xr.open_zarr): every decoder is taken.
_ENGINES_FORWARDING_KWARGS: frozenset[str] = frozenset({"kerchunk"})

# cftime calendars that numpy datetime64 represents exactly
_STANDARD_CALENDARS: frozenset[str] = frozenset(
    {"standard", "gregorian", "proleptic_gregorian"}
)


def _is_decode_cf_time_error(exc: BaseException) -> bool:
    return isinstance(exc, ValueError) and "unable to decode time units" in str(exc)


def _engine_parameters(engine: str) -> frozenset[str] | None:
    """Keywords the engine's ``open_dataset`` takes; None: any (or unknown)."""
    if engine in _ENGINES_FORWARDING_KWARGS:
        return None
    try:
        parameters = xr.backends.list_engines()[engine].open_dataset_parameters
    except Exception:
        return None
    return frozenset(parameters) if parameters else None


def _error_text(exc: BaseException) -> str:
    return f"{type(exc).__name__}: {exc}"


def _open_location(file_path: Path, engine: str) -> tuple[Any, dict[str, Any], str]:
    """What to pass to xarray, extra keywords, and how to show it in the report."""
    if engine == "zarr":
        location, extra = zarr_open_location(file_path)
        if extra:  # ZIP archive opened through a ZipStore
            return (
                location,
                extra,
                f"zarr.storage.ZipStore({str(file_path)!r}, mode='r')",
            )
        return location, extra, repr(str(file_path))
    if engine == "kerchunk" and file_path.suffix.lower() == ".json":
        # JSON references: relative target paths are resolved against the
        # reference file's folder (kerchunk's backend needs a str otherwise)
        return (
            kerchunk_refs_with_absolute_paths(file_path),
            {},
            f"{str(file_path)!r}  # references, target paths made absolute",
        )
    if engine == "kerchunk":
        return str(file_path), {}, repr(str(file_path))
    return file_path, {}, repr(str(file_path))


def _cftime_to_datetime64(ds: xr.Dataset) -> tuple[xr.Dataset, list[str]]:
    """Convert 1-D cftime coordinates of standard calendars to datetime64.

    rioxarray always decodes times as cftime objects (it has no use_cftime);
    datetime64 makes raster times behave like NetCDF ones (date axes, filters).
    """
    converted: list[str] = []
    for name, coord in ds.coords.items():
        if coord.ndim != 1 or coord.dtype != object or coord.size == 0:
            continue
        try:
            index = xr.CFTimeIndex(coord.values)
        except (TypeError, ValueError, ImportError):
            continue  # Not cftime objects (or cftime missing)
        if index.calendar not in _STANDARD_CALENDARS:
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                try:
                    datetimes = index.to_datetimeindex(time_unit="ns")
                except TypeError:  # xarray < 2025.01: no time_unit
                    datetimes = index.to_datetimeindex()
        except (ValueError, OverflowError) as exc:
            logger.info(f"Keeping cftime values of {name!r}: {exc!r}")
            continue
        ds = ds.assign_coords({name: (coord.dims, datetimes.values, coord.attrs)})
        converted.append(str(name))
    return ds, converted


def _rasterio_notes(
    ds: xr.Dataset,
    options: DecodingOptions,
    resolved: ResolvedOpen,
    band_as_variable: bool,
) -> tuple[xr.Dataset, list[str]]:
    """Raster time post-processing, and what the report should say about it."""
    notes: list[str] = []
    if band_as_variable and "NETCDF_DIM_EXTRA" in ds.attrs:
        notes.append(
            "convertBandsToVariables: each band is a separate variable, so the band "
            f"axis described by NETCDF_DIM_EXTRA={ds.attrs['NETCDF_DIM_EXTRA']!r} "
            "is not built and its values (e.g. times) stay raw in the NETCDF_DIM_* "
            "attributes. Turn convertBandsToVariables off to get it as a decoded "
            "coordinate."
        )
    if resolved.decoders.get("decode_times") is False:
        return ds, notes
    if options.use_cftime is True:
        notes.append("useCftime=on: raster times are kept as cftime objects.")
        return ds, notes
    ds, converted = _cftime_to_datetime64(ds)
    if converted:
        notes.append(
            f"Raster times {', '.join(converted)} converted from cftime to "
            "datetime64 (standard calendar; rioxarray always decodes to cftime)."
        )
    return ds, notes


def _report(
    engine: str,
    function: str,
    location_text: str,
    options: DecodingOptions,
    kwargs: list[OpenKwarg],
    notes: list[str],
    failed_engines: list[EngineFailure],
    fallback_reason: str | None = None,
) -> OpenReport:
    return OpenReport(
        engine=engine,
        function=function,
        raw=options.raw,
        call=format_open_call(
            function, location_text, None if engine == "cdflib" else engine, kwargs
        ),
        kwargs=kwargs,
        degraded_decoders=[k.name for k in kwargs if k.source == SOURCE_FALLBACK],
        fallback_reason=fallback_reason,
        notes=notes,
        failed_engines=failed_engines,
    )


def _open_with_engine(
    file_path: Path,
    engine: str,
    convert_bands_to_variables: bool,
    options: DecodingOptions,
    failed_engines: list[EngineFailure],
) -> "tuple[xr.DataTree | DictOfDatasets, OpenReport]":
    """Open with one xarray engine: a DataTree, or ``{"/": Dataset}`` for engines
    without group support (GRIB, rasterio, kerchunk)."""
    location, open_extra, location_text = _open_location(file_path, engine)
    band_as_variable = engine == "rasterio" and convert_bands_to_variables
    viewer_backend_kwargs = (
        {"band_as_variable": (True, "setting convertBandsToVariables")}
        if band_as_variable
        else {}
    )
    accepted = _engine_parameters(engine)
    use_tree = can_use_datatree(engine)
    open_fn = xr.open_datatree if use_tree else xr.open_dataset
    function = "xarray.open_datatree" if use_tree else "xarray.open_dataset"

    def attempt(time_fallback: bool) -> tuple[Any, ResolvedOpen]:
        resolved = resolve_open_kwargs(
            engine,
            options,
            accepted,
            time_fallback=time_fallback,
            viewer_backend_kwargs=viewer_backend_kwargs,
            reserved=frozenset(open_extra),
        )
        opened = open_fn(
            location,
            engine=engine,
            **resolved.decoders,
            **open_extra,
            backend_kwargs=resolved.backend_kwargs,
        )
        return opened, resolved

    fallback_reason = None
    try:
        opened, resolved = attempt(time_fallback=False)
    except Exception as exc:
        if options.raw or not _is_decode_cf_time_error(exc):
            raise
        logger.warning(
            f"CF time decode failed ({exc!r}); retrying with decode_times=False"
        )
        fallback_reason = _error_text(exc)
        opened, resolved = attempt(time_fallback=True)

    notes = list(resolved.notes)
    data: xr.DataTree | DictOfDatasets
    if isinstance(opened, xr.DataTree):
        data = opened
    else:
        ds = opened
        if engine == "rasterio":
            ds, raster_notes = _rasterio_notes(ds, options, resolved, band_as_variable)
            notes.extend(raster_notes)
        data = {"/": ds}

    kwargs = list(resolved.kwargs) + [
        OpenKwarg(name, value, "viewer (ZIP store)", KIND_KWARG)
        for name, value in open_extra.items()
    ]
    report = _report(
        engine,
        function,
        location_text,
        options,
        kwargs,
        notes,
        failed_engines,
        fallback_reason,
    )
    return data, report


def _open_with_cdflib(
    file_path: Path, options: DecodingOptions
) -> tuple[xr.Dataset, OpenReport]:
    """NASA CDF through cdflib's own API: its two flags map to the decoders."""
    import cdflib.xarray

    kwargs: list[OpenKwarg] = []
    notes: list[str] = []
    # cdflib defaults: to_datetime=True, fillval_to_nan=False
    if options.raw:
        kwargs.append(OpenKwarg("to_datetime", False, SOURCE_RAW, KIND_KWARG))
    elif options.decode_times is False:
        kwargs.append(
            OpenKwarg("to_datetime", False, f"{SOURCE_SETTING} decodeTimes", KIND_KWARG)
        )
    if options.mask_and_scale is True and not options.raw:
        kwargs.append(
            OpenKwarg(
                "fillval_to_nan", True, f"{SOURCE_SETTING} maskAndScale", KIND_KWARG
            )
        )
    for name, value in (
        ("decode_coords", options.decode_coords),
        ("use_cftime", options.use_cftime),
    ):
        if value is not None and not options.raw:
            notes.append(
                f"{name}={value!r} ({SOURCE_SETTING}) does not apply to cdflib: "
                "its default behaviour applies."
            )
    if options.engine_backend_kwargs.get("cdflib"):
        notes.append("engineBackendKwargs.cdflib ignored: cdflib takes none.")

    logger.info("Using cdflib to open CDF file")
    xds = cdflib.xarray.cdf_to_xarray(
        str(file_path), **{kwarg.name: kwarg.value for kwarg in kwargs}
    )
    report = _report(
        "cdflib",
        "cdflib.xarray.cdf_to_xarray",
        repr(str(file_path)),
        options,
        kwargs,
        notes,
        [],
    )
    return xds, report


def open_datatree_with_fallback(
    file_path: Path,
    file_format_info: FileFormatInfo,
    convert_bands_to_variables: bool = False,
    decoding: DecodingOptions | None = None,
) -> "tuple[xr.DataTree | DictOfDatasets, str, OpenReport]":
    """Open datatree or dataset, trying each available engine in turn.

    Returns
    -------
    tuple
        ``(data_structure, engine_name, open_report)`` where data_structure is
        either a DataTree or DictOfDatasets.

    Raises
    ------
    ImportError
        If no engines are available for the file format
    Exception
        If all engines fail to open the file
    """
    options = decoding or DecodingOptions()
    if not file_format_info.is_supported:
        raise ImportError(
            f"No engines available for {file_format_info.extension} files. "
            f"Missing packages: {', '.join(file_format_info.missing_packages)}"
        )

    # cdflib (NASA CDF) uses its own API, not xr.open_dataset
    if "cdflib" in file_format_info.available_engines:
        try:
            xds, report = _open_with_cdflib(file_path, options)
            return {"/": xds}, "cdflib", report
        except Exception as exc:
            logger.error(f"Failed to open CDF file with cdflib: {exc!r}")
            if len(file_format_info.available_engines) == 1:
                raise

    failed_engines: list[EngineFailure] = []
    exceptions: list[Exception] = []
    for engine in file_format_info.available_engines:
        if engine == "cdflib":  # Handled above
            continue
        try:
            data, report = _open_with_engine(
                file_path,
                engine,
                convert_bands_to_variables,
                options,
                list(failed_engines),
            )
        except Exception as exc:
            exceptions.append(exc)
            failed_engines.append(EngineFailure(engine, _error_text(exc)))
            continue
        return data, engine, report

    # If all engines failed, raise the last error
    raise exceptions[-1]


@dataclass
class OpenedData:
    """A file opened either as a DataTree or as a dict of per-group Datasets.

    Use with ``contextlib.closing`` so the underlying files are always closed.
    """

    data: xr.DataTree | DictOfDatasets
    used_engine: str
    report: OpenReport

    @classmethod
    def open(
        cls,
        file_path: Path,
        file_format_info: FileFormatInfo,
        convert_bands_to_variables: bool = False,
        decoding: DecodingOptions | None = None,
    ) -> "OpenedData":
        """Open with engine fallback (see ``open_datatree_with_fallback``)."""
        data, used_engine, report = open_datatree_with_fallback(
            file_path, file_format_info, convert_bands_to_variables, decoding
        )
        return cls(data, used_engine, report)

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
