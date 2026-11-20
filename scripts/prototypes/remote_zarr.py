"""Prototype: find, open and plot remote Zarr stores (anonymous HTTPS / S3 / GCS).

Throwaway exploration behind docs/design/REMOTE_ZARR.md. It runs outside the
viewer's backend, with plain xarray / zarr / fsspec / matplotlib:

1. ``stac``: a small STAC client over plain HTTP (no pystac) walks three
   public catalogs and lists their Zarr assets with the hints a viewer needs
   (media type, Zarr version, ``xarray:open_*_kwargs``, ``zarr:*`` fields):
   the EOPF Sentinel Zarr STAC API (items), the Planetary Computer
   (collection-level assets) and the Copernicus Marine static catalog. It also
   runs one item search (bbox + date + cloud cover) as a search UI would.
2. ``open``: opens each target with ``xr.open_datatree(engine="zarr")``
   through a zarr store wrapper that counts requests and bytes; records the
   time, the tree size and the size of xarray's HTML repr (what the viewer
   ships to its webview).
3. ``slice``: picks a 2D slice the way the viewer's automatic layout would,
   **estimates its download from the chunk grid before reading it**, reads it,
   compares, and renders a PNG.
4. ``cache``: the extension spawns one Python process per request, so every
   plot reopens the store. Measures a cold open against an open with the
   metadata documents cached on disk.
5. ``urls``: ``s3://`` / ``gs://`` URLs rewritten to their public HTTPS form,
   and what a store without consolidated metadata does over plain HTTPS.

Usage:
    .venv/bin/python scripts/prototypes/remote_zarr.py [--out DIR] [--only stac,open,...]
    # obstore instead of fsspec (and the Planetary Computer target, which needs
    # a SAS token per request):
    uv run --no-project --python .venv/bin/python --with obstore \\
        python scripts/prototypes/remote_zarr.py --store obstore

Each store is opened in its own child process, with an address-space limit
(CHILD_ADDRESS_SPACE), so a store that needs too much memory fails alone.
Needs internet. Without it, it prints a note and exits 0 (paranoia's
``prototypes`` step must not fail on an offline machine). A full run takes
about 5 minutes and downloads about 50 MB.
Output: artefacts/prototypes/remote_zarr/ (git-ignored): report.md,
report.json, one PNG per slice, cache/.
"""

import argparse
import hashlib
import json
import resource
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import xarray as xr
from zarr.storage import WrapperStore

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "artefacts" / "prototypes" / "remote_zarr"
USER_AGENT = "scientific-data-viewer-prototype"
HTTP_TIMEOUT_S = 30
# Each store is opened in its own process, under this address-space limit, so
# a store that needs more memory than expected fails alone (first full run in
# one process: the machine ran out of memory, other applications were killed).
CHILD_ADDRESS_SPACE = 6 * 2**30
CHILD_TIMEOUT_S = 600
# Slice picking: largest 2D field under this many elements, and refuse a slice
# whose chunks would download more than this (uncompressed estimate).
MAX_SLICE_ELEMENTS = 10_000_000
MAX_SLICE_BYTES = 64 * 2**20

EOPF_STAC = "https://stac.core.eopf.eodc.eu"
PC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
PC_SAS = "https://planetarycomputer.microsoft.com/api/sas/v1/token"
CMEMS_STAC = "https://stac.marine.copernicus.eu/metadata/catalog.stac.json"
CMEMS_DATASET = (
    "https://stac.marine.copernicus.eu/metadata/GLOBAL_ANALYSISFORECAST_PHY_001_024/"
    "cmems_mod_glo_phy_anfc_0.083deg_P1D-m_202406/dataset.stac.json"
)
METADATA_KEYS = (".zmetadata", "zarr.json", ".zgroup", ".zarray", ".zattrs")


# --------------------------------------------------------------------------- HTTP


def get_json(url: str, body: dict | None = None) -> Any:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(
        url,
        data=data,
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_S) as response:
        return json.load(response)


def online() -> bool:
    try:
        get_json(EOPF_STAC)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"remote_zarr: offline or catalog unreachable ({exc!r}); skipped")
        return False
    return True


# --------------------------------------------------------------------------- STAC


def is_zarr_media_type(media_type: str | None) -> bool:
    """Both spellings seen in the wild: ``application/vnd+zarr`` (older,
    Planetary Computer, EOPF v2 products) and ``application/vnd.zarr;
    version=3; profile=multiscales`` (zarr STAC extension, EOPF v3)."""
    return bool(media_type) and "zarr" in media_type.lower()


