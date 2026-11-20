# Feature (v0.14): log color scale

> Status: **implemented** in v0.14.0 (`python/sdv_backend/plotting/norm.py`,
> the **norm** select of the Color fieldset, `--norm log`). This page is the
> spec it was built from; the [decisions](#decisions-made-while-implementing)
> at the end record where the implementation settled the open questions or
> went further. User documentation: [`docs/PLOTTING.md`](../PLOTTING.md)
> § Log scale.

## Summary

Add a plot control that draws a variable on a **logarithmic scale**, without
changing the data: the colors of a color-mapped plot (image / mesh) follow
`log10(value)`, and the colorbar shows the real values (`10⁻³`, `10⁻²`, ...).
On a line plot the same control makes the data axis logarithmic.

## Motivation

A user asked to "log10 a variable before plotting it". Many variables span
several orders of magnitude (chlorophyll concentration, precipitation, aerosol
optical depth, particle counts...): on a linear scale the low values all share
the first color and the plot looks empty.

A **log scale** is better than a log10 transform of the data:

| Log scale (this feature)                                                   | `log10(data)` before plotting                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| Colorbar labelled in the variable's units (`1e-3 mg/m³`)                   | Colorbar in `log10(mg/m³)`, harder to read             |
| `vmin` / `vmax` typed in data units                                        | Limits must be typed as exponents                      |
| Zeros and negative values are left out (masked), no `-inf` / `NaN` warning | `log10(0) = -inf`, `log10(-1) = NaN` with warnings     |
| No new variable, no change to the attributes or the units                  | The plot title / units no longer match the data        |
| One matplotlib option (`norm=LogNorm(...)`)                                | A data transform the viewer has to explain and support |

## User-facing behaviour

### Control

A new parameter in the **Color** fieldset of the plot controls (Global Plot
Controls and every Group Plot Controls block):

- label `norm` (the xarray / matplotlib keyword), hint `scale`;
- a select with `linear` (default, nothing passed) and `log`;
  `symlog` can be added later (see [Later](#later));
- in a Group Plot Controls block, the select also has the usual "use the
  global value" state.

It needs a new `PlotParameterKind` (`choice`: a select with fixed options) in
`src/panel/webview/plotParams.ts`, since `dimension` selects list dimensions.
`changedFields.ts` must outline it when it differs from `linear`, and the plot
layout line must mark it with the "set by you" dot like the other controls.

### By plot kind

| Plot kind             | Effect of `norm = log`                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| image (imshow / mesh) | `norm=matplotlib.colors.LogNorm(vmin, vmax)`; colorbar with log ticks                             |
| facets (row / col)    | Same norm for every facet, one shared colorbar (xarray `FacetGrid`)                               |
| line                  | Log scale on the **data** axis (`yscale="log"`, or `xscale="log"` when the data is on the x axis) |
| histogram             | Not in the first version: ignored, with a note in the plot layout (see [Later](#later))           |

### Values the log scale cannot show

- **Values ≤ 0** are not drawn (matplotlib masks them: they get the colormap's
  "bad" color, transparent by default). The plot layout gets a note such as
  `log scale: 1 234 values ≤ 0 not shown`.
- **No value > 0** (all ≤ 0 or NaN): the plot falls back to a linear scale with
  a note (`log scale ignored: no positive value`), instead of a matplotlib error.
- **`vmin` ≤ 0 typed by the user**: ignored with a note, the smallest positive
  value is used instead. `vmax` ≤ 0: same, the largest value is used.
- **`robust`**: the 2nd / 98th percentiles are computed on the **positive**
  values only (xarray computes them on all values, and a negative 2nd
  percentile makes `LogNorm` fail).

## Implementation notes

### Backend (`python/sdv_backend/`)

- `cli.py`: new flag `--norm {linear,log}` (default `linear`).
- `plotting/options.py`: new field `PlotOptions.norm: str = "linear"` (the
  docstring already lists `norm` as a keyword worth wiring later).
- `plotting/kwargs.py`: `PlotKwargsBundle.build(norm=...)`. For the image
  kinds, build the `LogNorm` **ourselves** with the resolved `vmin` / `vmax`
  and **do not** pass `vmin` / `vmax` / `robust` to xarray next to it: xarray
  raises `ValueError: Cannot supply vmin and a norm with a different vmin`.
  The positive-only limits (see above) are computed from the selected data, so
  this step needs the data array (today `build` only sees options).
- `for_kind("line")`: map the option to `yscale` / `xscale` from the layout
  (which axis carries the values) instead of dropping it with the other color
  keys.
- `for_kind("histogram")`: drop it, with a layout note.
- **`applied_plot_kwargs` is returned as JSON** (`results.CreatePlotResult`):
  a `LogNorm` object is not JSON-serializable. Store a readable string in the
  applied kwargs (`"LogNorm(vmin=0.001, vmax=12.5)"`) and pass the object only
  to the xarray call.
- Notes about masked / ignored values go through the existing plot layout
  notes (`layout.resolve_layout` / `PlotLayout.to_json()`), so the webview shows
  them without new protocol fields.
- Check xarray's divergent colormap choice: when the data has both signs,
  xarray picks a diverging colormap centred on 0, which makes no sense on a log
  scale. With `LogNorm(vmin > 0)` it should not happen, but it needs a test.

### Extension (`src/`)

- `plotParams.ts`: new entry in `PLOT_PARAMETERS` (`key: 'norm'`, group
  `Color`) and the `choice` kind (render, read, reset, merge group / global).
- `DataProcessor`: pass `--norm log` only when set (keep the CLI call
  unchanged for `linear`).
- `MessageTypes`: the `createPlot` payload gets the new field.

## Tests

- **pytest** (`python/tests/`): image plot with `LogNorm`; facets share one
  norm; values ≤ 0 masked and counted in the note; all values ≤ 0 → linear with
  note; `vmin ≤ 0` ignored; `robust` + log uses positive percentiles; line
  plot gets `yscale="log"`; histogram ignores it with a note;
  `applied_plot_kwargs` is valid JSON; CLI parses `--norm log`.
- **TS tests** (`test/suite/`): the `choice` kind renders, reads, resets and
  inherits in group controls; changed-field outline.
- **Sample data**: add a variable spanning several orders of magnitude, with
  some zeros and NaN, to `python/sample_data/` (e.g. a lognormal
  "chlorophyll" field).
- **Golden snapshots / non-regression gallery**: add a log-scale case
  (`python/tools/golden_snapshots.py`, `python/non_regression_test_plot.py`).
- **QA**: one webview QA case (`scripts/qa/webview/`) with the select set.

## Docs

- `docs/PLOTTING.md`: plot-kind table (which kinds take `norm`) and the
  values-≤-0 rules.
- `docs/documentation.json` → regenerate `README.md`.
- `CHANGELOG.md`, `docs/RELEASE_NOTES_0.14.0.md`, `docs/v0.14/PR_SUMMARY_0.14.0.md`.
- `scripts/architecture/generate.py --check` if a module or protocol message
  changes.

## Acceptance criteria

1. Selecting `norm = log` on a 2D variable draws it with log colors and a
   colorbar in data units; `linear` gives the same plot as before.
2. `vmin` / `vmax` typed in data units are honoured on the log scale.
3. Zeros, negative values and NaN never make the plot fail; the plot layout
   says how many values were not shown.
4. Works with facets (one colorbar), group plot controls and `robust`.
5. On a line plot, the data axis is logarithmic.
6. Python 3.10 + xarray 2024.10 (users' own interpreters) still work.

## Later

- `symlog` (`SymLogNorm`, with a `linthresh` input) for data with both signs.
- Histogram: log-spaced bins (`numpy.logspace`) on a log x axis.
- Log scale on a coordinate axis (`xscale` / `yscale`, e.g. pressure levels).

## Open questions

- Control shape: a `norm` select (proposed, room for `symlog`) or a simple
  `log` checkbox?
- Should the note about values ≤ 0 be shown when they are only a few (e.g.
  below 0.1 %)?

## Decisions made while implementing

- **Control shape**: a `norm` select (`linear` empty, `log`), built on the
  `choice` kind that `flag_combine` had already added to `plotParams.ts`;
  `symlog` can be one more option.
- **Note about values ≤ 0**: always shown, with the count and the share
  (`norm=log: 14 of 239 values ≤ 0 not shown (5.9%)`): a hidden zero is worth
  knowing even when rare.
- **Lines**: the values ≤ 0 are made NaN before drawing, so they are a gap,
  not a line plunging to the bottom edge (matplotlib's `nonpositive="clip"`):
  the note says "not shown" for every kind.
- **`center=False`** is passed with the norm: xarray's diverging default for
  data of both signs is avoided (a test checks `viridis` is kept).
- **`extend`** (colorbar arrows) is computed from the values above 0, so the
  values ≤ 0 do not add an arrow at the bottom.
- **One user limit beyond the data** (only `vmin`, above the largest value):
  both limits take it, instead of an inverted norm that matplotlib refuses.
- **Dates, flag variables**: ignored with a note, like histograms.
- **Kwargs objects**: `PlotKwargsBundle` keeps readable values (returned as
  `applied_plot_kwargs`) and an `objects` dict swapped in by `for_call` just
  before the xarray call.
