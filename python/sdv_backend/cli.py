"""Command line interface (``info`` / ``plot`` modes); prints one JSON line."""

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from sdv_backend._bootstrap import logger
from sdv_backend.formats.zarr import resolve_store_path
from sdv_backend.info.display import (
    DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
    DEFAULT_SMALL_VARIABLE_BYTES,
)
from sdv_backend.info.extract import get_file_info
from sdv_backend.info.options import InfoOptions
from sdv_backend.plotting.api import create_plot
from sdv_backend.plotting.options import (
    PlotOptions,
    parse_col_wrap,
    parse_facetgrid_figsize,
)
from sdv_backend.results import CreatePlotResult, FileInfoResult
from sdv_backend.serialization import to_json_best_effort


def main() -> int:
    """Main entry point: parse arguments, run info or plot mode, print one JSON line."""
    parser = build_parser()
    args = parser.parse_args()

    if args.mode == "plot" and not args.variable_name:
        print(to_json_best_effort({"error": "Variable name is required for plot mode"}))
        return 1

    # Opening a Zarr metadata file should open the store that contains it
    args.file_path = resolve_store_path(args.file_path)

    if args.mode == "info":
        result = get_file_info(args.file_path, _info_options(args))
        ok = isinstance(result, FileInfoResult)
    else:
        dimension_slices = None
        if args.dimension_slices and args.dimension_slices.strip():
            try:
                dimension_slices = json.loads(args.dimension_slices)
            except json.JSONDecodeError as e:
                print(
                    to_json_best_effort(
                        {"error": f"Invalid --dimension-slices JSON: {e}"}
                    )
                )
                return 1
        result = create_plot(
            args.file_path, args.variable_name, _plot_options(args, dimension_slices)
        )
        ok = isinstance(result, CreatePlotResult)

    logger.info(f"{args.mode} Result: {result}")
    print(to_json_best_effort({"result" if ok else "error": asdict(result)}))
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Argument parser for ``info`` and ``plot`` modes (see module docstring)."""
    parser = argparse.ArgumentParser(
        description="Get data file information and create plots from data file variables",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python get_data_info.py info sample_data.nc
  python get_data_info.py plot sample_data.nc temperature
  python get_data_info.py plot sample_data.nc temperature --style dark_background
  python get_data_info.py plot sample_data.nc temperature --style default
  python get_data_info.py plot sample_data.nc temperature --style seaborn
        """,
    )

    mode_choices = ["info", "plot"]

    parser.add_argument(
        "mode",
        choices=mode_choices,
        help="Mode: 'info' to get file information, 'plot' to create plots",
    )

    parser.add_argument("file_path", type=Path, help="Path to the data file")

    parser.add_argument(
        "variable_name",
        nargs="?",
        help="Variable name to plot (required for plot mode)",
    )

    parser.add_argument(
        "plot_type",
        nargs="?",
        default="auto",
        help="Plot type: only 'auto' is supported (optional, default: 'auto')",
    )

    parser.add_argument(
        "--style",
        default="",
        help="Matplotlib plot style. Any valid matplotlib style name (e.g., 'default', 'dark_background', 'seaborn', 'ggplot', etc.)",
    )

    parser.add_argument(
        "--convert-bands-to-variables",
        action="store_true",
        help="Convert bands of GeoTIFF rasters to variables for better readability",
    )

    parser.add_argument(
        "--datetime-variable",
        default=None,
        help="Name of datetime variable to use as x-axis",
    )

    parser.add_argument(
        "--start-datetime",
        default=None,
        help="Start datetime for filtering (ISO format string)",
    )

    parser.add_argument(
        "--end-datetime",
        default=None,
        help="End datetime for filtering (ISO format string)",
    )

    parser.add_argument(
        "--dimension-slices",
        default=None,
        help='JSON object of dimension name to index or slice string (e.g. {"time": "0:24:2", "rlat": "100:120", "rlon": 130}) for isel() before plotting (Issue #117)',
    )

    parser.add_argument(
        "--facet-row",
        default=None,
        help="Dimension name for faceted plot row (Issue #117)",
    )

    parser.add_argument(
        "--facet-col",
        default=None,
        help="Dimension name for faceted plot col (Issue #117)",
    )

    parser.add_argument(
        "--col-wrap",
        type=parse_col_wrap,
        default=None,
        help="xarray plot col_wrap: positive integer or 'auto' (xarray 2026.04+)",
    )

    parser.add_argument(
        "--plot-x",
        default=None,
        help="Dimension or coordinate for x-axis (xarray plot x=)",
    )

    parser.add_argument(
        "--plot-y",
        default=None,
        help="Dimension or coordinate for y-axis (xarray plot y=)",
    )

    parser.add_argument(
        "--plot-hue",
        default=None,
        help="Dimension or coordinate for hue (xarray plot hue=, e.g. multiple lines)",
    )

    parser.add_argument(
        "--xincrease",
        default=None,
        choices=("true", "false"),
        help="xarray plot xincrease (axes direction): 'true' or 'false'",
    )

    parser.add_argument(
        "--yincrease",
        default=None,
        choices=("true", "false"),
        help="xarray plot yincrease (axes direction): 'true' or 'false'",
    )

    parser.add_argument(
        "--aspect",
        type=float,
        default=None,
        help="xarray plot aspect (figure width = aspect * size in inches, float)",
    )

    parser.add_argument(
        "--size",
        type=float,
        default=None,
        help="xarray plot size (figure height in inches, float)",
    )

    parser.add_argument(
        "--bins",
        type=int,
        default=None,
        help="Number of bins for histogram-style plots (Issue #117; passed as plot kwarg)",
    )

    parser.add_argument(
        "--robust",
        action="store_true",
        help="xarray plot robust: use 2nd/98th percentiles for color limits (helps with outliers)",
    )

    parser.add_argument(
        "--cmap",
        type=str,
        default=None,
        help="Matplotlib colormap name (user must provide a valid existing cmap). See https://matplotlib.org/stable/users/explain/colors/colormaps.html",
    )

    parser.add_argument(
        "--vmin",
        type=float,
        default=None,
        help="Lower bound for colormap scaling (colormap plots only; not histograms)",
    )
    parser.add_argument(
        "--vmax",
        type=float,
        default=None,
        help="Upper bound for colormap scaling (colormap plots only; not histograms)",
    )
    parser.add_argument(
        "--no-add-colorbar",
        action="store_true",
        help="Disable the colorbar on scalar-mappable plots (default is to show one)",
    )
    parser.add_argument(
        "--add-legend",
        action="store_true",
        help="Request a legend when xarray supports it (e.g. with hue); ignored for imshow without hue",
    )

    parser.add_argument(
        "--small-variable-bytes",
        type=int,
        default=DEFAULT_SMALL_VARIABLE_BYTES,
        help="Max size in bytes for variables/coordinates to load and display values (Issue #102). Set to 0 to disable.",
    )

    parser.add_argument(
        "--small-value-display-max-len",
        type=int,
        default=DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
        help="Max character length for displayed small variable/coordinate values (truncation).",
    )

    parser.add_argument(
        "--no-order-groups-alphabetically",
        action="store_true",
        help="Preserve DataTree group order from the file instead of sorting paths alphabetically (Issue #140)",
    )

    parser.add_argument(
        "--no-show-xarray-encoding-attributes",
        action="store_true",
        help="Omit __xarray_encoding.* attribute entries from group, coordinate, and variable metadata",
    )

    parser.add_argument(
        "--netcdf-engine-order",
        default=None,
        help=(
            "Comma-separated NetCDF engine try-order for .nc/.nc4/.netcdf "
            "(netcdf4,h5netcdf,scipy). Does not apply to NASA .cdf files."
        ),
    )

    parser.add_argument(
        "--no-show-inherited-coordinates",
        action="store_true",
        help=(
            "Do not merge parent DataTree coordinates onto child groups "
            "(xarray to_dataset inherit=False)"
        ),
    )

    parser.add_argument(
        "--open-as-kerchunk",
        action="store_true",
        help=(
            "Open the path as Kerchunk / virtual Zarr references (JSON or Parquet). "
            "Do not use for ordinary JSON."
        ),
    )

    parser.add_argument(
        "--facetgrid-figsize",
        type=parse_facetgrid_figsize,
        default=None,
        help=(
            "xarray facetgrid_figsize as WIDTH,HEIGHT in inches for faceted plots "
            "(xarray 2026.04+ set_options)"
        ),
    )
    return parser


