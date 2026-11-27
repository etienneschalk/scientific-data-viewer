"""Plots of CF flag variables by meaning.

``prepare_flag_plot`` turns the codes of a flag variable into an index array
of categories (one color per meaning, NaN where there is no data). The layout
engine then places it like any other variable (``layout.resolve_layout``:
image, line, facets), and ``draw.draw_plot`` draws it with the categories'
colors and labels.

``flag_values`` (exclusive codes): index 0..n-1 per meaning.

- image: one color per meaning, colorbar labelled ``value meaning (share)``,
  no data transparent;
- line (1D): steps, with the meanings on the y-axis;
- bars (in place of the histogram of codes): share of each meaning.

``flag_masks`` (bits) and masks + values (bit fields): one more dimension,
``flag``, with one entry per *field* (a mask; a mask repeated in
``flag_masks`` is one field with several states, CF example 3.8). Each entry
holds the category of its meaning where it is set, else "not set" (grey).
The layout engine puts ``flag`` on the facets like any free dimension:

- maps: one panel per flag, titled ``flag = cloud (bit 0)``;
- 1D: an image with one row per flag along the x-axis (block plot);
- a single point, ``bins`` or too many dimensions: bars, the share of the
  points where each flag is set.

Selection (``FlagChoice``): ``flag_select`` names the meanings to draw
(``flag_values``: the others merge into one grey category; bits: only the
fields holding them). ``flag_combine`` (bits) folds the chosen flags, or all
of them, into one map: ``any`` (OR, the usual "invalid pixel" mask), ``all``
(AND) or ``none`` (where none is set: the clear points).

``hide_flagged`` hides the points of a data variable where a flag variable
named in its ``ancillary_variables`` has one of the chosen flags set.

Colors: the user's ``cmap`` when set, else ``flag_colors`` when the file has a
valid one, else a qualitative palette (``tab10``, ``tab20``, then more).
Codes not declared in ``flag_values`` are drawn as one more category,
"other", and bits outside ``flag_masks`` are counted in a note: they show a
gap in the metadata.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

import numpy as np
import xarray as xr

from sdv_backend.flags import (
    FlagSpec,
    as_code,
    dtype_bits,
    mask_bits_text,
    normalize_meaning,
    raw_dtype_of,
)
from sdv_backend.plotting.colormaps import ColormapError, get_colormap
from sdv_backend.plotting.layout import PlotLayout

# Above this many meanings (or fields of bits), only the ones present in the
# plotted data are listed (ESA CCI Land Cover declares 37 classes, Sentinel-3
# OLCI WQSF about 40 bits)
MAX_LISTED_ABSENT = 20
OTHER_COLOR = "#000000"
OTHER_LABEL = "other (code not in flag_values)"
NOT_SET_COLOR = "#d9d9d9"
NOT_SET_LABEL = "not set"
FlagCombine = Literal["any", "all", "none"]
FLAG_COMBINE_CHOICES: tuple[str, ...] = ("any", "all", "none")
# Above this many names, a combined label counts them instead
MAX_NAMED_IN_LABEL = 3
# Bits: the index array has one copy of the data per field; above this many
# points, the last fields are left out (with a note)
MAX_FIELD_POINTS = 50_000_000

# Style options that make no sense for classes: one color each
_IGNORED_STYLE = ("vmin", "vmax", "robust")


@dataclass(frozen=True)
class Category:
    """One color of the plot: a meaning of ``flag_values``, or "other"."""

    label: str
    color: Any
    # Points where the meaning is set; None for "not set" (no share shown)
    count: int | None
    # flag_values entry, or the bits of a mask ("" for other / not set)
    value: str = ""

    def tick_label(self, total: int) -> str:
        prefix = f"{self.value} " if self.value else ""
        if self.count is None:
            return f"{prefix}{self.label}"
        return f"{prefix}{self.label} ({share_text(self.count, total)})"


@dataclass(frozen=True)
class FlagChoice:
    """What the user asked to draw: meanings by name, and how to combine
    bits (None: one panel per flag)."""

    select: tuple[str, ...] = ()
    combine: FlagCombine | None = None

    @property
    def is_set(self) -> bool:
        return bool(self.select) or self.combine is not None


@dataclass(frozen=True)
class FlagField:
    """One entry of the ``flag`` dimension: a mask, and the meanings it holds
    (one for a bit; several states for a mask repeated in ``flag_masks``)."""

    label: str
    flags: tuple[int, ...]


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
    # Bits: name of the dimension added for the fields (None for flag_values)
    flag_dim: str | None = None
    fields: list[FlagField] = field(default_factory=list)
    # The selection / combination applied ("" when none), for the layout line
    choice_text: str = ""

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
        text = {
            "values": "flag_values",
            "masks": "flag_masks",
            "mixed": "flag_masks + flag_values",
        }[self.spec.kind]
        text += f", {meanings} meaning{'s' if meanings > 1 else ''}"
        if self.spec.kind == "mixed":
            fields = len(flag_fields(self.spec))
            text += f" in {fields} field{'s' if fields > 1 else ''}"
        if self.choice_text:
            text += f", {self.choice_text}"
        return f"{text}, colors: {self.colors_source}"

    def set_categories(self) -> list[Category]:
        """The categories with a share (not "not set")."""
        return [c for c in self.categories if c.count is not None]


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
    if spec.kind == "values":
        for flag in spec.flags:
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
    var: xr.DataArray,
    spec: FlagSpec,
    cmap: str | None = None,
    choice: FlagChoice = FlagChoice(),
) -> FlagPlot:
    """Index array and categories of a valid flag variable."""
    notes: list[str] = list(spec.notes)
    selected = _selected(spec, choice.select, notes)
    if spec.kind == "values":
        if choice.combine is not None:
            notes.append(
                f"flag_combine={choice.combine} ignored: flag_values are exclusive "
                "codes (flag_select highlights some of them)"
            )
        return _prepare_values(var, spec, cmap, selected, notes)
    if choice.combine is not None:
        return _prepare_combined(var, spec, cmap, selected, choice.combine, notes)
    return _prepare_fields(var, spec, cmap, selected, notes)


def _selected(
    spec: FlagSpec, names: Sequence[str], notes: list[str]
) -> list[int] | None:
    """Indexes of the flags named by ``flag_select`` (None: no selection)."""
    if not names:
        return None
    found, unknown = spec.match(names)
    if not found:
        notes.append(
            f"flag_select ignored: no meaning of this variable is named "
            f"{', '.join(names)}"
        )
        return None
    if unknown:
        notes.append(
            f"flag_select: {', '.join(unknown)} not among the meanings of this variable"
        )
    return found


def _names_text(spec: FlagSpec, indexes: Sequence[int]) -> str:
    return ", ".join(spec.flags[i].label for i in indexes)


def _prepare_values(
    var: xr.DataArray,
    spec: FlagSpec,
    cmap: str | None,
    selected: list[int] | None,
    notes: list[str],
) -> FlagPlot:
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

    keep = list(range(len(spec.flags)))
    if selected is not None:
        keep = selected
    elif len(keep) > MAX_LISTED_ABSENT:
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
    if selected is not None:
        # The meanings not selected: one grey category
        rest = [i for i in range(len(spec.flags)) if i not in keep]
        if rest:
            remap[rest] = len(keep)
            categories.append(
                Category(
                    f"the {len(rest)} other meaning{'s' if len(rest) > 1 else ''}",
                    NOT_SET_COLOR,
                    sum(counts[i] for i in rest),
                )
            )
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

    index_da = xr.DataArray(
        index, dims=var.dims, coords=var.coords, name=var.name, attrs=_attrs(var)
    )
    choice_text = "" if selected is None else f"selected: {_names_text(spec, keep)}"
    return FlagPlot(
        spec,
        index_da,
        categories,
        total,
        colors_source,
        notes,
        choice_text=choice_text,
    )


def flag_fields(spec: FlagSpec) -> list[FlagField]:
    """The fields of a ``flag_masks`` spec: one per bit flag; with
    ``flag_values`` too, one per distinct mask (its states share it)."""
    bits = dtype_bits(spec.dtype)
    if spec.kind == "masks":
        return [
            FlagField(f"{flag.label} ({mask_bits_text(flag.mask or 0, bits)})", (i,))
            for i, flag in enumerate(spec.flags)
        ]
    by_mask: dict[int, list[int]] = {}
    for i, flag in enumerate(spec.flags):
        by_mask.setdefault(flag.mask or 0, []).append(i)
    fields = []
    for mask, members in by_mask.items():
        bits_text = mask_bits_text(mask, bits)
        if len(members) == 1:
            label = f"{spec.flags[members[0]].label} ({bits_text})"
        else:
            label = f"{bits_text}: {len(members)} states"
        fields.append(FlagField(label, tuple(members)))
    return fields


def _flag_prefix(spec: FlagSpec, i: int, states: int) -> str:
    """Colorbar prefix of a bit flag: its bits, and its value when it is not
    simply "all the bits set" (``bits 2-3 = 4``, one of ``states``)."""
    flag = spec.flags[i]
    bits_text = mask_bits_text(flag.mask or 0, dtype_bits(spec.dtype))
    if flag.value is None or (states == 1 and int(flag.value) == flag.mask):
        return bits_text
    return f"{bits_text} = {_value_text(flag.value)}"


def _bit_hits(
    var: xr.DataArray, spec: FlagSpec, notes: list[str]
) -> tuple[np.ndarray, np.ndarray, list[np.ndarray]]:
    """Codes, where there is data, and where each flag is set."""
    codes, valid = flag_codes(var, spec)
    raw_dtype = raw_dtype_of(var.encoding, var.dtype)
    if var.dtype.kind == "f" and raw_dtype.itemsize == 8:
        notes.append(
            "codes read as floats by this engine: bits above 2^53 may be wrong"
        )
    return codes, valid, [valid & flag.test(codes) for flag in spec.flags]


def _prepare_fields(
    var: xr.DataArray,
    spec: FlagSpec,
    cmap: str | None,
    selected: list[int] | None,
    notes: list[str],
) -> FlagPlot:
    """Bits: one entry of the ``flag`` dimension per field."""
    codes, valid, hits = _bit_hits(var, spec, notes)
    total = int(valid.sum())
    counts = [int(hit.sum()) for hit in hits]

    fields = flag_fields(spec)
    if selected is not None:
        fields = [f for f in fields if any(i in selected for i in f.flags)]
    elif len(fields) > MAX_LISTED_ABSENT:
        set_fields = [f for f in fields if any(counts[i] for i in f.flags)]
        if len(set_fields) < len(fields):
            notes.append(
                f"{len(fields) - len(set_fields)} of the {len(fields)} flags are "
                "never set in the plotted data and not drawn"
            )
        fields = set_fields or fields[:1]
    room = max(1, MAX_FIELD_POINTS // max(codes.size, 1))
    if len(fields) > room:
        notes.append(
            f"only the first {room} of {len(fields)} flags drawn: one panel each "
            f"is too much data ({codes.size} points); slice the variable to see "
            "the others"
        )
        fields = fields[:room]
    _note_undeclared_bits(codes, valid, spec, notes)

    keep = [i for f in fields for i in f.flags if selected is None or i in selected]
    states = {i: len(f.flags) for f in fields for i in f.flags}
    colors, colors_source = _palette(spec, keep, cmap, notes)
    categories = [
        Category(
            spec.flags[i].label,
            colors[k],
            counts[i],
            _flag_prefix(spec, i, states[i]),
        )
        for k, i in enumerate(keep)
    ]
    not_set = len(categories)
    # States of a kept field that were not selected are drawn as "not set"
    hidden_states = any(i not in keep for f in fields for i in f.flags)
    not_set_label = (
        f"{NOT_SET_LABEL} or not selected" if hidden_states else NOT_SET_LABEL
    )
    categories.append(Category(not_set_label, NOT_SET_COLOR, None))
    category_of = {i: k for k, i in enumerate(keep)}

    index = np.full((len(fields), *codes.shape), np.nan, dtype=np.float32)
    for f, flag_field in enumerate(fields):
        panel = index[f, ...]  # a view, also for a single point (0-D)
        panel[valid] = not_set
        for i in flag_field.flags:
            if i in category_of:
                panel[hits[i]] = category_of[i]

    flag_dim = _new_dim_name(var)
    coords = {
        name: coord for name, coord in var.coords.items() if flag_dim not in coord.dims
    }
    index_da = xr.DataArray(
        index,
        dims=(flag_dim, *var.dims),
        coords={**coords, flag_dim: [f.label for f in fields]},
        name=var.name,
        attrs=_attrs(var),
    )
    return FlagPlot(
        spec,
        index_da,
        categories,
        total,
        colors_source,
        notes,
        flag_dim=flag_dim,
        fields=fields,
        choice_text="" if selected is None else f"selected: {_names_text(spec, keep)}",
    )


def combined_labels(
    spec: FlagSpec, indexes: Sequence[int], combine: FlagCombine
) -> tuple[str, str]:
    """Labels of the two categories of a combination: where it holds, and
    the rest (``cloud OR cloud shadow`` / ``none of them``)."""
    labels = [spec.flags[i].label for i in indexes]
    if len(labels) == 1:
        name = labels[0]
        return {
            "any": (name, f"not {name}"),
            "all": (name, f"not {name}"),
            "none": (f"not {name}", name),
        }[combine]
    if len(labels) > MAX_NAMED_IN_LABEL:
        named = f"{len(labels)} flags"
        return {
            "any": (f"any of {named}", "none of them"),
            "all": (f"all {named}", "not all of them"),
            "none": (f"none of {named}", "at least one of them"),
        }[combine]
    return {
        "any": (" OR ".join(labels), "none of them"),
        "all": (" AND ".join(labels), "not all of them"),
        "none": (f"none of {', '.join(labels)}", "at least one of them"),
    }[combine]


def flags_set(
    hits: Sequence[np.ndarray], indexes: Sequence[int], combine: FlagCombine
) -> np.ndarray:
    """Where the combination of the flags ``indexes`` holds."""
    chosen = [hits[i] for i in indexes]
    if combine == "all":
        return np.logical_and.reduce(chosen)
    anyset = np.logical_or.reduce(chosen)
    return ~anyset if combine == "none" else anyset


def _prepare_combined(
    var: xr.DataArray,
    spec: FlagSpec,
    cmap: str | None,
    selected: list[int] | None,
    combine: FlagCombine,
    notes: list[str],
) -> FlagPlot:
    """Bits folded into one map: two categories, where the combination of
    the chosen flags (all of them without ``flag_select``) holds, and the rest."""
    codes, valid, hits = _bit_hits(var, spec, notes)
    total = int(valid.sum())
    _note_undeclared_bits(codes, valid, spec, notes)
    chosen = selected if selected is not None else list(range(len(spec.flags)))
    holds = valid & flags_set(hits, chosen, combine)
    colors, colors_source = _palette(spec, chosen[:1], cmap, notes)
    label, rest_label = combined_labels(spec, chosen, combine)
    count = int(holds.sum())
    categories = [
        Category(label, colors[0], count),
        Category(rest_label, NOT_SET_COLOR, total - count),
    ]
    index = np.where(holds, 0.0, np.where(valid, 1.0, np.nan))
    index_da = xr.DataArray(
        index, dims=var.dims, coords=var.coords, name=var.name, attrs=_attrs(var)
    )
    return FlagPlot(
        spec,
        index_da,
        categories,
        total,
        colors_source,
        notes,
        choice_text=f"{combine}: {_names_text(spec, chosen)}"
        if len(chosen) <= MAX_NAMED_IN_LABEL
        else f"{combine} of {len(chosen)} flags",
    )


def _note_undeclared_bits(
    codes: np.ndarray, valid: np.ndarray, spec: FlagSpec, notes: list[str]
) -> None:
    """Bits set in the data but in no ``flag_masks``: a gap in the metadata."""
    if codes.dtype.kind not in "iu":
        return
    declared = codes.dtype.type(0)
    for flag in spec.flags:
        declared |= as_code(flag.mask or 0, codes.dtype)
    stray = codes[valid] & ~declared
    stray = stray[stray != 0]
    if stray.size == 0:
        return
    bits = int(np.bitwise_or.reduce(stray))
    if bits < 0:
        bits &= (1 << (codes.dtype.itemsize * 8)) - 1
    count = int(stray.size)
    notes.append(
        f"{count} value{' has' if count == 1 else 's have'} "
        f"{mask_bits_text(bits, codes.dtype.itemsize * 8)} set, in no flag_masks"
    )


def _new_dim_name(var: xr.DataArray) -> str:
    name = "flag"
    while name in var.dims or name in var.coords:
        name += "_"
    return name


def _attrs(var: xr.DataArray) -> dict[str, Any]:
    return {
        key: var.attrs[key]
        for key in ("long_name", "standard_name")
        if key in var.attrs
    }


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
            colormap = get_colormap(cmap)
        except ColormapError as exc:
            notes.append(f"cmap={exc.cmap} ignored: {exc.reason}")
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


@dataclass
class HiddenPoints:
    """The result of ``hide_flagged``: the variable, what hid its points."""

    var: xr.DataArray
    notes: list[str]
    # Layout line item ("cloud, invalid (pixel_flags)"), None when nothing applied
    report: str | None = None


def hide_flagged(
    var: xr.DataArray,
    flag_vars: Sequence[tuple[str, xr.DataArray, FlagSpec]],
    names: Sequence[str],
) -> HiddenPoints:
    """``var`` with NaN where a flag variable of ``flag_vars`` (its
    ``ancillary_variables``, sliced as ``var``) has a flag of ``names`` set.

    A flag variable is used when its dimensions are dimensions of ``var``
    with the same sizes; it is broadcast along the others (a 2D land mask
    hides the same points at every time).
    """
    notes: list[str] = []
    hidden: xr.DataArray | None = None
    used: list[str] = []
    matched: set[str] = set()
    for name, flag_var, spec in flag_vars:
        found, _ = spec.match(names)
        if not found:
            continue
        mismatch = [
            str(d)
            for d in flag_var.dims
            if d not in var.dims or var.sizes[d] != flag_var.sizes[d]
        ]
        if mismatch:
            notes.append(
                f"hide_flags: {name} not used, its dimension "
                f"{', '.join(mismatch)} is not one of the variable's with the "
                f"same size (dimensions: {', '.join(map(str, var.dims)) or 'none'})"
            )
            continue
        codes, valid = flag_codes(flag_var, spec)
        hit = np.logical_or.reduce([valid & spec.flags[i].test(codes) for i in found])
        # No coordinates: the two variables come from the same group, sliced alike
        hit_da = xr.DataArray(hit, dims=flag_var.dims)
        hidden = hit_da if hidden is None else (hidden | hit_da)
        used.append(f"{_names_text(spec, found)} ({name})")
        matched |= {normalize_meaning(spec.flags[i].meaning) for i in found}
    if hidden is None:
        if not notes:
            where = (
                ", ".join(name for name, _, _ in flag_vars)
                if flag_vars
                else "no flag variable in ancillary_variables"
            )
            notes.append(
                f"hide_flags ignored: no flag named {', '.join(names)} ({where})"
            )
        return HiddenPoints(var, notes)
    unknown = [n for n in names if normalize_meaning(n) not in matched]
    if unknown:
        notes.append(
            f"hide_flags: {', '.join(unknown)} not a meaning of "
            f"{', '.join(name for name, _, _ in flag_vars)}"
        )
    masked = var.where(~hidden)
    masked.attrs = dict(var.attrs)
    masked.encoding = dict(var.encoding)
    before = int(var.notnull().sum())
    removed = before - int(masked.notnull().sum())
    notes.append(
        f"hide_flags: {removed} of {before} values hidden "
        f"({share_text(removed, before)}) where {'; '.join(used)} is set"
    )
    return HiddenPoints(masked, notes, "; ".join(used))


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
    elif (
        layout.kind == "line"
        and flag_plot.flag_dim is not None
        and layout.value("x") == flag_plot.flag_dim
        and "hue" not in layout.choices
    ):
        # A single point: one bar per flag
        layout.kind = "bars"
        layout.choices = {}
    layout.set(
        "flags", flag_plot.report_value(), "user" if flag_plot.choice_text else "auto"
    )
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
    import matplotlib.pyplot as plt

    cmap, norm = flag_plot.cmap_and_norm()
    n = len(flag_plot.categories)
    kwargs = {**kwargs, "cmap": cmap, "norm": norm}
    flag_axis = _flag_axis(var, flag_plot, kwargs)
    if flag_axis is not None:
        # Bits along an axis (block plot): integer positions, labelled below;
        # the first flag on top
        labels = [str(v) for v in var[flag_plot.flag_dim].values]
        var = var.assign_coords({flag_plot.flag_dim: np.arange(len(labels))})
        if flag_axis == "y":
            kwargs.setdefault("yincrease", False)
    add_colorbar = kwargs.get("add_colorbar", True)
    if add_colorbar:
        kwargs["cbar_kwargs"] = {"ticks": list(range(n))}
    result = getattr(var.plot, method)(**kwargs)
    if flag_axis is not None:
        axes = list(result.axs.flat) if hasattr(result, "axs") else [plt.gca()]
        for ax in axes:
            getattr(ax, f"set_{flag_axis}ticks")(
                list(range(len(labels))), labels=labels
            )
            getattr(ax, f"set_{flag_axis}label")("")
    if hasattr(result, "set_titles") and flag_plot.flag_dim in (
        kwargs.get("row"),
        kwargs.get("col"),
    ):
        # xarray cuts facet titles at 30 characters
        result.set_titles(maxchar=60)
    if not add_colorbar:
        return
    colorbar = getattr(result, "cbar", None) or getattr(result, "colorbar", None)
    if colorbar is None:
        return
    colorbar.set_ticks(list(range(n)), labels=flag_plot.tick_labels())
    colorbar.ax.tick_params(length=0, labelsize=8 if n > 12 else None)
    colorbar.ax.minorticks_off()


def _flag_axis(
    var: xr.DataArray, flag_plot: FlagPlot, kwargs: dict[str, Any]
) -> str | None:
    """``"x"`` / ``"y"`` when the bits dimension is an axis of the image."""
    if flag_plot.flag_dim is None or flag_plot.flag_dim not in var.dims:
        return None
    for axis in ("x", "y"):
        if kwargs.get(axis) == flag_plot.flag_dim:
            return axis
    return None


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

    categories = flag_plot.set_categories()
    n = len(categories)
    fig, ax = plt.subplots(figsize=(6.4, max(2.0, 0.35 * n + 1)))
    shares = [
        100 * (c.count or 0) / flag_plot.total if flag_plot.total else 0
        for c in categories
    ]
    ax.barh(range(n), shares, color=[c.color for c in categories], edgecolor="0.3")
    ax.set_yticks(
        list(range(n)), labels=[c.tick_label(flag_plot.total) for c in categories]
    )
    ax.invert_yaxis()
    where = "" if flag_plot.flag_dim is None else " where the flag is set"
    values = "value" if flag_plot.total == 1 else "values"
    ax.set_xlabel(f"% of the {flag_plot.total} {values} with data{where}")
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
