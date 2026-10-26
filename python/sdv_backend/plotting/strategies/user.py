"""Plot strategies driven by user-provided plot options."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.plotting.dispatcher import XarrayPlotDispatcher
from sdv_backend.plotting.kwargs import PlotKwargsBundle, build_user_facet_plot_kw


@dataclass(frozen=True)
class UserProvidedPlotRequest:
    """Facet / x-y-hue names from the user (histogram and slices-only strategies ignore these)."""

    facet_row: str | None = None
    facet_col: str | None = None
    plot_x: str | None = None
    plot_y: str | None = None
    plot_hue: str | None = None


def detect_user_provided_plot_strategy(
    bundle: PlotKwargsBundle,
    request: UserProvidedPlotRequest,
) -> Literal["histogram", "faceted", "slices_only"]:
    """Pick user-provided plotting strategy from bundle + facet request (mirrors auto `detect_plotting_strategy`)."""
    if "bins" in bundle.raw and bundle.raw.get("bins") is not None:
        return "histogram"
    if (
        request.facet_row
        or request.facet_col
        or request.plot_x
        or request.plot_y
        or request.plot_hue
    ):
        return "faceted"
    return "slices_only"


class UserProvidedPlottingStrategy(ABC):
    """One user-driven branch: maps (var, bundle, request) → a single dispatcher call."""

    @abstractmethod
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        request: UserProvidedPlotRequest,
    ) -> None: ...


class UserProvidedHistogramStrategy(UserProvidedPlottingStrategy):
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        request: UserProvidedPlotRequest,
    ) -> None:
        logger.info("Creating histogram plot with bins=%s", bundle.raw["bins"])
        dispatcher.hist(
            var,
            "user_provided:DataArray.plot.hist",
            **bundle.hist_kwargs(),
        )


class UserProvidedFacetedStrategy(UserProvidedPlottingStrategy):
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        request: UserProvidedPlotRequest,
    ) -> None:
        plot_kw = build_user_facet_plot_kw(
            var,
            facet_row=request.facet_row,
            facet_col=request.facet_col,
            plot_x=request.plot_x,
            plot_y=request.plot_y,
            plot_hue=request.plot_hue,
        )
        cmap_imshow = bundle.use_cmap_imshow_path()
        merged_imshow = bundle.user_imshow_merged_kw()

        if plot_kw:
            if var.ndim >= 2 and cmap_imshow:
                logger.info(
                    "Creating plot with user facets/dims and cmap via plot.imshow"
                )
                dispatcher.imshow(
                    var,
                    "user_provided:DataArray.plot.imshow(facets+slice_kwargs)",
                    **{**plot_kw, **merged_imshow},
                )
            else:
                dispatcher.plot(
                    var,
                    "user_provided:DataArray.plot(facets+slice_kwargs)",
                    **{**plot_kw, **bundle.generic_kwargs()},
                )
            return

        logger.warning(
            "Facet row/col and x/y/hue not found on variable; using default plot",
        )
        if var.ndim >= 2 and cmap_imshow:
            logger.info("Creating plot from user params with cmap via plot.imshow")
            dispatcher.imshow(
                var,
                "user_provided:DataArray.plot.imshow(fallback_no_valid_facets)",
                **merged_imshow,
            )
        elif bundle.raw:
            dispatcher.plot(
                var,
                "user_provided:DataArray.plot(fallback_no_valid_facets+kwargs)",
                **bundle.generic_kwargs(),
            )
        else:
            dispatcher.plot(
                var,
                "user_provided:DataArray.plot(fallback_no_valid_facets)",
            )


class UserProvidedSlicesOnlyStrategy(UserProvidedPlottingStrategy):
    def execute(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        dispatcher: XarrayPlotDispatcher,
        request: UserProvidedPlotRequest,
    ) -> None:
        logger.info("Creating plot from sliced data (xarray default)")
        cmap_imshow = bundle.use_cmap_imshow_path()
        merged_imshow = bundle.user_imshow_merged_kw()
        if var.ndim >= 2 and cmap_imshow:
            logger.info("Creating 2D+ plot from sliced data with cmap via plot.imshow")
            dispatcher.imshow(
                var,
                "user_provided:DataArray.plot.imshow(slices_only+cmap)",
                **merged_imshow,
            )
        elif bundle.raw:
            dispatcher.plot(
                var,
                "user_provided:DataArray.plot(slices_only+kwargs)",
                **bundle.generic_kwargs(),
            )
        else:
            dispatcher.plot(var, "user_provided:DataArray.plot(slices_only)")


_USER_PROVIDED_STRATEGY_REGISTRY: dict[str, UserProvidedPlottingStrategy] = {
    "histogram": UserProvidedHistogramStrategy(),
    "faceted": UserProvidedFacetedStrategy(),
    "slices_only": UserProvidedSlicesOnlyStrategy(),
}


class UserProvidedPlotOrchestrator:
    """Resolves user-provided strategy name, then runs the matching strategy (same pattern as `AutoPlotOrchestrator`)."""

    def __init__(self, dispatcher: XarrayPlotDispatcher) -> None:
        self._d = dispatcher

    def run(
        self,
        var: xr.DataArray,
        bundle: PlotKwargsBundle,
        *,
        facet_row: str | None,
        facet_col: str | None,
        plot_x: str | None,
        plot_y: str | None,
        plot_hue: str | None,
    ) -> None:
        request = UserProvidedPlotRequest(
            facet_row=facet_row,
            facet_col=facet_col,
            plot_x=plot_x,
            plot_y=plot_y,
            plot_hue=plot_hue,
        )
        name = detect_user_provided_plot_strategy(bundle, request)
        strat = _USER_PROVIDED_STRATEGY_REGISTRY[name]
        strat.execute(var, bundle, dispatcher=self._d, request=request)