def zarr_version_of(media_type: str) -> int | None:
    params = dict(
        part.strip().split("=", 1) for part in media_type.split(";")[1:] if "=" in part
    )
    return int(params["version"]) if params.get("version", "").isdigit() else None


@dataclass
class ZarrAsset:
    catalog: str
    owner: str  # item or collection id
    key: str
    href: str
    media_type: str
    zarr_version: int | None
    roles: list[str]
    title: str | None
    open_kwargs: dict[str, Any]  # xarray:open_*_kwargs, as published
    zarr_fields: dict[str, Any]  # zarr:node_type, zarr:consolidated, ...
    is_store_root: bool  # href is the product root, not a sub-group

    @classmethod
    def from_stac(
        cls, catalog: str, owner: str, key: str, asset: dict, root_href: str | None
    ) -> "ZarrAsset":
        open_kwargs = {
            k: v
            for k, v in asset.items()
            if k.startswith("xarray:open") and isinstance(v, dict)
        }
        return cls(
            catalog=catalog,
            owner=owner,
            key=key,
            href=asset["href"],
            media_type=asset.get("type", ""),
            zarr_version=zarr_version_of(asset.get("type", "")),
            roles=asset.get("roles", []),
            title=asset.get("title"),
            open_kwargs=open_kwargs,
            zarr_fields={k: v for k, v in asset.items() if k.startswith("zarr:")},
            is_store_root=root_href is None or asset["href"].rstrip("/") == root_href,
        )


def zarr_assets(catalog: str, owner: str, assets: dict) -> list[ZarrAsset]:
    zarr_ones = {k: a for k, a in assets.items() if is_zarr_media_type(a.get("type"))}
    # The store root: the shortest href that prefixes every other one.
    hrefs = sorted((a["href"].rstrip("/") for a in zarr_ones.values()), key=len)
    root = hrefs[0] if hrefs and all(h.startswith(hrefs[0]) for h in hrefs) else None
    return [
        ZarrAsset.from_stac(catalog, owner, k, a, root) for k, a in zarr_ones.items()
    ]


def stac_part(report: dict) -> dict[str, Any]:
    """Walk the three catalogs; return the targets the other parts open."""
    out: dict[str, Any] = {"catalogs": [], "assets": [], "search": None}
    targets: dict[str, Any] = {}

    # 1. EOPF: a STAC API, Zarr assets on items (product root + sub-groups).
    t0 = time.perf_counter()
    collections = get_json(f"{EOPF_STAC}/collections")["collections"]
    out["catalogs"].append(
        {
            "name": "EOPF Sentinel Zarr Samples (STAC API)",
            "url": EOPF_STAC,
            "collections": len(collections),
            "seconds": round(time.perf_counter() - t0, 2),
        }
    )
    for collection in collections:
        page = get_json(f"{EOPF_STAC}/collections/{collection['id']}/items?limit=1")
        if not page["features"]:
            continue
        item = page["features"][0]
        assets = zarr_assets("EOPF", item["id"], item["assets"])
        out["assets"].extend(asdict(a) for a in assets)
        roots = [a for a in assets if a.key == "product"]
        if roots:
            targets[f"eopf:{collection['id']}"] = roots[0].href

    # A search as a UI would send it: around Sophia Antipolis, last 60 days,
    # least cloudy first (sortby + query are in the API's conformance list).
    body = {
        "collections": ["sentinel-2-l2a"],
        "bbox": [6.9, 43.5, 7.2, 43.75],
        "datetime": "2026-09-20T00:00:00Z/2026-11-19T00:00:00Z",
        "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}],
        "limit": 5,
    }
    t0 = time.perf_counter()
    try:
        found = get_json(f"{EOPF_STAC}/search", body)
        out["search"] = {
            "body": body,
            "seconds": round(time.perf_counter() - t0, 2),
            "items": [
                {
                    "id": f["id"],
                    "cloud_cover": f["properties"].get("eo:cloud_cover"),
                    "datetime": f["properties"].get("datetime"),
                }
                for f in found["features"]
            ],
        }
    except urllib.error.HTTPError as exc:
        out["search"] = {"body": body, "error": repr(exc)}

    # 2. Planetary Computer: collection-level assets, Azure blobs that need a
    # short-lived SAS token (anonymous endpoint, no account).
    t0 = time.perf_counter()
    pc = get_json(f"{PC_STAC}/collections")["collections"]
    pc_zarr = [
        c
        for c in pc
        if any(is_zarr_media_type(a.get("type")) for a in c.get("assets", {}).values())
    ]
    out["catalogs"].append(
        {
            "name": "Microsoft Planetary Computer (STAC API)",
            "url": PC_STAC,
            "collections": len(pc),
            "collections_with_zarr": len(pc_zarr),
            "seconds": round(time.perf_counter() - t0, 2),
        }
    )
    for collection in pc_zarr:
        out["assets"].extend(
            asdict(a)
            for a in zarr_assets(
                "PlanetaryComputer", collection["id"], collection["assets"]
            )
        )
    targets["pc:daymet-annual-hi"] = next(
        a["href"]
        for c in pc_zarr
        if c["id"] == "daymet-annual-hi"
        for k, a in c["assets"].items()
        if k == "zarr-https"
    )

    # 3. Copernicus Marine: a static catalog (catalog -> product collections ->
    # dataset items), one Zarr asset per chunking strategy.
    t0 = time.perf_counter()
    cmems = get_json(CMEMS_STAC)
    dataset = get_json(CMEMS_DATASET)
    out["catalogs"].append(
        {
            "name": "Copernicus Marine (static STAC catalog)",
            "url": CMEMS_STAC,
            "products": sum(1 for link in cmems["links"] if link["rel"] == "child"),
            "seconds": round(time.perf_counter() - t0, 2),
        }
    )
    for asset in zarr_assets("CopernicusMarine", dataset["id"], dataset["assets"]):
        out["assets"].append(asdict(asset))
        targets[f"cmems:{asset.key}"] = asset.href

    report["stac"] = out
    return targets


