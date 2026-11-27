"""The ``norm`` plot control: a logarithmic scale, the data left unchanged.

- image (imshow / pcolormesh, facets included): ``LogNorm(vmin, vmax)``
  built here from the values above 0, so the colors follow ``log10(value)``
  and the colorbar shows the values. ``vmin`` / ``vmax`` / ``robust`` are
  turned into the norm's limits and not passed to xarray next to it (xarray
  rejects a ``vmin`` that differs from the norm's). ``center=False``: xarray
  would otherwise pick a diverging colormap for data of both signs.
- line: the axis that carries the values is logarithmic (``yscale``, or
  ``xscale`` when the variable is drawn along y).
- histogram, flag variables, values that are not numbers: ignored, with a
  note.

A log scale cannot show values ≤ 0: they are left out (masked: transparent
on an image, a gap on a line) and counted in a note. With no value above 0,
the plot stays linear, with a note.
"""

from typing import Literal

import numpy as np
import xarray as xr

from sdv_backend.plotting.kwargs import PlotKwargsBundle
from sdv_backend.plotting.layout import PlotLayout
from sdv_backend.plotting.options import PlotOptions

Norm = Literal["linear", "log"]
NORM_CHOICES: tuple[str, ...] = ("linear", "log")

# xarray's robust limits: 2nd and 98th percentiles
ROBUST_PERCENTILE = 2.0


def apply_norm(
    var: xr.DataArray,
    layout: PlotLayout,
    bundle: PlotKwargsBundle,
    options: PlotOptions,
    *,
    flags: bool = False,
) -> tuple[xr.DataArray, PlotKwargsBundle]:
    """``var`` and the kwargs drawing it with ``options.norm``.

    The layout gets a ``norm`` item (set by the user) when the log scale is
    used, and a note when it is not or when values are left out.
    """
    if options.norm != "log":
        return var, bundle
    if flags:
        layout.notes.append("norm=log ignored: a CF flag variable is drawn by meaning")
        return var, bundle
    if layout.kind not in ("image", "line"):
        layout.notes.append(f"norm=log ignored: not used by a {layout.kind}")
        return var, bundle
    if var.dtype.kind not in "iuf":
        layout.notes.append(
            f"norm=log ignored: the values are not numbers ({var.dtype})"
        )
        return var, bundle

    values = np.asarray(var.values, dtype=float)
    finite = values[np.isfinite(values)]
    positive = finite[finite > 0]
    if positive.size == 0:
        layout.notes.append("norm=log ignored: no value above 0, linear scale")
        return var, bundle
    not_shown = int(finite.size - positive.size)

    if layout.kind == "line":
        axis = _data_axis(layout)
        if not_shown:
            var = var.where(var > 0)
        bundle = bundle.with_kwargs({f"{axis}scale": "log"})
        layout.set("norm", f"log ({axis} axis)", "user")
    else:
        bundle = _log_norm(positive, layout, bundle)
    if not_shown:
        layout.notes.append(
            f"norm=log: {not_shown} of {finite.size} values ≤ 0 not shown "
            f"({100 * not_shown / finite.size:.2g}%)"
        )
    return var, bundle


def _data_axis(layout: PlotLayout) -> Literal["x", "y"]:
    """The axis of a line plot that carries the values: y, unless the
    variable is drawn along y (``y`` placed, ``x`` not)."""
    if layout.value("y") is not None and layout.value("x") is None:
        return "x"
    return "y"


def _log_norm(
    positive: np.ndarray,
    layout: PlotLayout,
    bundle: PlotKwargsBundle,
) -> PlotKwargsBundle:
    """``bundle`` with ``LogNorm(vmin, vmax)`` in place of vmin / vmax / robust."""
    from matplotlib.colors import LogNorm

    robust = bundle.raw.get("robust") is True
    low = (
        float(np.percentile(positive, ROBUST_PERCENTILE))
        if robust
        else float(positive.min())
    )
    high = (
        float(np.percentile(positive, 100 - ROBUST_PERCENTILE))
        if robust
        else float(positive.max())
    )
    vmin = _user_limit("vmin", bundle.raw.get("vmin"), low, layout)
    vmax = _user_limit("vmax", bundle.raw.get("vmax"), high, layout)
    if vmin is None and vmax is not None and vmax < low:
        low = vmax
    if vmax is None and vmin is not None and vmin > high:
        high = vmin
    vmin = low if vmin is None else vmin
    vmax = high if vmax is None else vmax

    text = f"LogNorm(vmin={vmin:.6g}, vmax={vmax:.6g})"
    extend = _extend(positive, vmin, vmax)
    layout.set("norm", f"log, {vmin:.3g} to {vmax:.3g}", "user")
    return bundle.with_kwargs(
        {"norm": text, "center": False, "extend": extend},
        objects={"norm": LogNorm(vmin=vmin, vmax=vmax)},
        drop=("vmin", "vmax", "robust"),
    )


def _user_limit(
    name: str, value: float | None, fallback: float, layout: PlotLayout
) -> float | None:
    """A limit the user typed, None when there is none or it is ≤ 0 (noted)."""
    if value is None:
        return None
    if value <= 0:
        layout.notes.append(
            f"{name}={value:g} ignored: a log scale starts above 0 "
            f"({fallback:.3g} used)"
        )
        return None
    return float(value)


def _extend(positive: np.ndarray, vmin: float, vmax: float) -> str:
    """Colorbar arrows for the values above 0 out of the limits (the values
    ≤ 0 are not drawn: no arrow for them)."""
    below = bool((positive < vmin).any())
    above = bool((positive > vmax).any())
    if below and above:
        return "both"
    if below:
        return "min"
    if above:
        return "max"
    return "neither"
