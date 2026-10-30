# Upgrade test plan — v0.12 → v0.13

Users don't install v0.13 fresh: the Marketplace updates their v0.12 in place, with their settings, their Python and, for some of them, the extension's own uv environment. This plan checks that the update does not leave anyone stuck. If someone does get stuck anyway, the [support playbook](#if-users-get-stuck-after-the-release) below says how to help them.

Back to the hub: [GETTING_STARTED.md](./GETTING_STARTED.md).

---

## Who is affected, and how

| User profile                                             | What v0.13 does at the first start                                                                                                                                                                                                                            | What could go wrong                                                                                                                                                                            | Covered by                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Own uv environment** (`useExtensionOwnEnvironment` on) | Deletes the environment and builds it again from scratch (progress notification, network needed, seconds with a warm uv cache, a few minutes when packages must be downloaded). The old one is kept in `python-environment.previous` until the new one works. | Offline or uv missing: the rebuild fails. VS Code is closed during the rebuild. On Windows, a file of the old environment is locked.                                                           | Unit tests, `upgrade-sandbox.sh` (`normal`, `offline`, `interrupted`), manual B19 / B20   |
| **Python extension's interpreter** (default)             | Nothing is installed or changed. The backend runs with the user's packages.                                                                                                                                                                                   | xarray too old for the new backend. zarr 2 cannot read Zarr v3 stores.                                                                                                                         | [Compatibility check](#compatibility-of-the-backend-with-older-python-stacks), manual B23 |
| **`overridePythonInterpreter`**                          | Same as above.                                                                                                                                                                                                                                                | Same as above.                                                                                                                                                                                 | Same as above                                                                             |
| **Own environment enabled, but uv not installed**        | Falls back to the Python extension's interpreter, as in v0.12. **New:** an error at startup says why, with an _Install uv_ button (v0.12 fell back silently).                                                                                                 | The message could be shown at every start until uv is installed or the setting turned off. That is intended.                                                                                   | Manual B19 (uv hidden)                                                                    |
| **Windows / macOS**                                      | Same as above.                                                                                                                                                                                                                                                | Windows: renaming the environment folder fails if a file is locked (antivirus, a leftover process). The rebuild is then skipped, the old environment kept, and the rebuild retried next start. | Manual B20 on a Windows machine (the script is Linux / macOS only)                        |

The extension never modifies an interpreter it does not own (Python extension or override).

---

## 1. Automated: `scripts/upgrade-sandbox.sh`

The script plays a real user update in a **throw-away VS Code profile**, from any release to any other. Your own VS Code settings, extensions and environment are not touched. Each step:

1. **The user runs the old release** (`artefacts/vsix-releases/scientific-data-viewer-0.12.1.vsix` by default, rebuilt from its tag by `scripts/release-vsix.sh 0.12.1`) with `useExtensionOwnEnvironment` on and a few settings of their own (plot style, bands, file size limit, and `globalTimeControls`, removed in 0.13). They open a NetCDF file; the script waits until the release has created its uv environment, then drops a marker file into it.
2. **VS Code updates the extension to the new release** on the same profile (same extension id, so the same storage folder) and the user opens the file again. Whether the environment must be rebuilt is worked out from what is on disk and from the new release, by the rule of `getUpdateReason`: no state file (every release before 0.13), a lower `ENVIRONMENT_REVISION`, or other requirements → **rebuild**; same revision and requirements, or a higher revision (downgrade) → **keep**. The script prints the expectation and why.
3. **What the user gets**:
   - **rebuild**: the marker is gone (the environment was deleted, not patched), the state file has the new revision, no `python-environment.previous` folder is left, the log shows the rebuild;
   - **keep**: the marker and the state file are untouched, nothing in the log says _Recreating_;
   - **always**: the viewer shows the file (`load complete` in the log), with the extension's own environment; every requirement and constraint of the new release is installed (`xarray>=2026.4.0` … `eccodeslib<2.48`); the user's `settings.json` is byte for byte the same; the backend of the new release opens `sample_data.nc`, `.grib`, `_cog.tif` and `.cdf`.

`--bump-new` raises `ENVIRONMENT_REVISION` of the new release by one, as the next release that needs a rebuild would do: with `--old` = `--new`, it tests the revision counter itself. `--expect rebuild|keep` fails when the rule says otherwise. Exit code 3 means the old release could not create its environment on this machine (nothing to migrate, not tested).

`./paranoia.sh --full` runs it as the **`migration`** step for every case below (the last patch of each older minor release found in the repository root, `PARANOIA_MIGRATION_FROM="0.11.2 0.12.1"` to choose), and the `offline` / `interrupted` scenarios as the **`upgrade`** step.

| Case           | Command                                                           | Must                                                                         |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Older releases | `--old artefacts/vsix-releases/scientific-data-viewer-<old>.vsix` | What the rule says (every release before 0.13: rebuild, no state file)       |
| Same release   | `--old <new>.vsix --new <new>.vsix --expect keep`                 | Keep: a release that does not bump the revision leaves the environment alone |
| Next revision  | `--old <new>.vsix --new <new>.vsix --bump-new --expect rebuild`   | Rebuild: a release that bumps the revision rebuilds it                       |

Each `.vsix` is unpacked and loaded as a development extension. Recent VS Code builds don't load extensions installed from the command line into a custom extensions folder, but the storage folder and environment are the same as with a Marketplace update.

### Run it

```bash
nvm use
npm run package                              # builds artefacts/vsix-releases/scientific-data-viewer-0.13.0.vsix
scripts/release-vsix.sh 0.12.1               # rebuilds artefacts/vsix-releases/scientific-data-viewer-0.12.1.vsix from its tag
python python/create_sample_data.py          # if artefacts/sample-data/ is missing
scripts/upgrade-sandbox.sh                   # scenario "normal"
scripts/upgrade-sandbox.sh --scenario offline
scripts/upgrade-sandbox.sh --scenario interrupted
scripts/upgrade-sandbox.sh --keep-open       # leaves v0.13 open at the end, to look around
scripts/upgrade-sandbox.sh --old artefacts/vsix-releases/scientific-data-viewer-0.13.0.vsix --bump-new --expect rebuild   # the revision counter
```

- **Needs:** uv, `unzip`, a display, and VS Code. By default the script uses the newest build that `npm test` downloaded into `.vscode-test/`. A snap-installed `code` did not load the sandbox extension; use `--code <path>` to choose another build.
- **Windows:** VS Code windows open on your screen during the run. Don't close them; the script closes them.
- **From a VS Code terminal:** the script clears the `VSCODE_*` / `ELECTRON_*` variables it inherits, otherwise the sandbox would talk to your own VS Code.
- **Other starting versions:** `scripts/release-vsix.sh <version>` rebuilds a release from its git tag into `artefacts/vsix-releases/` (git-ignored), or downloads it from Open VSX if the build fails; then `--old artefacts/vsix-releases/scientific-data-viewer-<version>.vsix`. `paranoia.sh` does it for the releases from 0.12.1 on.

### Scenarios

| Scenario      | What it simulates                                                                                                  | Expected                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normal`      | Plain update.                                                                                                      | Environment rebuilt, all checks pass.                                                                                                                     |
| `offline`     | First start of v0.13 with no package index (`UV_NO_CACHE=1`, unreachable `UV_DEFAULT_INDEX`), then a normal start. | The first start logs `recreation failed`: old environment back in place (marker present), no backup left, no state file. The second start rebuilds it.    |
| `interrupted` | VS Code killed (`kill -9`) while the new environment is being installed, then a normal start.                      | During the kill, the old environment sits in `python-environment.previous`. The next start logs `recreation was interrupted`, restores it, then rebuilds. |

### Results (2026-10-29, Linux, VS Code 1.144, uv 0.10.2)

| Scenario      | From → to       | Result                                                                                                                                                                       |
| ------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normal`      | 0.12.1 → 0.13.0 | ✅ 11/11 checks: environment rebuilt with `eccodeslib 2.47.3.23`; NetCDF, GRIB, COG and CDF open. With a warm uv cache the package install itself takes well under a second. |
| `offline`     | 0.12.1 → 0.13.0 | ✅ 3/3 checks after the failed rebuild (old environment back, no backup folder, no state file), then 11/11 after the next start.                                             |
| `interrupted` | 0.12.1 → 0.13.0 | ✅ old environment found in `python-environment.previous` after the kill; the next start restored it and rebuilt (11/11).                                                    |

### Migration results (2026-10-30, Linux, VS Code 1.144, uv 0.10.2, `paranoia.sh` step `migration`)

| From → 0.13.0                                             | Expected (worked out)                       | Result                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 0.5.0, 0.6.0, 0.7.0, 0.8.2, 0.9.0, 0.10.1, 0.11.2, 0.12.1 | rebuild: no state file                      | ✅ each: environment deleted and recreated (revision 2), file shown with it, settings unchanged, 4 samples open |
| 0.13.0 (same release)                                     | keep: same revision 2 and same requirements | ✅ environment and state file untouched, _up to date_ in the log, file shown, settings unchanged                |
| 0.13.0 with `ENVIRONMENT_REVISION` raised to 3            | rebuild: revision 2 < 3                     | ✅ deleted and recreated at revision 3                                                                          |

129 checks, 14 minutes. The test can fail: a package whose `getUpdateReason` always returns `null` (never rebuilds), with the revision raised, fails 3 checks within seconds (environment not deleted, no new state file, no rebuild in the log).

---

## 2. By hand, like a user

The script checks files and logs, not what the user sees, and it does not run on Windows. On at least one Windows or macOS machine, follow:

- **[Manual test plan B19](./MANUAL_TEST_PLAN_0.13.0.md#b19-the-extensions-own-python-environment-rebuilds-itself)**: rebuild notification; nothing left from the old environment; failed rebuild keeps the old environment; **Recreate** action.
- **[Manual test plan B20](./MANUAL_TEST_PLAN_0.13.0.md#b20-optional-recommended-real-upgrade-from-v012-like-a-user)**: install 0.12.1 from the Marketplace (**Install Specific Version…**), let it create its environment, then install the 0.13.0 `.vsix`.

What to look at on screen:

1. Exactly **one** progress notification (_"rebuilding its Python environment for this new version…"_), then _"Python environment rebuilt"_.
2. A file opened **during** the rebuild waits, then loads. It must not show an error.
3. The next reload shows **no** notification.
4. Windows: no `python-environment.previous` folder is left in `%APPDATA%\Code\User\globalStorage\eschalk0.scientific-data-viewer\`.

---

## Compatibility of the backend with older Python stacks

Users of the Python extension's interpreter keep their own packages after the update. The v0.12.1 and v0.13.0 backends were run on the same sample files:

| Interpreter                                  | v0.12.1                                                          | v0.13.0                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Python 3.10, xarray 2024.6, zarr 2           | ❌ crash: `module 'xarray' has no attribute 'DataTree'`          | ❌ by design, with a clear message: _"xarray 2024.6.0 is too old… pip install -U "xarray>=2026.4.0" "zarr>=3""_ |
| Python 3.12, xarray 2025.1, zarr 2           | NetCDF ✅, HDF5 ✅, plot ✅; Zarr v3 stores: `FileNotFoundError` | NetCDF ✅, HDF5 ✅, plot ✅; Zarr v3 stores: _"Missing dependencies for Zarr v3 files: zarr>=3"_                |
| Python 3.13, xarray 2026.4+, zarr 3 (uv env) | ✅                                                               | ✅                                                                                                              |

The backend source also byte-compiles with Python 3.10 and 3.12, and uses no standard-library API newer than 3.10. **Nothing that worked with v0.12.1 stops working with v0.13.0** on these stacks.

To repeat the check:

```bash
uv venv /tmp/midstack --python 3.12
uv pip install --python /tmp/midstack/bin/python "xarray==2025.1.2" netCDF4 matplotlib "zarr<3" h5netcdf h5py scipy
/tmp/midstack/bin/python python/get_data_info.py info artefacts/sample-data/sample_data.nc | tail -1
unzip -p artefacts/vsix-releases/scientific-data-viewer-0.12.1.vsix extension/python/get_data_info.py > /tmp/get_data_info_v012.py
/tmp/midstack/bin/python /tmp/get_data_info_v012.py info artefacts/sample-data/sample_data.nc | tail -1
```

---

## If users get stuck after the release

### Signals to watch in the first days

- GitHub issues mentioning _"environment"_, _"uv"_, _"after update"_, _"free(): invalid pointer"_, _"too old"_.
- Marketplace reviews and Q&A.

### First reply (copy, adapt)

> Thanks for the report, and sorry for the trouble. v0.13 rebuilds the extension's Python environment at the first start, which needs network access. Could you try, in order:
>
> 1. Command Palette → **Scientific Data Viewer: Manage Extension Virtual Environment** → **Recreate**, then reopen the file.
> 2. If it still fails: turn off **Scientific Data Viewer › Python: Use Extension Own Environment**, so the Python extension's interpreter is used. Or, to keep working while we look at it: Extensions view → gear of Scientific Data Viewer → **Install Specific Version…** → **0.12.1**.
>
> To help us fix it, please attach the output of **Scientific Data Viewer: Show Extension Logs** (the lines starting with `[uv]` matter most), the report of **Scientific Data Viewer: Run Healthcheck**, your OS, and your `uv --version`.

The same steps are in the README under **Troubleshooting → The extension stopped working after an update**, generated from `docs/documentation.json`.

### What to look for in their logs

| Log line                                                                    | Meaning                                                                    | Fix                                                                                    |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Extension virtual environment recreation failed, keeping the previous one` | Offline / index unreachable / uv error. The old environment is in use.     | Retry when online. Check the `uv` error above the line (proxy, certificates).          |
| `recreation failed and the previous one is not usable`                      | Neither environment works. The extension fell back to another interpreter. | **Recreate** when online, or turn the setting off.                                     |
| `uv is not available`                                                       | uv is not on `PATH` for VS Code.                                           | Install uv, restart VS Code (PATH is read at start).                                   |
| `Could not restore the previous environment from …previous`                 | Rename failed (Windows lock).                                              | Close VS Code, delete `python-environment` and `python-environment.previous`, restart. |
| `xarray … is too old`                                                       | The user's own interpreter.                                                | The message contains the `pip install` command.                                        |
| `exit code 134`, `free(): invalid pointer`                                  | eccodeslib ≥ 2.48 together with pyproj, in an interpreter we do not own.   | `pip install "eccodeslib<2.48"`.                                                       |

### If a fix release is needed

1. Fix on a branch from the release tag, bump to **0.13.1** (CHANGELOG, `docs/RELEASE_NOTES_0.13.1.md`).
2. If the fix changes the uv environment: change `ALL_REQUIREMENTS` / `ENVIRONMENT_CONSTRAINTS` and bump `ENVIRONMENT_REVISION` to 3, with a line in its history comment. Users then get a rebuild at their next start.
3. Run `scripts/upgrade-sandbox.sh --old artefacts/vsix-releases/scientific-data-viewer-0.12.1.vsix` **and** `--old artefacts/vsix-releases/scientific-data-viewer-0.13.0.vsix` (`scripts/release-vsix.sh` rebuilds them), in all three scenarios.
4. Publish (see [PUBLISHING.md](../PUBLISHING.md)).

A published version cannot be taken back from users who already updated. The fastest way out is a fixed version, plus **Install Specific Version…** in the meantime.
