"""``create_plot``: the 'plot' mode entry point.

Pipeline: detect format -> open file -> pick variable -> apply dimension slices
-> apply datetime filter -> resolve the layout (user choices first, the rest
automatic, see ``layout``) -> draw -> render PNG.

A CF flag variable (``flag_values`` / ``flag_masks`` + ``flag_meanings``) is
read raw and replaced by its index array of meanings before the layout
(``plotting/flags.py``); bit flags get one more dimension, ``flag``.
"""

import contextlib
from contextlib import closing
from pathlib import Path

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.decoding import ENGINES_WITH_PER_VARIABLE_DECODING
from sdv_backend.environment.packages import check_package_availability
from sdv_backend.flags import FlagSpec, needs_raw_codes, raw_dtype_of, read_flag_spec
from sdv_backend.formats.detect import detect_file_format
from sdv_backend.info.datatree import datatree_inherit_mode
from sdv_backend.opening import OpenedData
from sdv_backend.plotting.draw import draw_plot
from sdv_backend.plotting.flags import FlagPlot, adjust_layout, prepare_flag_plot
from sdv_backend.plotting.kwargs import PlotKwargsBundle
from sdv_backend.plotting.layout import PlotLayout, resolve_layout
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
    ignored_slice_notes,
    split_variable_path,
)
from sdv_backend.plotting.style import MATPLOTLIB_RC_CONTEXT
from sdv_backend.results import CreatePlotError, CreatePlotResult, FileFormatInfo


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
    # Replaced by detection; kept if detection itself raises, so the error
    # below reports the real exception rather than an UnboundLocalError.
    file_format_info = FileFormatInfo(
        extension=file_path.suffix.lower(),
        display_name="Unknown",
        available_engines=[],
        missing_packages=[],
    )
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

        mpl, plt, style_note = setup_pyplot(options.style)

        opened = OpenedData.open(
            file_path,
            file_format_info,
            options.convert_bands_to_variables,
            options.decoding,
        )
        with contextlib.ExitStack() as stack:
            stack.enter_context(closing(opened))
            try:
                group_name, variable_name = split_variable_path(variable_path)
                inherit = datatree_inherit_mode(options.show_inherited_coordinates)
                group = opened.group(group_name, inherit)
                var = get_variable(group, variable_name)
                spec = _usable_flag_spec(var, options)
                if spec is not None and _reopen_raw(var, opened):
                    raw = OpenedData.open(
                        file_path,
                        file_format_info,
                        options.convert_bands_to_variables,
                        options.decoding,
                        raw_variables=(variable_name,),
                    )
                    stack.enter_context(closing(raw))
                    var = get_variable(raw.group(group_name, inherit), variable_name)
                slice_notes = ignored_slice_notes(var, options.dimension_slices)
                var, applied_isel = apply_dimension_slices(
                    var, options.dimension_slices
                )
                selection = apply_datetime_filter(
                    var, variable_name, group, group_name, opened, options
                )
                ensure_not_empty(selection.var, options)
            except PlotInputError as exc:
                return CreatePlotError(error=str(exc), format_info=file_format_info)
            flag_plot = (
                prepare_flag_plot(selection.var, spec, options.cmap)
                if spec is not None
                else None
            )
            var, layout = resolve_layout(
                selection.var if flag_plot is None else flag_plot.index,
                options,
                selection,
            )
            bundle = _build_plot_kwargs(options, layout, flags=flag_plot is not None)
            if flag_plot is not None:
                adjust_layout(flag_plot, layout, bundle.raw)
            layout.notes[:0] = slice_notes + _flag_notes(var, options, flag_plot)
            if style_note:
                layout.notes.append(style_note)
            logger.info("Plot layout: %s", layout.to_json())

            # Start with a clean figure state (avoids "Current Serial #N" / stale-figure issues)
            plt.close("all")
            xarray_plot_ctx = (
                xr.set_options(facetgrid_figsize=options.facetgrid_figsize)
                if options.facetgrid_figsize is not None
                else contextlib.nullcontext()
            )
            with xarray_plot_ctx, mpl.rc_context(MATPLOTLIB_RC_CONTEXT):
                applied_plot_kwargs = draw_plot(
                    var, layout, bundle, selection, variable_name, flag_plot
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


def _usable_flag_spec(var: xr.DataArray, options: PlotOptions) -> FlagSpec | None:
    """The flag spec of ``var`` when it is drawn by meaning."""
    if not options.use_flags:
        return None
    spec = read_flag_spec(var.attrs, raw_dtype_of(var.encoding, var.dtype))
    if spec is None or not spec.is_valid:
        return None
    return spec


def _reopen_raw(var: xr.DataArray, opened: OpenedData) -> bool:
    """Whether decoding changed the codes and the engine can read them raw.

    Other engines keep the decoded floats: NaN then marks the points without
    data, and a fill code that is also a meaning is not shown.
    """
    return (
        needs_raw_codes(var.dtype, var.encoding)
        and opened.used_engine in ENGINES_WITH_PER_VARIABLE_DECODING
    )


def _flag_notes(
    var: xr.DataArray, options: PlotOptions, flag_plot: FlagPlot | None
) -> list[str]:
    """Why flag attributes present on ``var`` were not used."""
    if flag_plot is not None or not options.use_flags:
        return []
    spec = read_flag_spec(var.attrs, raw_dtype_of(var.encoding, var.dtype))
    if spec is None or spec.is_valid:
        return []
    return [f"CF flags not used ({'; '.join(spec.problems)}): plotted as numbers"]


def _build_plot_kwargs(
    options: PlotOptions, layout: PlotLayout, *, flags: bool = False
) -> PlotKwargsBundle:
    """Style kwargs the user set (the layout ones are resolved separately).

    vmin above vmax is swapped, with a note in ``layout`` when the plot is
    color-mapped (lines and histograms ignore both, and so do flag variables).
    """
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
    vmin, vmax = options.vmin, options.vmax
    if vmin is not None and vmax is not None and vmin > vmax:
        if layout.kind == "image" and not flags:
            layout.notes.append(
                f"vmin={vmin:g} is above vmax={vmax:g}: the two are swapped"
            )
        vmin, vmax = vmax, vmin
    return PlotKwargsBundle.build(
        bins=options.bins,
        robust=options.robust,
        xincrease=options.xincrease,
        yincrease=options.yincrease,
        cmap=options.cmap,
        vmin=vmin,
        vmax=vmax,
        add_colorbar=options.add_colorbar,
        add_legend=options.add_legend,
    )
