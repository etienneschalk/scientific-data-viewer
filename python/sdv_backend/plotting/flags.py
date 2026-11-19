"""Plots of CF flag variables by meaning (``flag_values``).

``prepare_flag_plot`` turns the codes of a ``flag_values`` variable into an
index array (0..n-1 for the meanings, NaN where there is no data) with one
color per meaning. The layout engine then places it like any other variable
(``layout.resolve_layout``: image, line, facets), and ``draw.draw_plot``
draws it with the categories' colors and labels:

- image: one color per meaning, colorbar labelled ``value meaning (share)``,
  no data transparent;
- line (1D): steps, with the meanings on the y-axis;
- bars (in place of the histogram of codes): share of each meaning.

Colors: the user's ``cmap`` when set, else ``flag_colors`` when the file has a
valid one, else a qualitative palette (``tab10``, ``tab20``, then more).
Codes not declared in ``flag_values`` are drawn as one more category,
"other", with a note: they show a gap in the metadata.

``flag_masks`` (bit fields) are not drawn by meaning yet: the variable is
plotted as numbers, with a note (docs/v0.15/CF_FLAGS_PROPOSAL.md, phase P2).
"""

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import xarray as xr

from sdv_backend.flags import FlagSpec, raw_dtype_of
from sdv_backend.plotting.layout import PlotLayout

# Above this many meanings, only the ones present in the plotted data are
# listed (ESA CCI Land Cover declares 37)
MAX_LISTED_ABSENT = 20
OTHER_COLOR = "#000000"
OTHER_LABEL = "other (code not in flag_values)"

# Style options that make no sense for classes: one color each
_IGNORED_STYLE = ("vmin", "vmax", "robust")


@dataclass(frozen=True)
class Category:
    """One color of the plot: a meaning of ``flag_values``, or "other"."""

    label: str
    color: Any
    count: int
    # flag_values entry ("" for other)
    value: str = ""

    def tick_label(self, total: int) -> str:
        prefix = f"{self.value} " if self.value else ""
        return f"{prefix}{self.label} ({share_text(self.count, total)})"


@dataclass
class FlagPlot:
    """A flag variable ready to draw: the index array and its categories."""

    spec: FlagSpec
    # Category index per point, NaN where there is no data
    index: xr.DataArray
    categories: list[Category]
    # Points with data (shares are counted against them)
    total: int
    # Where the colors come from: "cmap", "flag_colors" or the palette name
    colors_source: str
    notes: list[str] = field(default_factory=list)

    def cmap_and_norm(self) -> tuple[Any, Any]:
        from matplotlib.colors import BoundaryNorm, ListedColormap

        n = len(self.categories)
        cmap = ListedColormap([c.color for c in self.categories], name="flags")
        cmap.set_bad((0, 0, 0, 0))
        return cmap, BoundaryNorm(np.arange(-0.5, n), n)

    def tick_labels(self) -> list[str]:
        return [c.tick_label(self.total) for c in self.categories]

    def report_value(self) -> str:
        """Value of the ``flags`` item of the plot layout line."""
        meanings = len(self.spec.flags)
        return f"flag_values, {meanings} meaning{'s' if meanings > 1 else ''}, colors: {self.colors_source}"


def share_text(count: int, total: int) -> str:
    if total == 0 or count == 0:
        return "0%"
    share = 100 * count / total
    if share < 1:
        return "<1%"
    if share > 99 and count < total:
        return ">99%"
    return f"{share:.0f}%"


def flag_codes(var: xr.DataArray, spec: FlagSpec) -> tuple[np.ndarray, np.ndarray]:
    """Raw codes of ``var`` and where it has data.

    ``var`` is read raw when the engine allows it (``mask_and_scale`` off for
    this variable): ``_FillValue``, ``missing_value`` and ``valid_range`` are
    then still attributes and mark the points without data, except a code
    that is a declared meaning (``255 = no_data`` is shown as a class).
    Otherwise (decoded floats), NaN marks them.
    """
    values = np.asarray(var.values)
    raw_dtype = raw_dtype_of(var.encoding, values.dtype)
    if values.dtype.kind == "f" and raw_dtype.kind in "iub":
        valid = np.isfinite(values)
        return np.where(valid, values, 0).astype(raw_dtype), valid
    valid = np.ones(values.shape, dtype=bool)
    if values.dtype.kind == "f":
        valid &= np.isfinite(values)
    declared = np.zeros(values.shape, dtype=bool)
    for flag in spec.flags:
        if flag.value is not None:
            declared |= values == flag.value
    no_data = _no_data(values, var.attrs, var.encoding)
    return values, valid & ~(no_data & ~declared)


