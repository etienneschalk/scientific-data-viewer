# Scientific Data Viewer v0.13.1 Release Notes

**TL;DR** — One visual fix on top of 0.13.0. In the plot layout line, the items **set by you** now end with the same **`•`** as a plot control changed from its default. Before, only an outline set them apart from the automatic items, and some themes draw that outline in a color close to the other borders.

## Rationale

0.13.0 introduced the plot layout line. It lists what was drawn and where each dimension went, for example `image  time 0:6  col time  col_wrap 3  y lat  x lon`. Items set in the plot controls are outlined in the theme's `focusBorder` color, and items chosen automatically are not.

In the 0.13.0 manual test pass (2026-11-18), the 2026 Dark / Light themes made changed controls look unchanged. The fix moved the outline color from `inputOption.activeBorder` to `focusBorder`. That fixed the plot controls, which already had a second cue: a `•` after the name of each changed control. The layout line still relied on color alone. In the High Contrast themes, where every border already has a strong color, and in third-party themes with a `focusBorder` close to their borders, "set by you" and "automatic" items could still be hard to tell apart.

The layout items now use the same mark as the controls:

```
image   [time 0:6 •]  col time  [col_wrap 3 •]  y lat  x lon  size 4  aspect 1     outlined •: set by you · others: automatic
```

The `•` is added by CSS (`::after`), in the same `--sdv-changed` color as the outline. The item's text is unchanged, so copying a value from the line does not pick up the dot.

## Upgrade notes

No settings, no Python environment change (`ENVIRONMENT_REVISION` unchanged), and no backend change. Updating from 0.13.0 only changes the webview stylesheet and the legend text.

## Manual verification

1. Open the sample file (**Scientific Data Viewer: Open Sample File**). Click **Create Plot** on `tas`. The layout line above the plot has no `•`, and its legend reads `outlined •: set by you · others: automatic`, with the dot in the theme's focus color.
2. In **Global Plot Controls** → **Plot parameters**, set **col_wrap** to `3`. The control is outlined, with a `•` after its name. Click **Create Plot**: in the layout line, `col_wrap 3` is outlined and ends with a `•`, while the other items have neither.
3. In **Dimension slices**, type `0:6` in the **start** box of `time` and click **Create Plot**. `time 0:6` is outlined with a `•`.
4. Switch the color theme to **Dark 2026**, **Light 2026**, **Dark High Contrast** and **Light High Contrast**. In each one, the dot is visible after the items set by you and after their controls.
5. Export the webview (**Export Webview Content**) and open the HTML file in a browser. The dots are still there.

## Known limitations

- The dot follows `focusBorder`. In a theme where `focusBorder` is close to the background, the dot is faint, like the outline. The difference between "set by you" and "automatic" is still given by the dot's presence.

## Summary of changes

| Area      | Change                                                                                     |
| --------- | ------------------------------------------------------------------------------------------ |
| **Fixed** | Plot layout line: items set by you end with a `•`, like the changed plot controls          |
| **Docs**  | `docs/PLOTTING.md` (layout line example), `docs/SCREENSHOTS.md` (`changed-controls` scene) |
