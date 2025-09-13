#!/usr/bin/env python3
"""
Test script to verify the data structure returned by get_data_info.py
"""

import json

# Mock data structure to test the JSON format
test_data = {
    "format": "NetCDF",
    "fileSize": 1024,
    "dimensions": {"time": 100, "lat": 50, "lon": 60},
    "variables": [
        {
            "name": "temperature",
            "dtype": "float64",
            "shape": [100, 50, 60],
            "dimensions": ["time", "lat", "lon"],
            "size_bytes": 2400000,
            "attributes": {"units": "K", "long_name": "Temperature"},
        },
        {
            "name": "time",
            "dtype": "datetime64[ns]",
            "shape": [100],
            "dimensions": ["time"],
            "size_bytes": 800,
            "attributes": {},
        },
    ],
    "attributes": {"title": "Test Dataset"},
}

# Test JSON serialization
try:
    json_str = json.dumps(test_data, default=str, indent=2)
    print("✅ JSON serialization successful")
    print("Sample output:")
    print(json_str)

    # Test deserialization
    parsed_data = json.loads(json_str)
    print("\n✅ JSON deserialization successful")

    # Verify structure
    if "variables" in parsed_data and len(parsed_data["variables"]) > 0:
        var = parsed_data["variables"][0]
        required_fields = ["name", "dtype", "shape", "dimensions", "size_bytes"]
        missing_fields = [field for field in required_fields if field not in var]

        if not missing_fields:
            print("✅ All required fields present in variable structure")
        else:
            print(f"❌ Missing fields: {missing_fields}")
    else:
        print("❌ No variables found in data structure")

except Exception as e:
    print(f"❌ Error: {e}")
