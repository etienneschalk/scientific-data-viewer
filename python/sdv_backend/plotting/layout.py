"""Plot layout: which dimension goes where, the user's choices first.

``resolve_layout`` keeps every role the user set (x, y, hue, row, col,
col_wrap, size, aspect) and fills the others from the dimensions left free,
so changing one parameter keeps the automatic choice of the rest. Dimension
slices and the time range only select data: they never change the mode.

Order of the decisions (see docs/PLOTTING.md for the diagram):

1. ``bins`` set: histogram of every value, nothing else to lay out.
2. Size-1 dimensions nobody chose are dropped (index 0).
3. Plot kind from what is left: ``hue`` gives lines; two dimensions or more
   for the axes give an image; one gives a line; none, a histogram.
4. Empty axes get the last free dimensions (``x`` the last, ``y`` the one
   before), as xarray does.
5. Remaining dimensions become facets: ``col`` for one, ``row`` and ``col``
   for two. More than the facets can hold: histogram, with a note.
6. ``col_wrap`` (column facets only) and figure size get defaults.

Every choice records whether it came from the user or was picked here, and
the user's values that could not be used are explained in ``notes``.
"""

from collections.abc import Hashable
from dataclasses import dataclass, field
from typing import Any, Literal

import xarray as xr

from sdv_backend.plotting.options import (
    PlotOptions,
    col_wrap_is_set,
    xarray_supports_col_wrap_auto,
)
from sdv_backend.plotting.selection import DatetimeSelection

PlotKind = Literal["image", "line", "histogram"]
Source = Literal["user", "auto"]

# Facet panels of the automatic layout: at most 4 columns, 4 x 4 inches each
AUTO_COL_WRAP = 4
AUTO_FACET_SIZE = 4.0
AUTO_FACET_ASPECT = 1.0

# Roles in the order they are reported
ROLES = ("row", "col", "col_wrap", "y", "x", "hue", "size", "aspect", "bins")


@dataclass(frozen=True)
class Choice:
    value: Any
    source: Source


@dataclass
class PlotLayout:
    """What will be drawn: the plot kind and the kwargs that place the data."""

    kind: PlotKind
    choices: dict[str, Choice] = field(default_factory=dict)
    # Size-1 dimensions dropped (index 0) because nobody placed them
    squeezed: list[str] = field(default_factory=list)
    # User choices that could not be used, fallbacks, with the reason
    notes: list[str] = field(default_factory=list)
    # 1D line against the selected datetime variable instead of its dimension
    against_datetime: bool = False

    def set(self, role: str, value: Any, source: Source) -> None:
        self.choices[role] = Choice(value, source)

    def value(self, role: str) -> Any:
        choice = self.choices.get(role)
        return None if choice is None else choice.value

    def is_faceted(self) -> bool:
        return "row" in self.choices or "col" in self.choices

    def plot_kwargs(self) -> dict[str, Any]:
        """xarray kwargs of the layout (bins is a style kwarg, see kwargs.py)."""
        return {
            role: self.choices[role].value
            for role in ROLES
            if role in self.choices and role != "bins"
        }

    def to_json(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "choices": [
                {"role": role, "value": c.value, "source": c.source}
                for role in ROLES
                if (c := self.choices.get(role)) is not None
            ],
            "squeezed": list(self.squeezed),
            "notes": list(self.notes),
        }


def _user_value(text: str | None) -> str | None:
    return text.strip() if text and text.strip() else None


def _dims_of(var: xr.DataArray, name: str) -> tuple[Hashable, ...]:
    """Dimensions an axis name spans: itself, or the dimensions of a coordinate."""
    return (name,) if name in var.dims else tuple(var[name].dims)


def _user_pins(var: xr.DataArray, options: PlotOptions, layout: PlotLayout):
    """Valid user choices of x / y / hue / col / row, in that order of precedence.

    x, y and hue take a dimension or a coordinate, row and col a dimension.
    A name used by an earlier role, or absent from the variable, is ignored
    with a note.
    """
    requested = [
        ("x", options.plot_x),
        ("y", options.plot_y),
        ("hue", options.plot_hue),
        ("col", options.facet_col),
        ("row", options.facet_row),
    ]
    pins: dict[str, str] = {}
    for role, text in requested:
        name = _user_value(text)
        if name is None:
            continue
        facet = role in ("row", "col")
        if name not in var.dims and (facet or name not in var.coords):
            what = "dimension" if facet else "dimension or coordinate"
            layout.notes.append(
                f"{role}={name} ignored: not a {what} of this variable "
                f"(dimensions: {', '.join(map(str, var.dims)) or 'none'})"
            )
            continue
        used_by = next((r for r, n in pins.items() if n == name), None)
        if used_by is not None:
            layout.notes.append(f"{role}={name} ignored: already used as {used_by}")
            continue
        pins[role] = name
    return pins


def _histogram(layout: PlotLayout, options: PlotOptions) -> PlotLayout:
    """Histogram of every value: the user's x / y / hue / facets are dropped."""
    layout.kind = "histogram"
    layout.choices = {}
    if options.bins is not None and options.bins >= 1:
        layout.set("bins", options.bins, "user")
    _figure_size(layout, options)
    return layout


