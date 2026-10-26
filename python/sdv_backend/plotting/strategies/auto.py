"""Automatic plot strategies chosen from variable dimensions."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.plotting.dispatcher import XarrayPlotDispatcher
from sdv_backend.plotting.kwargs import PlotKwargsBundle


@dataclass(frozen=True)
class AutoDefaultPlotContext:
    """Extra state only needed for the auto `default` plotting strategy."""

    datetime_var: xr.DataArray | None
    datetime_var_display_name: str | None
    variable_name: str


class AutoPlottingStrategy(ABC):
    """One auto-detected strategy: maps (var, bundle) → a single dispatcher call."""

    @abstractmethod
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        plt_module: Any,
        default_ctx: AutoDefaultPlotContext,
    ) -> None: ...


class AutoTwoDClassicStrategy(AutoPlottingStrategy):
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        plt_module: Any,
        default_ctx: AutoDefaultPlotContext,
    ) -> None:
        logger.info("Creating 2D spatial plot")
        dispatcher.imshow(
            var,
            "auto:strategy=2d_classic:DataArray.plot.imshow",
            **bundle.auto_imshow_merged_kw(),
        )
        plt_module.gca().set_aspect("equal")


class AutoTwoDClassicIselStrategy(AutoPlottingStrategy):
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        plt_module: Any,
        default_ctx: AutoDefaultPlotContext,
    ) -> None:
        logger.info("Creating 2D spatial plot with isel")
        first_dim = var.dims[0]
        dispatcher.imshow(
            var.isel({first_dim: 0}),
            "auto:strategy=2d_classic_isel:DataArray.plot.imshow",
            **bundle.auto_imshow_merged_kw(),
        )
        plt_module.gca().set_aspect("equal")


class AutoThreeDColStrategy(AutoPlottingStrategy):
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        plt_module: Any,
        default_ctx: AutoDefaultPlotContext,
    ) -> None:
        logger.info("Creating 3D plot (col facet)")
        first_dim = var.dims[0]
        fk = bundle.auto_figure_defaults()
        col_wrap = min(4, var.sizes.get(first_dim, 4))
        dispatcher.imshow(
            var,
            "auto:strategy=3d_col:DataArray.plot.imshow",
            **{
                **bundle.imshow_kwargs(),
                "col": first_dim,
                "aspect": fk.get("aspect", 1),
                "size": fk.get("size", 4),
                "col_wrap": col_wrap,
            },
        )


class AutoFourDColRowStrategy(AutoPlottingStrategy):
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        plt_module: Any,
        default_ctx: AutoDefaultPlotContext,
    ) -> None:
        logger.info("Creating 4D plot (row and col facets)")
        first_dim = var.dims[0]
        second_dim = var.dims[1]
        fk = bundle.auto_figure_defaults()
        dispatcher.imshow(
            var,
            "auto:strategy=4d_col_row:DataArray.plot.imshow",
            **{
                **bundle.imshow_kwargs(),
                "col": second_dim,
                "row": first_dim,
                "aspect": fk.get("aspect", 1),
                "size": fk.get("size", 4),
            },
        )


class AutoDefaultStrategy(AutoPlottingStrategy):
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        plt_module: Any,
        default_ctx: AutoDefaultPlotContext,
    ) -> None:
        logger.info("Creating default plot (xarray choice)")
        dt_var = default_ctx.datetime_var
        dt_name = default_ctx.datetime_var_display_name
        vname = default_ctx.variable_name

        if dt_var is not None and var.ndim == 1:
            datetime_values = dt_var.values
            var_values = var.values
            if datetime_values.shape != var_values.shape:
                logger.warning("Datetime shape mismatch, falling back to default plot")
                dispatcher.plot(
                    var,
                    "auto:default:DataArray.plot(datetime_mismatch_fallback)",
                    **bundle.generic_kwargs(),
                )
                return

            import pandas as pd

            if not isinstance(datetime_values, pd.DatetimeIndex):
                datetime_index = pd.DatetimeIndex(datetime_values)
            else:
                datetime_index = datetime_values
            var_with_time = xr.DataArray(
                var_values,
                coords={dt_name: datetime_index},
                dims=[dt_name],
                name=vname,
            )
            dispatcher.plot(
                var_with_time,
                "auto:default:DataArray.plot(1d+datetime_coord)",
                **bundle.generic_kwargs(),
            )
            return

        if var.ndim >= 2 and "cmap" in bundle.raw:
            fk = bundle.auto_figure_defaults()
            plot_kw = bundle.auto_imshow_merged_kw()
            if var.ndim == 2:
                dispatcher.imshow(
                    var,
                    "auto:default:cmap:DataArray.plot.imshow(ndim=2)",
                    **plot_kw,
                )
            elif var.ndim == 3:
                first = var.dims[0]
                dispatcher.imshow(
                    var,
                    "auto:default:cmap:DataArray.plot.imshow(ndim=3)",
                    **{
                        **bundle.imshow_kwargs(),
                        "col": first,
                        "aspect": fk.get("aspect", 1),
                        "size": fk.get("size", 4),
                        "col_wrap": min(4, var.sizes.get(first, 4)),
                    },
                )
            else:
                first, second = var.dims[0], var.dims[1]
                dispatcher.imshow(
                    var,
                    "auto:default:cmap:DataArray.plot.imshow(ndim>=4)",
                    **{
                        **bundle.imshow_kwargs(),
                        "row": first,
                        "col": second,
                        "aspect": fk.get("aspect", 1),
                        "size": fk.get("size", 4),
                    },
                )
            return

        dispatcher.plot(
            var,
            "auto:default:DataArray.plot(xarray_routes)",
            **bundle.generic_kwargs(),
        )


_AUTO_STRATEGY_REGISTRY: dict[
    str,
    AutoPlottingStrategy,
] = {
    "2d_classic": AutoTwoDClassicStrategy(),
    "2d_classic_isel": AutoTwoDClassicIselStrategy(),
    "3d_col": AutoThreeDColStrategy(),
    "4d_col_row": AutoFourDColRowStrategy(),
    "default": AutoDefaultStrategy(),
}


class AutoPlotOrchestrator:
    """Request path: no user facet/slice params (except cmap on auto) — strategy from detect_plotting_strategy."""

    def __init__(self, dispatcher: XarrayPlotDispatcher) -> None:
        self._d = dispatcher

    def run(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        strategy: str,
        *,
        plt_module: Any,
        default_ctx: AutoDefaultPlotContext,
    ) -> None:
        logger.info("Auto-plot: using strategy %s", strategy)
        if bundle.use_cmap_imshow_path():
            logger.info("Colormap for imshow: %s", bundle.raw.get("cmap"))
        strat = _AUTO_STRATEGY_REGISTRY[strategy]
        strat.execute(
            var,
            bundle,
            dispatcher=self._d,
            plt_module=plt_module,
            default_ctx=default_ctx,
        )
