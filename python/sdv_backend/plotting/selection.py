"""Selecting the data to plot: open file, find variable, slice and time-filter."""

import re
from dataclasses import dataclass
from pathlib import PurePosixPath

import pandas as pd
import xarray as xr
from xarray.coding.times import contains_cftime_datetimes

from sdv_backend._bootstrap import logger
from sdv_backend.info.datatree import datatree_inherit_mode
from sdv_backend.info.variables import check_monotonicity
from sdv_backend.opening import OpenedData
from sdv_backend.plotting.options import PlotOptions, parse_dimension_slices


class PlotInputError(Exception):
    """Expected, user-facing failure; the message becomes ``CreatePlotError.error``."""


def split_variable_path(variable_path: str) -> tuple[PurePosixPath, str]:
    """'/group/var.name' -> (PurePosixPath('/group'), 'var.name').

    Uses ``.name`` instead of ``.stem`` to preserve dots in variable names.
    A bare name ('time') has the parent '.'; see ``_resolve_datetime_group``.
    """
    path = PurePosixPath(variable_path)
    return path.parent, path.name


def get_variable(group: xr.Dataset, variable_name: str) -> xr.DataArray:
    if variable_name in group.data_vars or variable_name in group.coords:
        return group[variable_name]
    logger.error(f"Variable '{variable_name}' not found in dataset")
    raise PlotInputError(f"Variable '{variable_name}' not found in dataset")


def apply_dimension_slices(
    var: xr.DataArray, dimension_slices: dict[str, str | int] | None
) -> tuple[xr.DataArray, dict[str, int | slice]]:
    """Apply user ``isel`` slices (Issue #117) on the dimensions ``var`` has."""
    applied_isel: dict[str, int | slice] = {}
    if not dimension_slices:
        return var, applied_isel
    try:
        isel_dict = parse_dimension_slices(dimension_slices)
        if isel_dict:
            # Only apply isel for dimensions that exist on this variable
            var_dims = set(var.dims)
            isel_subset = {d: v for d, v in isel_dict.items() if d in var_dims}
            if isel_subset:
                var = var.isel(isel_subset)
                applied_isel = dict(isel_subset)
                logger.info(f"Applied dimension slices: {applied_isel}")
    except ValueError as e:
        logger.warning(f"Dimension slice parse error: {e}")
        raise PlotInputError(f"Invalid dimension slice: {e}") from e
    except Exception as e:
        logger.exception("Dimension slice (isel) failed")
        raise PlotInputError(f"Dimension slice error: {type(e).__name__}: {e}") from e
    return var, applied_isel


@dataclass
class DatetimeSelection:
    """Result of the optional datetime filtering step."""

    var: xr.DataArray
    datetime_var: xr.DataArray | None = None
    datetime_var_name: str | None = None

    def is_used(self) -> bool:
        """Whether the datetime variable relates to the plotted variable."""
        if self.datetime_var is None or self.datetime_var_name is None:
            return False
        return (
            self.datetime_var_name in self.var.dims
            or self.datetime_var_name in self.var.coords
            or bool(set(self.var.dims) & set(self.datetime_var.dims))
        )


def _time_range_mask(datetime_var: xr.DataArray, start_ts, end_ts):
    mask = None
    if start_ts is not None:
        mask = datetime_var >= start_ts
    if end_ts is not None:
        before_end = datetime_var <= end_ts
        mask = before_end if mask is None else mask & before_end
    # cftime (object) comparisons give object arrays; isel needs booleans
    return None if mask is None else mask.astype(bool)


def _filter_with_mask(
    var: xr.DataArray,
    datetime_var: xr.DataArray,
    start_ts,
    end_ts,
    no_common_dim_warning: str,
) -> tuple[xr.DataArray, xr.DataArray | None]:
    """Boolean-index ``var`` along the first dimension it shares with ``datetime_var``."""
    common_dims = set(var.dims) & set(datetime_var.dims)
    if not common_dims:
        # No common dimensions - cannot use this datetime variable for plotting
        logger.warning(no_common_dim_warning)
        return var, None
    dim_name = next(iter(common_dims))
    mask = _time_range_mask(datetime_var, start_ts, end_ts)
    if mask is not None:
        var = var.isel({dim_name: mask})
        datetime_var = datetime_var.isel({dim_name: mask})
    return var, datetime_var


def _resolve_datetime_group(
    datetime_group_name: PurePosixPath,
    datetime_var_name: str,
    group: xr.Dataset,
    group_name: PurePosixPath,
    opened: OpenedData,
    options: PlotOptions,
) -> xr.Dataset:
    """Dataset holding the datetime variable.

    The webview sends root-group variables as a bare name ('time', parent
    '.'). Its global time selector lists each name once, so a bare name is
    looked up in the plotted variable's group first (which has its own
    'time', or inherits the root one), then in the root group.
    """
    if str(datetime_group_name) == ".":
        if datetime_var_name in group.variables:
            return group
        datetime_group_name = PurePosixPath("/")
    if datetime_group_name == group_name:
        return group
    return opened.group(
        datetime_group_name,
        datatree_inherit_mode(options.show_inherited_coordinates),
    )


# YYYY-MM-DD[THH:MM[:SS[.ffffff]]]: parsed by hand because datetime rejects
# dates that only exist in some calendars (e.g. 2000-02-30 in 360_day)
_ISO_DATETIME_RE = re.compile(
    r"^\s*(\d{1,4})-(\d{1,2})-(\d{1,2})"
    r"(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?Z?\s*$"
)