def _info_options(args: argparse.Namespace) -> InfoOptions:
    return InfoOptions(
        convert_bands_to_variables=args.convert_bands_to_variables,
        small_variable_bytes=args.small_variable_bytes,
        small_value_display_max_len=args.small_value_display_max_len,
        order_groups_alphabetically=not args.no_order_groups_alphabetically,
        show_xarray_encoding_attributes=not args.no_show_xarray_encoding_attributes,
        netcdf_engine_order=args.netcdf_engine_order,
        show_inherited_coordinates=not args.no_show_inherited_coordinates,
        open_as_kerchunk=args.open_as_kerchunk,
    )


def _parse_bool_flag(value: str | None) -> bool | None:
    """'true'/'false' CLI strings -> bool; None when the flag is omitted."""
    return None if value is None else value == "true"


def _plot_options(
    args: argparse.Namespace, dimension_slices: dict[str, str | int] | None
) -> PlotOptions:
    return PlotOptions(
        plot_type=args.plot_type,
        style=args.style,
        convert_bands_to_variables=args.convert_bands_to_variables,
        datetime_variable_name=args.datetime_variable,
        start_datetime=args.start_datetime,
        end_datetime=args.end_datetime,
        dimension_slices=dimension_slices,
        facet_row=args.facet_row,
        facet_col=args.facet_col,
        col_wrap=args.col_wrap,
        plot_x=args.plot_x,
        plot_y=args.plot_y,
        plot_hue=args.plot_hue,
        xincrease=_parse_bool_flag(args.xincrease),
        yincrease=_parse_bool_flag(args.yincrease),
        aspect=args.aspect,
        size=args.size,
        robust=args.robust,
        cmap=args.cmap,
        bins=args.bins,
        vmin=args.vmin,
        vmax=args.vmax,
        add_colorbar=not args.no_add_colorbar,
        add_legend=args.add_legend,
        netcdf_engine_order=args.netcdf_engine_order,
        show_inherited_coordinates=not args.no_show_inherited_coordinates,
        open_as_kerchunk=args.open_as_kerchunk,
        facetgrid_figsize=args.facetgrid_figsize,
    )
