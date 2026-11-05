"""How a file is decoded when it is opened: xarray CF decoders and engine
``backend_kwargs``.

Each keyword passed to xarray comes from one layer; later layers win:

1. engine default: nothing is passed, the engine decides;
2. viewer default (``VIEWER_DEFAULT_DECODERS`` / ``VIEWER_DEFAULT_BACKEND_KWARGS``);
3. user settings (``scientificDataViewer.decoding.*``, ``engineBackendKwargs``);
4. time fallback: ``decode_times=False`` when CF time units cannot be decoded;
5. raw mode ("Reopen raw" in the viewer): every decoder off.

Decoders an engine does not take are not passed (xarray would raise a
``TypeError``); the report says so. User ``backend_kwargs`` are limited to
``USER_BACKEND_KWARGS_ALLOWED``: keys that only change how a file is read,
never ones that write files, reach the network or take credentials.
"""

import json
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from sdv_backend.results import OpenKwarg

SOURCE_VIEWER = "viewer default"
SOURCE_SETTING = "setting"
SOURCE_FALLBACK = "time fallback"
SOURCE_RAW = "raw mode"

KIND_DECODER = "decoder"
KIND_BACKEND = "backend_kwargs"
KIND_KWARG = "kwarg"

# Decoders the viewer may pass, in the order of xarray's open_dataset signature
DECODER_NAMES: tuple[str, ...] = (
    "mask_and_scale",
    "decode_times",
    "decode_timedelta",
    "concat_characters",
    "use_cftime",
    "decode_coords",
)

# Raw mode: what decode_cf=False does, written out (decode_cf is not forwarded
# to engines such as kerchunk, explicit decoders are)
RAW_DECODERS: dict[str, Any] = {
    "mask_and_scale": False,
    "decode_times": False,
    "decode_timedelta": False,
    "concat_characters": False,
    "decode_coords": False,
}

TIME_FALLBACK_DECODERS: dict[str, Any] = {
    "decode_times": False,
    "decode_timedelta": False,
}

# Rasters keep their integer dtype and raw values; nodata stays an attribute
VIEWER_DEFAULT_DECODERS: dict[str, dict[str, Any]] = {
    "rasterio": {"mask_and_scale": False},
}

# Decoders an engine takes but only with its own value
ENGINE_FIXED_DECODERS: dict[str, frozenset[str]] = {
    "rasterio": frozenset({"decode_coords"}),  # rioxarray: only "all" is supported
}

VIEWER_DEFAULT_BACKEND_KWARGS: dict[str, dict[str, Any]] = {
    "cfgrib": {"indexpath": ""},  # Avoid intempestive .idx file creation
}

# backend_kwargs a user may set per engine (setting engineBackendKwargs).
# Left out on purpose: mode / clobber / persist (writing), storage_options /
# driver / open_kwargs (network, credentials, arbitrary driver options), lock,
# group, indexpath (writes index files), band_as_variable (its own setting),
# and the decoders (their own settings).
USER_BACKEND_KWARGS_ALLOWED: dict[str, frozenset[str]] = {
    "netcdf4": frozenset({"auto_complex"}),
    "h5netcdf": frozenset({"phony_dims", "invalid_netcdf", "decode_vlen_strings"}),
    "scipy": frozenset({"mmap"}),
    "zarr": frozenset({"consolidated", "zarr_format", "use_zarr_fill_value_as_mask"}),
    "cfgrib": frozenset(
        {
            "filter_by_keys",
            "read_keys",
            "ignore_keys",
            "encode_cf",
            "squeeze",
            "time_dims",
            "errors",
            "extra_coords",
            "coords_as_attributes",
            "cache_geo_coords",
        }
    ),
    "rasterio": frozenset({"parse_coordinates", "masked", "default_name"}),
}


@dataclass(frozen=True)
class DecodingOptions:
    """User choices about decoding; ``None`` leaves the choice to the engine.

    Attributes
    ----------
    mask_and_scale, decode_times, use_cftime : bool, optional
        xarray decoders (settings ``scientificDataViewer.decoding.*``).
    decode_coords : bool or {"coordinates", "all"}, optional
        xarray ``decode_coords``.
    raw : bool
        Open without any CF decoding ("Reopen raw").
    engine_backend_kwargs : dict
        ``{engine: {key: value}}`` from the setting ``engineBackendKwargs``;
        keys outside ``USER_BACKEND_KWARGS_ALLOWED`` are ignored and reported.
    """

    mask_and_scale: bool | None = None
    decode_times: bool | None = None
    decode_coords: bool | str | None = None
    use_cftime: bool | None = None
    raw: bool = False
    engine_backend_kwargs: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)

    def setting_decoders(self) -> dict[str, Any]:
        """Decoders set by the user (``decode_timedelta`` follows ``decode_times``
        when it is turned off)."""
        decoders: dict[str, Any] = {
            "mask_and_scale": self.mask_and_scale,
            "decode_times": self.decode_times,
            "decode_coords": self.decode_coords,
            "use_cftime": self.use_cftime,
        }
        if self.decode_times is False:
            decoders["decode_timedelta"] = False
        return {name: value for name, value in decoders.items() if value is not None}


@dataclass(frozen=True)
class ResolvedOpen:
    """Keywords for one open call, and where each comes from."""

    decoders: dict[str, Any]
    backend_kwargs: dict[str, Any]
    kwargs: list[OpenKwarg]
    notes: list[str]


def parse_on_off(value: str | None) -> bool | None:
    """CLI ``on`` / ``off`` -> bool; omitted -> None (engine default)."""
    if value is None:
        return None
    return value == "on"