def _parse_bound(text: str | None, datetime_var: xr.DataArray, label: str):
    """Parse a start/end bound comparable with ``datetime_var``'s values.

    ``pd.Timestamp`` for ``datetime64``; a cftime date in the variable's
    calendar for cftime variables (pandas cannot compare with those, and its
    Timestamps stop at year 1677).
    """
    if not text:
        return None
    if not contains_cftime_datetimes(datetime_var.variable):
        return pd.Timestamp(text)
    import cftime

    calendar = datetime_var.dt.calendar
    match = _ISO_DATETIME_RE.match(text)
    if match is None:
        raise PlotInputError(
            f"Invalid {label} datetime {text!r}: expected YYYY-MM-DD[THH:MM[:SS]]"
        )
    year, month, day, hour, minute, second, fraction = match.groups()
    try:
        return cftime.datetime(
            int(year),
            int(month),
            int(day),
            int(hour or 0),
            int(minute or 0),
            int(second or 0),
            int((fraction or "0").ljust(6, "0")),
            calendar=calendar,
        )
    except ValueError as exc:
        raise PlotInputError(
            f"Invalid {label} datetime {text!r} for the '{calendar}' calendar of "
            f"'{datetime_var.name}': {exc}"
        ) from exc


def apply_datetime_filter(
    var: xr.DataArray,
    variable_name: str,
    group: xr.Dataset,
    group_name: PurePosixPath,
    opened: OpenedData,
    options: PlotOptions,
) -> DatetimeSelection:
    """Restrict ``var`` to [start_datetime, end_datetime] of a datetime variable.

    The datetime variable may live in another group. When it is a dimension
    coordinate of ``var``, ``.sel()`` is used (with start/end swapped when
    decreasing); otherwise, or for non-monotonic coordinates, boolean indexing
    on a shared dimension. Variables without such a dimension (e.g. static
    fields) are plotted unfiltered.
    """
    if not options.datetime_variable_name:
        return DatetimeSelection(var=var)
    try:
        # Handle datetime variable path (may include group path like "/time" or "group/time")
        datetime_group_name, datetime_var_name = split_variable_path(
            options.datetime_variable_name
        )
        datetime_group = _resolve_datetime_group(
            datetime_group_name, datetime_var_name, group, group_name, opened, options
        )

        if (
            datetime_var_name not in datetime_group.coords
            and datetime_var_name not in datetime_group.data_vars
        ):
            logger.error(
                f"Datetime variable '{datetime_var_name}' not found in dataset"
            )
            raise PlotInputError(
                f"Datetime variable '{datetime_var_name}' not found in dataset"
            )

        datetime_var: xr.DataArray | None = datetime_group[datetime_var_name]
        assert datetime_var is not None
        start_ts = _parse_bound(options.start_datetime, datetime_var, "start")
        end_ts = _parse_bound(options.end_datetime, datetime_var, "end")

        if datetime_var_name in var.dims and datetime_var_name in var.indexes:
            monotonicity = check_monotonicity(datetime_var)
            if monotonicity == "non_monotonic":
                logger.info(
                    f"Datetime variable '{datetime_var_name}' is not monotonic. "
                    f"Using boolean indexing instead of .sel() with slice."
                )
                var, datetime_var = _filter_with_mask(
                    var,
                    datetime_var,
                    start_ts,
                    end_ts,
                    f"Datetime variable '{datetime_var_name}' does not share any dimensions "
                    f"with variable '{variable_name}'. Cannot use for plotting.",
                )
            else:
                if monotonicity == "decreasing":
                    logger.info(
                        f"Datetime variable '{datetime_var_name}' is monotonic decreasing. "
                        f"Swapping start and end times for slice."
                    )
                    time_slice = slice(end_ts, start_ts)
                else:
                    time_slice = slice(start_ts, end_ts)
                var = var.sel({datetime_var_name: time_slice})
                datetime_var = datetime_var.sel({datetime_var_name: time_slice})
        else:
            # Data variable, non-index coordinate or coordinate from another
            # group: boolean indexing on a shared dimension, if any
            var, datetime_var = _filter_with_mask(
                var,
                datetime_var,
                start_ts,
                end_ts,
                f"Datetime variable '{datetime_var_name}' does not share any dimensions "
                f"with variable '{variable_name}'; plotting it without time filtering. "
                f"Variable dimensions: {var.dims}, datetime dimensions: {datetime_var.dims}",
            )
    except PlotInputError:
        raise
    except Exception as exc:
        logger.error(f"Error processing datetime variable: {exc!r}")
        raise PlotInputError(f"Error processing datetime variable: {exc!r}") from exc

    return DatetimeSelection(
        var=var, datetime_var=datetime_var, datetime_var_name=datetime_var_name
    )


def ensure_not_empty(var: xr.DataArray, options: PlotOptions) -> None:
    """Fail clearly when slicing/time filtering left no values to plot.

    Without this, xarray fails deep inside plotting (e.g. ZeroDivisionError
    while laying out an empty facet grid).
    """
    empty_dims = [str(d) for d, n in var.sizes.items() if n == 0]
    if not empty_dims:
        return
    causes = []
    if options.datetime_variable_name and (
        options.start_datetime or options.end_datetime
    ):
        causes.append(
            f"time range [{options.start_datetime or '…'}, "
            f"{options.end_datetime or '…'}] on '{options.datetime_variable_name}'"
        )
    if options.dimension_slices:
        causes.append(f"dimension slices {options.dimension_slices}")
    hint = f" Check the {' and '.join(causes)}." if causes else ""
    raise PlotInputError(
        f"No data to plot: dimension(s) {', '.join(empty_dims)} are empty after "
        f"selection.{hint}"
    )
