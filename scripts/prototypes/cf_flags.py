"""Prototype: plots of CF flag variables (flag_values / flag_masks / flag_meanings).

Throwaway exploration behind docs/v0.14/CF_FLAGS_PROPOSAL.md. It writes a
synthetic CF file, reopens it with xarray's default decoding and renders the
proposed plot kinds with plain matplotlib, outside the viewer's backend:

1. flag_values: categorical map, colors from ``flag_colors``, shares in the
   colorbar;
2. flag_masks: one boolean panel per flag, plus an "any of" selection;
   2b. the flag frequency bars that replace the histogram;
3. flag_masks + flag_values (CF example 3.8): block plot along time;
4. a selection of meanings highlighted on the categorical map;
5. the uint64 check: default decoding (float64) loses the low bits.

Usage: .venv/bin/python scripts/prototypes/cf_flags.py [--out DIR]
Output: artefacts/prototypes/cf_flags/ (git-ignored).
"""

import argparse
from dataclasses import dataclass
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import xarray as xr
from matplotlib.colors import BoundaryNorm, ListedColormap

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "artefacts" / "prototypes" / "cf_flags"

NY, NX, NT = 60, 90, 4
LAT = np.linspace(-60, 60, NY)
LON = np.linspace(-90, 90, NX)
EXTENT = [LON[0], LON[-1], LAT[0], LAT[-1]]


@dataclass
class Flag:
    meaning: str
    value: int | None  # flag_values entry
    mask: int | None  # flag_masks entry

    def test(self, codes: np.ndarray) -> np.ndarray:
        if self.mask is None:
            return codes == self.value
        anded = codes & self.mask
        return anded == self.value if self.value is not None else anded != 0


def parse_flags(da: xr.DataArray) -> list[Flag]:
    attrs = da.attrs
    names = str(attrs["flag_meanings"]).split()
    values = np.atleast_1d(attrs["flag_values"]) if "flag_values" in attrs else None
    masks = np.atleast_1d(attrs["flag_masks"]) if "flag_masks" in attrs else None
    for arr in (values, masks):
        assert arr is None or len(arr) == len(names), "length mismatch"
    return [
        Flag(
            meaning,
            None if values is None else int(values[i]),
            None if masks is None else int(masks[i]),
        )
        for i, meaning in enumerate(names)
    ]


def as_codes(da: xr.DataArray) -> tuple[np.ndarray, np.ndarray]:
    """Integer codes and validity, whatever mask_and_scale did."""
    values = da.values
    valid = np.isfinite(values) if values.dtype.kind == "f" else np.ones(da.shape, bool)
    return np.where(valid, values, 0).astype(np.int64), valid


def label(meaning: str) -> str:
    return meaning.replace("_", " ")


