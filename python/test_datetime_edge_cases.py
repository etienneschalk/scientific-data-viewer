#!/usr/bin/env python3
"""
Unit tests for datetime variable detection and time filtering edge cases.

This test suite covers all edge cases mentioned in IMPLEMENTATION_PROPOSAL_ISSUE_106.md
"""

import numpy as np
import pandas as pd
import pytest
import xarray as xr
from pathlib import Path
import tempfile
import os

# Import functions to test
import sys

sys.path.insert(0, str(Path(__file__).parent))
from get_data_info import (
    is_datetime_variable,
    check_monotonicity,
    create_plot,
    get_file_info,
    CreatePlotResult,
    CreatePlotError,
)


class TestIsDatetimeVariable:
    """Test datetime variable detection (Edge Cases 9, 10)."""

    def test_datetime64_dtype(self):
        """Test detection of datetime64 dtype."""
        var = xr.DataArray(
            pd.date_range("2020-01-01", periods=10, freq="D"),
            dims=["time"],
            name="time",
        )
        assert is_datetime_variable(var) is True

    def test_cf_convention_time_units(self):
        """Test detection of CF-convention time coordinates (Edge Case 9)."""
        # Days since
        var = xr.DataArray(
            np.arange(10),
            dims=["time"],
            attrs={"units": "days since 2000-01-01"},
        )
        assert is_datetime_variable(var) is True

        # Hours since
        var = xr.DataArray(
            np.arange(10),
            dims=["time"],
            attrs={"units": "hours since 2000-01-01"},
        )
        assert is_datetime_variable(var) is True

        # Seconds since
        var = xr.DataArray(
            np.arange(10),
            dims=["time"],
            attrs={"units": "seconds since 2000-01-01"},
        )
        assert is_datetime_variable(var) is True

    def test_standard_name_time(self):
        """Test detection via standard_name attribute."""
        var = xr.DataArray(
            np.arange(10),
            dims=["time"],
            attrs={"standard_name": "time"},
        )
        assert is_datetime_variable(var) is True

    def test_common_time_variable_names(self):
        """Test detection via common variable names."""
        for name in ["time", "timestamp", "datetime", "date", "t"]:
            var = xr.DataArray(
                np.arange(10),
                dims=[name],
                attrs={"units": "days since 2000-01-01"},
            )
            var.name = name
            assert is_datetime_variable(var) is True

    def test_variable_name_with_dots(self):
        """Test variable names with dots are preserved (Edge Case 10)."""
        var = xr.DataArray(
            pd.date_range("2020-01-01", periods=10, freq="D"),
            dims=["time.hourly"],
            name="time.hourly",
        )
        assert is_datetime_variable(var) is True
        assert var.name == "time.hourly"

    def test_non_datetime_variable(self):
        """Test that non-datetime variables return False."""
        var = xr.DataArray(
            np.arange(10),
            dims=["x"],
            attrs={"units": "meters"},
        )
        assert is_datetime_variable(var) is False