def _figure_size(layout: PlotLayout, options: PlotOptions) -> None:
    """Facets get 4 x 4 inch panels; a single plot keeps matplotlib's figure
    size unless the user set one (xarray needs ``size`` with ``aspect``)."""
    user_size = options.size if options.size is not None and options.size > 0 else None
    user_aspect = (
        options.aspect if options.aspect is not None and options.aspect > 0 else None
    )
    if user_size is not None:
        layout.set("size", float(user_size), "user")
    if user_aspect is not None:
        layout.set("aspect", float(user_aspect), "user")
    if layout.is_faceted():
        if user_size is None:
            layout.set("size", AUTO_FACET_SIZE, "auto")
        if user_aspect is None:
            layout.set("aspect", AUTO_FACET_ASPECT, "auto")
    elif user_aspect is not None and user_size is None:
        import matplotlib as mpl

        layout.set("size", float(mpl.rcParams["figure.figsize"][1]), "auto")


def _col_wrap(layout: PlotLayout, var: xr.DataArray, options: PlotOptions) -> None:
    col = layout.value("col")
    user_set = col_wrap_is_set(options.col_wrap)
    if col is None or "row" in layout.choices:
        if user_set:
            layout.notes.append(
                "col_wrap ignored: it wraps column facets, and there is "
                + ("a row facet" if col is not None else "no col facet")
            )
        return
    if options.col_wrap == "auto" and not xarray_supports_col_wrap_auto():
        layout.notes.append(
            f"col_wrap=auto ignored: needs xarray 2026.04+ (installed {xr.__version__})"
        )
    elif user_set:
        layout.set("col_wrap", options.col_wrap, "user")
        return
    layout.set("col_wrap", min(AUTO_COL_WRAP, var.sizes[col]), "auto")


def resolve_layout(
    var: xr.DataArray,
    options: PlotOptions,
    selection: DatetimeSelection | None = None,
) -> tuple[xr.DataArray, PlotLayout]:
    """Layout of ``var`` (already sliced and time-filtered).

    Returns ``var`` without the dropped size-1 dimensions, and the layout.
    """
    layout = PlotLayout(kind="image")
    pins = _user_pins(var, options, layout)

    if options.bins is not None and options.bins >= 1:
        if pins:
            layout.notes.append(
                f"{', '.join(pins)} not used: bins draws a histogram of all values"
            )
        return var, _histogram(layout, options)

    def dims_pinned(roles) -> set[Hashable]:
        return {d for r in roles if r in pins for d in _dims_of(var, pins[r])}

    # Lines colored by hue have one axis, and need a dimension for it
    if "hue" in pins and "x" in pins and "y" in pins:
        layout.notes.append(f"y={pins.pop('y')} ignored: a line plot has one axis")
    if "hue" in pins and not ({"x", "y"} & pins.keys()):
        others = [
            d
            for d in var.dims
            if var.sizes[d] > 1 and d not in dims_pinned(("hue", "row", "col"))
        ]
        if not others:
            layout.notes.append(
                f"hue={pins.pop('hue')} ignored: no other dimension for the x-axis"
            )

    pinned_dims = dims_pinned(pins)
    layout.squeezed = [
        str(d) for d in var.dims if var.sizes[d] == 1 and d not in pinned_dims
    ]
    if layout.squeezed:
        var = var.isel(dict.fromkeys(layout.squeezed, 0))
    if var.ndim == 0:
        layout.notes.append("A single value is selected: nothing to lay out")
        return var, _histogram(layout, options)

    for role, name in pins.items():
        layout.set(role, name, "user")
    free = [d for d in var.dims if d not in pinned_dims]
    axis_dims = dims_pinned(("x", "y"))

    # Kind, then the empty axes take the last free dimensions (xarray's
    # default: x the last, y the one before)
    if "hue" in pins:
        layout.kind = "line"
        if "x" not in pins and "y" not in pins:
            layout.set("x", str(free.pop()), "auto")
    elif len(axis_dims) + len(free) >= 2:
        layout.kind = "image"
        # A 2D coordinate (curvilinear grid) spans both axes on its own
        if len(axis_dims) < 2:
            if "x" not in pins:
                layout.set("x", str(free.pop()), "auto")
            if "y" not in pins:
                layout.set("y", str(free.pop()), "auto")
    elif len(axis_dims) + len(free) == 1:
        layout.kind = "line"
        if not axis_dims:
            layout.set("x", str(free.pop()), "auto")
    else:
        layout.notes.append(
            "No dimension left to draw inside each panel: histogram instead"
        )
        return var, _histogram(layout, options)

    # The dimensions still free become facets, as the automatic layout always did
    slots = [r for r in ("row", "col") if r not in pins]
    if len(free) > len(slots):
        layout.notes.append(
            f"Too many dimensions to lay out ({', '.join(map(str, free))} left "
            "after the axes and facets): histogram of all values. Slice one of "
            "them to an index, or pick it as row / col, to get an image."
        )
        return var, _histogram(layout, options)
    if len(free) == 1:
        layout.set(slots[-1], str(free[0]), "auto")  # col, or row when col is taken
    elif len(free) == 2:
        layout.set("row", str(free[0]), "auto")
        layout.set("col", str(free[1]), "auto")

    _col_wrap(layout, var, options)
    _figure_size(layout, options)

    x = layout.choices.get("x")
    if (
        layout.kind == "line"
        and var.ndim == 1
        and x is not None
        and x.source == "auto"
        and selection is not None
        and selection.datetime_var is not None
        and selection.datetime_var.shape == var.shape
    ):
        layout.against_datetime = True
        layout.set("x", selection.datetime_var_name, "auto")
    return var, layout
