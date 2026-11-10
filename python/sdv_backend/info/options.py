"""User options for the 'info' mode."""

from collections.abc import Sequence
from dataclasses import dataclass

from sdv_backend.info.display import DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN


@dataclass(frozen=True)
class InfoOptions:
    """Options for ``get_file_info`` (one field per CLI flag).

    Attributes
    ----------
    convert_bands_to_variables : bool
        Whether to convert GeoTIFF bands to variables.
    small_variable_bytes : int
        Max size in bytes for variables/coordinates to load and display values (Issue #102). If 0, disabled.
    small_value_display_max_len : int
        Max character length for displayed small values (truncation).
    order_groups_alphabetically : bool
        When True, sort flattened DataTree group paths alphabetically (Issue #140).
    show_xarray_encoding_attributes : bool
        When True, report the xarray encoding of groups, coordinates and variables.
    netcdf_engine_order : sequence of str or str, optional
        Preferred engines for ``.nc`` / ``.nc4`` / ``.netcdf`` (not NASA ``.cdf``).
    show_inherited_coordinates : bool
        When True, child DataTree groups include parent coordinates via
        ``to_dataset(inherit='all_coords')``.
    open_as_kerchunk : bool
        Open JSON/Parquet as Kerchunk virtual Zarr (experimental).
    """

    convert_bands_to_variables: bool = False
    small_variable_bytes: int = 0
    small_value_display_max_len: int = DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN
    order_groups_alphabetically: bool = True
    show_xarray_encoding_attributes: bool = True
    netcdf_engine_order: Sequence[str] | str | None = None
    show_inherited_coordinates: bool = True
    open_as_kerchunk: bool = False