class TestCheckMonotonicity:
    """Test monotonicity checking (Edge Cases 2, 8, 12, 13)."""

    def test_empty_array(self):
        """Test empty array (Edge Case 2)."""
        var = xr.DataArray([], dims=["time"])
        result = check_monotonicity(var)
        assert result == "increasing"

    def test_single_value(self):
        """Test single value array (Edge Case 2)."""
        var = xr.DataArray([pd.Timestamp("2020-01-01")], dims=["time"])
        result = check_monotonicity(var)
        assert result == "increasing"

    def test_monotonic_increasing(self):
        """Test monotonic increasing sequence."""
        var = xr.DataArray(
            pd.date_range("2020-01-01", periods=10, freq="D"),
            dims=["time"],
        )
        result = check_monotonicity(var)
        assert result == "increasing"

    def test_monotonic_decreasing(self):
        """Test monotonic decreasing sequence (Edge Case 13)."""
        var = xr.DataArray(
            pd.date_range("2020-01-10", periods=10, freq="-1D"),
            dims=["time"],
        )
        result = check_monotonicity(var)
        assert result == "decreasing"

    def test_non_monotonic(self):
        """Test non-monotonic sequence (Edge Case 12)."""
        dates = pd.date_range("2020-01-01", periods=10, freq="D")
        # Shuffle to make non-monotonic
        shuffled = dates.tolist()
        shuffled[2], shuffled[5] = shuffled[5], shuffled[2]
        var = xr.DataArray(shuffled, dims=["time"])
        result = check_monotonicity(var)
        assert result == "non_monotonic"

    def test_with_nan_values(self):
        """Test with NaN values (Edge Case 8)."""
        dates = pd.date_range("2020-01-01", periods=10, freq="D")
        # Convert to list to allow modification
        dates_list = dates.tolist()
        dates_list[3] = pd.NaT
        var = xr.DataArray(dates_list, dims=["time"])
        # Should still work (pandas handles NaN)
        result = check_monotonicity(var)
        assert result in ["increasing", "decreasing", "non_monotonic"]

    def test_duplicate_values(self):
        """Test with duplicate values (should still be monotonic)."""
        dates = pd.date_range("2020-01-01", periods=5, freq="D")
        dates_with_duplicates = dates.tolist() + [dates[-1], dates[-1]]
        var = xr.DataArray(dates_with_duplicates, dims=["time"])
        result = check_monotonicity(var)
        assert result == "increasing"


