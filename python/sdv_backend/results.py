"""Result and error dataclasses serialized to JSON for the extension."""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class FileFormatInfo:
    """Information about a supported file format.

    Attributes
    ----------
    extension : str
        File extension (e.g., '.nc', '.zarr')
    display_name : str
        Human-readable format name (e.g., 'NetCDF', 'Zarr')
    available_engines : List[str]
        List of xarray engines that can read this format
    missing_packages : List[str]
        List of required packages that are not installed
    """

    extension: str
    display_name: str
    available_engines: list[str]
    missing_packages: list[str]

    @property
    def is_supported(self) -> bool:
        """Check if the format is supported by any available engine.

        Returns
        -------
        bool
            True if at least one engine is available, False otherwise
        """
        return len(self.available_engines) > 0


@dataclass(frozen=True)
class VariableInfo:
    """Information about a data variable.

    Attributes
    ----------
    name : str
        Variable name
    dtype : str
        Data type (e.g., 'float64', 'int32')
    shape : List[int]
        Shape of the variable array
    dimensions : List[str]
        Names of the dimensions
    size_bytes : int
        Memory size in bytes
    attributes : Dict[str, Any]
        Variable attributes/metadata
    encoding : Dict[str, Any]
        xarray encoding (dtype, _FillValue, chunks, codecs...); empty when
        showXarrayEncodingAttributes is off
    display_value : Optional[str], optional
        Loaded value(s) as string when size_bytes <= small_variable_bytes (Issue #102; configurable, 0 = disabled).
    """

    name: str
    dtype: str
    shape: list[int]
    dimensions: list[str]
    size_bytes: int
    attributes: dict[str, Any]
    encoding: dict[str, Any] = field(default_factory=dict)
    display_value: str | None = None


@dataclass(frozen=True)
class CoordinateInfo:
    """Information about a coordinate variable.

    Attributes
    ----------
    name : str
        Coordinate name
    dtype : str
        Data type (e.g., 'float64', 'datetime64[ns]')
    shape : List[int]
        Shape of the coordinate array
    dimensions : List[str]
        Names of the dimensions
    size_bytes : int
        Memory size in bytes
    attributes : Dict[str, Any]
        Coordinate attributes/metadata
    encoding : Dict[str, Any]
        xarray encoding (dtype, _FillValue, chunks, codecs...); empty when
        showXarrayEncodingAttributes is off
    display_value : Optional[str], optional
        Loaded value(s) as string when size_bytes <= small_variable_bytes (Issue #102; configurable, 0 = disabled).
    """

    name: str
    dtype: str
    shape: list[int]
    dimensions: list[str]
    size_bytes: int
    attributes: dict[str, Any]
    encoding: dict[str, Any] = field(default_factory=dict)
    display_value: str | None = None


@dataclass(frozen=True)
class FileInfoResult:
    """Complete information about a data file.

    Attributes
    ----------
    format_info : FileFormatInfo
        Detailed format information
    used_engine : str
        xarray engine used to read the file
    decode_cf_degraded : bool
        True when the file was opened with decode_cf=False after a CF time decode failure
    fileSize : int
        File size in bytes
    xarray_html_repr : str
        HTML representation of the dataset
    xarray_text_repr : str
        Text representation of the dataset
    xarray_show_versions : str
        Version information for all packages
    dimensions_flattened : Dict[str, Dict[str, int]]
        Dimensions for each group (for DataTree support)
    variables_flattened : Dict[str, List[VariableInfo]]
        Variables for each group (for DataTree support)
    coordinates_flattened : Dict[str, List[CoordinateInfo]]
        Coordinates for each group (for DataTree support)
    attributes_flattened : Dict[str, Dict[str, Any]]
        Attributes for each group (for DataTree support)
    encoding_flattened : Dict[str, Dict[str, Any]]
        xarray encoding for each group (absent when showXarrayEncodingAttributes is off)
    xarray_html_repr_flattened : Dict[str, str]
        HTML representation for each group
    xarray_text_repr_flattened : Dict[str, str]
        Text representation for each group
    """

    format_info: FileFormatInfo
    used_engine: str
    fileSize: int
    xarray_html_repr: str = field(repr=False)
    xarray_text_repr: str = field(repr=False)
    xarray_show_versions: str
    # For flattented datatrees
    dimensions_flattened: dict[str, dict[str, int]]
    variables_flattened: dict[str, list[VariableInfo]]
    coordinates_flattened: dict[str, list[CoordinateInfo]]
    attributes_flattened: dict[str, dict[str, Any]]
    xarray_html_repr_flattened: dict[str, str] = field(repr=False)
    xarray_text_repr_flattened: dict[str, str] = field(repr=False)
    encoding_flattened: dict[str, dict[str, Any]] = field(default_factory=dict)
    datetime_variables: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    decode_cf_degraded: bool = False

    # Format: {group_name: [{"name": var_name, "min": min_value, "max": max_value}, ...]}


@dataclass(frozen=True)
class FileInfoError:
    """Error information when file processing fails.

    Attributes
    ----------
    error : str
        Error message describing what went wrong
    error_type : str
        Type of error (e.g., 'ImportError', 'FileNotFoundError')
    suggestion : str
        Suggested action to resolve the error
    format_info : FileFormatInfo
        Format information for the file that failed
    xarray_show_versions : str
        Version information for debugging
    """

    error: str
    error_type: str
    suggestion: str
    format_info: FileFormatInfo
    xarray_show_versions: str


@dataclass(frozen=True)
class CreatePlotResult:
    """Result of creating a plot.

    Attributes
    ----------
    plot_data : str
        Base64-encoded PNG image data
    format_info : FileFormatInfo
        File format metadata
    applied_isel_kwargs : dict
        Final applied dimension slices (isel kwargs); values are int or str for slice
    applied_plot_kwargs : dict
        Final applied plot kwargs (row, col, xincrease, etc.)
    matplotlib_style : str
        Matplotlib style used for the plot
    variable_path : str
        Variable path that was plotted (e.g. '/temperature')
    """

    plot_data: str = field(repr=False)
    format_info: FileFormatInfo
    applied_isel_kwargs: dict[str, int | str] = field(default_factory=dict)
    applied_plot_kwargs: dict[str, Any] = field(default_factory=dict)
    matplotlib_style: str = ""
    variable_path: str = ""


@dataclass(frozen=True)
class CreatePlotError:
    """Error when creating a plot.

    Attributes
    ----------
    error : str
        Error message describing what went wrong
    """

    error: str
    format_info: FileFormatInfo
