"""``get_file_info``: the 'info' mode entry point."""

import io
import os
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path
from typing import TYPE_CHECKING, cast

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.environment.engines import can_use_datatree
from sdv_backend.formats.detect import detect_file_format
from sdv_backend.formats.geotiff import refine_geotiff_display_name
from sdv_backend.info.datatree import _flatten_datatree_groups, inherited_coord_sources
from sdv_backend.info.display import (
    DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
    XR_HTML_OPTIONS,
    XR_TEXT_OPTIONS,
)
from sdv_backend.info.encoding import _collect_dataarray_attributes
from sdv_backend.info.variables import (
    create_coord_info,
    create_variable_info,
    is_datetime_variable,
)
from sdv_backend.opening import open_datatree_with_fallback
from sdv_backend.results import FileInfoError, FileInfoResult

if TYPE_CHECKING:
    from sdv_backend.types import DictOfDatasets


def get_file_info(
    file_path: Path,
    convert_bands_to_variables: bool = False,
    small_variable_bytes: int = 0,
    small_value_display_max_len: int = DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
    order_groups_alphabetically: bool = True,
    show_xarray_encoding_attributes: bool = True,
    netcdf_engine_order: Sequence[str] | str | None = None,
    show_inherited_coordinates: bool = True,
    open_as_kerchunk: bool = False,
) -> FileInfoResult | FileInfoError:
    """Extract comprehensive information from a data file.

    Analyzes a data file and extracts metadata including format information,
    variables, coordinates, dimensions, and attributes. Supports both
    DataTree and Dataset structures.

    Parameters
    ----------
    file_path : Path
        Path to the data file
    convert_bands_to_variables : bool
        Whether to convert GeoTIFF bands to variables.
    small_variable_bytes : int
        Max size in bytes for variables/coordinates to load and display values (Issue #102). If 0, disabled.
    small_value_display_max_len : int
        Max character length for displayed small values (truncation).
    order_groups_alphabetically : bool
        When True, sort flattened DataTree group paths alphabetically (Issue #140).
    show_xarray_encoding_attributes : bool
        When True, include ``__xarray_encoding.*`` entries from xarray encoding metadata.
    netcdf_engine_order : sequence of str or str, optional
        Preferred engines for ``.nc`` / ``.nc4`` / ``.netcdf`` (not NASA ``.cdf``).
    show_inherited_coordinates : bool
        When True, child DataTree groups include parent coordinates via
        ``to_dataset(inherit='all_coords')``.
    open_as_kerchunk : bool
        Open JSON/Parquet as Kerchunk virtual Zarr (experimental).

    Returns
    -------
    FileInfoResult or FileInfoError
        Complete file information if successful, error information if failed
    """
    # Diagnostic: xr.show_versions()
    # Capture the output of xr.show_versions() by passing a StringIO object
    output = io.StringIO()
    xr.show_versions(file=output)
    versions_text = output.getvalue()

    # Detect file format and available engines
    file_format_info = detect_file_format(
        file_path,
        netcdf_engine_order=netcdf_engine_order,
        open_as_kerchunk=open_as_kerchunk,
    )

    try:
        # Open dataset with fallback
        xds_or_xdt, used_engine, decode_cf_degraded = open_datatree_with_fallback(
            file_path, file_format_info, convert_bands_to_variables
        )
    except ImportError:
        if file_format_info.extension == ".zip":
            error = FileInfoError(
                error=(
                    "This ZIP archive is not a Zarr store "
                    "(no zarr.json or .zgroup found)."
                ),
                error_type="ValueError",
                format_info=file_format_info,
                suggestion=(
                    "The archive must contain a Zarr store at its root or in a "
                    "subdirectory. Ordinary ZIP files cannot be opened as scientific data."
                ),
                xarray_show_versions=versions_text,
            )
            return error
        if (
            file_format_info.extension == ".kerchunk"
            and not file_format_info.missing_packages
        ):
            error = FileInfoError(
                error=(
                    "This file is not a Kerchunk / virtual Zarr reference "
                    "(no 'refs' mapping)."
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
            return error
        # Handle missing dependencies
        error = FileInfoError(
            error=f"Missing dependencies for {file_format_info.display_name} files: {', '.join(file_format_info.missing_packages)}",
            error_type="ImportError",
            format_info=file_format_info,
            suggestion=f"Install required packages: pip install {' '.join(file_format_info.missing_packages)}",
            xarray_show_versions=versions_text,
        )
        return error

    if used_engine == "rasterio":
        refined_name = refine_geotiff_display_name(
            file_path, file_format_info.display_name
        )
        if refined_name != file_format_info.display_name:
            file_format_info = replace(file_format_info, display_name=refined_name)

    try:
        datatree_flag: bool = can_use_datatree(used_engine) and isinstance(
            xds_or_xdt, xr.DataTree
        )
        if datatree_flag:
            xdt: xr.DataTree = cast("xr.DataTree", xds_or_xdt)
            # Extract information
            with xr.set_options(**XR_TEXT_OPTIONS):
                # Get HTML representation using xarray's built-in HTML representation
                repr_text: str = str(xdt)
            with xr.set_options(**XR_HTML_OPTIONS):
                # Get text representation using xarray's built-in text representation
                repr_html: str = xdt._repr_html_()

            # logger.info(f"{xdt=}")

            flat_dict_of_xds: DictOfDatasets = _flatten_datatree_groups(
                xdt,
                order_groups_alphabetically=order_groups_alphabetically,
                show_inherited_coordinates=show_inherited_coordinates,
            )
            inherited_sources = inherited_coord_sources(
                xdt,
                show_inherited_coordinates=show_inherited_coordinates,
            )
            logger.info(
                f"Processing DataTree with {len(flat_dict_of_xds.keys())} groups"
            )
        else:
            xds_dict: DictOfDatasets = cast("DictOfDatasets", xds_or_xdt)
            # For a single root group, display the traditional Dataset reprs
            if len(xds_dict) == 1 and "/" in xds_dict:
                xds: xr.Dataset = xds_dict["/"]
                with xr.set_options(**XR_TEXT_OPTIONS):
                    # Get HTML representation using xarray's built-in HTML representation
                    repr_text: str = str(xds)
                with xr.set_options(**XR_HTML_OPTIONS):
                    # Get text representation using xarray's built-in text representation
                    repr_html: str = xds._repr_html_()
            # Otherwise, need to do a custom repr.
            else:
                with xr.set_options(**XR_TEXT_OPTIONS):
                    repr_text: str = f"{'-' * 80}\n\n".join(
                        (
                            f"Group: {group}\n\n{xds!s}\n\n"
                            for group, xds in xds_dict.items()
                        )
                    )
                with xr.set_options(**XR_HTML_OPTIONS):
                    repr_html: str = "<br><br>".join(
                        (
                            f"<p>Group: {group}</p><br><br>{xds._repr_html_()}"
                            for group, xds in xds_dict.items()
                        )
                    )
            logger.info(f"{xds_dict=}")

            flat_dict_of_xds: DictOfDatasets = xds_dict
            inherited_sources = {}
            logger.info(
                f"Processing DictOfDatasets with {len(flat_dict_of_xds.keys())} groups"
            )

        info = FileInfoResult(
            format_info=file_format_info,
            used_engine=used_engine,
            decode_cf_degraded=decode_cf_degraded,
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

        for group in flat_dict_of_xds:
            logger.info(f"Processing group: {group}")
            # logger.info(f"{flat_dict_of_xds[group]=}")
            xds = flat_dict_of_xds[group]

            # Add attributes for group
            info.attributes_flattened[group] = _collect_dataarray_attributes(
                xds,
                show_xarray_encoding_attributes=show_xarray_encoding_attributes,
            )
            info.dimensions_flattened[group] = {str(k): v for k, v in xds.dims.items()}
            # Add coordinate variables for group
            for coord_name, coord in xds.coords.items():
                coord_info = create_coord_info(
                    str(coord_name),
                    coord,
                    small_variable_bytes=small_variable_bytes,
                    small_value_display_max_len=small_value_display_max_len,
                    show_xarray_encoding_attributes=show_xarray_encoding_attributes,
                    inherited_from=inherited_sources.get(group, {}).get(
                        str(coord_name)
                    ),
                )
                info.coordinates_flattened.setdefault(group, []).append(coord_info)
                # Check if coordinate is a datetime variable
                if is_datetime_variable(coord):
                    logger.info(
                        f"Found datetime coordinate: {group}/{coord_name} (dtype: {coord.dtype})"
                    )
                    # Compute min and max values
                    try:
                        import pandas as pd

                        coord_values = coord.values
                        if coord_values.size > 0:
                            min_val = pd.Timestamp(coord_values.min()).isoformat()
                            max_val = pd.Timestamp(coord_values.max()).isoformat()
                        else:
                            min_val = None
                            max_val = None
                    except Exception as exc:
                        logger.warning(
                            f"Could not compute min/max for datetime coordinate {coord_name}: {exc!r}"
                        )
                        min_val = None
                        max_val = None

                    info.datetime_variables.setdefault(group, []).append(
                        {
                            "name": str(coord_name),
                            "min": min_val,
                            "max": max_val,
                        }
                    )

            # Add data variables for group
            for var_name, var in xds.data_vars.items():
                var_info = create_variable_info(
                    str(var_name),
                    var,
                    small_variable_bytes=small_variable_bytes,
                    small_value_display_max_len=small_value_display_max_len,
                    show_xarray_encoding_attributes=show_xarray_encoding_attributes,
                )
                logger.info(
                    f"Processing group and var: {group=}  {var_name=} {var_info=}"
                )

                info.variables_flattened.setdefault(group, []).append(var_info)
                # Check if data variable is a datetime variable
                if is_datetime_variable(var):
                    logger.info(
                        f"Found datetime data variable: {group}/{var_name} (dtype: {var.dtype})"
                    )
                    # Compute min and max values
                    try:
                        import pandas as pd

                        var_values = var.values
                        if var_values.size > 0:
                            min_val = pd.Timestamp(var_values.min()).isoformat()
                            max_val = pd.Timestamp(var_values.max()).isoformat()
                        else:
                            min_val = None
                            max_val = None
                    except Exception as exc:
                        logger.warning(
                            f"Could not compute min/max for datetime variable {var_name}: {exc!r}"
                        )
                        min_val = None
                        max_val = None

                    info.datetime_variables.setdefault(group, []).append(
                        {
                            "name": str(var_name),
                            "min": min_val,
                            "max": max_val,
                        }
                    )

            # Extract information
            with xr.set_options(**XR_TEXT_OPTIONS):
                # Get HTML representation using xarray's built-in HTML representation
                repr_text: str = str(xds)
            with xr.set_options(**XR_HTML_OPTIONS):
                # Get text representation using xarray's built-in text representation
                repr_html: str = xds._repr_html_()

            info.xarray_html_repr_flattened[group] = repr_html
            info.xarray_text_repr_flattened[group] = repr_text

        # Close Start
        if datatree_flag:
            xdt: xr.DataTree = cast("xr.DataTree", xds_or_xdt)
            xdt.close()
        else:
            xds_dict: DictOfDatasets = cast("DictOfDatasets", xds_or_xdt)
            for group, xds in xds_dict.items():
                logger.info(f"Close {group=}")
                xds.close()
        # Close End

        logger.info(f"Detected datetime variables: {info.datetime_variables}")
        return info
    except Exception as exc:
        logger.info(f"Error getting file info: {exc!r}")
        # Handle other errors (file corruption, format issues, etc.)
        error = FileInfoError(
            error=str(exc),
            error_type=type(exc).__name__,
            suggestion="Check if the file is corrupted or in an unsupported format",
            format_info=file_format_info,
            xarray_show_versions=versions_text,
        )
        return error
