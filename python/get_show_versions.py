#!/usr/bin/env python3
"""
Script to get xarray show_versions output.
Usage: python get_show_versions.py
"""

import json
import sys
import xarray as xr
import io


def get_show_versions():
    try:
        # Capture the output of xr.show_versions() by passing a StringIO object
        output = io.StringIO()
        xr.show_versions(file=output)

        versions_text = output.getvalue()
        return {"versions": versions_text}

    except Exception as e:
        return {"error": str(e)}


def main():
    result = get_show_versions()
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
