#!/usr/bin/env python3
"""
Script to check package availability in the current Python environment.
Takes a list of package names as command line arguments and returns a JSON dict
mapping package names to boolean availability status.
"""

import json
import sys
from importlib.util import find_spec
from typing import Dict, List


def check_package_availability(package_names: List[str]) -> Dict[str, bool]:
    """
    Check if packages are available in the current Python environment.

    Args:
        package_names (list): List of package names to check

    Returns:
        dict: Dictionary mapping package names to boolean availability status
    """
    availability: Dict[str, bool] = {}

    for package_name in package_names:
        try:
            # Check if the package can be found
            spec = find_spec(package_name)
            availability[package_name] = spec is not None
        except (ImportError, ModuleNotFoundError, ValueError):
            # Package not available
            availability[package_name] = False

    return availability


def main():
    """Main function to handle command line arguments and output results."""

    # Get package names from command line arguments
    package_names = sys.argv[1:]

    # Check availability
    availability = check_package_availability(package_names)

    # Output as JSON. Flush so piped stdout is visible on Windows (Issue #118).
    # When stdout is a pipe, Windows uses full buffering; without flush the
    # parent may receive nothing or partial output.
    print(json.dumps(availability), flush=True)


if __name__ == "__main__":
    main()
