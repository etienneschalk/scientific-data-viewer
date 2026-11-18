# Pull Request: Fix uv env creation when reusing path after reinstall (Issue #115)

## Summary

When "use extension own environment" (uv) is enabled and the user has uninstalled then reinstalled the extension, the extension could fail to initialize because a previous uv virtual environment still existed at the same globalStorage path. This PR fixes that by passing `--clear` to `uv venv` so an existing environment is replaced. Closes #115.

## Problem

- User enables "use own env", extension creates uv venv at e.g. `.../globalStorage/eschalk0.scientific-data-viewer/python-environment`.
- User uninstalls the extension (globalStorage path may remain).
- User reinstalls the extension and "use own env" is still enabled.
- On first init, extension tries `uv venv --python 3.13 <path>`; uv fails with:
  `A virtual environment already exists at ... Use --clear to replace it`.
- Extension never creates the env and initialization fails.

## Solution

Add `--clear` to the `uv venv` arguments when creating the extension virtual environment. uv then replaces any existing environment at that path instead of failing.

## Changes

### Code

- **src/python/ExtensionVirtualEnvironmentManager.ts**
  - In `uvCreateVirtualEnvironment()`, add `'--clear'` to the `uv venv` spawn arguments (after `'venv'`).
  - Comment added to document that `--clear` replaces an existing env (e.g. after uninstall/reinstall).

### Documentation

- **CHANGELOG.md** – New "Fixed" entry under [0.8.1] for Issue #115 (problem, solution, file modified).

## Testing

- [ ] Install extension, enable "use own env", verify env is created and extension works.
- [ ] Uninstall extension (optionally leave globalStorage as-is or simulate by keeping the `python-environment` folder).
- [ ] Reinstall extension with "use own env" still enabled (or enable again).
- [ ] Confirm extension initializes and creates/reuses the uv env without error (no "virtual environment already exists" failure).

## Checklist

- [x] CHANGELOG updated (Fixed entry for #115 under 0.8.1)
- [ ] Manual test: uninstall → reinstall with own env
- [ ] No version bump (fix included in 0.8.1)
