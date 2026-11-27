# CF flag variables: proposal (v0.14)

Status: **P1 to P4 implemented** (0.14.0: `flag_values` plotted by meaning,
raw codes, Flags section in File Information, `flags` control; `flag_masks`
alone or with `flag_values` drawn as one panel per field, 1D block plots,
bars; `flag_select` / `flag_combine` controls; `hide_flags` through
`ancillary_variables`; see `CHANGELOG.md`). Written for 0.15 on branch
`eschalk/v0.15-cf-flags` (from `main`), then moved into 0.14 on
`eschalk/v0.14-cf-decoding`: the flag codes are read raw through the decoding
layer of 0.14 (`resolve_open_kwargs(raw_variables=...)`), so the decoding
settings also apply to that second read.

Answers to the open questions taken for P1: automatic display by default
(the `flags` checkbox turns it off; it moved from P3 to P1, as the escape
hatch of a default that changes plots), shares shown by default.

Choices made in P2 (differences from § 3 below): one colormap for all the
panels (each field holds its meanings' categories where set, a shared grey
`not set` elsewhere) rather than a boolean per panel, so each flag keeps its
color and the colorbar names them all; the 1D "block plot" is the image that
the layout engine already makes of `(flag, time)`, not a separate drawing;
facet titles carry the bits (`flag = cloud (bit 0)`), the colorbar the
shares. Added: a note for bits set in no `flag_masks`, and a limit of 50
million points for the array of fields (one copy of the data per field).

Choices made in P3 and P4: the controls are `flag_select`, `flag_combine`
and `hide_flags`, in a **Flags** fieldset with the `flags` checkbox (which is
`flag_display`); `flag_combine` keeps "empty = one panel per flag" instead of
a `panels` value, as the other controls; for `flag_values`, `flag_select`
greys the other classes and `flag_combine` is ignored (exclusive codes). The
datalist of § 4 is not done: the controls take several names separated by
commas, which a datalist cannot suggest. `hide_flags` is a separate control,
not `flag_select` applied to the ancillary variables: showing the chosen
classes and hiding the flagged points are opposite intents. It answers open
question 3: P4 is in the same release (0.14).

## Goal

