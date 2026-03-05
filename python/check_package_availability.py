#!/usr/bin/env python3
"""
Script to check package availability in the current Python environment.
Takes a list of package names as command line arguments and returns a JSON dict
mapping package names to boolean availability status.
"""

import contextlib
import json
import os
import sys
import traceback
from importlib.util import find_spec
from typing import Dict, List

# When SDV_DEBUG_LOG is set (e.g. on Windows), write logs to this file so the
# extension can read them even when stderr pipe is not captured.
# Holder list so we can set from __main__ without global declaration.
_LOG_FILE: list = []

# test


def _log(level: str, msg: str) -> None:
    """Print to stderr in a format the extension can forward to its logger."""
    line = f" - {level} - {msg}"
    print(line, file=sys.stderr, flush=True)
    if _LOG_FILE:
        with contextlib.suppress(OSError):
            _LOG_FILE[0].write(line + "\n")
            _LOG_FILE[0].flush()


# Force line-buffered stdout so output is visible when piped (e.g. Windows, Issue #118).
# When stdout is a pipe, Python uses full buffering by default; the parent may
# receive nothing or partial output without this.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(line_buffering=True)


def check_package_availability(package_names: List[str]) -> Dict[str, bool]:
    """
    Check if packages are available in the current Python environment.

    Args:
        package_names (list): List of package names to check

    Returns:
        dict: Dictionary mapping package names to boolean availability status
    """
    availability: Dict[str, bool] = {}
    _log(
        "DEBUG",
        f"check_package_availability called with {len(package_names)} package(s): {package_names}",
    )

    for package_name in package_names:
        try:
            _log("DEBUG", f"Checking package: '{package_name}'")
            # Check if the package can be found
            spec = find_spec(package_name)
            available = spec is not None
            availability[package_name] = available
            _log(
                "DEBUG",
                f"  find_spec('{package_name}') -> spec={spec!r}, available={available}",
            )
        except (ImportError, ModuleNotFoundError, ValueError) as e:
            # Package not available
            _log(
                "DEBUG",
                f"  Package '{package_name}' not available: {type(e).__name__}: {e}",
            )
            availability[package_name] = False

    _log("DEBUG", f"Availability result: {availability}")
    return availability


def main() -> None:
    """Main function to handle command line arguments and output results."""
    _log("INFO", "check_package_availability script started")
    _log("DEBUG", f"sys.argv: {sys.argv}")
    _log("DEBUG", f"sys.executable: {sys.executable}")
    _log("DEBUG", f"sys.version: {sys.version}")

    # Get package names from command line arguments
    package_names = sys.argv[1:]
    _log(
        "INFO", f"Package names from argv: {package_names} (count={len(package_names)})"
    )

    if not package_names:
        _log("WARNING", "No package names provided as arguments")

    # Check availability
    _log("DEBUG", "Calling check_package_availability()")
    availability = check_package_availability(package_names)
    _log("DEBUG", f"check_package_availability() returned: {availability}")

    # Output as JSON. Flush so piped stdout is visible on Windows (Issue #118).
    result_json = json.dumps(availability)
    _log("DEBUG", f"About to print JSON to stdout: {result_json}")
    print(result_json, flush=True)
    _log("INFO", "check_package_availability script finished successfully")


if __name__ == "__main__":

    def _run() -> None:
        try:
            main()
        except Exception as e:
            # Always emit valid JSON so the extension can parse and report the error.
            err_msg = f"{type(e).__name__}: {e}"
            _log("ERROR", f"Script failed: {err_msg}")
            payload = {"_error": err_msg}
            print(json.dumps(payload), flush=True)
            traceback.print_exc(file=sys.stderr)
            sys.exit(0)

    _log_path = os.environ.get("SDV_DEBUG_LOG")
    if _log_path:
        with open(_log_path, "a", encoding="utf-8") as logf:
            _LOG_FILE.append(logf)
            try:
                _run()
            finally:
                _LOG_FILE.clear()
    else:
        _run()