def parse_decode_coords(value: str | None) -> bool | str | None:
    """CLI ``coordinates`` / ``all`` / ``off`` -> xarray ``decode_coords``."""
    if value is None:
        return None
    return False if value == "off" else value


def parse_engine_backend_kwargs(text: str) -> dict[str, dict[str, Any]]:
    """Parse the ``--engine-backend-kwargs`` JSON: an object of objects."""
    value = json.loads(text)
    if not isinstance(value, dict) or not all(
        isinstance(engine, str) and isinstance(kwargs, dict)
        for engine, kwargs in value.items()
    ):
        raise ValueError(
            'expected a JSON object of objects, e.g. {"h5netcdf": {"phony_dims": "sort"}}'
        )
    return value


def resolve_open_kwargs(
    engine: str,
    options: DecodingOptions,
    accepted: frozenset[str] | None,
    *,
    time_fallback: bool = False,
    viewer_backend_kwargs: Mapping[str, tuple[Any, str]] | None = None,
    reserved: frozenset[str] = frozenset(),
) -> ResolvedOpen:
    """Decoders and ``backend_kwargs`` to open a file with ``engine``.

    Parameters
    ----------
    accepted : frozenset of str, optional
        Keywords the engine's ``open_dataset`` takes; ``None`` when it forwards
        any keyword (kerchunk) or is unknown.
    time_fallback : bool
        Retry after a CF time decoding failure: times are not decoded.
    viewer_backend_kwargs : mapping, optional
        Extra viewer ``backend_kwargs`` with their source label
        (e.g. ``band_as_variable`` from ``convertBandsToVariables``).
    reserved : frozenset of str
        Keywords the viewer already passes for this file (ZIP Zarr store);
        user ``backend_kwargs`` cannot replace them.
    """
    notes: list[str] = []

    fixed = ENGINE_FIXED_DECODERS.get(engine, frozenset())

    def takes(name: str) -> bool:
        return accepted is None or name in accepted

    def takes_decoder(name: str) -> bool:
        return takes(name) and name not in fixed

    # Decoders: layered, the last layer wins
    layered: dict[str, tuple[Any, str]] = {}
    for name, value in VIEWER_DEFAULT_DECODERS.get(engine, {}).items():
        layered[name] = (value, SOURCE_VIEWER)
    for name, value in options.setting_decoders().items():
        layered[name] = (value, SOURCE_SETTING)
    if options.raw:
        layered.pop("use_cftime", None)  # Meaningless without time decoding
        for name, value in RAW_DECODERS.items():
            layered[name] = (value, SOURCE_RAW)
    elif time_fallback:
        for name, value in TIME_FALLBACK_DECODERS.items():
            layered[name] = (value, SOURCE_FALLBACK)

    decoders: dict[str, Any] = {}
    kwargs: list[OpenKwarg] = []
    for name in DECODER_NAMES:
        if name not in layered:
            continue
        value, source = layered[name]
        if not takes_decoder(name):
            if source in (SOURCE_SETTING, SOURCE_RAW):
                notes.append(
                    f"{name}={value!r} ({source}) does not apply to the {engine} "
                    "engine: its default behaviour applies."
                )
            continue
        decoders[name] = value
        kwargs.append(OpenKwarg(name, value, source, KIND_DECODER))

    # backend_kwargs: viewer defaults, then allowed user keys
    backend_kwargs: dict[str, Any] = {}
    for name, value in VIEWER_DEFAULT_BACKEND_KWARGS.get(engine, {}).items():
        backend_kwargs[name] = value
        kwargs.append(OpenKwarg(name, value, SOURCE_VIEWER, KIND_BACKEND))
    for name, (value, source) in (viewer_backend_kwargs or {}).items():
        backend_kwargs[name] = value
        kwargs.append(OpenKwarg(name, value, source, KIND_BACKEND))

    allowed = USER_BACKEND_KWARGS_ALLOWED.get(engine, frozenset())
    for name, value in options.engine_backend_kwargs.get(engine, {}).items():
        if name not in allowed:
            allowed_text = ", ".join(sorted(allowed)) or "none"
            notes.append(
                f"engineBackendKwargs.{engine}.{name} ignored: not an allowed key "
                f"for {engine} (allowed: {allowed_text})."
            )
        elif not takes(name):
            notes.append(
                f"engineBackendKwargs.{engine}.{name} ignored: the installed "
                f"{engine} engine does not take it."
            )
        elif name in reserved or name in backend_kwargs:
            notes.append(
                f"engineBackendKwargs.{engine}.{name} ignored: the viewer sets "
                "it for this file."
            )
        else:
            backend_kwargs[name] = value
            kwargs.append(OpenKwarg(name, value, SOURCE_SETTING, KIND_BACKEND))

    return ResolvedOpen(decoders, backend_kwargs, kwargs, notes)


def format_open_call(
    function: str,
    location: str,
    engine: str | None,
    kwargs: list[OpenKwarg],
) -> str:
    """Python snippet reproducing the open call, each keyword commented with
    its source (copied from the Troubleshooting section)."""
    lines = [f"{function}(", f"    {location},"]
    if engine is not None:
        lines.append(f"    engine={engine!r},")
    for kwarg in kwargs:
        if kwarg.kind != KIND_BACKEND:
            lines.append(f"    {kwarg.name}={kwarg.value!r},  # {kwarg.source}")
    backend = [kwarg for kwarg in kwargs if kwarg.kind == KIND_BACKEND]
    if backend:
        lines.append("    backend_kwargs={")
        for kwarg in backend:
            lines.append(f"        {kwarg.name!r}: {kwarg.value!r},  # {kwarg.source}")
        lines.append("    },")
    lines.append(")")
    return "\n".join(lines)