# --------------------------------------------------------------------------- stores


class CountingStore(WrapperStore):
    """Counts the requests and bytes a zarr store serves (gets, ranges, lists)."""

    def __init__(self, store: Any) -> None:
        super().__init__(store)
        self.gets = 0
        self.misses = 0
        self.bytes = 0
        self.lists = 0
        self.found: list[str] = []  # keys that returned data

    async def get(self, key, prototype, byte_range=None):
        buf = await self._store.get(key, prototype, byte_range)
        self.gets += 1
        if buf is None:
            self.misses += 1
        else:
            self.found.append(key)
            self.bytes += len(buf)
        return buf

    def zarr_format(self) -> int | None:
        names = {key.rsplit("/", 1)[-1] for key in self.found}
        return (
            3
            if "zarr.json" in names
            else 2
            if names & {".zmetadata", ".zgroup", ".zarray"}
            else None
        )

    async def exists(self, key):
        self.gets += 1
        return await self._store.exists(key)

    def list_dir(self, prefix):
        self.lists += 1
        return self._store.list_dir(prefix)

    def snapshot(self) -> tuple[int, int]:
        return self.gets, self.bytes


class ForbiddenAsMissingStore(WrapperStore):
    """S3-compatible stores without public listing answer 403, not 404, for a
    key that does not exist. zarr-python probes ``zarr.json`` (v3) before
    ``.zmetadata`` (v2): fsspec turns the 403 into an error and the whole open
    fails (Copernicus Marine ARCO). Read a 403 on a metadata key as "absent"."""

    def __init__(self, store: Any) -> None:
        super().__init__(store)
        self.forbidden: list[str] = []

    async def get(self, key, prototype, byte_range=None):
        try:
            return await self._store.get(key, prototype, byte_range)
        except Exception as exc:
            # aiohttp: ClientResponseError.status; obstore: PermissionDeniedError
            forbidden = (
                getattr(exc, "status", None) == 403
                or type(exc).__name__ == "PermissionDeniedError"
            )
            if forbidden and key.rsplit("/", 1)[-1] in METADATA_KEYS:
                self.forbidden.append(key)
                return None
            raise


class MetadataCacheStore(WrapperStore):
    """Keeps metadata documents on disk, keyed by store URL (not chunks).

    The idea a backend would need, since each request is a new process. A
    real one needs an expiry: ``latest.zarr`` stores change every few hours.
    """

    def __init__(self, store: Any, cache_dir: Path) -> None:
        super().__init__(store)
        self.cache_dir = cache_dir
        cache_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self.cache_dir / hashlib.sha1(key.encode()).hexdigest()

    async def get(self, key, prototype, byte_range=None):
        if byte_range is not None or key.rsplit("/", 1)[-1] not in METADATA_KEYS:
            return await self._store.get(key, prototype, byte_range)
        path = self._path(key)
        if path.exists():
            data = path.read_bytes()
            return None if data == b"\0MISSING" else prototype.buffer.from_bytes(data)
        buf = await self._store.get(key, prototype, byte_range)
        path.write_bytes(b"\0MISSING" if buf is None else buf.to_bytes())
        return buf


