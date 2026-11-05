# v0.14 — Getting started

v0.14.0 is a focused release about **how files are decoded**: the time fallback turns off time decoding only, **Reopen raw** shows stored values, **Troubleshooting > How this file was opened** gives the reproducible xarray call, and decoding plus engine `backend_kwargs` become settings. This page is the entry point: what to read, what to review closely, what to test.

It is built on the v0.13.0 branch (`eschalk/backend-package`): merge v0.13 first.

---

## Where to start

| Time you have | Do this                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **15 min**    | Read the TL;DR and **Upgrade notes** of the [release notes](../RELEASE_NOTES_0.14.0.md), and [§ What could break users](#what-could-break-users). Run the [automated checks](#automated-checks). |
| **1 h**       | Add the [manual test plan](./MANUAL_TEST_PLAN_0.14.0.md) (about 30 min) and a review of [the high-risk code](#review).                                                                           |

---

## Map of the v0.14 documents

| Document                                                   | What it is for                                                               | Read it when                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| **GETTING_STARTED.md** (this page)                         | Hub: reading order, risks, review and test plan                              | First                                      |
| [RELEASE_NOTES_0.14.0.md](../RELEASE_NOTES_0.14.0.md)      | For users and reviewers: what changed, why (decoding history), upgrade notes | Before testing; published with the release |
| [CHANGELOG.md](../../CHANGELOG.md) (0.14.0 section)        | Every change with its files and tests                                        | To find where something was changed        |
| [PR_SUMMARY_0.14.0.md](./PR_SUMMARY_0.14.0.md)             | Merge request description: tables, test commands, commit list                | When opening / reviewing the PR            |
| [MANUAL_TEST_PLAN_0.14.0.md](./MANUAL_TEST_PLAN_0.14.0.md) | Click-by-click test plan with a results sheet                                | Before merging                             |

No upgrade test plan: v0.14 adds no package and does not rebuild the extension's own environment (`ENVIRONMENT_REVISION` unchanged).

---

## What could break users

| #   | Risk                                                                                                        | Who                            | Safety net                                                                                                                                   | Left to check by hand              |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | **A decoder passed to an engine that does not take it** (`TypeError` from xarray) makes a format unreadable | Everyone                       | Decoders filtered by each engine's `open_dataset_parameters`; rioxarray's `decode_coords` pinned; every sample format opened decoded and raw | One file per format (test plan M2) |
| 2   | **Different values** for files that used to hit the time fallback: now masked and scaled                    | Files with broken time units   | Intended; `test_decode_times_fallback.py`; **Reopen raw** shows the old (stored) values                                                      | M1                                 |
| 3   | **`engineBackendKwargs` abused** by a workspace to pass dangerous keywords                                  | Anyone opening untrusted repos | Machine scope + global value only (TS); allowlist checked again by the backend (Python)                                                      | M7                                 |
| 4   | **Raster time coordinate changes dtype** (cftime → `datetime64`)                                            | GeoTIFF users with time tags   | Only standard calendars, only 1-D coordinates; `useCftime: on` keeps cftime                                                                  | M5                                 |
| 5   | **Scripts parsing the backend JSON** read `decode_cf_degraded`                                              | Integrators, golden snapshots  | Documented in the upgrade notes                                                                                                              | Re-record golden snapshots         |

---

## Review

Review closely, in this order:

1. `python/sdv_backend/decoding.py`: `resolve_open_kwargs` (layers, filtering, allowlist) and `USER_BACKEND_KWARGS_ALLOWED`: any key added there must not write, reach the network or take credentials.
2. `python/sdv_backend/opening.py`: `_open_with_engine` (fallback), `_cftime_to_datetime64`, `_open_with_cdflib`.
3. `src/common/config.ts`: `getEngineBackendKwargs` (global value only) and `package.json` (`"scope": "machine"`).
4. `src/panel/UIController.ts`: `setRawMode` / `openFileOptions` (raw mode reaches info **and** plots).

The webview changes (`dataInfo.ts`, `representations.ts`, `main.ts`) render text through `escapeHtml` / `textContent`; a jsdom test feeds file-derived markup into the report.

## Automated checks

```bash
source ~/.nvm/nvm.sh && nvm use
npm run compile && npm run lint && npm run typecheck
env -u ELECTRON_RUN_AS_NODE npm test              # 331 tests
.venv/bin/python -m pytest python/tests           # 246 tests
.venv/bin/python scripts/architecture/generate.py --check
npx vsce ls | wc -l                               # 73 files (decoding.py added)
./paranoia.sh --quick                             # readiness report
```
