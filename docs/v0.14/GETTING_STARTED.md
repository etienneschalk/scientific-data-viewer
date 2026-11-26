# v0.14 — Getting started

v0.14.0 has four parts:

- **How files are decoded**: the time fallback turns off time decoding only, **Reopen raw** shows stored values, **Troubleshooting > How this file was opened** gives the reproducible xarray call, and decoding plus engine `backend_kwargs` become settings.
- **CF flag variables**: a variable with `flag_values` and `flag_meanings` is plotted by meaning (one color per class, named colorbar, steps for 1D, bars instead of a histogram); bit flags (`flag_masks`) get one panel per flag, or a block plot for 1D data; the codes are read raw, and File Information lists the flags. A **Flags** fieldset of plot controls picks meanings by name, folds bit flags into one map (`cloud OR cloud_shadow`) and hides the points a quality flag marks (`ancillary_variables`). The four phases of the [proposal](./CF_FLAGS_PROPOSAL.md) are done.
- **Log scale and seaborn colormaps**: a **norm** plot control (`log`: colors follow `log10(value)`, colorbar in data units; log data axis for lines; values ≤ 0 left out with a note), and `seaborn:<name>` colormaps in **cmap**. seaborn joins the extension's own environment, which is rebuilt once (`ENVIRONMENT_REVISION` 3). Specs: [FEATURE_LOG_COLOR_SCALE.md](./FEATURE_LOG_COLOR_SCALE.md), [FEATURE_SEABORN_COLORMAPS.md](./FEATURE_SEABORN_COLORMAPS.md).
- **Plot settings, remade**: one settings editor replaces the _Global Plot Controls_ and _Group Plot Controls_ blocks. **Settings** (next to **Create Plot**, or in a group's **Plot** section) opens it under the button, built on demand, one at a time; its tabs are the levels (**This variable**, **Group /a**, **Whole file**) and the nearest level wins. Summaries under each Plot button, **Plot all** / **Cancel all** / **Save all** / **Clear all** in the header, **Plot group** per group. Design: [FEATURE_PLOT_SETTINGS_UI.md](./FEATURE_PLOT_SETTINGS_UI.md).

This page is the entry point: what to read, what to review closely, what to test.

It is built on 0.13.1, released on 2026-11-20 (tag `v0.13.1`), and has `main` merged in since then. The interpreter-override fix (risk 6, M9) shipped in 0.13.1; it is listed here for users who upgrade from 0.13.0 straight to 0.14.0. The CF flags were written for 0.15 on `eschalk/v0.15-cf-flags` (from 0.13.0), then cherry-picked onto this branch; their codes are now read raw through the decoding layer of 0.14 (risk 9).

---

## Where to start

| Time you have | Do this                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **15 min**    | Read the TL;DR and **Upgrade notes** of the [release notes](../RELEASE_NOTES_0.14.0.md), and [§ What could break users](#what-could-break-users). Run the [automated checks](#automated-checks).                                                                                     |
| **2 h**       | Add the [manual test plan](./MANUAL_TEST_PLAN_0.14.0.md) (about 110 min; M31-M38 alone, 20 min, check the plot settings and need no code knowledge), a review of [the high-risk code](#review), and the [flags proposal](./CF_FLAGS_PROPOSAL.md) for the choices made in each phase. |

---

## Map of the v0.14 documents

| Document                                                       | What it is for                                                                                                                            | Read it when                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **GETTING_STARTED.md** (this page)                             | Hub: reading order, risks, review and test plan                                                                                           | First                                      |
| [RELEASE_NOTES_0.14.0.md](../RELEASE_NOTES_0.14.0.md)          | For users and reviewers: what changed, why (decoding history, flags), upgrade notes                                                       | Before testing; published with the release |
| [CHANGELOG.md](../../CHANGELOG.md) (0.14.0 section)            | Every change with its files and tests                                                                                                     | To find where something was changed        |
| [PR_SUMMARY_0.14.0.md](./PR_SUMMARY_0.14.0.md)                 | Merge request description: tables, test commands, commit list                                                                             | When opening / reviewing the PR            |
| [MANUAL_TEST_PLAN_0.14.0.md](./MANUAL_TEST_PLAN_0.14.0.md)     | Click-by-click test plan with a results sheet (M1-M9 decoding, M10-M24 flags, M25-M30 log scale, seaborn, upgrade, M31-M38 plot settings) | Before merging                             |
| [CF_FLAGS_PROPOSAL.md](./CF_FLAGS_PROPOSAL.md)                 | Design: CF § 3.5, what other tools do, plot kinds, phases P1-P4                                                                           | To understand the choices and what is next |
| [FEATURE_LOG_COLOR_SCALE.md](./FEATURE_LOG_COLOR_SCALE.md)     | Spec of the `norm` plot control (implemented), with the decisions made                                                                    | To understand the log scale rules          |
| [FEATURE_SEABORN_COLORMAPS.md](./FEATURE_SEABORN_COLORMAPS.md) | Spec of `seaborn:<name>` colormaps (implemented), with the decisions made                                                                 | To understand the seaborn handling         |
| [FEATURE_PLOT_SETTINGS_UI.md](./FEATURE_PLOT_SETTINGS_UI.md)   | Design of the plot settings remake: levels, editor, summaries, what was left out                                                          | To understand the new plot settings        |

No separate upgrade test plan: the one environment change (seaborn, `ENVIRONMENT_REVISION` 2 → 3, rebuilt once) is step M30 of the manual test plan, covered by unit tests (`extensionEnvironmentUpdate.test.ts`), and to be played before release with `scripts/upgrade-sandbox.sh --old artefacts/vsix-releases/scientific-data-viewer-0.13.1.vsix --expect rebuild` (not run yet).

---

## What could break users

| #   | Risk                                                                                                                                   | Who                                                | Safety net                                                                                                                                                                          | Left to check by hand              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | **A decoder passed to an engine that does not take it** (`TypeError` from xarray) makes a format unreadable                            | Everyone                                           | Decoders filtered by each engine's `open_dataset_parameters`; rioxarray's `decode_coords` pinned; every sample format opened decoded and raw                                        | One file per format (test plan M2) |
| 2   | **Different values** for files that used to hit the time fallback: now masked and scaled                                               | Files with broken time units                       | Intended; `test_decode_times_fallback.py`; **Reopen raw** shows the old (stored) values                                                                                             | M1                                 |
| 3   | **`engineBackendKwargs` abused** by a workspace to pass dangerous keywords                                                             | Anyone opening untrusted repos                     | Machine scope + global value only (TS); allowlist checked again by the backend (Python)                                                                                             | M7                                 |
| 4   | **Raster time coordinate changes dtype** (cftime → `datetime64`)                                                                       | GeoTIFF users with time tags                       | Only standard calendars, only 1-D coordinates; `useCftime: on` keeps cftime                                                                                                         | M5                                 |
| 5   | **Scripts parsing the backend JSON** read `decode_cf_degraded`, or meet the new `flags` key, kind `bars`, roles `flags` / `hide_flags` | Integrators, golden snapshots                      | Documented in the upgrade notes                                                                                                                                                     | Re-record golden snapshots         |
| 6   | **Interpreter override set in a project** stops applying (now user settings only)                                                      | Users with a workspace `overridePythonInterpreter` | Warning in the logs; fallback to own env / Python extension; documented in upgrade notes                                                                                            | M9                                 |
| 7   | **A variable wrongly taken for flags** (attributes present but meant otherwise) is drawn as classes                                    | Files with odd flag attributes                     | Strict checks (counts, types, duplicates, masks); inconsistent specs keep the numeric plot with a note; **flags** control off restores it                                           | M12, M19                           |
| 8   | **Plots differ** for flag variables (intended)                                                                                         | Everyone with CF flags                             | Release notes; **flags** checkbox; golden snapshots: only `flags` keys and the fixed sample differ                                                                                  | M10-M16                            |
| 9   | **The raw re-read of flag codes fails** or ignores the decoding settings                                                               | Flag variables with a `_FillValue`                 | Only netcdf4 / h5netcdf / scipy / zarr re-read (tested on xarray 2024.10 and 2026.7); the second open gets the tab's `DecodingOptions` (test); none when the codes are already raw  | M11, M14, M24                      |
| 10  | **Colors from the file reach the page** (`flag_colors`)                                                                                | Anyone opening untrusted files                     | Hex codes or color names only, checked in the backend and again in the webview; test with a CSS injection attempt                                                                   | —                                  |
| 11  | **Too many panels or too much memory** for a bit-flag variable (one copy of the data per flag)                                         | Products with dozens of bits                       | Above 20 flags only those set are drawn; above 50 million points the last flags are left out, with a note; **flags** off restores the single plot                                   | M17                                |
| 12  | **`hide_flags` hides the wrong points** (flag variable on other coordinates, misaligned)                                               | Users masking data with quality flags              | Same group only, same dimension names and sizes required, else skipped with a note; broadcast by name, no coordinate alignment; tests check the hidden points one by one            | M23                                |
| 13  | **The environment rebuild fails or takes long** (seaborn, `ENVIRONMENT_REVISION` 3)                                                    | Users of `useExtensionOwnEnvironment`              | Rebuild mechanism of 0.13 (previous environment kept and restored, retried next start); unit test for revision 2 → 3; seaborn is a pure-Python wheel                                | M30, `upgrade-sandbox.sh`          |
| 14  | **A log plot fails or misleads** (values ≤ 0, limits ≤ 0, `robust` negative, xarray `vmin` vs norm conflict, diverging colormap)       | Users of **norm** `log`                            | Limits built from the values above 0, `vmin` / `vmax` / `robust` never passed next to the norm, `center=False`, linear fallback with a note; 19 tests, Python 3.10 / xarray 2024.10 | M25-M27                            |
| 15  | **seaborn breaks plots that do not ask for it** (import time, rcParams)                                                                | Everyone                                           | seaborn imported only for a `seaborn:` name (subprocess test); rcParams unchanged after resolving a name (test); missing seaborn: one-line error                                    | M28, M29                           |
| 16  | **A plot request differs** from 0.13 for the same settings (store and merge rewritten)                                                 | Everyone who plots                                 | Same fields, bools always sent: the jsdom test of the full payload kept its 0.13 expectation; QA `controls.mjs` checks the CLI arguments with the real backend                      |
| 17  | **A setting is lost or comes back** (editor rebuilt from the store on open, tab switch, Reset, Refresh)                                | Users of the plot settings                         | Text of every control stored per level; Chrome's `change` on a removed focused box ignored (`withoutCapture`), jsdom test simulating it and QA check in real Chromium               |
| 18  | **Users look for the Global Plot Controls**, or keep `globalDimensionSlices` / `groupDimensionSlices` in their settings                | Users of 0.13                                      | Upgrade notes; **Whole file** tab from the first group or any variable; old settings ignored (greyed out as unknown by VS Code)                                                     |

---

## Review

Review closely, in this order:

1. `python/sdv_backend/decoding.py`: `resolve_open_kwargs` (layers, filtering, allowlist, `raw_variables`) and `USER_BACKEND_KWARGS_ALLOWED`: any key added there must not write, reach the network or take credentials.
2. `python/sdv_backend/opening.py`: `_open_with_engine` (fallback), `_cftime_to_datetime64`, `_open_with_cdflib`.
3. `src/common/config.ts`: `getEngineBackendKwargs` and `getOverridePythonInterpreter` (global value only), and `package.json` (`"scope": "machine"` on both).
4. `src/panel/UIController.ts`: `setRawMode` / `openFileOptions` (raw mode reaches info **and** plots).
5. `python/sdv_backend/flags.py`: the parsing and checks: what is accepted decides which variables change; `Flag.test` (signed / uint64 masks).
6. `python/sdv_backend/plotting/flags.py`: `flag_codes` (fill vs declared meaning), `prepare_flag_plot` (categories, remapping above 20 meanings), palette; `flag_fields` / `_prepare_fields` (fields of masks + values, the `flag` dimension, the size limit), `draw_flag_image` (block plot ticks, facet titles); `hide_flagged`.
7. `python/sdv_backend/plotting/api.py`: the second, raw open of the file (`_reopen_raw`, `raw_group`), `_hide_flags` (ancillary variables: raw read, the same slices as the variable, broadcast by dimension name), the notes when flags are not used.
8. `src/panel/webview/plotParams.ts`: the **Flags** fieldset and the control kind `choice` (a select that is not a dimension select); `src/panel/webview/render/variables.ts`: `renderFlags` (file-derived text escaped, colors inlined only after `isSafeFlagColor`).
9. `python/sdv_backend/plotting/norm.py`: `apply_norm` / `_log_norm` (limits from the values above 0, user limits ≤ 0, one limit beyond the data, `extend`), and `plotting/kwargs.py` (`objects` / `for_call`: objects reach xarray, text reaches the JSON).
10. `python/sdv_backend/plotting/colormaps.py` (`resolve_cmap`: lazy import, error messages) and `src/python/ExtensionVirtualEnvironmentManager.ts` (`ALL_REQUIREMENTS` + seaborn, `ENVIRONMENT_REVISION` 3).
11. `src/panel/webview/plotSettings.ts`: `scopeChain` (which levels apply), `plotRequestFor` (which value wins, bool defaults, numbers checked at the winning level only), the store (`updateLevelSettings` merges, empty values pruned); `src/panel/webview/plotEditor.ts`: `handlePlotEditorEvent` / `withoutCapture` (what is stored and when), `editSetting` (the level a click opens), file-derived names (group paths, dimensions) escaped in tabs, hints and summaries.

The webview changes (`dataInfo.ts`, `representations.ts`, `main.ts`, `variables.ts`) render text through `escapeHtml` / `textContent`; jsdom tests feed file-derived markup into the report and the Flags section.

## Automated checks

```bash
source ~/.nvm/nvm.sh && nvm use
npm run compile && npm run lint && npm run typecheck
env -u ELECTRON_RUN_AS_NODE npm test              # 367 tests
.venv/bin/python -m pytest python/tests           # 405 tests (seaborn: pip install -r requirements-dev.txt)
.venv/bin/python python/create_sample_data.py --overwrite
.venv/bin/python scripts/architecture/generate.py --check
.venv/bin/python scripts/prototypes/cf_flags.py
npx vsce ls | wc -l                               # 86 files
SDV_PYTHON=$PWD/.venv/bin/python node scripts/qa/webview/run-all.mjs    # 102 checks (render, controls, cancel)
.venv/bin/python python/tools/golden_snapshots.py check -k plot__   # 30 plot cases
./paranoia.sh --quick                             # readiness report
```
