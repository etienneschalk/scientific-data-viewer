"""``create_plot``: the 'plot' mode entry point."""

import base64
import contextlib
import datetime
from collections.abc import Sequence
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import cast

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.environment.engines import can_use_datatree
from sdv_backend.environment.packages import check_package_availability
from sdv_backend.formats.detect import detect_file_format
from sdv_backend.info.datatree import _datatree_inherit_mode
from sdv_backend.info.variables import check_monotonicity
from sdv_backend.opening import open_datatree_with_fallback
from sdv_backend.plotting.dispatcher import (
    XarrayPlotDispatcher,
    detect_plotting_strategy,
)
from sdv_backend.plotting.kwargs import PlotKwargsBundle
from sdv_backend.plotting.options import _parse_dimension_slices, col_wrap_is_set
from sdv_backend.plotting.strategies.auto import (
    AutoDefaultPlotContext,
    AutoPlotOrchestrator,
)
from sdv_backend.plotting.strategies.user import UserProvidedPlotOrchestrator
from sdv_backend.plotting.style import MATPLOTLIB_RC_CONTEXT
from sdv_backend.results import CreatePlotError, CreatePlotResult
from sdv_backend.types import ColWrap, DictOfDatasets


def create_plot(
    file_path: Path,
    variable_path: str,
    plot_type: str = "auto",
    style: str = "auto",
    convert_bands_to_variables: bool = False,
    datetime_variable_name: str | None = None,
    start_datetime: str | None = None,
    end_datetime: str | None = None,
    dimension_slices: dict[str, str | int] | None = None,
    facet_row: str | None = None,
    facet_col: str | None = None,
    col_wrap: ColWrap = None,
    plot_x: str | None = None,
    plot_y: str | None = None,
    plot_hue: str | None = None,
    xincrease: bool | None = None,
    yincrease: bool | None = None,
    aspect: int | float | None = None,
    size: int | float | None = None,
    robust: bool | None = None,
    cmap: str | None = None,
    bins: int | None = None,
    vmin: int | float | None = None,
    vmax: int | float | None = None,
    add_colorbar: bool = True,
    add_legend: bool = False,
    netcdf_engine_order: Sequence[str] | str | None = None,
    show_inherited_coordinates: bool = True,
    open_as_kerchunk: bool = False,
    facetgrid_figsize: tuple[float, float] | None = None,
) -> CreatePlotResult | CreatePlotError:
    """Create a plot from a data file variable.

    Opens a data file, extracts the specified variable, and creates a
    matplotlib visualization. The plotting strategy is automatically
    determined based on the variable's dimensions.

    Other xarray ``DataArray.plot`` kwargs worth wiring later (see xarray plotting
    docs) include ``norm``, ``center``, ``levels``, ``extend``, ``subplot_kws``,
    ``cbar_kwargs``, ``edgecolors``, ``linewidth``, ``marker``, ``linestyle``,
    and ``alpha``.

    Parameters
    ----------
    file_path : Path
        Path to the data file
    variable_path : str
        Path to the variable within the file (e.g., '/temperature')
    plot_type : str, optional
        Type of plot to create (currently only 'auto' supported)
    style : str, optional
        Matplotlib style to use (e.g., 'default', 'dark_background')
    vmin, vmax : float, optional
        Color scale limits (passed to colormap plots only; not histograms or plain line plots).
    add_colorbar : bool, optional
        Whether to draw a colorbar for scalar-mappable plots (default True). Ignored for histograms.
    add_legend : bool, optional
        Whether to add a legend when xarray supports it (e.g. ``hue``). Omitted on generic
        ``DataArray.plot`` and ``plot.imshow`` when ``hue`` is not set, so kwargs are not
        forwarded to matplotlib artists that reject ``add_legend`` (e.g. ``QuadMesh``).
        Default False.

    Returns
    -------
    CreatePlotResult or CreatePlotError
        CreatePlotResult with Base64-encoded PNG image data if successful, CreatePlotError if failed
    """

    try:
        if plot_type != "auto":
            raise ValueError(f"Invalid plot type: {plot_type}")

        # Detect file format and available engines
        file_format_info = detect_file_format(
            file_path,
            netcdf_engine_order=netcdf_engine_order,
            open_as_kerchunk=open_as_kerchunk,
        )

        if not file_format_info.is_supported:
            logger.error(
                f"No engines available for {file_format_info.extension} files. "
                f"Missing packages: {', '.join(file_format_info.missing_packages)}"
            )
            return CreatePlotError(
                error=f"No engines available for {file_format_info.extension} files. "
                f"Missing packages: {', '.join(file_format_info.missing_packages)}",
                format_info=file_format_info,
            )

        if not check_package_availability("matplotlib"):
            logger.error("Matplotlib is not installed")
            return CreatePlotError(
                error="Matplotlib is not installed. Install it and retry.",
                format_info=file_format_info,
            )

        # Inline imports of matplotlib as it is only used in this function.
        import matplotlib as mpl

        # Use non-interactive backend so plotting works headless (e.g. in VSCode)
        # and we avoid "Current Serial #N" / figure-manager errors from GUI backends.
        mpl.use("Agg")
        import matplotlib.pyplot as plt

        # Apply matplotlib style provided by VSCode extension
        if style and style.strip():
            try:
                logger.info(f"Using matplotlib style: {style}")
                plt.style.use(style)
            except Exception as exc:
                logger.warning(f"Failed to apply style '{style}': {exc}, using default")
                plt.style.use("default")
        else:
            logger.info("No style specified, using default")
            plt.style.use("default")

        # Open dataset with fallback
        xds_or_xdt, used_engine, _decode_cf_degraded = open_datatree_with_fallback(
            file_path, file_format_info, convert_bands_to_variables
        )

        datatree_flag: bool = can_use_datatree(used_engine) and isinstance(
            xds_or_xdt, xr.DataTree
        )

        path = PurePosixPath(variable_path)
        group_name = path.parent
        variable_name: str = (
            path.name
        )  # Use .name instead of .stem to preserve dots in variable names

        plot_inherit = _datatree_inherit_mode(show_inherited_coordinates)
        if can_use_datatree(used_engine) and isinstance(xds_or_xdt, xr.DataTree):
            xdt = cast("xr.DataTree", xds_or_xdt)

            group = xdt[str(group_name)].to_dataset(inherit=plot_inherit)
        else:
            xds_dict = cast("DictOfDatasets", xds_or_xdt)

            group = xds_dict[str(group_name)]

        # Get variable
        if variable_name in group.data_vars or variable_name in group.coords:
            var = group[variable_name]
        else:
            logger.error(f"Variable '{variable_name}' not found in dataset")
            # Close Start
            if datatree_flag:
                xdt = cast("xr.DataTree", xds_or_xdt)
                xdt.close()
            else:
                xds_dict = cast("DictOfDatasets", xds_or_xdt)
                for group, xds in xds_dict.items():
                    logger.info(f"Close {group=}")
                    xds.close()
            # Close End
            return CreatePlotError(
                error=f"Variable '{variable_name}' not found in dataset",
                format_info=file_format_info,
            )

        # Apply dimension slices (Issue #117) before datetime filtering
        applied_isel: dict[str, int | slice] = {}
        if dimension_slices:
            try:
                isel_dict = _parse_dimension_slices(dimension_slices)
                if isel_dict:
                    # Only apply isel for dimensions that exist on this variable
                    var_dims = set(var.dims)
                    isel_subset = {d: v for d, v in isel_dict.items() if d in var_dims}
                    if isel_subset:
                        var = var.isel(isel_subset)
                        applied_isel = dict(isel_subset)
                        logger.info(f"Applied dimension slices: {applied_isel}")
            except ValueError as e:
                logger.warning(f"Dimension slice parse error: {e}")
                return CreatePlotError(
                    error=f"Invalid dimension slice: {e}",
                    format_info=file_format_info,
                )
            except Exception as e:
                logger.exception("Dimension slice (isel) failed")
                return CreatePlotError(
                    error=f"Dimension slice error: {type(e).__name__}: {e}",
                    format_info=file_format_info,
                )

        # Handle datetime variable and time filtering
        datetime_var = None
        datetime_var_display_name = None
        datetime_var_name = None
        if datetime_variable_name:
            try:
                # Parse datetime strings
                import pandas as pd

                start_ts = pd.Timestamp(start_datetime) if start_datetime else None
                end_ts = pd.Timestamp(end_datetime) if end_datetime else None

                # Handle datetime variable path (may include group path like "/time" or "group/time")
                datetime_path = PurePosixPath(datetime_variable_name)
                datetime_group_name = datetime_path.parent
                datetime_var_name = (
                    datetime_path.name
                )  # Use .name instead of .stem to preserve dots in variable names
                datetime_var_display_name = datetime_var_name  # Store for plot labels

                # If datetime variable is in a different group, get that group
                datetime_group = group
                if (
                    str(datetime_group_name) != str(group_name)
                    and str(datetime_group_name) != "."
                ):
                    if can_use_datatree(used_engine) and isinstance(
                        xds_or_xdt, xr.DataTree
                    ):
                        xdt = cast("xr.DataTree", xds_or_xdt)
                        datetime_group = xdt[str(datetime_group_name)].to_dataset(
                            inherit=plot_inherit
                        )
                    else:
                        xds_dict = cast("DictOfDatasets", xds_or_xdt)
                        datetime_group = xds_dict[str(datetime_group_name)]

                # Get the datetime variable
                if (
                    datetime_var_name not in datetime_group.coords
                    and datetime_var_name not in datetime_group.data_vars
                ):
                    logger.error(
                        f"Datetime variable '{datetime_var_name}' not found in dataset"
                    )
                    return CreatePlotError(
                        error=f"Datetime variable '{datetime_var_name}' not found in dataset",
                        format_info=file_format_info,
                    )

                datetime_var = datetime_group[datetime_var_name]

                # If datetime variable is not a coordinate but shares a dimension with var,
                # we can set it as a coordinate temporarily or use boolean indexing
                if datetime_var_name not in datetime_group.coords:
                    # Find common dimension
                    common_dims = set(var.dims) & set(datetime_var.dims)
                    if common_dims:
                        dim_name = next(iter(common_dims))
                        # Create boolean mask for time range filtering
                        if start_ts and end_ts:
                            mask = (datetime_var >= start_ts) & (datetime_var <= end_ts)
                        elif start_ts:
                            mask = datetime_var >= start_ts
                        elif end_ts:
                            mask = datetime_var <= end_ts
                        else:
                            mask = None

                        if mask is not None:
                            var = var.isel({dim_name: mask})
                            datetime_var = datetime_var.isel({dim_name: mask})
                    else:
                        # No common dimensions - cannot use this datetime variable for plotting
                        logger.warning(
                            f"Datetime variable '{datetime_var_name}' does not share any dimensions "
                            f"with variable '{variable_name}'. Cannot use for plotting. "
                            f"Variable dimensions: {var.dims}, datetime dimensions: {datetime_var.dims}"
                        )
                        datetime_var = None
                else:
                    # Use .sel() if datetime is a coordinate
                    # But first check if the coordinate exists in var's dataset
                    # (it might be from a different group)
                    if datetime_var_name in group.coords:
                        # Check monotonicity before using .sel() with slice
                        monotonicity = check_monotonicity(datetime_var)
                        if monotonicity == "non_monotonic":
                            # Fall back to boolean indexing for non-monotonic data
                            logger.info(
                                f"Datetime variable '{datetime_var_name}' is not monotonic. "
                                f"Using boolean indexing instead of .sel() with slice."
                            )
                            # Find common dimension
                            common_dims = set(var.dims) & set(datetime_var.dims)
                            if common_dims:
                                dim_name = next(iter(common_dims))
                                # Create boolean mask for time range filtering
                                if start_ts and end_ts:
                                    mask = (datetime_var >= start_ts) & (
                                        datetime_var <= end_ts
                                    )
                                elif start_ts:
                                    mask = datetime_var >= start_ts
                                elif end_ts:
                                    mask = datetime_var <= end_ts
                                else:
                                    mask = None

                                if mask is not None:
                                    var = var.isel({dim_name: mask})
                                    datetime_var = datetime_var.isel({dim_name: mask})
                            else:
                                logger.warning(
                                    f"Datetime variable '{datetime_var_name}' does not share any dimensions "
                                    f"with variable '{variable_name}'. Cannot use for plotting."
                                )
                                datetime_var = None
                        else:
                            # Coordinate exists in var's dataset - can use .sel() directly
                            # For monotonic decreasing, swap start and end times
                            if monotonicity == "decreasing":
                                logger.info(
                                    f"Datetime variable '{datetime_var_name}' is monotonic decreasing. "
                                    f"Swapping start and end times for slice."
                                )
                                slice_start = end_ts
                                slice_end = start_ts
                            else:
                                # monotonicity == "increasing"
                                slice_start = start_ts
                                slice_end = end_ts

                            # slice() accepts None for start/end, so a single call handles all cases
                            var = var.sel(
                                {datetime_var_name: slice(slice_start, slice_end)}
                            )
                            datetime_var = datetime_var.sel(
                                {datetime_var_name: slice(slice_start, slice_end)}
                            )
                    else:
                        # Coordinate is from a different group - need to use positional indexing
                        # Find common dimension between var and datetime_var
                        common_dims = set(var.dims) & set(datetime_var.dims)
                        if common_dims:
                            dim_name = next(iter(common_dims))
                            # Create boolean mask for time range filtering
                            if start_ts and end_ts:
                                mask = (datetime_var >= start_ts) & (
                                    datetime_var <= end_ts
                                )
                            elif start_ts:
                                mask = datetime_var >= start_ts
                            elif end_ts:
                                mask = datetime_var <= end_ts
                            else:
                                mask = None

                            if mask is not None:
                                var = var.isel({dim_name: mask})
                                datetime_var = datetime_var.isel({dim_name: mask})
                        else:
                            # No common dimensions - cannot use this datetime variable for plotting
                            logger.warning(
                                f"Datetime variable '{datetime_var_name}' is a coordinate in a different group "
                                f"and does not share any dimensions with variable '{variable_name}'. "
                                f"Cannot use for plotting. "
                                f"Variable dimensions: {var.dims}, datetime dimensions: {datetime_var.dims}"
                            )
                            datetime_var = None

            except Exception as exc:
                logger.error(f"Error processing datetime variable: {exc!r}")
                return CreatePlotError(
                    error=f"Error processing datetime variable: {exc!r}",
                    format_info=file_format_info,
                )

        # Branch: user provided any dimension-slice/facet/x/y/hue/bins/aspect/size params => build only from user input
        # When only cmap is set, we keep auto branch so cmap is passed to the relevant plot calls there
        user_provided = bool(
            (dimension_slices and len(dimension_slices) > 0)
            or (facet_row and facet_row.strip())
            or (facet_col and facet_col.strip())
            or col_wrap_is_set(col_wrap)
            or (plot_x and plot_x.strip())
            or (plot_y and plot_y.strip())
            or (plot_hue and plot_hue.strip())
            or (bins is not None and bins >= 1)
            or (aspect is not None and aspect > 0)
            or (size is not None and size > 0)
        )

        # Optional plot kwargs (e.g. bins for histogram, robust, xincrease, yincrease, aspect, size)
        logger.info(
            "Plot params received: row=%r, col=%r, plot_x=%r, plot_y=%r, plot_hue=%r, "
            "bins=%s, xincrease=%s, yincrease=%s, aspect=%s, size=%s, robust=%s, cmap=%r, "
            "col_wrap=%s, vmin=%s, vmax=%s, add_colorbar=%s, add_legend=%s",
            facet_row,
            facet_col,
            plot_x,
            plot_y,
            plot_hue,
            bins,
            xincrease,
            yincrease,
            aspect,
            size,
            robust,
            cmap,
            col_wrap,
            vmin,
            vmax,
            add_colorbar,
            add_legend,
        )
        bundle = PlotKwargsBundle.build(
            bins=bins,
            robust=robust,
            xincrease=xincrease,
            yincrease=yincrease,
            aspect=aspect,
            size=size,
            cmap=cmap,
            col_wrap=col_wrap,
            vmin=vmin,
            vmax=vmax,
            add_colorbar=add_colorbar,
            add_legend=add_legend,
        )

        # Log applied kwargs including row/col (xarray names) when set
        applied_for_log = dict(bundle.raw)
        if facet_row and facet_row.strip():
            applied_for_log["row"] = facet_row.strip()
        if facet_col and facet_col.strip():
            applied_for_log["col"] = facet_col.strip()
        logger.info("Applied plot kwargs: %s", applied_for_log)
        if "cmap" in bundle.raw:
            logger.info(
                "cmap=%r will be applied via plot.imshow() (not passed to generic .plot())",
                bundle.raw["cmap"],
            )

        plot_dispatcher = XarrayPlotDispatcher()

        # Start with a clean figure state (avoids "Current Serial #N" / stale-figure issues)
        plt.close("all")

        xarray_plot_ctx = (
            xr.set_options(facetgrid_figsize=facetgrid_figsize)
            if facetgrid_figsize is not None
            else contextlib.nullcontext()
        )
        with xarray_plot_ctx, mpl.rc_context(MATPLOTLIB_RC_CONTEXT):
            if user_provided:
                logger.info(
                    "User provided dimension/facet/bins params: building plot from user input only"
                )
                UserProvidedPlotOrchestrator(plot_dispatcher).run(
                    var,
                    bundle,
                    facet_row=facet_row,
                    facet_col=facet_col,
                    plot_x=plot_x,
                    plot_y=plot_y,
                    plot_hue=plot_hue,
                )
            else:
                strategy = detect_plotting_strategy(var)
                default_ctx = AutoDefaultPlotContext(
                    datetime_var=datetime_var,
                    datetime_var_display_name=datetime_var_display_name,
                    variable_name=variable_name,
                )
                AutoPlotOrchestrator(plot_dispatcher).run(
                    var,
                    bundle,
                    strategy,
                    plt_module=plt,
                    default_ctx=default_ctx,
                )

            # Build suptitle with optional start/end time information
            # Only include start/end time if datetime variable is actually being used
            datetime_var_used = False
            if datetime_var is not None and datetime_var_name is not None:
                datetime_var_used = (
                    datetime_var_name in var.dims
                    or datetime_var_name in var.coords
                    or bool(set(var.dims) & set(datetime_var.dims))
                )

            suptitle_lines = [
                f"Variable: {variable_name}",
                "Creation date: "
                f"{datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')}",
            ]
            if datetime_var_used:
                if start_datetime:
                    suptitle_lines.append(
                        f"Start Time: {start_datetime} ({datetime_var_name})"
                    )
                if end_datetime:
                    suptitle_lines.append(
                        f"End Time: {end_datetime} ({datetime_var_name})"
                    )

            plt.suptitle("\n".join(suptitle_lines), y=1.20)
            # Convert to base64 string
            buffer = BytesIO()
            plt.savefig(buffer, format="png", dpi=100, bbox_inches="tight")
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close("all")

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

        logger.info("Plot created successfully")
        # Serialize isel kwargs for result (slice -> str for JSON)
        applied_isel_serializable: dict[str, int | str] = {
            k: v if isinstance(v, int) else str(v) for k, v in applied_isel.items()
        }
        return CreatePlotResult(
            plot_data=image_base64,
            format_info=file_format_info,
            applied_isel_kwargs=applied_isel_serializable,
            applied_plot_kwargs=dict(applied_for_log),
            matplotlib_style=style,
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
