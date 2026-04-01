# Scientific Data Viewer v0.11.0 Release Notes

**TL;DR** — **Plotting pipeline overhaul** in Python (`create_plot`): clearer strategy selection, reliable forwarding of style kwargs to the right xarray entry points, **new plot kwargs** (`vmin` / `vmax`, colorbar on/off, legend), matching **webview controls** in Global and Group Plot Controls, **robust** fixed on all colormap paths, and a **non-regression plot script** (Issue #117 workflows) wired into `setup.sh`. Version **0.11.0** ships these changes together (there is no separate **0.10.2** release).

## Plotting backend refactor (`python/get_data_info.py`)

The logic that chooses between `DataArray.plot()`, `plot.imshow()`, and `plot.hist()` is now structured as:

- **`PlotKwargsBundle`** — builds user kwargs and derived subsets (e.g. generic vs imshow vs histogram-only).
- **`XarrayPlotDispatcher`** — single place for imshow / plot / hist calls and `plot_used:` logging.
- **Strategy classes** — auto strategies (`detect_plotting_strategy`) and user-provided strategies (`histogram` / `faceted` / `slices_only`) with small registries.

Behaviour is intended to stay aligned with previous releases except where noted below (fixes and new kwargs).

## Fixed: **robust** on colormap plots

When **robust** was enabled, logs showed `robust: True` but some paths built `plot.imshow(...)` without merging the same kwargs as generic `plot()`, so percentile-based limits did not always apply. All imshow paths now receive the same imshow-safe kwargs bundle (including **robust**, **vmin** / **vmax**, etc., excluding histogram-only keys).

## New plot kwargs (CLI and Python API)

| Parameter           | Default | Notes                                                                                                                                         |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **vmin** / **vmax** | (unset) | Color scale limits; used on scalar-mappable plots, not on histograms.                                                                         |
| **add_colorbar**    | `True`  | Set to `False` to hide the colorbar where xarray draws one.                                                                                   |
| **add_legend**      | `False` | Request a legend when xarray supports it (e.g. with **hue**). Imshow without **hue** strips **add_legend** to avoid xarray/matplotlib errors. |

**CLI:** `--vmin`, `--vmax`, `--no-add-colorbar`, `--add-legend`.

**Extension:** `DataProcessor.createPlot` and the webview → `CreatePlot` message accept optional `vmin`, `vmax`, `addColorbar`, and `addLegend` (same semantics as the CLI). The webview **add_legend** checkbox is **on** by default so quicklooks match typical xarray plotting behaviour on methods that default `add_legend=True`; the Python CLI still treats the flag as opt-in (`--add-legend`).

## Webview: Global and Group Plot Controls

The data viewer panel exposes the new options next to the existing dimension-slice and plot-parameter UI:

| Control             | Placement                                                                   | Default in UI | Backend note                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **vmin** / **vmax** | Same row as **cmap** (optional free-text numbers; invalid or empty omitted) | (empty)       | Same as Python: only finite values are sent.                                                                                    |
| **add_colorbar**    | Checkbox row with **xincrease**, **yincrease**, **robust**                  | On (`true`)   | Unchecked sends `--no-add-colorbar`.                                                                                            |
| **add_legend**      | Same checkbox row                                                           | On (`true`)   | Checked sends `--add-legend` (UI default on); Python `create_plot` / CLI omit the flag by default when not used from the panel. |

**Group Plot Controls** duplicate these fields; per-field **global vs. group** behaviour matches other plot parameters (non-empty group facet/cmap-style fields override global; when the group plot section has no overrides, global values apply). **col_wrap** and **bins** inputs use a narrower width so the extra controls fit more comfortably.

## Non-regression plot script

- **`python/non_regression_test_plot.py`** — runs `create_plot` over Issue #117-style cases (00–06), extra combinations (10–18), and v0.11-style cases (20–24) on `sample-data/hs-issue-0117.nc`.
- Default output: **`sample-data/non_regression_test_plot/v<version>/`** (version from `package.json`), with **`summary.txt`** and **`summary.md`** (embedded PNGs).
- **`setup.sh`** runs this script after `create_sample_data.py` (failure is non-fatal).

## Xarray plot API analysis docs (basis for UI improvements)

- Added **`python/generate_xarray_plot_design_doc.py`**: an AST-based parser that reads xarray's `dataarray_plot.py` and generates method/overload inventories, kwargs tables, common-vs-specific kwargs, and a kwargs×method matrix in markdown (no-LLM data extraction).
- Added generated data-only reference **`docs/XARRAY_PLOT_GUI_DESIGN.md`** and companion interpretation **`docs/XARRAY_PLOT_GUI_DESIGN_llm_interpretation.md`**.
- These documents provide a maintainable baseline to evolve Plot controls (common controls + method-specific controls) as xarray's plotting API changes.

## Breaking change: Python 3.10+ for checked-in Python scripts (typing modernization)

The repository’s Python tooling was updated with **Ruff** using **`--unsafe-fixes`**, applying [pyupgrade](https://github.com/asottile/pyupgrade) rules that migrate away from older `typing` styles. The main ones are:

| Ruff rule | PEP | What changed |
| --------- | --- | ------------ |
| **UP006** ([non-pep585-annotation](https://docs.astral.sh/ruff/rules/non-pep585-annotation/)) | [PEP 585](https://peps.python.org/pep-0585/) | `typing.List` / `Dict` / … → builtin generics such as `list[...]`, `dict[...]`. Using built-ins as generics was introduced in 3.9; idiomatic style is to stop importing those names from `typing`. |
| **UP007** ([non-pep604-annotation-union](https://docs.astral.sh/ruff/rules/non-pep604-annotation-union/)) | [PEP 604](https://peps.python.org/pep-0604/) | `Optional[...]` / `Union[...]` replaced by PEP 604 union syntax in annotations, which **requires Python 3.10+** to parse. |

**Why this is a breaking change:** If you run or vendor **`python/*.py`** (including `get_data_info.py`, `create_sample_data.py`, `non_regression_test_plot.py`, `generate_xarray_plot_design_doc.py`) with **Python 3.9 or older**, the interpreter will fail to parse files that use PEP 604 unions. **Use Python 3.10 or newer** for those scripts and for **`ruff check`** / **`pre-commit`** (see `target-version = "py310"` in `pyproject.toml`).

This does **not** change the extension’s documented end-user Python strategy (e.g. Python 3.13 via **uv** in the README); it raises the **minimum Python for maintaining and executing the extension’s checked-in Python sources** in this repo.

**Typing note:** `typing` aliases for built-in collections are [deprecated in Python 3.9+](https://docs.python.org/3/library/typing.html#deprecated-aliases) in favour of PEP 585; PEP 604 union syntax is the modern replacement for `Optional`/`Union` in annotations. Ruff’s fixes are marked unsafe when runtime introspection of annotations on older versions could break (see each rule’s “Fix safety” section in the Ruff docs).

## Upgrade notes

- **Python:** Use **3.10+** for repo scripts and linting (see breaking change above).
- **CLI / JSON:** No deliberate breaking changes to the extension’s plot **JSON/CLI** contract beyond **new optional** arguments.
- **Plots:** After updating to **0.11.0**, enable **robust** to see consistent color scaling on supported rasters, per [xarray’s plotting API](https://docs.xarray.dev/en/stable/user-guide/plotting.html).

## Summary of changes

| Area        | Change                                                                               |
| ----------- | ------------------------------------------------------------------------------------ |
| **Backend** | `PlotKwargsBundle`, `XarrayPlotDispatcher`, user/auto plot strategy registries       |
| **Fixed**   | `robust` (and other imshow kwargs) merged on all `plot.imshow` paths                 |
| **Added**   | `vmin`, `vmax`, `add_colorbar`, `add_legend`; CLI flags; TS / webview passthrough    |
| **Webview** | Inputs for vmin/vmax; add_colorbar / add_legend checkboxes; narrower col_wrap & bins |
| **Added**   | `non_regression_test_plot.py`, `setup.sh` hook, `summary.md` report                  |
| **Tooling** | Ruff `py310`; PEP 585/604 typing in `python/` (UP006/UP007; **Python 3.10+** to run scripts) |
| **Version** | **0.11.0** (skips unreleased **0.10.2** label)                                       |
