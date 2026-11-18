"""Style keyword arguments of xarray ``DataArray.plot`` (colors, axes, legend).

Where the data goes (x, y, hue, facets, figure size) is decided by
``layout.resolve_layout``; this module only filters the style options the
user set down to the ones the chosen plot kind accepts.
"""

from dataclasses import dataclass
from typing import Any

from sdv_backend._bootstrap import logger
from sdv_backend.plotting.layout import PlotKind

# Options of a color-mapped plot, rejected by line and histogram artists
COLOR_MESH_KEYS: tuple[str, ...] = ("cmap", "vmin", "vmax", "robust", "add_colorbar")

# The only style options a histogram takes (see xarray's plot.hist)
HISTOGRAM_KEYS: tuple[str, ...] = ("bins", "xincrease", "yincrease")


@dataclass(frozen=True)
class PlotKwargsBundle:
    """Style kwargs the user set; ``for_kind`` keeps those a plot kind accepts."""

    raw: dict[str, Any]

    @staticmethod
    def build(
        *,
        bins: int | None = None,
        robust: bool | None = None,
        xincrease: bool | None = None,
        yincrease: bool | None = None,
        cmap: str | None = None,
        vmin: int | float | None = None,
        vmax: int | float | None = None,
        add_colorbar: bool = True,
        add_legend: bool = False,
    ) -> "PlotKwargsBundle":
        plot_kwargs: dict[str, Any] = {}
        if bins is not None and bins >= 1:
            plot_kwargs["bins"] = bins
        if robust is True:
            plot_kwargs["robust"] = True
        if xincrease is not None:
            plot_kwargs["xincrease"] = xincrease
        if yincrease is not None:
            plot_kwargs["yincrease"] = yincrease
        if cmap is not None and cmap.strip():
            plot_kwargs["cmap"] = cmap.strip()
        if vmin is not None:
            plot_kwargs["vmin"] = float(vmin)
        if vmax is not None:
            plot_kwargs["vmax"] = float(vmax)
        if not add_colorbar:
            plot_kwargs["add_colorbar"] = False
        if add_legend:
            plot_kwargs["add_legend"] = True
        return PlotKwargsBundle(raw=plot_kwargs)

    def for_kind(self, kind: PlotKind, *, hue: bool) -> dict[str, Any]:
        """Kwargs a plot kind accepts.

        Histograms take only ``HISTOGRAM_KEYS``; line artists reject the color
        keys; ``add_legend`` is only passed with ``hue`` (matplotlib's
        ``AxesImage`` / ``QuadMesh`` reject it, issue #134).
        """
        if kind == "histogram":
            return {k: v for k, v in self.raw.items() if k in HISTOGRAM_KEYS}
        out = dict(self.raw)
        out.pop("bins", None)
        if kind == "line":
            ignored = [key for key in COLOR_MESH_KEYS if out.pop(key, None) is not None]
            if ignored:
                logger.info("%s ignored: not a color-mapped plot", ", ".join(ignored))
        if not hue:
            out.pop("add_legend", None)
        return out
