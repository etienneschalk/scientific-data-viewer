# Pull Request: Release 0.13.1 — interpreter override from user settings only, changed marker in the plot layout line

## Summary

Patch release on top of 0.13.0, collecting the 0.13.1 fixes on `eschalk/v0.13.1-release`.

- **Security**: `python.overridePythonInterpreter` is machine-scoped and read from user settings only, so a repository's `.vscode/settings.json` can no longer choose the program the extension runs. Cherry-picked from `eschalk/v0.14-cf-decoding`.
- **Plot layout line**: in the plot layout line, items set in the plot controls now end with the same **`•`** as a changed plot control. Before, only an outline in the theme's `focusBorder` color set them apart from the automatic items. Follows up the 2026 themes fix of 0.13.0 (manual test pass of 2026-11-18). See [`RELEASE_NOTES_0.13.1.md`](../RELEASE_NOTES_0.13.1.md).

**Version:** `0.13.1` in `package.json` / `package-lock.json`

---

## Changes

| Area   | What                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Why    | The layout line relied on color alone, while changed controls have both an outline and a `•`. Where `focusBorder` is close to the other borders (High Contrast, some third-party themes), "set by you" looked like "automatic" |
| What   | `.plot-layout-item--user::after` adds ` •` in `--sdv-changed`; the legend shows the marker (`outlined •: set by you · others: automatic`)                                                                                      |
| Where  | `src/panel/webview/styles.css`, `src/panel/webview/render/plotLayout.ts`                                                                                                                                                       |
| Docs   | `CHANGELOG.md`, `docs/RELEASE_NOTES_0.13.1.md`, `docs/PLOTTING.md`, `docs/SCREENSHOTS.md`                                                                                                                                      |
| Tests  | `test/suite/ui/webviewScript.test.ts`: the legend contains the marker (the dot itself is a pseudo-element, outside `textContent`)                                                                                              |
| Python | No change; `ENVIRONMENT_REVISION` unchanged                                                                                                                                                                                    |

### Security: interpreter override

| Area  | What                                                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why   | The override names the program the extension runs and could be set in a workspace: a cloned repository could make the extension execute one of its files when a data file was opened         |
| What  | `"scope": "machine"` in `package.json`; `getOverridePythonInterpreter` reads `inspect().globalValue` only; `getIgnoredWorkspaceOverridePythonInterpreter` lets `PythonManager` log a warning |
| Where | `package.json`, `src/common/config.ts`, `src/python/PythonManager.ts`, `README.md` (regenerated)                                                                                             |
| Tests | `test/suite/config.test.ts`: machine scope; workspace and workspace-folder values ignored; user value read and trimmed; non-string value ignored                                             |

### Development: upgrade sandbox, offline scenario

| Area  | What                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why   | Paranoia `upgrade` step failed on 0.13.1 (`fails when: offline`). Without a uv environment change it upgrades from the release itself with `--bump-new`; the failed rebuild restores the previous environment with its `sdv-environment.json` (lower revision, rebuild still pending), but the check required no state file, true only from releases before 0.13 |
| What  | The check accepts no state file, or the state file of before the upgrade, unchanged. The extension's behaviour is unchanged                                                                                                                                                                                                                                      |
| Where | `scripts/upgrade-sandbox.sh`                                                                                                                                                                                                                                                                                                                                     |

## Testing

```bash
source ~/.nvm/nvm.sh && nvm use
npm run typecheck
env -u ELECTRON_RUN_AS_NODE xvfb-run -a npm test            # 349 passing
npm run screenshots -- --scenario changed-controls --theme 2026-dark
npm run screenshots -- --scenario changed-controls --theme 2026-light
```

Results:

| Check                                              | Result                                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                | OK                                                                                                              |
| `npm test`                                         | 349 passing                                                                                                     |
| Screenshots `changed-controls` (2026 Dark / Light) | `•` after `time 0:6` and `col_wrap 3`, none after `col time`, `y lat`, `x lon`; legend `outlined •: set by you` |

Manual verification: steps 1–8 of the [release notes](../RELEASE_NOTES_0.13.1.md#manual-verification).

## Commits (oldest → newest)

1. fix(webview): mark the items set by you in the plot layout line with a dot
2. fix(config): read the interpreter override from user settings only
3. fix(qa): accept the state file restored by a failed offline rebuild in the upgrade sandbox