def make_dataset(path: Path) -> None:
    rng = np.random.default_rng(0)
    yy, xx = np.meshgrid(LAT, LON, indexing="ij")
    # flag_values: land cover classes, non-contiguous codes, a fill value
    codes = np.array([10, 20, 30, 50, 60, 190, 200, 210], dtype=np.uint8)
    field = np.sin(xx / 25) + np.cos(yy / 18) + 0.4 * rng.standard_normal((NY, NX))
    edges = np.quantile(field, np.linspace(0, 1, len(codes) + 1)[1:-1])
    land_cover = codes[np.digitize(field, edges)]
    land_cover[yy > 45] = 255
    # flag_masks: independent bits over time (like Sentinel-3 WQSF)
    bits = np.zeros((NT, NY, NX), dtype=np.uint8)
    for t in range(NT):
        cloud = (np.sin((xx + 30 * t) / 15) * np.cos(yy / 12)) > 0.4
        shadow = np.roll(cloud, (3, 4), axis=(0, 1)) & ~cloud
        glint = (np.abs(xx - 20 * t) < 8) & (np.abs(yy) < 20)
        layers = [cloud, shadow, np.abs(yy) > 50, glint, rng.random((NY, NX)) < 0.01]
        bits[t] = sum(layer.astype(np.uint8) << i for i, layer in enumerate(layers))
    # flag_masks + flag_values (CF example 3.8): two booleans and a 2-bit mode
    n = 200
    status = (rng.random(n) < 0.1) * 1 | (rng.random(n) < 0.05) * 2
    status = (status | np.repeat(np.array([0, 4, 8, 12, 4]), n // 5)).astype(np.int8)
    time = np.datetime64("2026-01-01", "ns") + np.arange(n) * np.timedelta64(1, "m")
    ds = xr.Dataset(
        {
            "land_cover": (
                ("lat", "lon"),
                land_cover,
                {
                    "long_name": "Land cover class",
                    "standard_name": "land_cover_lccs",
                    "flag_values": codes,
                    "flag_meanings": "cropland grassland mosaic_cropland "
                    "tree_cover_broadleaved tree_cover_needleleaved urban "
                    "bare_areas water",
                    "flag_colors": "#ffff64 #ffb432 #dcf064 #006400 #003c00 "
                    "#c31400 #fff5d7 #0046c8",
                },
            ),
            "pixel_flags": (
                ("time", "lat", "lon"),
                bits,
                {
                    "long_name": "Pixel classification flags",
                    "standard_name": "status_flag",
                    "flag_masks": np.array([1, 2, 4, 8, 16], np.uint8),
                    "flag_meanings": "cloud cloud_shadow snow_ice sun_glint invalid",
                },
            ),
            "sensor_status_qc": (
                ("time_s",),
                status,
                {
                    "long_name": "Sensor status",
                    "flag_masks": np.array([1, 2, 12, 12, 12], np.int8),
                    "flag_values": np.array([1, 2, 4, 8, 12], np.int8),
                    "flag_meanings": "low_battery hardware_fault offline_mode "
                    "calibration_mode maintenance_mode",
                    "valid_range": np.array([0, 15], np.int8),
                },
            ),
        },
        coords={"lat": LAT, "lon": LON, "time": np.arange(NT), "time_s": time},
    )
    ds.to_netcdf(path, encoding={"land_cover": {"_FillValue": np.uint8(255)}})


def plot_categorical(ds: xr.Dataset, out: Path) -> None:
    flags = parse_flags(ds.land_cover)
    codes, valid = as_codes(ds.land_cover)
    index = np.full(codes.shape, np.nan)
    for i, flag in enumerate(flags):
        index[valid & flag.test(codes)] = i
    n = len(flags)
    colors = str(ds.land_cover.attrs.get("flag_colors", "")).split()
    palette = colors if len(colors) == n else plt.get_cmap("tab10").colors[:n]
    cmap = ListedColormap(palette)
    cmap.set_bad("#00000000")
    fig, ax = plt.subplots(figsize=(9, 4.5))
    da = xr.DataArray(index, dims=ds.land_cover.dims, coords=ds.land_cover.coords)
    image = da.plot.imshow(
        ax=ax,
        cmap=cmap,
        norm=BoundaryNorm(np.arange(-0.5, n), n),
        add_colorbar=False,
    )
    colorbar = fig.colorbar(image, ax=ax, ticks=np.arange(n))
    total = valid.sum()
    colorbar.ax.set_yticklabels(
        [
            f"{flag.value} {label(flag.meaning)} ({100 * (index == i).sum() / total:.0f}%)"
            for i, flag in enumerate(flags)
        ]
    )
    ax.set_aspect("equal")
    ax.set_title("Land cover class  [flag_values, colors: flag_colors]")
    fig.tight_layout()
    fig.savefig(out / "1_categorical_map.png", dpi=80)
    plt.close(fig)


def plot_mask_panels(ds: xr.Dataset, out: Path) -> None:
    flags = parse_flags(ds.pixel_flags)
    codes, _ = as_codes(ds.pixel_flags)
    first = codes[0]
    fig, axes = plt.subplots(2, 3, figsize=(12, 5.5), sharex=True, sharey=True)
    on_off = ListedColormap(["#e8e8e8", "#c0392b"])
    for ax, flag in zip(axes.flat, flags, strict=False):
        on = flag.test(first)
        ax.imshow(on, origin="lower", cmap=on_off, vmin=0, vmax=1, extent=EXTENT)
        bit = int(np.log2(flag.mask))
        ax.set_title(
            f"{label(flag.meaning)} (bit {bit}) {100 * on.mean():.0f}%", fontsize=9
        )
    chosen = [f for f in flags if f.meaning in ("cloud", "cloud_shadow")]
    any_on = np.logical_or.reduce([f.test(first) for f in chosen])
    axes.flat[5].imshow(
        any_on,
        origin="lower",
        cmap=ListedColormap(["#e8e8e8", "#2c3e50"]),
        extent=EXTENT,
    )
    axes.flat[5].set_title("selection: cloud OR cloud_shadow", fontsize=9)
    fig.suptitle("pixel_flags, time = 0  [flag_masks: one panel per flag]")
    fig.tight_layout()
    fig.savefig(out / "2_mask_facets.png", dpi=80)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 3.5))
    width = 0.8 / NT
    for t in range(NT):
        shares = [100 * f.test(codes[t]).mean() for f in flags]
        ax.barh(
            np.arange(len(flags)) + t * width, shares, height=width, label=f"time {t}"
        )
    ax.set_yticks(
        np.arange(len(flags)) + 0.4 - width / 2, [label(f.meaning) for f in flags]
    )
    ax.invert_yaxis()
    ax.set_xlabel("% of pixels with the flag set")
    ax.legend(fontsize=8)
    ax.set_title("pixel_flags: flag frequency (replaces the value histogram)")
    fig.tight_layout()
    fig.savefig(out / "2b_mask_frequency.png", dpi=80)
    plt.close(fig)