def _no_data(values: np.ndarray, attrs: dict, encoding: dict) -> np.ndarray:
    no_data = np.zeros(values.shape, dtype=bool)
    for name in ("_FillValue", "missing_value"):
        for source in (attrs, encoding):
            if name in source and source[name] is not None:
                for fill in np.atleast_1d(source[name]):
                    no_data |= values == fill
    valid_range = attrs.get("valid_range")
    low = attrs.get("valid_min")
    high = attrs.get("valid_max")
    if valid_range is not None and np.size(valid_range) == 2:
        low, high = np.asarray(valid_range).tolist()
    if low is not None:
        no_data |= values < low
    if high is not None:
        no_data |= values > high
    return no_data


def prepare_flag_plot(
    var: xr.DataArray, spec: FlagSpec, cmap: str | None = None
) -> FlagPlot:
    """Index array and categories of a valid ``flag_values`` variable."""
    codes, valid = flag_codes(var, spec)
    total = int(valid.sum())
    index = np.full(codes.shape, np.nan)
    matched = np.zeros(codes.shape, dtype=bool)
    counts = []
    for i, flag in enumerate(spec.flags):
        hit = valid & flag.test(codes) & ~matched
        index[hit] = i
        matched |= hit
        counts.append(int(hit.sum()))
    other = valid & ~matched
    notes: list[str] = list(spec.notes)

    keep = list(range(len(spec.flags)))
    if len(keep) > MAX_LISTED_ABSENT:
        keep = [i for i in keep if counts[i] > 0]
        absent = len(spec.flags) - len(keep)
        if absent:
            notes.append(
                f"{absent} of the {len(spec.flags)} meanings are absent from the "
                "plotted data and not listed"
            )
    colors, colors_source = _palette(spec, keep, cmap, notes)
    categories = [
        Category(
            spec.flags[i].label,
            colors[k],
            counts[i],
            value=_value_text(spec.flags[i].value),
        )
        for k, i in enumerate(keep)
    ]
    remap = np.full(len(spec.flags), np.nan)
    remap[keep] = np.arange(len(keep))
    with np.errstate(invalid="ignore"):
        index = np.where(
            np.isnan(index), np.nan, remap[np.nan_to_num(index).astype(int)]
        )
    if other.any():
        undeclared = np.unique(codes[other])
        shown = ", ".join(_value_text(v) for v in undeclared[:5].tolist())
        more = f" and {len(undeclared) - 5} more" if len(undeclared) > 5 else ""
        count = int(other.sum())
        notes.append(
            f"{count} value{' has a code' if count == 1 else 's have codes'} not "
            f"listed in flag_values ({shown}{more}): drawn as 'other'"
        )
        index[other] = len(categories)
        categories.append(Category(OTHER_LABEL, OTHER_COLOR, int(other.sum())))

    attrs = {
        key: var.attrs[key]
        for key in ("long_name", "standard_name")
        if key in var.attrs
    }
    index_da = xr.DataArray(
        index, dims=var.dims, coords=var.coords, name=var.name, attrs=attrs
    )
    return FlagPlot(spec, index_da, categories, total, colors_source, notes)


def _value_text(value: Any) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _palette(
    spec: FlagSpec, keep: list[int], cmap: str | None, notes: list[str]
) -> tuple[list[Any], str]:
    """One color per kept meaning: the user's cmap, else flag_colors, else a
    qualitative palette."""
    import matplotlib as mpl
    from matplotlib.colors import ListedColormap, is_color_like

    n = max(len(keep), 1)
    if cmap:
        try:
            colormap = mpl.colormaps[cmap]
        except KeyError:
            notes.append(f"cmap={cmap} ignored: not a matplotlib colormap")
        else:
            if isinstance(colormap, ListedColormap) and n <= colormap.N:
                colors = list(colormap.colors)[:n]  # type: ignore[arg-type]
            else:
                colors = [colormap(x) for x in np.linspace(0, 1, n)]
            return colors, f"cmap {cmap}"
    if spec.colors is not None:
        chosen = [spec.colors[i] for i in keep]
        bad = [c for c in chosen if not is_color_like(c)]
        if not bad:
            return chosen, "flag_colors"
        notes.append(f"flag_colors ignored: matplotlib does not know {bad[0]}")
    if n <= 10:
        return list(mpl.colormaps["tab10"].colors)[:n], "tab10"  # type: ignore[attr-defined]
    if n <= 20:
        return list(mpl.colormaps["tab20"].colors)[:n], "tab20"  # type: ignore[attr-defined]
    many = [
        color
        for name in ("tab20", "tab20b", "tab20c")
        for color in mpl.colormaps[name].colors  # type: ignore[attr-defined]
    ]
    if n <= len(many):
        return many[:n], "tab20 + tab20b + tab20c"
    turbo = mpl.colormaps["turbo"]
    return [turbo(x) for x in np.linspace(0, 1, n)], "turbo"


