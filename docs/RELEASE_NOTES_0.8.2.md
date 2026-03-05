# Scientific Data Viewer v0.8.2 Release Notes

## Fix: Python script output broken on Windows (Issue #118)

On Windows, the package availability check could fail with "Invalid response format" and "Python environment not ready," and in principle any Python script (including plotting) could return empty output. This release fixes the root cause and adds extra robustness for the package check.

### Where the issue came from

In **v0.8.0**, [PR #110](https://github.com/etienneschalk/scientific-data-viewer/pull/110) fixed [Issue #97](https://github.com/etienneschalk/scientific-data-viewer/issues/97): when a plot timed out, the backend Python process was left running as an orphan. The fix was to spawn with `detached: true` and kill the process group with `process.kill(-pid)` so both the shell and Python were terminated.

On **Windows**, Node.js does not connect a detached child’s stdout/stderr to the parent’s pipes, so the extension received **empty output** from any spawned Python script. That behavior is a known Node/Windows quirk (see e.g. [openclaw/openclaw#18739](https://github.com/openclaw/openclaw/issues/18739)). So the same change that fixed "kill on timeout" on Unix broke "read script output" on Windows.

### Why it looked like only the package check failed

The package check runs during extension startup. When it got empty stdout on Windows, the environment never became "ready," so features that depend on it (like opening a file and running `get_data_info`) were never used in that scenario. So you saw the package check fail and might have assumed only that script was affected. In fact, **any** script run with the old spawn options would have had empty stdout on Windows (including plotting); the package check was just the first one that ran.

### What we changed

We no longer use a shell or `detached` when running Python:

- The extension now spawns the **Python executable directly** (`shell: false`), so there is a single child process (Python).
- **Stdout and stderr are always captured** on all platforms, including Windows.
- On **timeout or cancel**, we kill that single child with `childProcess.kill('SIGTERM')`. There is no orphan process, so the behavior fixed in Issue #97 is preserved; we just kill the one process instead of a process group.

We also:

- Try **`python` before `python3`** on Windows in the fallback interpreter list to avoid the Windows Store stub.
- Harden the **package-check script**: line-buffered stdout and a top-level try/except that prints a JSON `{"_error": "..."}` on any exception.
- Log the **full command line** for every Python run so you can copy-paste and reproduce issues.

## CI: Extension debug logs in test output

When tests run via `npm run test` (e.g. in CI), the test runner spawns a separate VS Code process that loads the extension. By default, that child process’s `console.log` / `console.debug` output may not appear in the test log, so extension debug and info logs were hard to see in CI.

We now:

- **test/runTest.ts** passes `extensionTestsEnv: { SCIENTIFIC_DATA_VIEWER_VERBOSE_LOGS: '1' }` into the child, so the extension knows it is running under the test runner.
- **Logger** (src/common/Logger.ts), when that env var is set, writes every log line (info, debug, warn, error) to **stderr** in addition to the Output Channel and console. The test runner forwards the child’s stderr to the parent, so all extension logs appear in the same stream as the test output and are visible in the CI log.

This only applies when the test runner sets the env var; normal use is unchanged.

### Upgrading

No action required. If you were affected by "Invalid response format" or "Python environment not ready" on Windows (especially with "use extension own environment"), updating to 0.8.2 should resolve it. Plot and data-info scripts now get their output correctly on Windows as well.
