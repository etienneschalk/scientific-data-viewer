# Plot settings: one editor, three levels (v0.14 UI remake)

Status: **implemented in 0.14.0**. User-facing summary in the [release notes](../RELEASE_NOTES_0.14.0.md#plot-settings-one-editor-three-levels); test steps M31-M38 of the [manual test plan](./MANUAL_TEST_PLAN_0.14.0.md#plot-settings-ui-remake).

## The problem (0.13)

- **Two sets of the same controls.** _Global Plot Controls_ (near the top of the page) and _Group Plot Controls_ (one block per group) held the same ~20 fields. Which one won was explained in a paragraph of the README: field by field, the group's value if set, else the global one, except dimension slices, where the group's whole set replaced the global one.
- **Scrolling.** The controls were far from the variable they applied to. Tuning a plot meant scrolling up to the controls, then down to **Create Plot**, then to the image.
- **No per-variable setting.** Two variables of the same group could not get two colormaps.
- **Everything built in advance.** Every group carried its controls (19 parameters, then three boxes and a slider per dimension), open or not. Large files with many groups built thousands of controls nobody used.
- **"Use the global value"** was an indeterminate checkbox (a dash), hard to read.
- **Plot All / Cancel All** existed only in the global block.

## The design

### Levels

A setting (a plot parameter, or the slice of one dimension) belongs to a **level**:

| Level           | Key           | Applies to                               | Tab title       |
| --------------- | ------------- | ---------------------------------------- | --------------- |
| a data variable | `v:/grp/name` | this variable only                       | `This variable` |
| a group         | `g:/grp`      | its variables and those of its subgroups | `Group /grp`    |
| the root group  | `g:/`         | every variable of the file               | `Whole file`    |

The **chain** of a variable goes from the variable to its group, then up the parent groups to `/`. For each setting, the **first level of the chain that sets it wins**; without one, the backend chooses (true / false parameters: their default, always sent). Slices follow the same rule, **dimension by dimension**: a slice of `time` for the whole file and a slice of `lat` for one variable both apply to that variable.

The former _Global_ level is the root group: settings flow down the tree like coordinates in a `DataTree`. A file with one group (most NetCDF files) has two levels: the variable and the whole file.

### The editor

- **Settings** button next to **Create Plot** (variable) and in the new **Plot** section of each group card (first section, open). It opens the editor **under the button**, in the page, not in a pop-up window: the plot stays visible while it is tuned.
- **Tabs**, one per level of the chain, each with the number of values it sets. An empty control shows in grey what it falls back to: `magma (file)`, `true (default)`, `auto`. A control set at the level shown is outlined (as before).
- **Built when opened, removed when closed, one at a time.** Opening another editor closes the first. Close: `×`, **Close**, **Escape**, or the Settings button again. **Enter** in a box plots.
- **True / false parameters** are selects: empty (the fallback, in grey), `true`, `false`. No more three-state checkbox.
- **Flags fieldset** only where flags apply: a variable with CF flags or `ancillary_variables`, or a group holding one.
- **Reset** (per block) clears the slices or the parameters **of the level shown**.

### Summaries and clicks

- Under each Plot button, a **summary** lists every setting that applies, with the level that sets it: `time 0:6 file`, `cmap magma file`, `vmax 10 variable`. Items set at the level of that variable or group are outlined. A click opens the editor on that level, with the focus on the field.
- The items of the **layout line under a plot** (`col time`, `col_wrap 3`…) are buttons too: a click opens the editor on the field, at the level that sets it, or at the variable's own level for an automatic choice.
- A plot whose settings changed after it was made says so: _Settings changed: plot again to apply them_.

### Buttons

**Plot all**, **Cancel all**, **Save all plots** and **Clear all plots** moved to the sticky header, so they are always in reach. Each group's **Plot** section has **Plot group** (the group's own data variables; subgroups have their own button). While one runs, the others are disabled.

## Implementation

| Module                         | Role                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webview/plotParams.ts`        | The table of parameters (no element ids any more), rendering of one level's controls, text → value (`parsePlotParameter`), number checks                                                             |
| `webview/plotSettings.ts`      | **New.** Model of the file (groups, variables, dimensions), levels (`scopeChain`), the **store** (text of the controls of each level), resolution (`plotRequestFor`, `inheritedSettings`, summaries) |
| `webview/plotEditor.ts`        | **New.** The editor (open / close / tabs / reset / keys) and the summaries                                                                                                                           |
| `webview/dimensionSlices.ts`   | Boxes and slider rendered from stored text; `sliceValueFromTexts`                                                                                                                                    |
| `webview/plotActions.ts`       | Reads the request from the store; **Plot group**; "settings changed" note                                                                                                                            |
| `webview/render/plotLayout.ts` | Layout items are buttons that open their field                                                                                                                                                       |
| `HTMLGenerator.ts`             | Plot buttons in the header; _Global Plot Controls_ section removed                                                                                                                                   |

**Why a store.** In 0.13 the values lived only in the page: `readPlotControls` read the inputs at plot time, so the controls had to exist all the time. The store holds the **text** of each control (`RawParams`, slices as `[start, stop, step]`), not parsed values, so an editor rebuilt from it shows exactly what was typed, a wrong number included (still outlined, still blocking the plot). It lives as long as the tab and survives **Refresh**.

**One trap, now handled.** Chrome fires `change` on a focused box when it is removed from the page. Without care, rebuilding the editor after **Reset** stored the old values again. `withoutCapture` ignores events while the editor content is replaced or removed (jsdom test simulating Chrome, QA check in real Chromium).

**Export.** The HTML export leaves the editor out; the summaries are the record of the settings. In a browser the Settings and Plot group buttons are hidden.

## What was considered and left out

- **A pop-up dialog**: hides the plot being tuned.
- **A fixed side panel**: VS Code editors are often narrow.
- **Plot on every change**: each plot runs a Python process; one click (or Enter) is fine.
- **Group cards built on first open**: would save more page size, but **Plot all**, the outline and Ctrl+F need the variables in the page. The controls were the heavy part, and they are gone.
- **"Apply to group"** (move the values of a level to its parent): a possible follow-up.

## Removed settings

`scientificDataViewer.globalDimensionSlices` and `scientificDataViewer.groupDimensionSlices` (show or hide the global / group blocks) have no meaning without those blocks: removed from `package.json`. A value left in `settings.json` is ignored (VS Code greys it out as unknown).