_S3_REGIONS: dict[str, str] = {}


def s3_bucket_region(bucket: str) -> str:
    """AWS answers any HEAD on the global endpoint with the bucket's region in
    ``x-amz-bucket-region`` (even 301 / 403). The global endpoint itself is
    not enough: chunk reads of a us-west-2 bucket through it fail with 500."""
    if bucket not in _S3_REGIONS:
        request = urllib.request.Request(
            f"https://{bucket}.s3.amazonaws.com/",
            method="HEAD",
            headers={"User-Agent": USER_AGENT},
        )
        try:
            headers = urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_S).headers
        except urllib.error.HTTPError as exc:
            headers = exc.headers
        _S3_REGIONS[bucket] = headers.get("x-amz-bucket-region", "us-east-1")
    return _S3_REGIONS[bucket]


def https_of(url: str) -> str:
    """Public HTTPS form of an anonymous object-store URL (same bytes, no SDK)."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme == "s3":
        region = s3_bucket_region(parsed.netloc)
        return f"https://{parsed.netloc}.s3.{region}.amazonaws.com{parsed.path}"
    if parsed.scheme in ("gs", "gcs"):
        return f"https://storage.googleapis.com/{parsed.netloc}{parsed.path}"
    return url


def make_store(url: str, backend: str, sas_token: str | None = None) -> Any:
    if backend == "obstore":
        from obstore.store import from_url
        from zarr.storage import ObjectStore

        if sas_token:  # Azure blob over HTTPS with a SAS token
            parsed = urllib.parse.urlparse(url)
            account = parsed.netloc.split(".")[0]
            container, _, prefix = parsed.path.lstrip("/").partition("/")
            from obstore.store import AzureStore

            store = AzureStore(
                container,
                prefix=prefix,
                account_name=account,
                sas_key=sas_token,
            )
        else:
            public = https_of(url)  # same public HTTPS form as fsspec
            # obstore recognises S3 HTTPS URLs and would look for credentials
            # (environment, then EC2 instance metadata): anonymous = unsigned.
            anonymous = {"skip_signature": True} if ".amazonaws.com" in public else {}
            store = from_url(public, **anonymous)
        return ObjectStore(store, read_only=True)

    from zarr.storage import FsspecStore

    if sas_token:
        raise RuntimeError(
            "fsspec HTTP cannot add a SAS token to every request (needs adlfs or obstore)"
        )
    return FsspecStore.from_url(https_of(url), read_only=True)


def open_tree(store: Any, **kwargs: Any) -> xr.DataTree:
    return xr.open_datatree(store, engine="zarr", chunks=None, **kwargs)


# --------------------------------------------------------------------------- slice


@dataclass
class SliceOption:
    kind: str  # "map" (last two dims) or "series" (along one dim)
    isel: dict[str, int]
    estimated_bytes: int | None  # uncompressed bytes of the chunks touched


@dataclass
class SlicePlan:
    group: str
    variable: str
    dims: list[str]
    shape: list[int]
    stored_dtype: str
    chunks: list[int] | None
    shards: list[int] | None
    options: list[SliceOption]
    chosen: SliceOption | None
    notes: list[str] = field(default_factory=list)


def estimate_bytes(da: xr.DataArray, isel: dict[str, int]) -> int | None:
    """Uncompressed bytes zarr decodes to serve ``da.isel(isel)``: whole
    chunks (inner chunks when sharded: those are read by byte range), in the
    stored dtype (before scale_factor makes them float64)."""
    chunks = da.encoding.get("chunks")
    if not chunks:
        return None
    touched = [
        (c if dim in isel else -(-n // c) * c)
        for dim, n, c in zip(da.dims, da.shape, chunks, strict=True)
    ]
    itemsize = np.dtype(da.encoding.get("dtype", da.dtype)).itemsize
    return int(np.prod(touched)) * itemsize


def plan_slice(tree: xr.DataTree, prefer: str | None = None) -> SlicePlan | None:
    """What a quick look would draw, chosen by download cost.

    Variable: the fewest dims first, then the largest 2D field under
    MAX_SLICE_ELEMENTS. Options: the map (last two dims, index 0 elsewhere)
    and one series along each other dim (middle of the map). The map wins
    when it fits MAX_SLICE_BYTES, else the cheapest series that fits."""
    candidates = []
    for node in tree.subtree:
        for name, da in node.dataset.data_vars.items():
            if da.ndim < 2 or da.dtype.kind not in "iufb":
                continue
            if prefer and name != prefer:
                continue
            ny, nx = da.shape[-2:]
            if ny * nx > MAX_SLICE_ELEMENTS or min(ny, nx) < 8:
                continue
            candidates.append((da.ndim, -ny * nx, node.path, name, da))
    if not candidates:
        return None
    candidates.sort(key=lambda c: c[:2])
    _, _, path, name, da = candidates[0]

    lead, (ydim, xdim) = da.dims[:-2], da.dims[-2:]
    centre = {ydim: da.sizes[ydim] // 2, xdim: da.sizes[xdim] // 2}
    map_isel = dict.fromkeys(lead, 0)
    options = [SliceOption("map", map_isel, estimate_bytes(da, map_isel))]
    for along in lead:
        isel = {d: 0 for d in lead if d != along} | centre
        options.append(
            SliceOption(f"series along {along}", isel, estimate_bytes(da, isel))
        )
    fitting = [
        o
        for o in options
        if o.estimated_bytes is None or o.estimated_bytes <= MAX_SLICE_BYTES
    ]
    chosen = None
    if fitting:
        chosen = (
            fitting[0]
            if fitting[0].kind == "map"
            else min(fitting, key=lambda o: o.estimated_bytes or 0)
        )
    chunks, shards = da.encoding.get("chunks"), da.encoding.get("shards")
    plan = SlicePlan(
        group=path,
        variable=name,
        dims=list(da.dims),
        shape=list(da.shape),
        stored_dtype=str(np.dtype(da.encoding.get("dtype", da.dtype))),
        chunks=list(chunks) if chunks else None,
        shards=list(shards) if shards else None,
        options=options,
        chosen=chosen,
    )
    if chosen is None:
        plan.notes.append(
            f"every option is above {MAX_SLICE_BYTES // 2**20} MiB: a viewer asks first"
        )
    elif chosen.kind != "map":
        plan.notes.append(
            "the map is above the budget: the store is chunked for series"
        )
    return plan


def read_and_plot(tree: xr.DataTree, plan: SlicePlan, png: Path, title: str) -> None:
    assert plan.chosen is not None
    da = tree[plan.group].dataset[plan.variable].isel(plan.chosen.isel)
    values = np.asarray(da.values, dtype="float64")
    fig, ax = plt.subplots(figsize=(6, 4.5), dpi=90)
    if values.ndim == 2:
        finite = values[np.isfinite(values)]
        vmin, vmax = np.percentile(finite, [2, 98]) if finite.size else (0, 1)
        image = ax.imshow(
            values, vmin=vmin, vmax=vmax, cmap="viridis", interpolation="nearest"
        )
        fig.colorbar(image, ax=ax, shrink=0.8)
    else:
        da.plot(ax=ax)
    ax.set_title(
        f"{title}\n{plan.group}/{plan.variable} {plan.chosen.isel}", fontsize=8
    )
    fig.savefig(png, bbox_inches="tight")
    plt.close(fig)


# --------------------------------------------------------------------------- open


@dataclass
class OpenResult:
    name: str
    url: str
    backend: str
    ok: bool
    error: str | None = None
    open_seconds: float | None = None
    open_requests: int | None = None
    open_bytes: int | None = None
    forbidden_as_missing: int = 0
    zarr_format: int | None = None
    groups: int | None = None
    variables: int | None = None
    multiscales_groups: int | None = None
    html_repr_chars: int | None = None
    slice: dict | None = None
    slice_seconds: float | None = None
    slice_requests: int | None = None
    slice_bytes: int | None = None
    png: str | None = None
    noindex_open_seconds: float | None = None
    noindex_open_requests: int | None = None
    warm_open_seconds: float | None = None
    warm_open_requests: int | None = None
    warm_noindex_open_seconds: float | None = None
    warm_noindex_open_requests: int | None = None
    peak_rss_mib: int | None = None


def timed_open(store: Any, **kwargs: Any) -> tuple[float, xr.DataTree]:
    t0 = time.perf_counter()
    tree = open_tree(store, **kwargs)
    return round(time.perf_counter() - t0, 2), tree


def open_target(
    name: str,
    url: str,
    backend: str,
    out: Path,
    do_slice: bool,
    do_cache: bool,
    prefer: str | None = None,
) -> OpenResult:
    result = OpenResult(name=name, url=url, backend=backend, ok=False)
    sas = None
    try:
        if name.startswith("pc:"):
            collection = name.split(":", 1)[1]
            sas = get_json(f"{PC_SAS}/{collection}")["token"]

        def counting() -> tuple[CountingStore, ForbiddenAsMissingStore]:
            guard = ForbiddenAsMissingStore(make_store(url, backend, sas))
            return CountingStore(guard), guard

        store, guard = counting()
        result.open_seconds, tree = timed_open(store)
        result.open_requests, result.open_bytes = store.snapshot()
        result.forbidden_as_missing = len(guard.forbidden)
        result.zarr_format = store.zarr_format()
        result.groups = len(list(tree.subtree))
        result.variables = sum(len(n.dataset.data_vars) for n in tree.subtree)
        result.multiscales_groups = sum(
            1 for n in tree.subtree if "multiscales" in n.attrs
        )
        result.html_repr_chars = len(tree._repr_html_())
        result.ok = True

        if do_slice:
            plan = plan_slice(tree, prefer)
            if plan is None:
                result.slice = {"skipped": "no 2D field under the size limits"}
            else:
                result.slice = asdict(plan)
                if plan.chosen is not None:
                    before = store.snapshot()
                    t0 = time.perf_counter()
                    png = out / f"{name.replace(':', '_')}.png"
                    read_and_plot(tree, plan, png, name)
                    result.slice_seconds = round(time.perf_counter() - t0, 2)
                    result.slice_requests = store.gets - before[0]
                    result.slice_bytes = store.bytes - before[1]
                    result.png = png.name
        tree.close()

        # The info view needs no index: without creating the default indexes,
        # xarray does not read the 1D coordinates at open time.
        noindex, _ = counting()
        result.noindex_open_seconds, tree = timed_open(
            noindex, create_default_indexes=False
        )
        result.noindex_open_requests = noindex.gets
        tree.close()

        if do_cache:
            cache_dir = out / "cache" / hashlib.sha1(url.encode()).hexdigest()[:16]
            # Fill the cache, then open as the next process would.
            filler, _ = counting()
            open_tree(MetadataCacheStore(filler, cache_dir)).close()
            warm, _ = counting()
            result.warm_open_seconds, tree = timed_open(
                MetadataCacheStore(warm, cache_dir)
            )
            result.warm_open_requests = warm.gets
            tree.close()
            warm, _ = counting()
            result.warm_noindex_open_seconds, tree = timed_open(
                MetadataCacheStore(warm, cache_dir), create_default_indexes=False
            )
            result.warm_noindex_open_requests = warm.gets
            tree.close()
    except Exception as exc:  # a prototype: record and go on
        result.error = f"{type(exc).__name__}: {str(exc)[:300]}"
    return result


def fixed_targets() -> dict[str, tuple[str, str | None]]:
    """Public stores outside any STAC catalog (name -> url, preferred variable)."""
    return {
        "dynamical:gfs-forecast": (
            "https://data.dynamical.org/noaa/gfs/forecast/latest.zarr",
            "temperature_2m",
        ),
        "gcs:arco-era5": (
            "gs://gcp-public-data-arco-era5/ar/1959-2022-full_37-1h-0p25deg-chunk-1.zarr-v2",
            "2m_temperature",
        ),
        "gcs:cmip6-cesm2-tas": (
            "gs://cmip6/CMIP6/ScenarioMIP/NCAR/CESM2/ssp585/r4i1p1f1/Amon/tas/gn/v20200528",
            None,
        ),
        "s3:mur-sst": ("s3://mur-sst/zarr-v1", "analysed_sst"),
        "s3:nwm-chrtout": (
            "s3://noaa-nwm-retrospective-2-1-zarr-pds/chrtout.zarr",
            None,
        ),
    }


def urls_part(report: dict, backend: str) -> None:
    """s3:// gs:// -> https, and a store opened without its consolidated
    metadata over plain HTTPS (no listing on object stores)."""
    rows = []
    for name, (url, _) in fixed_targets().items():
        public = https_of(url)
        meta = public.rstrip("/") + "/.zmetadata"
        try:
            request = urllib.request.Request(
                meta, method="HEAD", headers={"User-Agent": USER_AGENT}
            )
            status = urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_S).status
        except urllib.error.HTTPError as exc:
            status = exc.code
        rows.append({"name": name, "url": url, "https": public, ".zmetadata": status})
    report["urls"] = rows

    eopf = report.get("targets", {}).get("eopf:sentinel-2-l2a")
    if eopf:
        store = CountingStore(make_store(eopf, backend))
        t0 = time.perf_counter()
        try:
            tree = open_tree(store, consolidated=False)
            outcome = f"opened: {len(list(tree.subtree))} groups, {sum(len(n.dataset.data_vars) for n in tree.subtree)} variables"
        except Exception as exc:
            outcome = f"{type(exc).__name__}: {str(exc)[:200]}"
        report["unconsolidated_over_https"] = {
            "url": eopf,
            "outcome": outcome,
            "seconds": round(time.perf_counter() - t0, 2),
            "requests": store.gets,
            "lists": store.lists,
        }


# --------------------------------------------------------------------------- report


def mib(n: int | None) -> str:
    return "-" if n is None else f"{n / 2**20:.2f}"


def write_markdown(report: dict, path: Path) -> None:
    lines = [f"# Remote Zarr prototype — {report['date']} ({report['backend']})", ""]
    stac = report.get("stac")
    if stac:
        lines += [
            "## Catalogs",
            "",
            "| Catalog | Size | Seconds |",
            "| --- | --- | --- |",
        ]
        for c in stac["catalogs"]:
            size = ", ".join(
                f"{k}={v}" for k, v in c.items() if k not in ("name", "url", "seconds")
            )
            lines.append(f"| {c['name']} | {size} | {c['seconds']} |")
        lines += ["", "## Zarr assets found (first item per collection)", ""]
        lines += [
            "| Catalog | Owner | Key | Media type | Root | Open hints |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for a in stac["assets"]:
            hints = (
                json.dumps(a["open_kwargs"] | a["zarr_fields"])
                if (a["open_kwargs"] or a["zarr_fields"])
                else ""
            )
            lines.append(
                f"| {a['catalog']} | {a['owner'][:40]} | {a['key']} | `{a['media_type']}` | "
                f"{'yes' if a['is_store_root'] else 'sub-group'} | {hints[:120]} |"
            )
        if stac.get("search"):
            lines += [
                "",
                "## Item search",
                "",
                "```json",
                json.dumps(stac["search"], indent=1),
                "```",
            ]
    if report.get("open"):
        lines += [
            "",
            "## Open",
            "",
            "Seconds (requests). _No index_: `create_default_indexes=False`. _Warm_: metadata documents",
            "from the disk cache, as a second process would see them.",
            "",
            "| Target | Zarr | Groups | Vars | Multiscales | HTML repr kchars | Open | Open MiB | No index | Warm | Warm, no index | 403 as missing | Peak RSS MiB | Error |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for r in report["open"]:

            def sr(s, n):
                return "-" if s is None else f"{s} ({n})"

            lines.append(
                f"| {r['name']} | {r['zarr_format'] or '-'} | {r['groups'] or '-'} | {r['variables'] or '-'} | "
                f"{r['multiscales_groups'] or '-'} | {(r['html_repr_chars'] or 0) // 1000} | "
                f"{sr(r['open_seconds'], r['open_requests'])} | {mib(r['open_bytes'])} | "
                f"{sr(r['noindex_open_seconds'], r['noindex_open_requests'])} | "
                f"{sr(r['warm_open_seconds'], r['warm_open_requests'])} | "
                f"{sr(r['warm_noindex_open_seconds'], r['warm_noindex_open_requests'])} | "
                f"{r['forbidden_as_missing'] or ''} | {r.get('peak_rss_mib') or '-'} | {(r['error'] or '')[:100]} |"
            )
        lines += [
            "",
            "## Quick-look slice",
            "",
            f"Estimate: uncompressed bytes of the chunks touched, stored dtype. Budget {MAX_SLICE_BYTES // 2**20} MiB.",
            "",
            "| Target | Variable | Shape | Chunks (shards) | Options: estimate MiB | Chosen | Read MiB (req) | Seconds | Notes |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for r in report["open"]:
            sl = r.get("slice")
            if not sl:
                continue
            if "skipped" in sl:
                lines.append(f"| {r['name']} | {sl['skipped']} | | | | | | | |")
                continue
            options = "; ".join(
                f"{o['kind']}: {mib(o['estimated_bytes'])}" for o in sl["options"]
            )
            chosen = sl["chosen"]["kind"] if sl["chosen"] else "none"
            chunks = f"{sl['chunks']}" + (f" ({sl['shards']})" if sl["shards"] else "")
            lines.append(
                f"| {r['name']} | {sl['group'].rstrip('/')}/{sl['variable']} | {sl['shape']} {sl['stored_dtype']} | {chunks} | "
                f"{options} | {chosen} | {mib(r['slice_bytes'])} ({r['slice_requests'] if r['slice_requests'] is not None else '-'}) | "
                f"{r['slice_seconds'] or '-'} | {'; '.join(sl['notes'])} |"
            )
    if report.get("urls"):
        lines += [
            "",
            "## URL forms",
            "",
            "| Target | URL | HTTPS | HEAD .zmetadata |",
            "| --- | --- | --- | --- |",
        ]
        lines += [
            f"| {u['name']} | `{u['url']}` | `{u['https']}` | {u['.zmetadata']} |"
            for u in report["urls"]
        ]
    if report.get("unconsolidated_over_https"):
        lines += ["", "## Without consolidated metadata over HTTPS", "", "```json"]
        lines += [json.dumps(report["unconsolidated_over_https"], indent=1), "```"]
    path.write_text("\n".join(lines) + "\n")


def run_isolated(
    name: str, url: str, prefer: str | None, store: str, out: Path, parts: set[str]
) -> dict:
    """``open_target`` in a child process with a memory limit; its result."""
    payload = {
        "name": name,
        "url": url,
        "prefer": prefer,
        "slice": "slice" in parts,
        "cache": "cache" in parts,
    }
    command = [
        sys.executable,
        __file__,
        "--store",
        store,
        "--out",
        str(out),
        "--child",
        json.dumps(payload),
    ]

    def limit() -> None:
        resource.setrlimit(
            resource.RLIMIT_AS, (CHILD_ADDRESS_SPACE, CHILD_ADDRESS_SPACE)
        )

    try:
        proc = subprocess.run(
            command,
            capture_output=True,
            text=True,
            preexec_fn=limit,
            timeout=CHILD_TIMEOUT_S,
        )
        lines = proc.stdout.strip().splitlines()
        if proc.returncode == 0 and lines:
            return json.loads(lines[-1])
        error = f"child exit {proc.returncode}: {proc.stderr.strip()[-300:]}"
    except subprocess.TimeoutExpired:
        error = f"child timed out after {CHILD_TIMEOUT_S} s"
    return asdict(OpenResult(name=name, url=url, backend=store, ok=False, error=error))


def child_main(args: argparse.Namespace) -> int:
    payload = json.loads(args.child)
    out: Path = args.out / args.store
    result = open_target(
        payload["name"],
        payload["url"],
        args.store,
        out,
        payload["slice"],
        payload["cache"],
        payload["prefer"],
    )
    result.peak_rss_mib = (
        resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024
    )  # KiB on Linux
    print(json.dumps(asdict(result), default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--only", default="stac,open,slice,cache,urls")
    parser.add_argument("--store", choices=("fsspec", "obstore"), default="fsspec")
    parser.add_argument(
        "--targets", default="", help="comma-separated name prefixes to keep"
    )
    parser.add_argument(
        "--child", help=argparse.SUPPRESS
    )  # one target, JSON; used by run_isolated
    args = parser.parse_args()
    if args.child:
        return child_main(args)
    parts = set(args.only.split(","))
    out: Path = args.out / args.store
    out.mkdir(parents=True, exist_ok=True)

    if not online():
        return 0

    report: dict[str, Any] = {
        "date": time.strftime("%Y-%m-%d %H:%M"),
        "backend": args.store,
        "versions": {"python": sys.version.split()[0], "xarray": xr.__version__},
    }
    import zarr

    report["versions"]["zarr"] = zarr.__version__
    targets: dict[str, tuple[str, str | None]] = {}
    if "stac" in parts or "open" in parts:
        found = stac_part(report)
        report["targets"] = found
        keep = (
            "eopf:sentinel-2-l2a",
            "eopf:sentinel-2-l2a-zarr3",
            "eopf:sentinel-3-slstr-l2-lst",
            "eopf:sentinel-1-l1-grd",
            "pc:daymet-annual-hi",
            "cmems:timeChunked",
            "cmems:geoChunked",
            "cmems:downsampled4",
        )
        for name in keep:
            if name in found:
                targets[name] = (
                    found[name],
                    "zos" if name.startswith("cmems") else None,
                )
        targets |= fixed_targets()
    if args.targets:
        prefixes = tuple(args.targets.split(","))
        targets = {k: v for k, v in targets.items() if k.startswith(prefixes)}

    if "open" in parts:
        report["open"] = []
        for name, (url, prefer) in targets.items():
            print(f"open {name} ...", flush=True)
            result = run_isolated(name, url, prefer, args.store, args.out, parts)
            print(
                f"  {result['open_seconds']}s, peak {result['peak_rss_mib']} MiB {result['error'] or ''}",
                flush=True,
            )
            report["open"].append(result)
    if "urls" in parts:
        urls_part(report, args.store)

    (out / "report.json").write_text(json.dumps(report, indent=1, default=str))
    write_markdown(report, out / "report.md")
    print(f"remote_zarr: report in {out / 'report.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
