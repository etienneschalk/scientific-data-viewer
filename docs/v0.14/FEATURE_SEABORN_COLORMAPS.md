# Feature (v0.14): seaborn colormaps

> Status: **proposed** for v0.14. This page is the spec an issue points to.

## Summary

Let the `cmap` plot control take **seaborn colormaps**, named with a
`seaborn:` prefix: `seaborn:rocket`, `seaborn:mako_r`, `seaborn:icefire`...
seaborn becomes an **optional** dependency: installed in the extension's own
environment, never required in a user's interpreter.

## Motivation

Many scientists use seaborn's colormaps (`rocket`, `mako`, `flare`, `crest`,
`vlag`, `icefire`): perceptually uniform like viridis, and the defaults of
their seaborn figures. Today the `cmap` input only takes matplotlib colormap
names, so a plot in the viewer cannot match the figures of a paper or a
notebook.

seaborn colormaps are ordinary matplotlib colormaps, so the effort is small:

```python
import seaborn as sns

cmap = sns.color_palette("rocket", as_cmap=True)  # a matplotlib Colormap
da.plot(cmap=cmap)
```

## User-facing behaviour

- The `cmap` input accepts `seaborn:<name>`. Everything else is unchanged:
  without a prefix the name is a matplotlib colormap, as today.
- `<name>` is anything `sns.color_palette(<name>, as_cmap=True)` accepts:
  - the seaborn colormaps `rocket`, `mako`, `flare`, `crest`, `vlag`,
    `icefire`, and their reversed `_r` variants;
  - seaborn palette strings that build a colormap, e.g.
    `seaborn:light:seagreen`, `seaborn:dark:salmon_r`,
    `seaborn:blend:#7AB,#EDA`, `seaborn:ch:s=.25,rot=-.25` (cubehelix).
    Only the **first** colon is the prefix separator: the rest is passed
    to seaborn as is.
- Tooltip / placeholder of the `cmap` input mention the prefix
  (`e.g. viridis, seaborn:rocket`).
- **seaborn not installed** (user's own interpreter): the plot fails with a
  clear message, `seaborn:rocket needs the seaborn package: pip install
seaborn` (or "use the extension's own environment"), not a traceback.
- **Unknown name** (`seaborn:rockett`): clear error naming the colormap, like
  an unknown matplotlib name.
- Plot kinds that ignore `cmap` today (line, histogram) still ignore it.

## Implementation notes

### Resolving the name (`python/sdv_backend/plotting/`)

- New helper, e.g. `plotting/colormaps.py`:
  `resolve_cmap(name: str) -> str | matplotlib.colors.Colormap`.
  - no `seaborn:` prefix → return the string unchanged (xarray / matplotlib
    resolve it, current behaviour);
  - `seaborn:` prefix → `import seaborn` **lazily** (only for this case: it
    costs import time and imports pandas), then
    `sns.color_palette(rest, as_cmap=True)`;
  - `ImportError` → the "needs the seaborn package" error;
  - `ValueError` from seaborn → the "unknown colormap" error.
- Importing seaborn does not change matplotlib's style (only `sns.set_theme()`
  does), so the matplotlib style option is not affected.
- `kwargs.py`: pass the resolved object to xarray, but keep the **string**
  (`"seaborn:rocket"`) in `applied_plot_kwargs`: that dict is returned as JSON
  (`results.CreatePlotResult`) and a `Colormap` object is not serializable.
- Facets: a single resolved colormap is shared by every facet (no change).

### Dependency

- Add `seaborn` to `ALL_REQUIREMENTS` in
  `src/python/ExtensionVirtualEnvironmentManager.ts`: it is then installed in
  the extension's uv environment and listed with the optional packages
  (`EXTENDED_PACKAGES`, checked with `find_spec`; import name = package name).
  seaborn's own dependencies (numpy, pandas, matplotlib) are already there.
- Check that existing extension environments get it: if they are not updated
  by the requirement change alone, bump `ENVIRONMENT_REVISION`. Run
  `scripts/upgrade-sandbox.sh` before release.
- Not required for the backend to run: the Python 3.10 / xarray 2024.10 gates
  are unchanged.

### Alternative: the `cmap` package

The `seaborn:rocket` naming is also the one of the
[`cmap`](https://cmap-docs.readthedocs.io/) package (pyapp-kit):
`Colormap("seaborn:rocket").to_mpl()`. It depends on numpy only and has many
other catalogues under the same `namespace:name` syntax (`cmocean:thermal`,
`crameri:batlow`, `colorcet:fire`...).

| seaborn (proposed)                                  | `cmap` package                         |
| --------------------------------------------------- | -------------------------------------- |
| What users asked for; the package they already have | One more package, less known           |
| Full seaborn palette syntax (`light:`, `ch:`, ...)  | Only the named seaborn colormaps       |
| One library                                         | cmocean, crameri, colorcet... for free |

Proposal: **seaborn for v0.14**. The prefix syntax leaves room to resolve other
namespaces with the `cmap` package later (see [Later](#later)) without
breaking `seaborn:` names.

### Extension (`src/`)

- `plotParams.ts`: `cmap` title and placeholder mention `seaborn:`.
- Optional: a `<datalist>` on the `cmap` input with common matplotlib names
  and the six seaborn colormaps (suggestions only, free text still allowed).

## Tests

- **pytest** (`python/tests/`): `resolve_cmap` with no prefix (unchanged
  string), `seaborn:rocket`, `seaborn:mako_r`, `seaborn:light:seagreen`,
  `seaborn:ch:s=.25,rot=-.25`; unknown name → clear error; seaborn missing
  (monkeypatched import) → clear error; `applied_plot_kwargs` keeps the string
  and is valid JSON; image plot with facets; line / histogram still ignore it.
  Tests that need seaborn are skipped when it is not installed.
- **Golden snapshots / non-regression gallery**: one `seaborn:rocket` case.
- **QA**: one webview QA case typing `seaborn:mako` in the `cmap` input.
- `requirements-dev.txt`: add seaborn (pinned) for the CI paranoia run.

## Docs

- `docs/PLOTTING.md`: the `seaborn:` prefix, with a link to seaborn's
  colormap / palette docs.
- `docs/documentation.json` → regenerate `README.md` (optional packages list).
- `CHANGELOG.md`, `docs/RELEASE_NOTES_0.14.0.md` (upgrade note: seaborn added
  to the extension's environment), `docs/v0.14/PR_SUMMARY_0.14.0.md`.

## Acceptance criteria

1. `seaborn:rocket` in the `cmap` input draws the plot with seaborn's rocket
   colormap; `viridis` and other matplotlib names work as before.
2. Reversed (`_r`) and palette-string colormaps (`light:`, `dark:`, `blend:`,
   `ch:`) work.
3. Without seaborn in the interpreter, or with an unknown name, the user gets a
   one-line error that says what to do.
4. seaborn is installed in the extension's own environment (new and existing
   ones) and listed with the optional packages.
5. Plots without a `seaborn:` prefix do not import seaborn.

## Later

- Other namespaces through the `cmap` package (`cmocean:`, `crameri:`,
  `colorcet:`), the same way.
- A colormap picker with previews instead of a free-text input.

## Open questions

- Should plain `rocket` (no prefix) also work? Importing seaborn registers its
  six colormaps in matplotlib, but that would import seaborn for every plot,
  and the prefix keeps it explicit.
