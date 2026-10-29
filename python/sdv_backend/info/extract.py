"""``get_file_info``: the 'info' mode entry point.

Pipeline: detect format -> open file -> build whole-file reprs -> flatten
groups -> per group: attributes, dimensions, coordinates, variables, datetime
ranges and reprs.
"""

import io
import os
from contextlib import closing
from dataclasses import replace
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.formats.detect import detect_file_format
from sdv_backend.formats.geotiff import refine_geotiff_display_name
from sdv_backend.info.datatree import flatten_datatree_groups, inherited_coord_sources
from sdv_backend.info.display import XR_HTML_OPTIONS, XR_TEXT_OPTIONS
from sdv_backend.info.encoding import collect_attributes, collect_encoding
from sdv_backend.info.options import InfoOptions
from sdv_backend.info.variables import (
    create_coord_info,
    create_variable_info,
    is_datetime_variable,
)
from sdv_backend.opening import OpenedData
from sdv_backend.results import FileFormatInfo, FileInfoError, FileInfoResult
from sdv_backend.types import DictOfDatasets


def get_file_info(
    file_path: Path, options: InfoOptions = InfoOptions()
) -> FileInfoResult | FileInfoError:
    """Extract comprehensive information from a data file.

    Analyzes a data file and extracts metadata including format information,
    variables, coordinates, dimensions, and attributes. Supports both
    DataTree and Dataset structures.

    Returns
    -------
    FileInfoResult or FileInfoError
        Complete file information if successful, error information if failed
    """
    # Diagnostic: xr.show_versions() output, attached to results and errors
    output = io.StringIO()
    xr.show_versions(file=output)
    versions_text = output.getvalue()

    file_format_info = detect_file_format(
        file_path,
        netcdf_engine_order=options.netcdf_engine_order,
        open_as_kerchunk=options.open_as_kerchunk,
    )

    try:
        opened = OpenedData.open(
            file_path, file_format_info, options.convert_bands_to_variables
        )
    except ImportError as exc:
        if file_format_info.available_engines and not file_format_info.missing_packages:
            # Raised by an installed engine: a reading failure, not a setup one
            return _file_info_error(exc, file_format_info, versions_text)
        return _open_import_error(file_format_info, versions_text)
    except Exception as exc:
        # Missing, corrupt or unreadable file: every engine failed
        return _file_info_error(exc, file_format_info, versions_text)

    if opened.used_engine == "rasterio":
        refined_name = refine_geotiff_display_name(
            file_path, file_format_info.display_name
        )
        if refined_name != file_format_info.display_name:
            file_format_info = replace(file_format_info, display_name=refined_name)

    try:
        with closing(opened):
            repr_text, repr_html = _whole_file_reprs(opened)
            groups, inherited_sources = _flatten_groups(opened, options)

            info = FileInfoResult(
                format_info=file_format_info,
                used_engine=opened.used_engine,
                decode_cf_degraded=opened.decode_cf_degraded,
                fileSize=os.path.getsize(file_path),
                xarray_html_repr=repr_html,
                xarray_text_repr=repr_text,
                xarray_show_versions=versions_text,
                dimensions_flattened={},
                coordinates_flattened={},
                variables_flattened={},
                attributes_flattened={},
                xarray_html_repr_flattened={},
                xarray_text_repr_flattened={},
                datetime_variables={},
            )
            for group, xds in groups.items():
                _add_group_info(
                    info, group, xds, inherited_sources.get(group, {}), options
                )

        logger.info(f"Detected datetime variables: {info.datetime_variables}")
        return info
    except Exception as exc:
        return _file_info_error(exc, file_format_info, versions_text)


def _file_info_error(
    exc: Exception, file_format_info: FileFormatInfo, versions_text: str
) -> FileInfoError:
    """Error result for a file that could not be read (corruption, format issues...)."""
    logger.info(f"Error getting file info: {exc!r}")
    return FileInfoError(
        error=str(exc) or type(exc).__name__,
        error_type=type(exc).__name__,
        suggestion="Check if the file is corrupted or in an unsupported format",
        format_info=file_format_info,
        xarray_show_versions=versions_text,
    )