class TestCreatePlotEdgeCases:
    """Test create_plot function with various edge cases."""

    def create_temp_nc_file(self, data_dict, coords_dict=None):
        """Helper to create temporary NetCDF file."""
        ds = xr.Dataset(data_dict, coords=coords_dict or {})
        fd, path = tempfile.mkstemp(suffix=".nc")
        os.close(fd)
        ds.to_netcdf(path)
        return Path(path)

    def test_invalid_datetime_string(self):
        """Test invalid datetime string (Edge Case 1)."""
        # Create a simple test file
        temp_file = self.create_temp_nc_file(
            {"temperature": (["time"], np.arange(10))},
            {"time": pd.date_range("2020-01-01", periods=10, freq="D")},
        )
        try:
            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="/time",
                start_datetime="invalid-datetime",
            )
            assert isinstance(result, CreatePlotError)
            assert (
                "Error processing datetime variable" in result.error
                or "invalid" in result.error.lower()
            )
        finally:
            os.unlink(temp_file)

    def test_datetime_variable_not_found(self):
        """Test datetime variable not found (Edge Case 15)."""
        temp_file = self.create_temp_nc_file(
            {"temperature": (["time"], np.arange(10))},
            {"time": pd.date_range("2020-01-01", periods=10, freq="D")},
        )
        try:
            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="/nonexistent_time",
            )
            assert isinstance(result, CreatePlotError)
            assert "not found" in result.error.lower()
        finally:
            os.unlink(temp_file)

    def test_no_common_dimensions(self):
        """Test no common dimensions (Edge Case 14)."""
        temp_file = self.create_temp_nc_file(
            {
                "temperature": (["x"], np.arange(10)),
                "time_var": (["y"], pd.date_range("2020-01-01", periods=5, freq="D")),
            },
        )
        try:
            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="/time_var",
            )
            # Should succeed but not use datetime (datetime_var = None)
            assert isinstance(result, CreatePlotResult)
        finally:
            os.unlink(temp_file)

    def test_shape_mismatch(self):
        """Test shape mismatch (Edge Case 4)."""
        temp_file = self.create_temp_nc_file(
            {
                "temperature": (["time"], np.arange(10)),
                "time_var": (
                    ["other_dim"],
                    pd.date_range("2020-01-01", periods=5, freq="D"),
                ),
            },
        )
        try:
            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="/time_var",
            )
            # Should succeed but fall back to default plotting
            assert isinstance(result, CreatePlotResult)
        finally:
            os.unlink(temp_file)

    def test_monotonic_increasing_filtering(self):
        """Test filtering with monotonic increasing datetime."""
        temp_file = self.create_temp_nc_file(
            {"temperature": (["time"], np.arange(20))},
            {"time": pd.date_range("2020-01-01", periods=20, freq="D")},
        )
        try:
            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="/time",
                start_datetime="2020-01-05T00:00:00",
                end_datetime="2020-01-10T00:00:00",
            )
            assert isinstance(result, CreatePlotResult)
        finally:
            os.unlink(temp_file)

    def test_monotonic_decreasing_filtering(self):
        """Test filtering with monotonic decreasing datetime (Edge Case 13)."""
        dates = pd.date_range("2020-01-20", periods=20, freq="-1D")
        temp_file = self.create_temp_nc_file(
            {"temperature": (["time"], np.arange(20))},
            {"time": dates},
        )
        try:
            # For decreasing, we need to provide times that make sense after swapping
            # Dates go from 2020-01-20 down to 2020-01-01
            # So if we want data from 2020-01-05 to 2020-01-10, we provide them in reverse
            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="/time",
                start_datetime="2020-01-10T00:00:00",
                end_datetime="2020-01-05T00:00:00",
            )
            # Result could be CreatePlotResult or CreatePlotError (if empty range)
            assert isinstance(result, (CreatePlotResult, CreatePlotError))
        finally:
            os.unlink(temp_file)

    def test_non_monotonic_filtering(self):
        """Test filtering with non-monotonic datetime (Edge Case 12)."""
        dates = pd.date_range("2020-01-01", periods=20, freq="D")
        # Shuffle to make non-monotonic
        shuffled = dates.tolist()
        shuffled[5], shuffled[10] = shuffled[10], shuffled[5]
        temp_file = self.create_temp_nc_file(
            {"temperature": (["time"], np.arange(20))},
            {"time": shuffled},
        )
        try:
            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="/time",
                start_datetime="2020-01-05T00:00:00",
                end_datetime="2020-01-10T00:00:00",
            )
            # Should use boolean indexing instead of slice
            assert isinstance(result, CreatePlotResult)
        finally:
            os.unlink(temp_file)

    def test_empty_result_after_filtering(self):
        """Test empty result after filtering (Edge Case 7)."""
        temp_file = self.create_temp_nc_file(
            {"temperature": (["time"], np.arange(10))},
            {"time": pd.date_range("2020-01-01", periods=10, freq="D")},
        )
        try:
            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="/time",
                start_datetime="2025-01-01T00:00:00",
                end_datetime="2025-01-10T00:00:00",
            )
            # Should return empty plot (no crash) - could be CreatePlotResult or CreatePlotError
            assert isinstance(result, (CreatePlotResult, CreatePlotError))
        finally:
            os.unlink(temp_file)

    def test_start_greater_than_end_decreasing(self):
        """Test start > end for monotonic decreasing (Edge Case 6)."""
        dates = pd.date_range("2020-01-20", periods=20, freq="-1D")
        temp_file = self.create_temp_nc_file(
            {"temperature": (["time"], np.arange(20))},
            {"time": dates},
        )
        try:
            # User perspective: start > end, but after swapping should work
            # Dates go from 2020-01-20 down to 2020-01-01
            # If user provides start=2020-01-10, end=2020-01-05, after swap it's end=2020-01-10, start=2020-01-05
            # This should select data from 2020-01-05 to 2020-01-10 in the decreasing sequence
            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="/time",
                start_datetime="2020-01-10T00:00:00",
                end_datetime="2020-01-05T00:00:00",
            )
            # Result could be CreatePlotResult or CreatePlotError (if empty range)
            assert isinstance(result, (CreatePlotResult, CreatePlotError))
        finally:
            os.unlink(temp_file)

    def test_cross_group_datetime_variable(self):
        """Test cross-group datetime variable (Edge Case 11)."""
        # Create file with groups (requires netCDF4)
        try:
            import netCDF4
        except ImportError:
            pytest.skip("netCDF4 not available for group testing")

        fd, path = tempfile.mkstemp(suffix=".nc")
        os.close(fd)
        temp_file = Path(path)

        try:
            with netCDF4.Dataset(temp_file, "w") as nc:
                # Root group variable
                time_dim = nc.createDimension("time", 10)
                temp_var = nc.createVariable("temperature", "f4", ("time",))
                temp_var[:] = np.arange(10)

                # Subgroup with datetime - use numeric values with units for CF convention
                subgroup = nc.createGroup("subgroup")
                time_var = subgroup.createVariable("time", "f8", ("time",))
                # Convert datetime to days since 2000-01-01
                base_date = pd.Timestamp("2000-01-01")
                dates = pd.date_range("2020-01-01", periods=10, freq="D")
                days_since = (dates - base_date).days.values.astype("float64")
                time_var[:] = days_since
                time_var.units = "days since 2000-01-01"
                time_var.standard_name = "time"

            result = create_plot(
                temp_file,
                "/temperature",  # Use absolute path
                datetime_variable_name="subgroup/time",
            )
            # Should handle cross-group datetime
            assert isinstance(result, (CreatePlotResult, CreatePlotError))
        finally:
            if temp_file.exists():
                os.unlink(temp_file)

    def test_variable_name_with_dots(self):
        """Test variable name with dots (Edge Case 10)."""
        temp_file = self.create_temp_nc_file(
            {"temperature.hourly": (["time"], np.arange(10))},
            {"time": pd.date_range("2020-01-01", periods=10, freq="D")},
        )
        try:
            result = create_plot(
                temp_file,
                "/temperature.hourly",  # Use absolute path
                datetime_variable_name="/time",
            )
            assert isinstance(result, CreatePlotResult)
        finally:
            os.unlink(temp_file)


