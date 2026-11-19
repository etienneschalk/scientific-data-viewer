# v0.15.0 — CF flag variables plotted by meaning

Branch `eschalk/v0.15-cf-flags`, based on `main` (v0.13.0). To rebase on
`eschalk/v0.14-cf-decoding` once 0.14 is merged (both change `opening.py`).

Design: [CF_FLAGS_PROPOSAL.md](./CF_FLAGS_PROPOSAL.md) (research, plot kinds,
phases P1-P4). This branch implements the four phases: **P1** (`flag_values`),
**P2** (`flag_masks`, alone or with `flag_values`), **P3** (`flag_select`,
`flag_combine`) and **P4** (`hide_flags` through `ancillary_variables`). Start with
[GETTING_STARTED.md](./GETTING_STARTED.md).

## Summary

| Change                           | User-visible effect                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `flag_values` plotted by meaning | One color per class (`cmap`, else `flag_colors`, else palette), colorbar `value meaning (share)`, facets share it                 |
| 1D flags                         | Steps, meanings on the y-axis, points colored by meaning                                                                          |
| Bars (kind `bars`)               | In place of the histogram of codes: one bar per meaning                                                                           |
| Codes read raw                   | `mask_and_scale={name: False}` reopen: a fill code that is a meaning is shown; uint64 masks exact                                 |
| Flags section                    | File Information: kind, value / mask / bits / meaning, swatches, problems, notes                                                  |
| **flags** control                | Color, default on; off = plain numbers (`--no-flags`)                                                                             |
| Bit flags (P2)                   | `flag` dimension, one entry per field: one panel per flag, row per flag over time, 1D block plot, bars of shares                  |
| Selection (P3)                   | **flag_select** (meanings by name, others grey / panels dropped), **flag_combine** (`any` / `all` / `none` of bit flags, one map) |
| Hiding (P4)                      | **hide_flags**: NaN where an `ancillary_variables` flag variable has one of the meanings set; layout item, count of hidden values |
| **Flags** fieldset               | `flags` moved from Color; new control kind `choice` (select) for `flag_combine`                                                   |
| Notes                            | Why flags are not used (inconsistent spec), ignored `vmin` / `vmax` / `robust` / `bins`, bits in no `flag_masks`                  |
| Samples                          | `sample_cf_flags.nc`; the invalid QC flags of `sample_many_encoding.nc` fixed                                                     |
| Proposal, prototype              | `docs/v0.15/CF_FLAGS_PROPOSAL.md`; `scripts/prototypes/cf_flags.py`, `paranoia.sh` step `prototypes`                              |

## Design

| Step            | Where                                     | What                                                                                                                   |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Parse and check | `sdv_backend/flags.py`                    | `read_flag_spec(attrs, raw_dtype)` -> `FlagSpec` (kind, flags, colors, problems, notes); numpy only                    |
| Info            | `info/variables.py`                       | `VariableInfo.flags = spec.to_json()` (values and masks as text)                                                       |
| Raw codes       | `plotting/api.py`, `opening.py`           | Reopen with `raw_variables=(name,)` when decoding changed the dtype and the engine allows it                           |
| Index array     | `plotting/flags.py`                       | `prepare_flag_plot`: categories, shares, `other`, present-only above 20 meanings, palette                              |
| Bit fields      | `plotting/flags.py`                       | `flag_fields` (one per mask, states of a repeated mask), `_prepare_fields`: dimension `flag`, `not set`                |
| Layout          | `plotting/layout.py` (unchanged logic)    | `resolve_layout` on the index array; then `adjust_layout`: `histogram` / line on `flag` -> `bars`, role `flags`, notes |
| Selection       | `flags.py`, `plotting/flags.py`           | `FlagSpec.match`; `FlagChoice` -> `_prepare_values` / `_prepare_fields` / `_prepare_combined`                          |
| Hidden points   | `plotting/api.py`, `plotting/flags.py`    | `_hide_flags` (lookup, raw read, slices) -> `hide_flagged` (NaN, notes, `hide_flags` item)                             |
| Draw            | `plotting/draw.py` -> `plotting/flags.py` | `ListedColormap` + `BoundaryNorm`, labelled colorbar; steps; bars; `flag` axis ticks, facet titles                     |