def adjust_layout(flag_plot: FlagPlot, layout: PlotLayout, raw: dict[str, Any]) -> None:
    """Report the flags in the layout line, and what they make useless.

    ``raw`` are the style kwargs the user set (``PlotKwargsBundle.raw``):
    the ones that make no sense for classes are removed from it, with a note.
    """
    if layout.kind == "histogram":
        layout.kind = "bars"
        if layout.value("bins") is not None:
            layout.notes.append(
                "bins ignored: a CF flag variable is drawn as one bar per meaning"
            )
            layout.choices.pop("bins", None)
    layout.set("flags", flag_plot.report_value(), "auto")
    ignored = [key for key in _IGNORED_STYLE if raw.pop(key, None) is not None]
    if ignored and layout.kind != "line":
        layout.notes.append(
            f"{', '.join(ignored)} ignored: CF flag meanings have one color each"
        )
    layout.notes.extend(flag_plot.notes)


def draw_flag_image(
    var: xr.DataArray, flag_plot: FlagPlot, kwargs: dict[str, Any], method: str
) -> None:
    """``plot.imshow`` / ``plot.pcolormesh`` with one color per category."""
    cmap, norm = flag_plot.cmap_and_norm()
    n = len(flag_plot.categories)
    kwargs = {**kwargs, "cmap": cmap, "norm": norm}
    add_colorbar = kwargs.get("add_colorbar", True)
    if add_colorbar:
        kwargs["cbar_kwargs"] = {"ticks": list(range(n))}
    result = getattr(var.plot, method)(**kwargs)
    if not add_colorbar:
        return
    colorbar = getattr(result, "cbar", None) or getattr(result, "colorbar", None)
    if colorbar is None:
        return
    colorbar.set_ticks(list(range(n)), labels=flag_plot.tick_labels())
    colorbar.ax.tick_params(length=0, labelsize=8 if n > 12 else None)
    colorbar.ax.minorticks_off()


def draw_flag_line(
    var: xr.DataArray, flag_plot: FlagPlot, kwargs: dict[str, Any]
) -> None:
    """Steps along the x-axis, with the meanings on the y-axis (ACT style);
    points colored by meaning when there is one line."""
    import matplotlib.pyplot as plt

    kwargs = {**kwargs, "drawstyle": "steps-mid"}
    single = "hue" not in kwargs and "row" not in kwargs and "col" not in kwargs
    if single:
        kwargs["color"] = "0.6"
        kwargs["linewidth"] = 1
    result = var.plot.line(**kwargs)
    axes = list(result.axs.flat) if hasattr(result, "axs") else [plt.gca()]
    n = len(flag_plot.categories)
    labels = [c.tick_label(flag_plot.total) for c in flag_plot.categories]
    for ax in axes:
        ax.set_yticks(list(range(n)), labels=labels)
        ax.set_ylim(-0.5, n - 0.5)
        ax.set_ylabel("")
    if single:
        line = axes[0].get_lines()[0]
        x, y = line.get_xdata(), np.asarray(line.get_ydata(), dtype=float)
        has = np.isfinite(y)
        colors = [flag_plot.categories[int(v)].color for v in y[has]]
        axes[0].scatter(np.asarray(x)[has], y[has], c=colors, s=12, zorder=3)


def draw_flag_bars(var: xr.DataArray, flag_plot: FlagPlot) -> None:
    """One horizontal bar per category: its share of the points with data."""
    import matplotlib.pyplot as plt

    categories = flag_plot.categories
    n = len(categories)
    fig, ax = plt.subplots(figsize=(6.4, max(2.0, 0.35 * n + 1)))
    shares = [
        100 * c.count / flag_plot.total if flag_plot.total else 0 for c in categories
    ]
    ax.barh(range(n), shares, color=[c.color for c in categories], edgecolor="0.3")
    ax.set_yticks(
        list(range(n)), labels=[c.tick_label(flag_plot.total) for c in categories]
    )
    ax.invert_yaxis()
    ax.set_xlabel(f"% of the {flag_plot.total} values with data")
    ax.set_xlim(0, max([*shares, 1]) * 1.1)
    title = var.attrs.get("long_name") or var.name or ""
    if title:
        ax.set_title(str(title))
    fig.tight_layout()


def describe_kwargs(kwargs: dict[str, Any], flag_plot: FlagPlot) -> dict[str, Any]:
    """The kwargs reported in the result: the colormap objects as text."""
    out = {k: v for k, v in kwargs.items() if k not in ("cmap", "norm", "cbar_kwargs")}
    n = len(flag_plot.categories)
    out["cmap"] = f"ListedColormap({n} colors: {flag_plot.colors_source})"
    out["norm"] = f"BoundaryNorm(-0.5..{n - 0.5}, {n})"
    return out
