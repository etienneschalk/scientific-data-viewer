# v0.15 — Getting started

v0.15.0 is about **CF flag variables**: a variable with `flag_values` and `flag_meanings` is plotted by meaning (one color per class, named colorbar, steps for 1D, bars instead of a histogram); bit flags (`flag_masks`) get one panel per flag, or a block plot for 1D data; the codes are read raw, and File Information lists the flags. Phases P1 and P2 of the [proposal](./CF_FLAGS_PROPOSAL.md) are done. This page is the entry point: what to read, what to review closely, what to test.

It is built on `main` (v0.13.0). v0.14 (`eschalk/v0.14-cf-decoding`) is still open and also changes `python/sdv_backend/opening.py`: rebase this branch on it once 0.14 is merged.

---

## Where to start

| Time you have | Do this                                                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **15 min**    | Read the TL;DR and **Upgrade notes** of the [release notes](../RELEASE_NOTES_0.15.0.md), and [§ What could break users](#what-could-break-users). Run the [automated checks](#automated-checks).                        |
| **1 h**       | Add the [manual test plan](./MANUAL_TEST_PLAN_0.15.0.md) (about 25 min), a review of [the high-risk code](#review), and the [proposal](./CF_FLAGS_PROPOSAL.md) for the phases still to come (P3 selection, P4 masking). |

---

## Map of the v0.15 documents

| Document                                                   | What it is for                                                  | Read it when                               |
| ---------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| **GETTING_STARTED.md** (this page)                         | Hub: reading order, risks, review and test plan                 | First                                      |
| [CF_FLAGS_PROPOSAL.md](./CF_FLAGS_PROPOSAL.md)             | Design: CF § 3.5, what other tools do, plot kinds, phases P1-P4 | To understand the choices and what is next |
| [RELEASE_NOTES_0.15.0.md](../RELEASE_NOTES_0.15.0.md)      | For users and reviewers: what changed, why, upgrade notes       | Before testing; published with the release |
| [CHANGELOG.md](../../CHANGELOG.md) (0.15.0 section)        | Every change with its files and tests                           | To find where something was changed        |
| [PR_SUMMARY_0.15.0.md](./PR_SUMMARY_0.15.0.md)             | Merge request description: tables, test commands, commit list   | When opening / reviewing the PR            |
| [MANUAL_TEST_PLAN_0.15.0.md](./MANUAL_TEST_PLAN_0.15.0.md) | Click-by-click test plan with a results sheet                   | Before merging                             |

No upgrade test plan: v0.15 adds no package and does not rebuild the extension's own environment (`ENVIRONMENT_REVISION` unchanged).

---

## What could break users

| #   | Risk                                                                                                | Who                                | Safety net                                                                                                                                        | Left to check by hand |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | **A variable wrongly taken for flags** (attributes present but meant otherwise) is drawn as classes | Files with odd flag attributes     | Strict checks (counts, types, duplicates, masks); inconsistent specs keep the numeric plot with a note; **flags** control off restores it         | M3, M9                |
| 2   | **The raw reopen fails** with an engine that rejects `mask_and_scale` as a dict                     | Flag variables with a `_FillValue` | Only netcdf4 / h5netcdf / scipy / zarr reopen (tested on xarray 2024.10 and 2026.7); other engines keep the decoded values                        | M2, M5                |
| 3   | **Plots differ** for flag variables (intended)                                                      | Everyone with CF flags             | Release notes; **flags** checkbox; golden snapshots: only `flags` keys and the fixed sample differ                                                | M1-M7                 |
| 4   | **Colors from the file reach the page** (`flag_colors`)                                             | Anyone opening untrusted files     | Hex codes or color names only, checked in the backend and again in the webview; test with a CSS injection attempt                                 | —                     |
| 5   | **Scripts parsing the backend JSON** see a new `flags` key, kind `bars`, role `flags`               | Integrators, golden snapshots      | Documented in the upgrade notes                                                                                                                   | Re-record golden      |
| 6   | **Too many panels or too much memory** for a bit-flag variable (one copy of the data per flag)      | Products with dozens of bits       | Above 20 flags only those set are drawn; above 50 million points the last flags are left out, with a note; **flags** off restores the single plot | M8                    |

---

## Review

| File                                    | Why it deserves attention                                                                                                                                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python/sdv_backend/flags.py`           | The parsing and checks: what is accepted decides which variables change; `Flag.test` (signed / uint64 masks)                                                                                                                                                            |
| `python/sdv_backend/plotting/flags.py`  | `flag_codes` (fill vs declared meaning), `prepare_flag_plot` (categories, remapping above 20 meanings), palette; `flag_fields` / `_prepare_fields` (fields of masks + values, the `flag` dimension, the size limit), `draw_flag_image` (block plot ticks, facet titles) |
| `python/sdv_backend/plotting/api.py`    | The second, raw open of the file (`_reopen_raw`) and the notes when flags are not used                                                                                                                                                                                  |
| `python/sdv_backend/opening.py`         | `raw_variables` / `ENGINES_WITH_PER_VARIABLE_DECODING`: must not change any other open                                                                                                                                                                                  |
| `src/panel/webview/render/variables.ts` | `renderFlags`: file-derived text escaped, colors inlined only after `isSafeFlagColor`                                                                                                                                                                                   |

---

## Automated checks

```bash
source ~/.nvm/nvm.sh && nvm use
npm run compile && npm run lint && npm run typecheck
env -u ELECTRON_RUN_AS_NODE npm test
.venv/bin/python -m pytest python/tests
.venv/bin/python python/create_sample_data.py --overwrite
.venv/bin/python scripts/architecture/generate.py --check
.venv/bin/python scripts/prototypes/cf_flags.py
./paranoia.sh --quick
```