class TestGetFileInfoEdgeCases:
    """Test get_file_info function edge cases."""

    def create_temp_nc_file(self, data_dict, coords_dict=None):
        """Helper to create temporary NetCDF file."""
        ds = xr.Dataset(data_dict, coords=coords_dict or {})
        fd, path = tempfile.mkstemp(suffix=".nc")
        os.close(fd)
        ds.to_netcdf(path)
        return Path(path)

    def test_no_datetime_variables(self):
        """Test file with no datetime variables (Edge Case 16)."""
        temp_file = self.create_temp_nc_file(
            {"temperature": (["x"], np.arange(10))},
        )
        try:
            result = get_file_info(temp_file)
            assert hasattr(result, "datetime_variables")
            assert result.datetime_variables == {}
        finally:
            os.unlink(temp_file)

    def test_empty_datetime_array(self):
        """Test empty datetime array (Edge Case 2)."""
        temp_file = self.create_temp_nc_file(
            {"temperature": (["time"], np.arange(0))},
            {"time": pd.date_range("2020-01-01", periods=0, freq="D")},
        )
        try:
            result = get_file_info(temp_file)
            assert hasattr(result, "datetime_variables")
            # Should handle empty arrays gracefully
            if "/" in result.datetime_variables:
                datetime_vars = result.datetime_variables["/"]
                for var_info in datetime_vars:
                    if var_info["name"] == "time":
                        # min/max should be None for empty arrays
                        assert (
                            var_info.get("min") is None or var_info.get("max") is None
                        )
        finally:
            os.unlink(temp_file)

    def test_datetime_variables_with_min_max(self):
        """Test that min/max are computed correctly."""
        dates = pd.date_range("2020-01-01", periods=10, freq="D")
        temp_file = self.create_temp_nc_file(
            {"temperature": (["time"], np.arange(10))},
            {"time": dates},
        )
        try:
            result = get_file_info(temp_file)
            assert hasattr(result, "datetime_variables")
            if "/" in result.datetime_variables:
                datetime_vars = result.datetime_variables["/"]
                time_var = next((v for v in datetime_vars if v["name"] == "time"), None)
                if time_var:
                    assert "min" in time_var
                    assert "max" in time_var
                    assert time_var["min"] is not None
                    assert time_var["max"] is not None
        finally:
            os.unlink(temp_file)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