## Files

| Area      | Files                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend   | `flags.py` (new), `plotting/flags.py` (new), `plotting/api.py`, `plotting/draw.py`, `plotting/layout.py`, `plotting/options.py`, `opening.py`, `results.py`, `info/variables.py`, `cli.py`                   |
| Extension | `src/shared/flags.ts` (new), `src/shared/plotLayout.ts`, `src/types.ts`, `src/python/DataProcessor.ts`                                                                                                       |
| Webview   | `render/variables.ts` (`renderFlags`), `plotParams.ts` (Flags fieldset: `useFlags`, `flagSelect`, `flagCombine`, `hideFlags`; kind `choice`), `styles.css`                                                   |
| Samples   | `python/sample_data/flags.py` (new), `main.py`, `netcdf_encoding.py`                                                                                                                                         |
| Tests     | `python/tests/test_flags.py` (new); `test/suite/ui/webviewScript.test.ts`, `test/suite/dataProcessor.test.ts`                                                                                                |
| Tooling   | `scripts/prototypes/cf_flags.py` (new), `paranoia.sh` (`prototypes`), `scripts/architecture/graphs.py`, `docs/architecture/` (regenerated)                                                                   |
| Docs      | `CHANGELOG.md`, `docs/RELEASE_NOTES_0.15.0.md`, `docs/v0.15/`, `docs/PLOTTING.md`, `docs/DEVELOPMENT.md`, `docs/documentation.json`, `README.md`, `CLAUDE.md`, `package.json` / `package-lock.json` (0.15.0) |

## Testing

| Check                                                          | Result                                                                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pytest python/tests`                                          | 322 passed (87 in `test_flags.py`: 15 for bit flags, 19 for selection and `hide_flags`)                                |
| `test_flags.py` on Python 3.10, xarray 2024.10, matplotlib 3.9 | 86 passed, 1 skipped (zarr 2 there: the viewer needs zarr 3)                                                           |
| `npm test` (VS Code, `env -u ELECTRON_RUN_AS_NODE`)            | 351 passing                                                                                                            |
| `npm run typecheck`, `npm run lint`                            | clean                                                                                                                  |
| `.vsix` (`paranoia.sh` step `vsix`)                            | 83 files (was 80: `out/src/shared/flags.js`, `sdv_backend/flags.py`, `sdv_backend/plotting/flags.py`), nothing missing |
| `scripts/architecture/generate.py --check`                     | clean (diagrams regenerated)                                                                                           |
| Golden snapshots vs the commit before P1 (`--ignore-png`)      | Only the new `flags` keys, and `sample_many_encoding.nc` (fixed flags, file size) differ                               |
| Backend on `sample_cf_flags.nc`                                | Every variable plotted: images, facets, steps, bars, panels per bit, block plot, notes as expected                     |
| Manual test plan                                               | [MANUAL_TEST_PLAN_0.15.0.md](./MANUAL_TEST_PLAN_0.15.0.md): to run                                                     |

```bash
source ~/.nvm/nvm.sh && nvm use
npm run compile && npm run lint && npm run typecheck
env -u ELECTRON_RUN_AS_NODE npm test
.venv/bin/python -m pytest python/tests
.venv/bin/python python/create_sample_data.py --overwrite
.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_cf_flags.nc /land_cover
.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_cf_flags.nc /wqsf
.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_cf_flags.nc /pixel_flags --flag-select cloud,cloud_shadow --flag-combine any
.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_cf_flags.nc /sst --hide-flags "cloud, bad data"
.venv/bin/python scripts/architecture/generate.py --check
.venv/bin/python scripts/prototypes/cf_flags.py
./paranoia.sh --only prototypes
```

## Commits

1. docs(flags): proposal for plotting CF flag variables, with its prototype
2. feat(flags): plot CF flag_values variables by meaning, list flags in File Information (v0.15.0)
3. feat(flags): draw CF bit flags (flag_masks) as one panel per flag, 1D as a block plot (P2)
4. feat(flags): choose flags by name, combine bit flags, hide points flagged by ancillary_variables (P3, P4)