def _open_import_error(
    file_format_info: FileFormatInfo, versions_text: str
) -> FileInfoError:
    """Explain an ImportError raised while opening (not-a-Zarr ZIP, not-Kerchunk
    JSON, or genuinely missing packages)."""
    if file_format_info.extension == ".zip":
        return FileInfoError(
            error=(
                "This ZIP archive is not a Zarr store (no zarr.json or .zgroup found)."
            ),
            error_type="ValueError",
            format_info=file_format_info,
            suggestion=(
                "The archive must contain a Zarr store at its root or in a "
                "subdirectory. Ordinary ZIP files cannot be opened as scientific data."
            ),
            xarray_show_versions=versions_text,
        )
    if (
        file_format_info.extension == ".kerchunk"
        and not file_format_info.missing_packages
    ):
        return FileInfoError(
            error=(
                "This file is not a Kerchunk / virtual Zarr reference (no 'refs' mapping)."
            ),
            error_type="ValueError",
            format_info=file_format_info,
            suggestion=(
                "Use a Kerchunk JSON file (typically named *.kerchunk.json "
                "or *.ref.json) or right-click → Open as Kerchunk / virtual Zarr. "
                "Ordinary JSON is not opened automatically. Requires the "
                "optional kerchunk package."
            ),
            xarray_show_versions=versions_text,
        )
    missing = file_format_info.missing_packages
    if not missing and not file_format_info.available_engines:
        # No engine maps to this extension: not a missing-package problem
        return FileInfoError(
            error=(
                f"Unsupported file format: {file_format_info.extension or 'no extension'}"
            ),
            error_type="ValueError",
            format_info=file_format_info,
            suggestion=(
                "Supported formats: NetCDF, CDF, HDF5, Zarr (directory or ZIP), "
                "GRIB, GeoTIFF, JPEG-2000 and Kerchunk references."
            ),
            xarray_show_versions=versions_text,
        )
    return FileInfoError(
        error=f"Missing dependencies for {file_format_info.display_name} files: {', '.join(missing)}",
        error_type="ImportError",
        format_info=file_format_info,
        suggestion=f"Install required packages: pip install {' '.join(missing)}",
        xarray_show_versions=versions_text,
    )


def _text_and_html_repr(obj: xr.DataTree | xr.Dataset) -> tuple[str, str]:
    """xarray's own text and HTML reprs, with the viewer's display options."""
    with xr.set_options(**XR_TEXT_OPTIONS):
        repr_text = str(obj)
    with xr.set_options(**XR_HTML_OPTIONS):
        repr_html = obj._repr_html_()
    return repr_text, repr_html


def _whole_file_reprs(opened: OpenedData) -> tuple[str, str]:
    """Reprs of the whole file: the DataTree, the single root Dataset, or one
    section per group when the engine only yields a dict of Datasets."""
    if opened.is_tree:
        return _text_and_html_repr(opened.tree)
    xds_dict = opened.datasets
    if len(xds_dict) == 1 and "/" in xds_dict:
        return _text_and_html_repr(xds_dict["/"])
    with xr.set_options(**XR_TEXT_OPTIONS):
        repr_text = f"{'-' * 80}\n\n".join(
            f"Group: {group}\n\n{xds!s}\n\n" for group, xds in xds_dict.items()
        )
    with xr.set_options(**XR_HTML_OPTIONS):
        repr_html = "<br><br>".join(
            f"<p>Group: {group}</p><br><br>{xds._repr_html_()}"
            for group, xds in xds_dict.items()
        )
    return repr_text, repr_html


