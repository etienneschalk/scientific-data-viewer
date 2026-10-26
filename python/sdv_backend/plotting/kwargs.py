"""Construction of xarray ``DataArray.plot`` keyword arguments."""

from dataclasses import dataclass
from typing import Any

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.plotting.options import xarray_supports_col_wrap_auto
from sdv_backend.types import ColWrap


def strip_add_legend_unless_hue(plot_kwargs: dict[str, Any]) -> dict[str, Any]:
    """Omit ``add_legend`` when ``hue`` is absent.

    xarray's generic ``DataArray.plot`` may route to ``pcolormesh`` (``QuadMesh``);
    those artists do not accept ``add_legend``. The same applies to ``plot.imshow``
    without ``hue``. See https://github.com/etienneschalk/scientific-data-viewer/issues/134
    """
    if "hue" in plot_kwargs or "add_legend" not in plot_kwargs:
        return plot_kwargs
    out = dict(plot_kwargs)
    out.pop("add_legend", None)
    logger.info("add_legend omitted for plot without hue=")
    return out


@dataclass(frozen=True)
class PlotKwargsBundle:
    """User-requested plot kwargs. Variants split cmap (imshow-only) from generic .plot()."""

    raw: dict[str, Any]

    @staticmethod
    def build(
        *,
        bins: int | None,
        robust: bool | None,
        xincrease: bool | None,
        yincrease: bool | None,
        aspect: int | float | None,
        size: int | float | None,
        cmap: str | None,
        col_wrap: ColWrap,
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
        if aspect is not None and aspect > 0:
            plot_kwargs["aspect"] = float(aspect)
        if size is not None and size > 0:
            plot_kwargs["size"] = float(size)
        if cmap is not None and cmap.strip():
            plot_kwargs["cmap"] = cmap.strip()
        if col_wrap == "auto":
            if xarray_supports_col_wrap_auto():
                plot_kwargs["col_wrap"] = "auto"
            else:
                logger.warning(
                    "col_wrap='auto' requires xarray 2026.04+; "
                    f"installed {xr.__version__}, omitting col_wrap"
                )
        elif col_wrap is not None and col_wrap >= 1:
            plot_kwargs["col_wrap"] = int(col_wrap)
        if vmin is not None:
            plot_kwargs["vmin"] = float(vmin)
        if vmax is not None:
            plot_kwargs["vmax"] = float(vmax)
        if not add_colorbar:
            plot_kwargs["add_colorbar"] = False
        if add_legend:
            plot_kwargs["add_legend"] = True
        return PlotKwargsBundle(raw=plot_kwargs)

    def hist_kwargs(self) -> dict[str, Any]:
        """Kwargs for .plot.hist(): only keys histograms accept (see xarray hist API)."""
        out: dict[str, Any] = {}
        for k in ("bins", "xincrease", "yincrease"):
            if k in self.raw:
                out[k] = self.raw[k]
        return out

    def generic_kwargs(self) -> dict[str, Any]:
        """Kwargs for .plot(): no cmap / color-only keys (xarray may mis-route them)."""
        out = dict(self.raw)
        out.pop("cmap", None)
        out.pop("vmin", None)
        out.pop("vmax", None)
        out.pop("add_colorbar", None)
        if not out.get("add_legend"):
            out.pop("add_legend", None)
        return out

    def imshow_kwargs(self) -> dict[str, Any]:
        """Kwargs for .plot.imshow(): full raw except bins (histogram-only). Includes cmap."""
        out = dict(self.raw)
        out.pop("bins", None)
        return out

    def use_cmap_imshow_path(self) -> bool:
        return "cmap" in self.raw

    def _subset_figure_kw(self, keys: tuple[str, ...]) -> dict[str, Any]:
        return {k: self.raw[k] for k in keys if k in self.raw}

    def user_imshow_merged_kw(self) -> dict[str, Any]:
        """User branch: imshow + aspect/size/col_wrap (single merge; no duplicate ** cmap)."""
        fig = self._subset_figure_kw(("aspect", "size", "col_wrap"))
        return {**self.imshow_kwargs(), **fig}

    def auto_imshow_merged_kw(self) -> dict[str, Any]:
        """Auto branch: imshow + aspect/size only (col_wrap handled per strategy)."""
        fig = self._subset_figure_kw(("aspect", "size"))
        return {**self.imshow_kwargs(), **fig}

    def auto_figure_defaults(self) -> dict[str, Any]:
        """Aspect/size subset for strategies that pass explicit defaults."""
        return self._subset_figure_kw(("aspect", "size"))


def _valid_plot_dim(name: str | None, var_arr: xr.DataArray) -> str | None:
    if not name or not name.strip():
        return None
    n = name.strip()
    if n in var_arr.dims:
        return n
    if n in var_arr.coords:
        return n
    return None


def build_user_facet_plot_kw(
    var: xr.DataArray,
    *,
    facet_row: str | None,
    facet_col: str | None,
    plot_x: str | None,
    plot_y: str | None,
    plot_hue: str | None,
) -> dict[str, Any]:
    row_dim = (
        facet_row.strip()
        if (facet_row and facet_row.strip() and facet_row.strip() in var.dims)
        else None
    )
    col_dim = (
        facet_col.strip()
        if (facet_col and facet_col.strip() and facet_col.strip() in var.dims)
        else None
    )
    x_dim = _valid_plot_dim(plot_x, var)
    y_dim = _valid_plot_dim(plot_y, var)
    hue_dim = _valid_plot_dim(plot_hue, var)

    plot_kw: dict[str, Any] = {}
    if row_dim or col_dim:
        if row_dim and col_dim:
            plot_kw = {"row": row_dim, "col": col_dim}
        elif row_dim:
            plot_kw["row"] = row_dim
        else:
            plot_kw["col"] = col_dim
            plot_kw["col_wrap"] = min(4, var.sizes.get(col_dim, 4))
    if x_dim is not None:
        plot_kw["x"] = x_dim
    if y_dim is not None:
        plot_kw["y"] = y_dim
    if hue_dim is not None:
        plot_kw["hue"] = hue_dim
    return plot_kw
