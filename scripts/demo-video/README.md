# Demo video

A short video of a new user's first minute with the extension: a fresh VS Code,
**Set up Python** from the Getting Started walkthrough (the extension creates its
own uv environment), a NetCDF file opened from the Explorer, its structure
browsed, then plots made and tuned. It is filmed in a real VS Code and edited
automatically, so it can be made again for each release.

```bash
source ~/.nvm/nvm.sh && nvm use
node scripts/demo-video/record.mjs                    # film: artefacts/demo-video/recording/
uv run --no-project --with pillow --with imageio-ffmpeg \
    python scripts/demo-video/montage.py              # edit: artefacts/demo-video/scientific-data-viewer-demo.mp4
```

The output is a 1920 × 1080, 30 fps H.264 MP4, about 1 min 30 s long and 9 MB
(under GitHub's 10 MB upload limit). Everything goes to `artefacts/demo-video/`
(git-ignored).

## Requirements

- Node 22 and the npm dependencies (`@vscode/test-electron` downloads VS Code
  into `.vscode-test/`, like `npm test`).
- `uv` and network access. The filmed extension creates its environment with uv,
  and `uv run` provides Pillow and ffmpeg (`imageio-ffmpeg`) to the montage. No
  project dependency is added. By default the filmed uv starts with an empty
  cache and no Python (`UV_CACHE_DIR`, `UV_PYTHON_INSTALL_DIR` in
  `artefacts/demo-video/run/`), like on a new user's machine. It downloads
  Python 3.13 and about 40 packages, so the video shows how long a first
  install really takes (sped up, with a `×N` badge). Your own uv cache and
  Pythons are not used or changed.
- **No display.** VS Code runs offscreen (Chromium's Ozone headless platform, on
  a 1920 × 1080 virtual screen): nothing opens on your screen, and it runs
  without an X server.

## record.mjs: filming

1. Packages the working tree into `artefacts/demo-video/build/` (once; `--package`
   to package again, `--vsix <file>` to film another build).
2. Makes a fresh profile in `artefacts/demo-video/run/`: user data with clean
   settings (no Chat panel or Copilot prompt, no git prompt, Dark Modern, zoom 120 %),
   the `.vsix` installed with the VS Code CLI (the window looks like a normal
   install, not an Extension Development Host), and a `climate-data/` folder
   with a copy of the shipped sample `media/samples/sample_climate.nc`.
3. Starts VS Code with a DevTools port and plays `scenario.mjs` like a user:
   mouse moves along eased paths (hover effects included), clicks, keyboard
   shortcuts, typing, smooth scrolling in the viewer. It reaches the workbench
   and the viewer's webview (an out-of-process iframe) over the Chrome DevTools
   Protocol (`lib/director.mjs`).
4. Films the window with `Page.startScreencast` (JPEG frames, about 25 fps
   while something moves) and logs the montage cues to `events.jsonl`: cursor
   positions, clicks, shortcuts, captions, zooms, fast-forwards.

| Option             | Effect                                                                            |
| ------------------ | --------------------------------------------------------------------------------- |
| `--skip-setup`     | No Python chapter: the viewer uses the repository `.venv` (fast storyboard edits) |
| `--warm-uv-cache`  | Your uv cache and Pythons: no download, but the setup looks instant in the video  |
| `--vsix FILE`      | Extension to install                                                              |
| `--package`        | Package the working tree again (`vsce package`, rebuilds `out/`)                  |
| `--vscode-version` | VS Code to film (default `1.147.0`)                                               |
| `--limit S`        | Watchdog time limit in seconds (default 900)                                      |
| `--out DIR`        | Output folder (default `artefacts/demo-video`)                                    |

After the recording, the uv downloads and the filmed extension's environment
(about 1.4 GB) are deleted from `run/`; the profile and its logs stay.

A failed step stops the recording with exit code 1. It saves a screenshot of
that moment (`recording/failure.png`) and keeps the VS Code log
(`run/vscode.log`, `run/userdata/logs/`). A watchdog in its own process
(`lib/watchdog.mjs`) kills every process started from the run folder. It does so
when the recorder exits, even if it is killed, and when the recording runs
past `--limit`, so no VS Code is left running.

## montage.py: editing

From the frames and cues it renders:

- a **title card** (icon, name, formats, version), with a crossfade into the footage;
- the **mouse cursor**, **click ripples** and **shortcut key caps**, drawn from the
  logged positions. The screencast has no OS cursor, so the cursor is drawn at a
  constant size even when zoomed;
- **captions**: a numbered lower third per chapter;
- **zooms**: eased camera moves onto the region a step is about, 16:9, at most
  2×, with room left for the caption;
- **fast-forwards**: the uv environment creation (a first install: downloads)
  is sped up to about 5 s, with a `×N` badge;
- an **end card** (Marketplace / Open VSX, `ext install`, GitHub), then a fade to black.

| Option            | Effect                                                                             |
| ----------------- | ---------------------------------------------------------------------------------- |
| `--sheet`         | Contact sheet (one frame every 2 s) instead of the video                           |
| `--stills T…`     | Full-size frames at these output times (s) instead of the video                    |
| `--scale 0.5`     | Smaller, faster render (preview)                                                   |
| `--crf N`         | H.264 quality (default 26, about 9 MB; 18: a master of about 18 MB)                |
| `--gif`           | Also an animated GIF (800 px, 10 fps) next to the MP4 (whole video: 15 MB or more) |
| `--gif-range A B` | GIF of the video from A to B seconds only (20 s: about 4 MB)                       |
| `--fps`           | Frame rate (default 30)                                                            |

## Changing the storyboard

`scenario.mjs` is the storyboard. Locators are `main(css, { text | exact })`
(workbench) and `viewer(css, …)` (viewer page). Text is matched with whitespace
collapsed, and only elements with a size count, so content of closed
`<details>` is skipped. Cues for the montage:

```js
d.caption('Plot a variable in one click', {
  step: 4,
  sub: 'optional second line',
});
await d.zoom(viewer('.plot-image-container img'), { padding: 10 }); // ... d.zoom(null)
d.speed('fit', 'uv at work');
/* wait */ d.speed(1); // or a number: ×8
d.cut();
/* … */ d.uncut(); // drop footage
```

Iterate with `record.mjs --skip-setup` (about 1 minute), then
`montage.py --sheet`. Make the full recording, with the Python chapter, last.

## Publishing the video

- **GitHub** (README, release notes, discussions): drag the MP4 into the editor.
  GitHub uploads it and embeds a player. The limit is 10 MB on the free plan,
  and the default CRF 26 keeps the video under it.
- **VS Code Marketplace / Open VSX**: their README pages show images but no
  video. Link to the video, or embed a highlight GIF (`--gif-range`, from the
  contact sheet's times).