def _flatten_groups(
    opened: OpenedData, options: InfoOptions
) -> tuple[DictOfDatasets, dict[str, dict[str, str]]]:
    """Group path -> Dataset, and group -> {coord name: defining group} for
    inherited coordinates (DataTree only)."""
    if opened.is_tree:
        groups = flatten_datatree_groups(
            opened.tree,
            order_groups_alphabetically=options.order_groups_alphabetically,
            show_inherited_coordinates=options.show_inherited_coordinates,
        )
        inherited_sources = inherited_coord_sources(
            opened.tree,
            show_inherited_coordinates=options.show_inherited_coordinates,
        )
        logger.info(f"Processing DataTree with {len(groups.keys())} groups")
        return groups, inherited_sources
    logger.info(f"xds_dict={opened.datasets!r}")
    logger.info(f"Processing DictOfDatasets with {len(opened.datasets.keys())} groups")
    return opened.datasets, {}


def _add_group_info(
    info: FileInfoResult,
    group: str,
    xds: xr.Dataset,
    inherited_from: dict[str, str],
    options: InfoOptions,
) -> None:
    """Fill every ``*_flattened`` entry of ``info`` for one group."""
    logger.info(f"Processing group: {group}")
    info.attributes_flattened[group] = collect_attributes(xds)
    if options.show_xarray_encoding_attributes:
        info.encoding_flattened[group] = collect_encoding(xds)
    info.dimensions_flattened[group] = {str(k): v for k, v in xds.dims.items()}

    for coord_name, coord in xds.coords.items():
        coord_info = create_coord_info(
            str(coord_name),
            coord,
            small_variable_bytes=options.small_variable_bytes,
            small_value_display_max_len=options.small_value_display_max_len,
            show_xarray_encoding_attributes=options.show_xarray_encoding_attributes,
            inherited_from=inherited_from.get(str(coord_name)),
        )
        info.coordinates_flattened.setdefault(group, []).append(coord_info)
        if is_datetime_variable(coord):
            logger.info(
                f"Found datetime coordinate: {group}/{coord_name} (dtype: {coord.dtype})"
            )
            info.datetime_variables.setdefault(group, []).append(
                _datetime_range(str(coord_name), coord, "coordinate")
            )

    for var_name, var in xds.data_vars.items():
        var_info = create_variable_info(
            str(var_name),
            var,
            small_variable_bytes=options.small_variable_bytes,
            small_value_display_max_len=options.small_value_display_max_len,
            show_xarray_encoding_attributes=options.show_xarray_encoding_attributes,
        )
        logger.info(f"Processing group and var: {group=}  {var_name=} {var_info=}")
        info.variables_flattened.setdefault(group, []).append(var_info)
        if is_datetime_variable(var):
            logger.info(
                f"Found datetime data variable: {group}/{var_name} (dtype: {var.dtype})"
            )
            info.datetime_variables.setdefault(group, []).append(
                _datetime_range(str(var_name), var, "variable")
            )

    repr_text, repr_html = _text_and_html_repr(xds)
    info.xarray_html_repr_flattened[group] = repr_html
    info.xarray_text_repr_flattened[group] = repr_text


def _datetime_range(name: str, da: xr.DataArray, kind: str) -> dict[str, Any]:
    """{'name', 'min', 'max'} with ISO strings, ignoring NaT / missing values.

    ``min`` / ``max`` are None when there is no valid value or they cannot be
    computed. Works for ``datetime64`` and cftime (non-standard calendars).
    """
    min_val = max_val = None
    try:
        values = np.asarray(da.values).ravel()
        if np.issubdtype(values.dtype, np.datetime64):
            values = values[~np.isnat(values)]
            if values.size > 0:
                min_val = pd.Timestamp(values.min()).isoformat()
                max_val = pd.Timestamp(values.max()).isoformat()
        else:
            # cftime objects; missing values decode to None or NaN
            valid = [v for v in values if v is not None and not pd.isna(v)]
            if valid:
                min_val = min(valid).isoformat()
                max_val = max(valid).isoformat()
    except Exception as exc:
        min_val = max_val = None
        logger.warning(f"Could not compute min/max for datetime {kind} {name}: {exc!r}")
    return {"name": name, "min": min_val, "max": max_val}
