"""``create_plot``: the 'plot' mode entry point.

Pipeline: detect format -> open file -> pick variable -> apply dimension slices
-> apply datetime filter -> resolve the layout (user choices first, the rest
automatic, see ``layout``) -> draw -> render PNG.
"""

import contextlib
from contextlib import closing
from pathlib import Path

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.environment.packages import check_package_availability
from sdv_backend.formats.detect import detect_file_format
from sdv_backend.info.datatree import datatree_inherit_mode
from sdv_backend.opening import OpenedData
from sdv_backend.plotting.draw import draw_plot
from sdv_backend.plotting.kwargs import PlotKwargsBundle
from sdv_backend.plotting.layout import resolve_layout
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.plotting.render import (
    build_suptitle,
    figure_to_base64_png,
    setup_pyplot,
)
from sdv_backend.plotting.selection import (
    PlotInputError,
    apply_datetime_filter,
    apply_dimension_slices,
    ensure_not_empty,
    get_variable,
    split_variable_path,
)
from sdv_backend.plotting.style import MATPLOTLIB_RC_CONTEXT
from sdv_backend.results import CreatePlotError, CreatePlotResult


def create_plot(
    file_path: Path,
    variable_path: str,
    options: PlotOptions = PlotOptions(),
) -> CreatePlotResult | CreatePlotError:
    """Create a plot from a data file variable.

    Opens a data file, extracts the specified variable, and creates a
    matplotlib visualization. Every layout option the user left empty (x, y,
    facets, col_wrap, figure size) is chosen from the dimensions left free,
    so one option changed keeps the automatic choice of the others (see
    ``layout.resolve_layout``).

    Parameters
    ----------
    file_path : Path
        Path to the data file
    variable_path : str
        Path to the variable within the file (e.g., '/temperature')
    options : PlotOptions
        User plot options

    Returns
    -------
    CreatePlotResult or CreatePlotError
        CreatePlotResult with Base64-encoded PNG image data if successful, CreatePlotError if failed
    """
    try:
        # Detect file format and available engines
        file_format_info = detect_file_format(
            file_path,
            netcdf_engine_order=options.netcdf_engine_order,
            open_as_kerchunk=options.open_as_kerchunk,
        )

        if not file_format_info.is_supported:
            message = (
                f"No engines available for {file_format_info.extension} files. "
                f"Missing packages: {', '.join(file_format_info.missing_packages)}"
                if file_format_info.missing_packages
                else f"Unsupported file format: {file_format_info.extension or 'no extension'}"
            )
            logger.error(message)
            return CreatePlotError(error=message, format_info=file_format_info)

        if not check_package_availability("matplotlib"):
            logger.error("Matplotlib is not installed")
            return CreatePlotError(
                error="Matplotlib is not installed. Install it and retry.",
                format_info=file_format_info,
            )

        mpl, plt = setup_pyplot(options.style)

        opened = OpenedData.open(
            file_path, file_format_info, options.convert_bands_to_variables
        )
        with closing(opened):
            try:
                group_name, variable_name = split_variable_path(variable_path)
                group = opened.group(
                    group_name,
                    datatree_inherit_mode(options.show_inherited_coordinates),
                )
                var = get_variable(group, variable_name)
                var, applied_isel = apply_dimension_slices(
                    var, options.dimension_slices
                )
                selection = apply_datetime_filter(
                    var, variable_name, group, group_name, opened, options
                )
                ensure_not_empty(selection.var, options)
            except PlotInputError as exc:
                return CreatePlotError(error=str(exc), format_info=file_format_info)
            var, layout = resolve_layout(selection.var, options, selection)
            logger.info("Plot layout: %s", layout.to_json())
            bundle = _build_plot_kwargs(options)

            # Start with a clean figure state (avoids "Current Serial #N" / stale-figure issues)
            plt.close("all")
            xarray_plot_ctx = (
                xr.set_options(facetgrid_figsize=options.facetgrid_figsize)
                if options.facetgrid_figsize is not None
                else contextlib.nullcontext()
            )
            with xarray_plot_ctx, mpl.rc_context(MATPLOTLIB_RC_CONTEXT):
                applied_plot_kwargs = draw_plot(
                    var, layout, bundle, selection, variable_name
                )

                suptitle = build_suptitle(
                    variable_name,
                    selection,
                    options.start_datetime,
                    options.end_datetime,
                )
                image_base64 = figure_to_base64_png(plt, suptitle)

        logger.info("Plot created successfully")
        return CreatePlotResult(
            plot_data=image_base64,
            format_info=file_format_info,
            applied_isel_kwargs={
                k: v if isinstance(v, int) else slice_text(v)
                for k, v in applied_isel.items()
            },
            applied_plot_kwargs=applied_plot_kwargs,
            plot_layout=layout.to_json(),
            matplotlib_style=options.style,
            variable_path=variable_path,
        )

    except Exception as exc:
        described = describe_exception(exc)
        logger.error(
            f"Error creating plot: {described} ({file_path=} {variable_path=})"
        )
        return CreatePlotError(
            error=f"Error creating plot: {described} ({file_path=} {variable_path=})",
            format_info=file_format_info,
        )


def slice_text(value: slice) -> str:
    """``slice(5, 15, None)`` -> ``'5:15'``, the notation typed in the viewer."""
    parts = ["" if v is None else str(v) for v in (value.start, value.stop)]
    if value.step is not None:
        parts.append(str(value.step))
    return ":".join(parts)


def describe_exception(exc: Exception) -> str:
    """``repr`` of an exception, or ``Type: str`` when the repr says nothing.

    Some exceptions keep their message out of ``args``: fsspec's
    ``ReferenceNotReachable`` (Kerchunk target missing) has the repr
    ``ReferenceNotReachable()`` while its ``str`` names the reference and the
    file it could not read.
    """
    described = repr(exc)
    if described == f"{type(exc).__name__}()" and str(exc):
        described = f"{type(exc).__name__}: {exc}"
        if exc.__cause__ is not None:
            described += f" ({exc.__cause__!r})"
    return described


def _build_plot_kwargs(options: PlotOptions) -> PlotKwargsBundle:
    """Style kwargs the user set (the layout ones are resolved separately)."""
    logger.info(
        "Plot params received: row=%r, col=%r, plot_x=%r, plot_y=%r, plot_hue=%r, "
        "bins=%s, xincrease=%s, yincrease=%s, aspect=%s, size=%s, robust=%s, cmap=%r, "
        "col_wrap=%s, vmin=%s, vmax=%s, add_colorbar=%s, add_legend=%s",
        options.facet_row,
        options.facet_col,
        options.plot_x,
        options.plot_y,
        options.plot_hue,
        options.bins,
        options.xincrease,
        options.yincrease,
        options.aspect,
        options.size,
        options.robust,
        options.cmap,
        options.col_wrap,
        options.vmin,
        options.vmax,
        options.add_colorbar,
        options.add_legend,
    )
    return PlotKwargsBundle.build(
        bins=options.bins,
        robust=options.robust,
        xincrease=options.xincrease,
        yincrease=options.yincrease,
        cmap=options.cmap,
        vmin=options.vmin,
        vmax=options.vmax,
        add_colorbar=options.add_colorbar,
        add_legend=options.add_legend,
    )
