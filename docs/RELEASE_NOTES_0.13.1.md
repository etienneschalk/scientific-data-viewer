# Scientific Data Viewer v0.13.1 Release Notes

**TL;DR** — A security fix and a visual fix on top of 0.13.0.

- **Security**: `scientificDataViewer.python.overridePythonInterpreter` is now read from **user settings only**. Before, a repository's `.vscode/settings.json` could set it, so opening a data file in that folder ran a program the repository chose.
- **Plot layout line**: the items **set by you** now end with the same **`•`** as a plot control changed from its default. Before, only an outline set them apart from the automatic items, and some themes draw that outline in a color close to the other borders.

## Rationale

### Interpreter override: user settings only

`scientificDataViewer.python.overridePythonInterpreter` names the program the extension runs, and it wins over every other interpreter source. Up to 0.13.0 it could be set at any scope. A repository could ship `.vscode/settings.json` with `"scientificDataViewer.python.overridePythonInterpreter": "./tools/run.sh"`, and opening any data file from that folder ran the script. The extension's backend has no workspace trust check of its own to stop this.

In 0.13.1 the setting is `"scope": "machine"`: VS Code ignores and flags values in workspace and folder settings. The extension also reads only the global (user, or remote machine) value, and logs a warning when a workspace value is present. Its description no longer suggests a relative `.venv/bin/python`. Per-project interpreters keep working through **Python: Select Interpreter**, which the Python extension manages under VS Code's workspace trust.

The fix was first written for v0.14 (`eschalk/v0.14-cf-decoding`) and is brought forward to this patch release.

### Changed marker in the plot layout line

0.13.0 introduced the plot layout line. It lists what was drawn and where each dimension went, for example `image  time 0:6  col time  col_wrap 3  y lat  x lon`. Items set in the plot controls are outlined in the theme's `focusBorder` color, and items chosen automatically are not.

In the 0.13.0 manual test pass (2026-11-18), the 2026 Dark / Light themes made changed controls look unchanged. The fix moved the outline color from `inputOption.activeBorder` to `focusBorder`. That fixed the plot controls, which already had a second cue: a `•` after the name of each changed control. The layout line still relied on color alone. In the High Contrast themes, where every border already has a strong color, and in third-party themes with a `focusBorder` close to their borders, "set by you" and "automatic" items could still be hard to tell apart.

The layout items now use the same mark as the controls:

```
image   [time 0:6 •]  col time  [col_wrap 3 •]  y lat  x lon  size 4  aspect 1     outlined •: set by you · others: automatic
```

The `•` is added by CSS (`::after`), in the same `--sdv-changed` color as the outline. The item's text is unchanged, so copying a value from the line does not pick up the dot.

## Upgrade notes

- **`python.overridePythonInterpreter` in a workspace is now ignored.** If you set it in a project's `.vscode/settings.json` (e.g. `.venv/bin/python`), the extension falls back to the next interpreter source (own environment, then the Python extension's interpreter) and logs a warning. Either select that interpreter with **Python: Select Interpreter**, or move the override to your **user** settings with an absolute path. A value in user settings works as before.
- No new setting, no Python environment change (`ENVIRONMENT_REVISION` unchanged), and no backend change.

## Manual verification

1. Open the sample file (**Scientific Data Viewer: Open Sample File**). Click **Create Plot** on `tas`. The layout line above the plot has no `•`, and its legend reads `outlined •: set by you · others: automatic`, with the dot in the theme's focus color.
2. In **Global Plot Controls** → **Plot parameters**, set **col_wrap** to `3`. The control is outlined, with a `•` after its name. Click **Create Plot**: in the layout line, `col_wrap 3` is outlined and ends with a `•`, while the other items have neither.
3. In **Dimension slices**, type `0:6` in the **start** box of `time` and click **Create Plot**. `time 0:6` is outlined with a `•`.
4. Switch the color theme to **Dark 2026**, **Light 2026**, **Dark High Contrast** and **Light High Contrast**. In each one, the dot is visible after the items set by you and after their controls.
5. Export the webview (**Export Webview Content**) and open the HTML file in a browser. The dots are still there.
6. Open a folder and create `.vscode/settings.json` with `"scientificDataViewer.python.overridePythonInterpreter": "/does/not/exist/python"`. VS Code marks the setting as not applicable in the workspace.
7. Run **Scientific Data Viewer: Refresh Python Environment**. The status bar shows the same interpreter as before, and a data file still opens. **Show Extension Logs** contains a warning `Ignoring scientificDataViewer.python.overridePythonInterpreter = /does/not/exist/python from the workspace settings`.
8. Put the same key in **user** settings with a real interpreter path (e.g. the output of `which python3`) and refresh: the status bar shows it. Remove both values afterwards.

## Known limitations

- Users who relied on a workspace `overridePythonInterpreter` (for example a team sharing `.venv/bin/python` in `.vscode/settings.json`) lose it silently, apart from the log line. This is intended: the safe replacement is **Python: Select Interpreter**.
- The dot follows `focusBorder`. In a theme where `focusBorder` is close to the background, the dot is faint, like the outline. The difference between "set by you" and "automatic" is still given by the dot's presence.

## Summary of changes

| Area            | Change                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Security**    | `python.overridePythonInterpreter` read from user settings only (`package.json` scope, `config.ts`, `PythonManager.ts`) |
| **Fixed**       | Plot layout line: items set by you end with a `•`, like the changed plot controls                                       |
| **Development** | `scripts/upgrade-sandbox.sh`: the offline scenario accepts the state file restored with the previous environment        |
| **Docs**        | `docs/PLOTTING.md` (layout line example), `docs/SCREENSHOTS.md` (`changed-controls` scene), `README.md` (setting)       |