A producer who describes an integer mask variable with the CF attributes
`flag_values`, `flag_masks` and `flag_meanings` should get, with no setting
and no code, a plot that reads like the product's user guide: class names
instead of numbers, one color per class (the producer's own when given),
one map per bit flag, and a way to pick the flags they care about
("cloud OR cloud_shadow"). Today the viewer draws these variables as a
continuous `viridis` image of arbitrary codes (`10, 20, 190, 210`) or, for
bit masks, of meaningless sums of powers of two.

## What CF says (section 3.5)

| Attributes present              | Meaning                                                                                                  | Test for flag _i_           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------- |
| `flag_values` + `flag_meanings` | mutually exclusive codes (classes, status)                                                               | `v == values[i]`            |
| `flag_masks` + `flag_meanings`  | independent booleans, one bit field each; several can be true at once                                    | `v & masks[i] != 0`         |
| all three                       | bit fields holding either a boolean or an enumeration (repeated mask = several values of the same field) | `v & masks[i] == values[i]` |

- `flag_meanings` is a blank-separated list, words joined by `_`; it has
  exactly one entry per value / mask.
- `flag_values` / `flag_masks` have the type of the variable.
- Usual `standard_name`s: `status_flag`, `quality_flag`, and enumerations
  such as `region`, `area_type`, `land_cover_lccs`.
- The mixed example (3.8, `sensor_status_qc`): `flag_masks = 1, 2, 12, 12, 12`,
  `flag_values = 1, 2, 4, 8, 12`, `flag_meanings = low_battery hardware_fault
offline_mode calibration_mode maintenance_mode`: bits 0 and 1 are
  booleans, bits 2-3 a three-state mode.
- A related variable points to its flags with `ancillary_variables`
  (`chlorophyll:ancillary_variables = "chlorophyll_quality_flag"`).

## What other tools do

| Tool                                  | Values (classes)                                                                                    | Masks (bits)                                                                      | Takeaway                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **cf_xarray**                         | `da.cf == "atlantic_ocean"`, `da.cf.isin([...])`, a "Flag Variable" repr, `FlagGrouper` for groupby | same comparisons; repr shows the bit pattern; documented as "very lightly tested" | select by meaning name, never by number                        |
| **ARM ACT**                           | 1D: y-axis labels from `flag_meanings`; 2D: colorbar with one label and a user color per value      | `qc_flag_block_plot`: one row per test, broken bars along time                    | 1D flags are a block plot, not a line                          |
| **ESA SNAP**                          | _index coding_: classification band with one color per class                                        | _flag coding_: one mask per flag in the Mask Manager, overlaid on any band        | two families: categorical map vs. one boolean layer per flag   |
| **satpy** (Sentinel-3 OLCI `wqsf`)    | -                                                                                                   | `BitFlags` built from `flag_masks` / `flag_meanings`, masks requested by name     | real products have dozens of bits in `uint64`                  |
| **ESA CCI Land Cover** (`lccs_class`) | 37 codes from 0 to 220, plus a **non-standard `flag_colors`** attribute (hex colors)                | -                                                                                 | producers already ship colors; honour them when valid          |
| **regionmask**                        | writes `flag_values` / `flag_meanings` on its region masks                                          | -                                                                                 | region masks are categorical maps too                          |
| Panoply, GDAL                         | nothing found showing flag-aware display (GDAL lists the attributes as band metadata)               | -                                                                                 | not a solved problem in desktop viewers: a chance to stand out |

## Proposal

### 1. Read the flags right (backend, `sdv_backend/flags.py`)

`FlagSpec.from_attrs(attrs, dtype) -> FlagSpec | FlagIssue`: kind
(`values` / `masks` / `mixed`), the list of `Flag(meaning, value, mask)`
and `test(codes) -> bool array`. It checks, and turns every problem into a
note and the usual plot (never an error):

- same number of meanings as values / masks; meanings unique;
- integer variable (or float holding integer codes, see below), integer
  values / masks; non-zero masks;
- mixed: `value & mask == value`, else the flag can never be true. **Our
  own sample generator breaks this**: `python/sample_data/netcdf_encoding.py`
  writes `flag_values = 0..4` with `flag_masks = 1, 2, 4, 8, 16` (value 3
  with mask 4 is impossible), so the fix and a test come with the feature;
- `flag_colors` (optional): used only when it has one valid color per
  meaning, else a note and the default palette.

**Codes are read raw.** With xarray's default `mask_and_scale`, an integer
variable with a `_FillValue` becomes float:

- a `uint64` bit field (Sentinel-3 `wqsf`) loses its low bits above 2^53;
  checked with xarray 2026.7: `(1 << 63) | 2` comes back as `2**63` and
  bit 1 is lost;
- a code equal to `_FillValue` or outside `valid_range` that _is_ a
  declared meaning (`255 = no_data`) disappears instead of being shown.

So a flag variable is read with `mask_and_scale` off for that variable only
(`open_dataset(..., mask_and_scale={name: False})` works with xarray 2026.7;
to check against the xarray 2024.10 floor, fallback: open it a second time
undecoded), and the fill / `valid_range` mask is computed separately. This
ties in with the decoding settings of 0.14 (`decoding.maskAndScale`): the
raw read only applies to the variable being drawn as flags.

### 2. Show them in File Information (metadata only, cheap)

The variable gets a `flags` badge and a table: value or mask (masks in
binary, `0b0000_1100`), meaning (underscores as spaces), color swatch when
`flag_colors` is given, and the validation notes. No data is read. This
rewards a good producer even before a plot is made, and lists the names the
selection control (§ 4) accepts.

### 3. Draw them (automatic when the spec is valid)

The trick that keeps this small: **decode the flags into ordinary arrays,
then reuse the layout engine of 0.13 unchanged.**

- values -> an index array (0..n-1, NaN for fill, n for "other code");
- masks -> a boolean array with a new dimension `flag` whose coordinate is
  the meanings; `resolve_layout` then puts `flag` on `col` like any other
  free dimension, and the dimension slice `flag 0:2` or `col` / `row`
  controls work on it with no new code;
- mixed -> one field per distinct mask: a mask used once is a boolean (as
  masks), a repeated mask an enumeration (as values).

| Variable   | 2D or more (maps)                                                                                                                                                                                                                       | 1D (time series)                                                              | Nothing left for axes / `bins` set                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **values** | categorical image: one color per meaning (`flag_colors`, else `tab10` / `tab20`, beyond 20 a generated distinct palette), colorbar labelled `value meaning (share %)`, fill transparent, codes not declared in grey "other" with a note | step line with the meanings as y-tick labels (ACT)                            | horizontal bar chart: one bar per meaning, same colors (replaces the histogram of codes)    |
| **masks**  | one boolean panel per flag (facets on `flag`), title `meaning (bit k) share %`                                                                                                                                                          | block plot: one row per flag, bars where it is set (ACT `qc_flag_block_plot`) | bar chart: share of points with each flag set; `hue` gives one bar per index of a dimension |
| **mixed**  | one panel per field: booleans as for masks, enumerated fields as categorical images                                                                                                                                                     | block plot, enumerated fields in one color per state                          | bar chart per meaning                                                                       |

The prototype `scripts/prototypes/cf_flags.py` (plain matplotlib, output in `artefacts/prototypes/cf_flags/`) produces:

- a land cover map with `flag_colors` and shares in the colorbar;
- five bit-flag panels plus a "cloud OR cloud_shadow" panel;
- the CF 3.8 `sensor_status_qc` block plot;
- two land cover classes highlighted, the others grey (§ 4);
- the `uint64` check of § 1.

Details:

- the shares come from one `np.bincount` / one `&` per flag: cheap next to
  rendering;
- facets share one colorbar (`cbar_kwargs` ticks and labels);
- more than 20 declared classes (CCI LC: 37): the colorbar lists only the
  classes present in the selection, with a note giving the count of absent
  ones;
- `cmap` set by the user: sampled into n discrete colors (their choice
  wins over `flag_colors`); `vmin` / `vmax` / `robust`: ignored with a note
  (meaningless for classes);
- the layout line gets `flags values (8)` / `palette flag_colors`, marked
  automatic or set, as the other items.

### 4. Select what to draw by meaning

New controls in `plotParams.ts` (global and group, so they follow the
"empty = automatic" rule), passed as CLI flags:

| Control         | CLI                                      | Effect                                                                                                                                                                            |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flags`         | `--flags cloud,cloud_shadow`             | values: the chosen classes in color, the others in grey "other" (highlight), share of the selection in the title; masks: only the chosen flags' panels                            |
| `flags_combine` | `--flags-combine panels\|any\|all\|none` | masks: `any` = one map "cloud OR cloud_shadow" (the usual "invalid pixel" mask), `all` = AND, `none` = pixels where none is set (the clear ones), `panels` (default) one map each |
| `flag_display`  | `--flag-display auto\|raw`               | `raw`: today's numeric plot, the escape hatch                                                                                                                                     |

- Names are matched case-insensitively, `_` and space alike.
- A global selection applies to every variable whose meanings contain the
  names; unknown names give a note, as slices on a missing dimension do.
- The webview fills a datalist from the File Information flags so names are
  picked, not typed.

### 5. Later: mask a data variable with its flags (`ancillary_variables`)

Plot `chlorophyll` and hide the points where its `quality_flag` has
`cloud` or `invalid` set: the selection of § 4 applied to the variable named
in `ancillary_variables`, in the same group. This is what users of Sentinel-3
or CCI data do by hand in every notebook. It needs a second variable read and
a "mask with" control, so it is a separate phase.

## Why not depend on cf_xarray

The backend runs in users' own interpreters (Python 3.10+, xarray ≥ 2024.10),
and every extra package is an install prompt. Parsing the three attributes and
the `&` tests is about 150 lines. cf_xarray documents its mask handling as
"very lightly tested", and does not read raw codes. The tests can still compare
our boolean results with cf_xarray's when it is installed (dev only).

## Phases

| Phase | Content                                                                                                    | Tests / checks                                                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| P1    | `flags.py` (parse, validate, raw read), File Information table, categorical image + bars for `flag_values` | `python/tests/test_flags.py` (CF 3.5 examples, invalid specs, uint64, fill code declared as meaning), golden snapshots, screenshots |
| P2    | masks and mixed: `flag` dimension, panels, 1D block plots                                                  | plot tests per kind; non-regression gallery entries                                                                                 |
| P3    | `flags` / `flags_combine` / `flag_display` controls, layout line items, notes                              | `webviewScript.test.ts`, `dataProcessor.test.ts` (CLI args), e2e scenario                                                           |
| P4    | `ancillary_variables` masking                                                                              | sample with data + quality flag                                                                                                     |

New sample generator `python/sample_data/flags.py`:

- CCI-like land cover with `flag_colors` and a fill value;
- Sentinel-3-like `uint64` bit field;
- CF 3.8 `sensor_status_qc` 1D;
- broken specs (length mismatch, impossible mixed value, bad `flag_colors`).

It also fixes the samples in `netcdf_encoding.py`.

## Open questions

1. Automatic flag display by default (with `flag_display=raw` as the escape
   hatch), or opt-in? Recommended: automatic. The point is to reward a
   producer without the user doing anything.
2. Shares (%) in the colorbar / panel titles by default? Recommended: yes,
   they cost one pass over the codes.
3. Is P4 (`ancillary_variables`) in the same release or a later one?

## Sources

- [CF Conventions 1.11, § 3.5 Flags](https://cfconventions.org/Data/cf-conventions/cf-conventions-1.11/cf-conventions.html) and [1.7 § 3.5](https://cfconventions.org/Data/cf-conventions/cf-conventions-1.7/build/ch03s05.html)
- [CF conformance requirements](https://cfconventions.org/cf-conventions/DOI/conformance.html)
- [cf_xarray: Flag Variables](https://cf-xarray.readthedocs.io/en/latest/flags.html)
- [ARM ACT: plotting state variables](https://arm-doe.github.io/ACT/auto_examples/plotting/plot_state_variable.html), [`qc_flag_block_plot`](https://arm-doe.github.io/ACT/API/generated/act.plotting.TimeSeriesDisplay.qc_flag_block_plot.html), [embedded QC](https://arm-doe.github.io/ACT/auto_examples/qc/plot_qc_example.html)
- [SNAP product data model (flag / index coding)](https://senbox.atlassian.net/wiki/spaces/SNAP/pages/29261838), [SNAP flag writing bug](https://forum.step.esa.int/t/bug-when-writing-flags-to-dimap-netcdf-and-other-formats/41526)
- [satpy `olci_nc` reader (`BitFlags`)](https://satpy.readthedocs.io/en/latest/_modules/satpy/readers/olci_nc.html), [Sentinel-3 OLCI quality and science flags](https://Sentinels.copernicus.eu/web/sentinel/technical-guides/sentinel-3-olci/level-2/quality-and-science-flags-op)
- ESA CCI Land Cover `flag_colors`: [Iris thread showing the header](https://groups.google.com/g/scitools-iris/c/l0DiKa4zeSs), [CDS dataset page](https://cds.climate.copernicus.eu/datasets/satellite-land-cover)
- [regionmask: flag_values / flag_meanings on masks](https://lightrun.com/answers/regionmask-regionmask-add-flag_values-and-flag_meanings-to-2d-masks)
- [GDAL netCDF flags as band metadata (gdal-dev)](https://lists.osgeo.org/pipermail/gdal-dev/2019-July/050607.html)
