"""``create_plot``: the 'plot' mode entry point.

Pipeline: detect format -> open file -> pick variable -> apply dimension slices
-> apply datetime filter -> build xarray plot kwargs -> run a plotting strategy
(user-driven or automatic) -> render PNG.
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
from sdv_backend.plotting.dispatcher import (
    XarrayPlotDispatcher,
    detect_plotting_strategy,
)
from sdv_backend.plotting.kwargs import PlotKwargsBundle
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
from sdv_backend.plotting.strategies.auto import (
    AutoDefaultPlotContext,
    AutoPlotOrchestrator,
)
from sdv_backend.plotting.strategies.user import UserProvidedPlotOrchestrator
from sdv_backend.plotting.style import MATPLOTLIB_RC_CONTEXT
from sdv_backend.results import CreatePlotError, CreatePlotResult


def create_plot(
    file_path: Path,
    variable_path: str,
    options: PlotOptions = PlotOptions(),
) -> CreatePlotResult | CreatePlotError:
    """Create a plot from a data file variable.

    Opens a data file, extracts the specified variable, and creates a
    matplotlib visualization. The plotting strategy is automatically
    determined based on the variable's dimensions unless the user provided
    layout options (see ``PlotOptions.has_user_layout``).

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
    plot_type = options.plot_type  # named local: part of the error message below
    try:
        # Detect file format and available engines
        file_format_info = detect_file_format(
            file_path,
            netcdf_engine_order=options.netcdf_engine_order,
            open_as_kerchunk=options.open_as_kerchunk,
        )

        if plot_type != "auto":
            raise ValueError(f"Invalid plot type: {plot_type}")

        if not file_format_info.is_supported:
            message = (
                f"No engines available for {file_format_info.extension} files. "
                f"Missing packages: {', '.join(file_format_info.missing_packages)}"
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
            var = selection.var

            bundle, applied_plot_kwargs = _build_plot_kwargs(options)

            # Start with a clean figure state (avoids "Current Serial #N" / stale-figure issues)
            plt.close("all")
            xarray_plot_ctx = (
                xr.set_options(facetgrid_figsize=options.facetgrid_figsize)
                if options.facetgrid_figsize is not None
                else contextlib.nullcontext()
            )
            with xarray_plot_ctx, mpl.rc_context(MATPLOTLIB_RC_CONTEXT):
                plot_dispatcher = XarrayPlotDispatcher()
                if options.has_user_layout:
                    logger.info(
                        "User provided dimension/facet/bins params: building plot from user input only"
                    )
                    UserProvidedPlotOrchestrator(plot_dispatcher).run(
                        var,
                        bundle,
                        facet_row=options.facet_row,
                        facet_col=options.facet_col,
                        plot_x=options.plot_x,
                        plot_y=options.plot_y,
                        plot_hue=options.plot_hue,
                    )
                else:
                    AutoPlotOrchestrator(plot_dispatcher).run(
                        var,
                        bundle,
                        detect_plotting_strategy(var),
                        plt_module=plt,
                        default_ctx=AutoDefaultPlotContext(
                            datetime_var=selection.datetime_var,
                            datetime_var_display_name=selection.datetime_var_name,
                            variable_name=variable_name,
                        ),
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
            # slice -> str for JSON
            applied_isel_kwargs={
                k: v if isinstance(v, int) else str(v) for k, v in applied_isel.items()
            },
            applied_plot_kwargs=applied_plot_kwargs,
            matplotlib_style=options.style,
            variable_path=variable_path,
        )

    except Exception as exc:
        logger.error(
            f"Error creating plot: {exc!r} ({file_path=} {variable_path=} {plot_type=})"
        )
        return CreatePlotError(
            error=f"Error creating plot: {exc!r} ({file_path=} {variable_path=} {plot_type=})",
            format_info=file_format_info,
        )


def _build_plot_kwargs(options: PlotOptions) -> tuple[PlotKwargsBundle, dict]:
    """Build the xarray plot kwargs bundle; also return the kwargs reported back
    to the extension (bundle kwargs plus xarray ``row``/``col`` when set)."""
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
    bundle = PlotKwargsBundle.build(
        bins=options.bins,
        robust=options.robust,
        xincrease=options.xincrease,
        yincrease=options.yincrease,
        aspect=options.aspect,
        size=options.size,
        cmap=options.cmap,
        col_wrap=options.col_wrap,
        vmin=options.vmin,
        vmax=options.vmax,
        add_colorbar=options.add_colorbar,
        add_legend=options.add_legend,
    )

    applied = dict(bundle.raw)
    if options.facet_row and options.facet_row.strip():
        applied["row"] = options.facet_row.strip()
    if options.facet_col and options.facet_col.strip():
        applied["col"] = options.facet_col.strip()
    logger.info("Applied plot kwargs: %s", applied)
    if "cmap" in bundle.raw:
        logger.info(
            "cmap=%r will be applied via plot.imshow() (not passed to generic .plot())",
            bundle.raw["cmap"],
        )
    return bundle, applied