def plot_mixed_blocks(ds: xr.Dataset, out: Path) -> None:
    flags = parse_flags(ds.sensor_status_qc)
    codes, _ = as_codes(ds.sensor_status_qc)
    times = mdates.date2num(ds.time_s.values)
    step = times[1] - times[0]
    per_mask: dict[int | None, int] = {}
    for flag in flags:
        per_mask[flag.mask] = per_mask.get(flag.mask, 0) + 1
    fig, ax = plt.subplots(figsize=(9, 3))
    for row, flag in enumerate(flags):
        starts = times[flag.test(codes)]
        color = "#2980b9" if per_mask[flag.mask] > 1 else "#c0392b"
        ax.broken_barh([(s, step) for s in starts], (row - 0.4, 0.8), color=color)
    ax.set_yticks(
        range(len(flags)),
        [f"{label(f.meaning)}  (&{f.mask}=={f.value})" for f in flags],
    )
    ax.invert_yaxis()
    ax.xaxis_date()
    ax.set_title("sensor_status_qc  [red: boolean bit, blue: enumerated bits 2-3]")
    fig.tight_layout()
    fig.savefig(out / "3_mixed_blocks.png", dpi=80)
    plt.close(fig)


def plot_selection(ds: xr.Dataset, out: Path) -> None:
    flags = parse_flags(ds.land_cover)
    codes, valid = as_codes(ds.land_cover)
    chosen = {"tree_cover_broadleaved", "tree_cover_needleleaved"}
    selected = np.where(valid, 0.0, np.nan)
    for flag in flags:
        if flag.meaning in chosen:
            selected[valid & flag.test(codes)] = 1
    cmap = ListedColormap(["#dddddd", "#006400"])
    cmap.set_bad("#00000000")
    fig, ax = plt.subplots(figsize=(9, 4.5))
    image = ax.imshow(
        selected, origin="lower", cmap=cmap, vmin=0, vmax=1, extent=EXTENT
    )
    colorbar = fig.colorbar(image, ticks=[0.25, 0.75])
    colorbar.ax.set_yticklabels(["other", "tree cover (2 classes)"])
    share = 100 * np.nansum(selected) / valid.sum()
    ax.set_title(f"land_cover: selected meanings = {sorted(chosen)}  ({share:.0f}%)")
    fig.tight_layout()
    fig.savefig(out / "4_selection.png", dpi=80)
    plt.close(fig)


def check_uint64(out: Path) -> str:
    """Default decoding of a uint64 bit field with a _FillValue loses bits."""
    path = out / "uint64_flags.nc"
    values = np.array([1, (1 << 60) | 1, (1 << 63) | 2, 0], dtype=np.uint64)
    masks = np.array([1, 2, 1 << 60, 1 << 63], np.uint64)
    ds = xr.Dataset(
        {"wqsf": ("x", values, {"flag_masks": masks, "flag_meanings": "a b c d"})}
    )
    ds.to_netcdf(path, encoding={"wqsf": {"_FillValue": np.uint64(0)}})
    with xr.open_dataset(path) as decoded:
        third = decoded.wqsf.values[2]
        lines = [
            f"default decoding: dtype {decoded.wqsf.dtype}, (1<<63)|2 -> {third!r}"
        ]
    with xr.open_dataset(path, mask_and_scale={"wqsf": False}) as raw:
        lines.append(
            f"mask_and_scale={{'wqsf': False}}: dtype {raw.wqsf.dtype}, values kept"
        )
        assert int(raw.wqsf.values[2]) == int(values[2])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    out = parser.parse_args().out
    out.mkdir(parents=True, exist_ok=True)
    path = out / "flags_demo.nc"
    make_dataset(path)
    with xr.open_dataset(path) as ds:
        print(f"land_cover after default decoding: {ds.land_cover.dtype}")
        plot_categorical(ds, out)
        plot_mask_panels(ds, out)
        plot_mixed_blocks(ds, out)
        plot_selection(ds, out)
    print(check_uint64(out))
    print(f"written to {out}: " + ", ".join(sorted(p.name for p in out.glob("*.png"))))


if __name__ == "__main__":
    main()
