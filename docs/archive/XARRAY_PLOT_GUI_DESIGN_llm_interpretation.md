# Xarray Plot GUI Design - LLM Interpretation

This document contains interpretation and recommendations based on the generated, parser-only source:
`docs/XARRAY_PLOT_GUI_DESIGN.md`.

## How to Use the Parsed Results

- Treat the generated matrix as the source of truth for capability detection.
- Derive UI control groups from kwarg coverage across methods.
- Use per-method signature tables to validate control availability and defaults.

## Recommended GUI Architecture

### 1) Method-first layout with progressive disclosure

- Add a top-level **Plot method** selector (`plot`, `imshow`, `hist`, `line`, `step`, `scatter`, `contour`, `contourf`, `pcolormesh`, `surface`).
- Show only controls valid for the selected method.
- Keep advanced controls collapsed by default.

### 2) Control groups mapped to matrix coverage

- **Common controls (high coverage)**:
  - axes/layout: `row`, `col`, `col_wrap`, `size`, `aspect`
  - scales/ticks/limits: `xscale`, `yscale`, `xticks`, `yticks`, `xlim`, `ylim`, `xincrease`, `yincrease`
- **Color controls (2D-heavy methods)**:
  - `cmap`, `vmin`, `vmax`, `robust`, `center`, `levels`, `extend`, `norm`
  - colorbar controls: `add_colorbar`, `cbar_ax`, `cbar_kwargs`
- **Legend/series controls**:
  - `add_legend`, `hue`, `hue_style`
- **Method-only controls**:
  - `hist`: `bins`-family controls (from method signatures)
  - `step`: `where`, `drawstyle`, `ds`
  - `pcolormesh` / 2D: `infer_intervals`
  - `scatter`: `markersize`, `linewidth`, `add_title`

### 3) Method detail sections

- Add one collapsible section per method:
  - **`imshow` controls**
  - **`hist` controls**
  - **`line/step` controls**
  - **`scatter` controls**
  - **`contour/contourf/pcolormesh/surface` controls**
- Populate each section from parsed signature metadata, not handwritten lists.

## Maintainability Strategy

- Keep `docs/XARRAY_PLOT_GUI_DESIGN.md` parser-only and regenerate in CI.
- Generate a machine-readable artifact next (JSON) from the same parser and drive UI from it.
- Add CI guard:
  - if parsed signatures/matrix change, fail until UI schema is updated.
- Keep this interpretation doc human-maintained and versioned separately.

## Suggested Implementation Plan

1. Extend generator to emit JSON (`kwargs_by_method`, `common_kwargs`, `defaults`, `annotations`).
2. Build a UI schema adapter from JSON to panel controls.
3. Add runtime compatibility checks in `create_plot` request building.
4. Add snapshot tests for:
   - method control visibility
   - default propagation
   - invalid kwarg suppression per method.

## Practical Notes

- Do not expose every parsed kwarg at once in the UI; prioritize high-coverage controls.
- Keep low-frequency kwargs in an **Advanced** subsection.
- For unsupported combinations, explain why a control is hidden/disabled using parsed method constraints.
