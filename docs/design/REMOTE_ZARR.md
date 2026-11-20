# Remote Zarr and STAC browsing — design

|                 |                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Status**      | Draft for review — design and prototype only, no product code                                                        |
| **Date**        | 2026-11-19                                                                                                           |
| **Branch**      | `eschalk/remote-zarr-design`, from `main` (v0.13.0)                                                                  |
| **Prototype**   | [`scripts/prototypes/remote_zarr.py`](../../scripts/prototypes/remote_zarr.py) → `artefacts/prototypes/remote_zarr/` |
| **Growth plan** | §5.3 "Remote data (no download)", and §5.2 "ESA EOPF Sentinel Zarr", which it serves                                 |
| **Scope**       | Anonymous (public) data only. Authentication is a later phase (§ 10, P4)                                             |

## 0. TL;DR

- **The data is there, public, and in Zarr.** Three public STAC catalogs list Zarr stores that can be read without an account. Measured on 2026-11-19:
  - **ESA EOPF**: 16 Sentinel-1/2/3 collections, a STAC API with search. Its assets even carry `xarray:open_datatree_kwargs`.
  - **Copernicus Marine**: 364 products in a static catalog, each dataset in three chunkings (time, geo, downsampled).
  - **Microsoft Planetary Computer**: 13 Zarr collections. They need a short-lived SAS token from an anonymous endpoint.

  Many more stores are public without a catalog: dynamical.org (GFS, IFS ENS), ARCO ERA5 and WeatherBench2 on Google Cloud, Pangeo CMIP6 on GCS / AWS, AWS Open Data (MUR SST, NWM…).

- **Nobody does this in VS Code.** Web viewers exist (GridLook, Browzarr, inspect.geozarr.org, EOPF Explorer), and QGIS reads STAC. In VS Code, the only STAC tools found are Debrief (local catalogs) and Microsoft's Planetary Computer Pro MCP tools (search for Copilot). No VS Code tool opens a remote Zarr store with xarray and lets the user browse and plot it.
- **The backend part is small; the hard parts are cost and identity.** In the prototype, plain `xr.open_datatree(url, engine="zarr")` with fsspec + aiohttp opens 12 of the 13 public stores tried; the 13th (Planetary Computer, signed) opens with obstore. The issues found are all fixable:
  1. **Opening reads coordinates.** Building default indexes reads every 1D coordinate. MUR SST takes **30 s and 1,297 requests** to open; with `create_default_indexes=False` (xarray ≥ 2025.7.1) it takes **0.7 s and 6 requests**.
  2. **One quick look can download hundreds of MB.** The cost depends on chunking:
     - one GFS map is ~422 MiB, because the store is chunked for forecast series;
     - one CMIP6 `tas` map is ~86 MiB, one ERA5 map ~4 MiB;
     - Copernicus Marine publishes each dataset twice: a map costs 48 MiB in the time-chunked copy and 4.5 GiB in the geo-chunked one.

     The size can be **estimated from the chunk grid before reading**: a safe upper bound in every case measured. The viewer can then choose a cheaper slice, an overview or a sibling store, or ask the user first.

  3. **Without consolidated metadata, an HTTPS open "succeeds" with an empty tree.** There is no error, so the viewer must detect it.
  4. **Object-store quirks:**
     - S3 answers **403** for a missing key, which breaks zarr's v3 → v2 probe (Copernicus Marine).
     - `s3://` needs the bucket region.
     - Planetary Computer needs a SAS token on every request.
  5. **Every request is a new Python process**, so every plot reopens the store. A small **on-disk cache** of the metadata documents (and of small 1D chunks), plus no-index opening, brings a reopen down to **0.05–0.5 s and 0–4 requests**.
- **Recommendation:**
  - **Browse catalogs in TypeScript.** STAC is JSON over HTTPS, so a tree view needs no Python.
  - **Open data in the existing Python backend.** It takes a URL instead of a path.
  - **Build in four phases** (§ 10):
    - **P1:** an _Open Remote Dataset…_ command for a Zarr URL, with a download budget and a metadata cache.
    - **P2:** a _Remote Data_ tree view (STAC catalogs → collections → items → Zarr assets) with simple search.
    - **P3:** overviews and cost-aware plot suggestions, remote Kerchunk, Planetary Computer signing.
    - **P4:** authentication, OPeNDAP, Icechunk.
- **New dependencies:** `fsspec` + `aiohttp` only, about 10 small wheels. Do **not** add `xarray-eopf`: its current release pins `zarr<3` (§ 4.4). Do not add `s3fs` / `gcsfs` / `adlfs` either: anonymous S3 and GCS are plain HTTPS.

## 1. Goal

A user in VS Code can **find** a public remote dataset, **look inside** it (groups, variables, attributes, encoding, the same view as for a local file) and **plot** a slice. They never download the product, and no Python code is needed. The flagship case is an EOPF Sentinel product, found in the EOPF STAC catalog by place and date and opened in one click.

### 1.1 Goals

1. Open a public Zarr store from a URL: `https://`, `s3://`, `gs://`, Zarr v2 or v3, consolidated or not where possible.
2. Browse public STAC catalogs (API or static) down to Zarr assets, and open them.
3. Show the **cost** of a plot before paying it: estimated download, and a confirmation above a budget.
4. Stay responsive: cancel any open or plot; time out cleanly; say what went wrong in a sentence (offline, private, not Zarr, no consolidated metadata, too big).
5. Keep today's guarantees: user interpreters are never modified, the `.vsix` stays an allow-list, the backend runs on Python 3.10+ / xarray ≥ 2024.10 (degrading features, not failing).

### 1.2 Non-goals (this design)

- Credentials of any kind (S3 profiles, Earthdata `.netrc`, CDSE / DestinE tokens): § 10, P4.
- Writing, converting or downloading whole products ("Save as NetCDF"). We stay a viewer.
- A map-based search UI. A bbox typed or picked from presets is enough at first; a map is P3.
- Other remote formats: NetCDF over HTTP byte ranges, OPeNDAP, COG. The design leaves room for them (§ 5.1). Remote **Kerchunk** JSON is cheap to add because it already goes through fsspec (P3).
- Dask. Reads stay lazy-by-index (`chunks=None`), as today.

## 2. What exists online

### 2.1 Catalogs that list Zarr stores

All of these were queried live on 2026-11-19 (prototype part `stac`).

| Catalog                                                                                  | Kind                                                           | Zarr assets                                                                                                                        | Anonymous read                                                                  | Notes                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EOPF Sentinel Zarr Samples** — `https://stac.core.eopf.eodc.eu`                        | STAC API 1.0 (stac-fastapi-pgstac)                             | On **items**: the product root (`product`) and sub-groups (`SR_10m`, `B04_10m`, `reflectance`…), plus a `.zip` and `.zmetadata`    | **Yes**, HTTPS on `data.eodc.eu`                                                | 16 collections (S1 GRD/SLC/OCN, S2 L1C/L2A, S3 OLCI/SLSTR…), incl. four **Zarr v3** collections (`sentinel-1-l1-grd-zarr3`, `sentinel-1-l1-slc-zarr3`, `sentinel-2-l1c-zarr3`, `sentinel-2-l2a-zarr3`): the v3 move is under way. Search, sort, CQL2 filter. Rolling one-year archive for S2. |
| **Copernicus Marine** — `https://stac.marine.copernicus.eu/metadata/catalog.stac.json`   | Static catalog (catalog → product collections → dataset items) | On **items**: `timeChunked`, `geoChunked`, `downsampled4` (one store per chunking strategy), plus native NetCDF and WMTS           | **Yes**, S3-compatible HTTPS (`s3.waw3-1.cloudferro.com`)                       | 364 products. The data is the "ARCO" layer behind the `copernicusmarine` toolbox; anonymous reads work, but missing keys answer 403 (§ 3.2).                                                                                                                                                  |
| **Microsoft Planetary Computer** — `https://planetarycomputer.microsoft.com/api/stac/v1` | STAC API                                                       | **Collection-level** assets `zarr-https` / `zarr-abfs` (Daymet, gridMET, TerraClimate, CONUS404, GPM IMERG): 13 of 139 collections | **With a SAS token** from `…/api/sas/v1/token/<collection>` (anonymous, ~1 day) | Plain HTTPS answers 409 "public access not permitted". Assets implement the xarray-assets extension (`xarray:open_kwargs`).                                                                                                                                                                   |
| NASA VEDA — `https://openveda.cloud/api/stac`                                            | STAC API                                                       | 2 of 247 collections (`s3://veda-data-store…`)                                                                                     | **No** (403)                                                                    | Out of scope until authentication.                                                                                                                                                                                                                                                            |

Public stores without a STAC catalog, all opened anonymously by the prototype:

| Store                                                                 | URL                                                                              | Zarr        | Notes                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| dynamical.org NOAA GFS forecast (also analysis, ECMWF IFS ENS, HRRR…) | `https://data.dynamical.org/noaa/gfs/forecast/latest.zarr`                       | v3, sharded | Updated several times a day (`latest` moves): caches need an expiry     |
| Google ARCO ERA5                                                      | `gs://gcp-public-data-arco-era5/ar/1959-2022-full_37-1h-0p25deg-chunk-1.zarr-v2` | v2          | 552,264 hourly steps; one map = one chunk                               |
| Pangeo CMIP6 (GCS, mirrored on AWS `cmip6-pds`)                       | `gs://cmip6/CMIP6/ScenarioMIP/NCAR/CESM2/ssp585/r4i1p1f1/Amon/tas/gn/v20200528`  | v2          | Thousands of stores, indexed by an **intake-esm CSV catalog**, not STAC |
| AWS Open Data MUR SST                                                 | `s3://mur-sst/zarr-v1` (us-west-2)                                               | v2          | 17999 × 36000 grid: no map fits a quick look without an overview        |
| AWS Open Data NWM retrospective                                       | `s3://noaa-nwm-retrospective-2-1-zarr-pds/chrtout.zarr`                          | v2          | 2.7 M river reaches × 367 k hours: 1D-heavy                             |
| Google WeatherBench2                                                  | `gs://weatherbench2/datasets/era5/…zarr`                                         | v2          | Checked with a metadata `HEAD` only                                     |

### 2.2 How STAC describes a Zarr store (and how inconsistently)

What a viewer has to understand, seen in the live catalogs:

- **Two media types.** The older `application/vnd+zarr` is used by Planetary Computer, the EOPF v2 collections and Copernicus Marine. The newer, versioned `application/vnd.zarr; version=3; profile=multiscales` is used by EOPF's v3 collections and recommended by the EOAP best practices. Match on "zarr" in the type and read the `version` / `profile` parameters when present.
- **Where the asset lives:**
  - On items (EOPF, Copernicus Marine).
  - On the **collection, with no items at all** (Planetary Computer).
- **Root or sub-group.** EOPF publishes the product root _and_ assets that point inside it (`…zarr/measurements/reflectance/r10m`, even single arrays `…/r10m/b04`). Opening a sub-group URL as a store works, because consolidated metadata exists at every level in EOPF v2. The better UX is still to open the **root** and reveal the sub-group (§ 6.3).
- **Hints for opening:**
  - `xarray:open_kwargs` / `xarray:open_dataset_kwargs` / `xarray:open_datatree_kwargs` (xarray-assets extension). Examples: Planetary Computer `{"consolidated": true}`; EOPF `{"engine": "eopf-zarr", "op_mode": "native", "chunks": {}}`.
  - `zarr:node_type`, `zarr:consolidated` (the newer [zarr STAC extension](https://github.com/stac-extensions/zarr), on EOPF v3).
  - These hints come from a remote document: they are **untrusted input**. An allow-list applies (§ 9).
- **Datacube extension** (`cube:variables`, `cube:dimensions`): present on Copernicus Marine and EOPF v3. It is enough to show "what is inside" in the tree **before** opening the store.
- **Multiscales.** EOPF v3 groups carry the GeoZarr `multiscales` convention (`zarr_conventions`, `layout` with `r10m … r720m`). That gives free overviews for quick looks (F7, § 6.4).

### 2.3 Tools that already do part of this

| Tool                                                                                             | What it does                                                               | Gap we fill                                                                 |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [STAC Browser](https://github.com/radiantearth/stac-browser) (Radiant Earth), EOPF's own browser | Web UI over any STAC API / static catalog                                  | Browses metadata; does not open Zarr contents                               |
| [EOPF Sentinel Zarr Explorer](https://explorer.eopf.copernicus.eu)                               | Web map viewer for EOPF products                                           | Sentinel only, web only                                                     |
| GridLook, Browzarr, [inspect.geozarr.org](https://inspect.geozarr.org)                           | Web viewers of remote Zarr (WebGL maps, structure inspection), client-side | Need a CORS-enabled store; no xarray decoding (CF, time); not in the editor |
| QGIS (STAC data source, GDAL Zarr driver)                                                        | Desktop GIS; STAC search, Zarr via `/vsicurl/`                             | GIS-oriented, no DataTree / CF view                                         |
| Debrief VS Code extension                                                                        | Local STAC catalogs as virtual folders (maritime analysis)                 | Local only, not scientific arrays                                           |
| Planetary Computer Pro MCP Tools (VS Code)                                                       | STAC search and GeoCatalog management through Copilot                      | No data viewing                                                             |

_Sources: their docs and announcements, read on 2026-11-19; only the catalogs and stores in §§ 2.1–2.2 were tested by us._

The niche is real: "xarray in your editor", for remote stores, is not done by anyone, and EOPF users are about to need it (growth plan §5.2).

## 3. Prototype

`scripts/prototypes/remote_zarr.py`, plain xarray / zarr / fsspec / matplotlib, outside the backend:

```bash
.venv/bin/python scripts/prototypes/remote_zarr.py                      # all parts, fsspec
.venv/bin/python scripts/prototypes/remote_zarr.py --only stac          # catalogs only (~5 s)
.venv/bin/python scripts/prototypes/remote_zarr.py --targets eopf,cmems # a subset of stores
uv run --no-project --python .venv/bin/python --with obstore \
    python scripts/prototypes/remote_zarr.py --store obstore            # obstore instead of fsspec
```

Output: `artefacts/prototypes/remote_zarr/<store>/report.md` (+ `report.json`, one PNG per slice, the metadata cache). Offline, it prints a note and exits 0.

What it does:

| Part    | What                                                                                                                                                                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stac`  | A small STAC client over `urllib` (no pystac) walks EOPF (API), Planetary Computer (API, collection assets) and Copernicus Marine (static), lists every Zarr asset with its hints, and runs one EOPF item search (bbox around Sophia Antipolis, last 60 days, least cloudy first) |
| `open`  | `xr.open_datatree(store, engine="zarr", chunks=None)` through a zarr `WrapperStore` that counts requests and bytes; also with `create_default_indexes=False`                                                                                                                      |
| `slice` | Picks the quick-look slice the viewer's automatic layout would, **estimates its download from the chunk grid**, chooses map or series by cost, reads it, compares estimate and reality, renders a PNG                                                                             |
| `cache` | Opens once to fill an on-disk cache of metadata documents (`.zmetadata`, `zarr.json`, `.zarray`…), then opens again as the next process would                                                                                                                                     |
| `urls`  | `s3://` / `gs://` → public HTTPS, and a store opened without its consolidated metadata over HTTPS                                                                                                                                                                                 |

Setup:

- dev `.venv`: Python 3.13.1, xarray 2026.7.0, zarr 3.1.3, fsspec 2025.9.0, aiohttp 3.13.2;
- an office connection in France.

Each store is opened in **its own child process with a 6 GiB address-space limit**, and its peak RSS is recorded. The first version opened every store in one process. During its full run the machine ran out of memory, and the kernel killed other applications (a browser, an editor window). The per-store peaks measured since (F11) show the prototype was not the only consumer, but a viewer-like workload must not be allowed to grow without bound.

### 3.1 Results

Run of 2026-11-19, fsspec store. The EOPF products are the first item of each collection that day: they change daily.

**Opening.** Times in seconds, requests in parentheses.

- _No index_: `create_default_indexes=False`.
- _Warm_: metadata documents served from the disk cache, as the next process would see them.
- _HTML_: size of xarray's HTML repr, which the info view ships to the webview.

| Store                                          | Zarr | Groups / vars | HTML (k chars) | Open             | Metadata MiB | No index     | Warm         | Warm, no index | Peak RSS MiB |
| ---------------------------------------------- | ---- | ------------- | -------------- | ---------------- | ------------ | ------------ | ------------ | -------------- | ------------ |
| EOPF S2 L2A                                    | 2    | 32 / 83       | 346            | 3.92 (45)        | 0.86         | 0.25 (4)     | 3.20 (41)    | **0.05 (0)**   | 453          |
| EOPF S2 L2A, Zarr v3                           | 3    | 48 / 174      | 400            | 5.70 (77)        | 1.37         | 0.74 (4)     | 4.86 (73)    | **0.08 (0)**   | 454          |
| EOPF S3 SLSTR LST                              | 2    | 13 / 77       | 318            | 1.74 (24)        | 0.44         | 0.91 (16)    | 1.11 (20)    | 0.69 (12)      | 326          |
| EOPF S1 GRD                                    | 2    | 25 / 78       | 440            | 4.76 (72)        | 0.66         | 2.45 (40)    | 4.24 (68)    | 2.36 (36)      | 169          |
| Planetary Computer Daymet HI (obstore, signed) | 2    | 1 / 7         | 30             | 1.23 (51)        | 0.01         | 0.57 (8)     | 1.09 (47)    | 0.50 (4)       | 179          |
| Copernicus Marine, time-chunked                | 2    | 1 / 14        | 39             | 1.02 (12)        | 0.03         | 0.21 (6)     | 0.43 (8)     | 0.14 (2)       | 960          |
| Copernicus Marine, geo-chunked                 | 2    | 1 / 14        | 39             | 0.79 (12)        | 0.03         | 0.21 (6)     | 0.47 (8)     | 0.15 (2)       | 168          |
| Copernicus Marine, downsampled4                | 2    | 1 / 14        | 39             | 0.82 (12)        | 0.02         | 0.22 (6)     | 0.43 (8)     | 0.14 (2)       | 224          |
| dynamical.org GFS forecast                     | 3    | 1 / 25        | 60             | 5.37 (12)        | 0.50         | 1.05 (8)     | 0.55 (8)     | 0.32 (4)       | 211          |
| ARCO ERA5                                      | 2    | 1 / 31        | 53             | 1.46 (17)        | 0.07         | 0.38 (6)     | 0.22 (13)    | 0.08 (2)       | 293          |
| Pangeo CMIP6 CESM2 `tas`                       | 2    | 1 / 1         | 30             | 1.31 (11)        | 0.03         | 0.29 (8)     | 0.23 (7)     | 0.13 (4)       | 155          |
| AWS MUR SST                                    | 2    | 1 / 4         | 27             | **31.16 (1297)** | 0.10         | **0.76 (6)** | 30.03 (1293) | **0.47 (2)**   | 161          |
| AWS NWM `chrtout`                              | 2    | 1 / 3         | 26             | **9.99 (554)**   | 0.99         | **0.46 (6)** | 9.32 (550)   | **0.30 (2)**   | 205          |

**Quick-look slice.**

- The variable and the slice are what the viewer's automatic layout would pick: the last two dims, index 0 elsewhere.
- _Estimate_: uncompressed bytes of the chunks touched, in the stored dtype. It is computed before reading. Budget: 64 MiB.
- When the map is over budget, the cheapest series that fits is read instead.

| Store                           | Variable, shape, stored dtype                    | Chunks (shards)                           | Estimates (MiB)                                                     | Read                   | MiB read (requests) | s    |
| ------------------------------- | ------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------- | ---------------------- | ------------------- | ---- |
| EOPF S2 L2A                     | `r60m/b01` 1830² uint16                          | 1830²                                     | map 6.39                                                            | map                    | 0.19 (1)            | 0.49 |
| EOPF S2 L2A, Zarr v3            | `r60m/b01` 1830² uint16                          | 1024² (2048²)                             | map 8.00                                                            | map                    | 0.18 (1)            | 0.60 |
| EOPF S3 SLSTR LST               | `lst` 1200 × 1500 int16                          | 601 × 750                                 | map 3.44                                                            | map                    | 1.67 (4)            | 0.74 |
| Planetary Computer Daymet HI    | `prcp` 41 × 584 × 284 float32                    | 1 × 584 × 284                             | map 0.63, series 25.9                                               | map                    | 0.07 (1)            | 0.21 |
| Copernicus Marine, time-chunked | `zos` 1642 × 2041 × 4320 float32                 | 1 × 512 × 2048                            | **map 48**, series 6,568                                            | map                    | 17.31 (12)          | 1.95 |
| Copernicus Marine, geo-chunked  | same variable                                    | 134 × 32 × 32                             | map **4,522**, **series 6.8**                                       | series                 | 5.07 (13)           | 0.81 |
| Copernicus Marine, downsampled4 | `zos` 1642 × 511 × 1080                          | 1 × 511 × 1080                            | **map 2.1**, series 3,457                                           | map                    | 1.20 (1)            | 1.08 |
| dynamical.org GFS               | `temperature_2m` 8113 × 209 × 721 × 1440 float32 | 1 × 105 × 121 × 121 (1 × 210 × 726 × 726) | map **422**, series / init_time 47,578, **series / lead_time 11.7** | series along lead_time | 2.68 (7)            | 5.10 |
| ARCO ERA5                       | `2m_temperature` 552264 × 721 × 1440 float32     | 1 × 721 × 1440                            | map 3.96                                                            | map                    | 2.23 (1)            | 0.49 |
| Pangeo CMIP6 CESM2              | `tas` 1032 × 192 × 288 float32                   | 408 × 192 × 288                           | map **86**, series 258                                              | **none: would ask**    | -                   | -    |
| AWS MUR SST, NWM                | 17999 × 36000 grid; 1D reaches                   | -                                         | no field under 10 M elements                                        | -                      | -                   | -    |

**STAC.**

- Each catalog's root and collections list loads in 0.4–0.8 s (EOPF 16 collections, Planetary Computer 139, Copernicus Marine 364 products).
- The EOPF item search answers in 0.55 s: bbox around Sophia Antipolis, 60 days, sorted by cloud cover. The best scene had 0.02 % cloud.

**Without consolidated metadata.**

- Opening the EOPF S2 store with `consolidated=False` over HTTPS returns in 0.51 s.
- It finds **1 group and 0 variables**, and raises no error (4 requests, 2 listings attempted).

### 3.2 Findings

- **F1. It works with what xarray already has.**
  - `xr.open_datatree(<zarr store>, engine="zarr", chunks=None)` over fsspec + aiohttp opened 12 of the 13 stores. They cover Zarr v2 and v3, sharded and not, and EOPF trees of up to 48 groups and 174 variables.
  - The 13th, Planetary Computer, opens with obstore and a SAS token.
  - Two small store wrappers were needed: F8 and F9.
- **F2. The open cost is coordinates, not metadata.** Metadata is 0.02–1.4 MiB. What makes MUR SST take 31 s and 1,297 requests is xarray reading every 1D coordinate to build the default indexes. The same holds, less extremely, for NWM (10 s, 554 requests) and EOPF (4–6 s, 45–77 requests).
  - `create_default_indexes=False` brings these opens to **0.2–1.0 s and 4–8 requests**.
  - The info view needs no index. The plot path selects by position (`isel`), so it needs none either.
  - The option exists from **xarray 2025.7.1**: feature-detect it, and fall back to today's behaviour on older interpreters.
- **F3. CF time decoding reads data at open.**
  - Even without indexes, EOPF S1 GRD reads 36 chunks (2.4 s): `azimuth_time` / `azimuth_time_gcp` in 16 groups. xarray's datetime decoding reads the first and last value of each time variable to check it can decode them. S3 SLSTR shows the same (12 reads).
  - Turning `decode_times` off would show raw numbers. Better: cache these **small 1D chunks** with the metadata (F4).
- **F4. A metadata cache alone barely helps; with no-index opening it makes reopening nearly free.**
  - Warm metadata alone: EOPF S2 3.9 → 3.2 s, MUR 31 → 30 s.
  - Warm metadata plus no index: **0.05–0.5 s with 0–4 requests**. The exceptions are the time variables of F3: 0.7–2.4 s.
  - Every plot is a new process, so this is the difference between a viewer that feels local and one that does not.
- **F5. The chunk-grid estimate is a safe upper bound, and cheap.**
  - Read / estimate ratios:
    - 0.03 for EOPF S2: the tile is mostly outside the swath, and chunks that would only hold the fill value are never written;
    - 0.36 for Copernicus Marine;
    - 0.49 for S3 LST;
    - 0.56 for ERA5;
    - 0.23 for the GFS series.
  - It never underestimated. It needs only `encoding["chunks"]` and the stored dtype.
  - The first version used the decoded dtype (float64 after `scale_factor`) and overestimated EOPF ×4.
- **F6. Chunking decides which plot is cheap, by orders of magnitude.**
  - Copernicus Marine publishes the same variable twice:
    - **time-chunked**: map 48 MiB, series 6.6 GiB;
    - **geo-chunked**: map 4.5 GiB, series 6.8 MiB.
  - GFS is chunked for forecast series: one map at one lead time is **422 MiB**, one point's 209-step series 11.7 MiB.
  - CMIP6 `tas` (408 months per chunk) costs 86 MiB for any map.
  - A viewer that just draws "the first map" will, on some stores, download hundreds of MB without telling anyone. So the estimate, the alternatives and the confirmation (§ 6.4) are core to the feature. When a STAC item offers several chunkings, the viewer should pick the store that suits the plot.
- **F7. Overviews exist and are the cheap quick look.**
  - EOPF v3 groups carry the GeoZarr `multiscales` layout (5 such groups in S2 L2A, down to `r720m`, 152²).
  - Copernicus Marine's `downsampled4`: map 2.1 MiB estimated, 1.2 MiB read, against 48 MiB at full resolution.
  - MUR SST (17999 × 36000) has no overview and no field a quick look can afford. That is a limit to state, not to work around.
- **F8. S3-compatible stores answer 403 for missing keys.**
  - zarr-python probes `zarr.json` (v3) before `.zmetadata` (v2). Copernicus Marine's object store answers 403 to the missing `zarr.json`, so fsspec raises and **the open fails**.
  - Reading a 403 on a metadata key as "absent" fixes it (one hit per open).
  - obstore raises `PermissionDeniedError` in the same case: the wrapper is needed with both stores.
- **F9. `s3://` needs the bucket region.**
  - Through the global endpoint `bucket.s3.amazonaws.com`, MUR SST (us-west-2) answered **500** on a chunk read.
  - The region endpoint works.
  - The region comes free in the `x-amz-bucket-region` header of one `HEAD` on the bucket.
  - `gs://` maps to `storage.googleapis.com` with no such issue.
- **F10. Without consolidated metadata, HTTPS gives an empty tree, silently.** Object stores serve no directory listing to plain HTTPS. zarr finds the root group but none of its members, and xarray returns 1 group and 0 variables with no error. The viewer must treat "a group with no members, and no consolidated metadata" as an error with an explanation (§ 6.6). Every catalog store tested was consolidated, but stores written by hand often are not.
- **F11. Memory follows the slice, so the budget also bounds memory.**
  - Peak RSS per store: 155–960 MiB. The 960 MiB is the 8.8 M-pixel Copernicus Marine map decoded to float64.
  - The viewer's plot path already loads one slice. With the download budget and a cap on plotted elements (downsampling before matplotlib), memory stays bounded.
  - The prototype's own first run, all stores in one process, was part of a machine-wide out-of-memory: hence the per-store child processes.
- **F12. Remote products are large trees.**
  - EOPF products give 318–440 k characters of HTML repr (25–48 groups), the same order as large local files today.
  - Nothing new to build for remote, but the AI tools design's budget concerns apply doubly to EOPF.
- **F13. Browsing catalogs costs nothing** next to opening data: 0.4–0.8 s per catalog root, 0.55 s per search, plain JSON. That supports doing it in TypeScript without Python (§ 8).

### 3.3 fsspec or obstore

Same run, with `--store obstore` (obstore 0.12.1, zarr's `ObjectStore`, same public HTTPS URLs; S3 URLs unsigned with `skip_signature=True`). Times in seconds, requests in parentheses.

| Store                           | fsspec: open | obstore: open | fsspec: warm, no index | obstore: warm, no index | Notes                                                                                      |
| ------------------------------- | ------------ | ------------- | ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------ |
| EOPF S2 L2A                     | 3.92 (45)    | 2.92 (45)     | 0.05 (0)               | 0.04 (0)                |                                                                                            |
| EOPF S2 L2A, Zarr v3            | 5.70 (77)    | 4.82 (77)     | 0.08 (0)               | 0.07 (0)                |                                                                                            |
| EOPF S1 GRD                     | 4.76 (72)    | 4.38 (72)     | 2.36 (36)              | 2.27 (36)               |                                                                                            |
| Planetary Computer Daymet HI    | **fails**    | 3.84 (51)     | -                      | 0.51 (4)                | fsspec HTTP cannot add the SAS token to every request (would need `adlfs`)                 |
| Copernicus Marine, time-chunked | 1.02 (12)    | 0.81 (12)     | 0.14 (2)               | 0.30 (2)                | Both need the 403 wrapper: obstore raises `PermissionDeniedError`                          |
| dynamical.org GFS               | 5.37 (12)    | **fails**     | 0.32 (4)               | -                       | obstore's HTTP store requires a `Content-Length` header; this server does not send one     |
| ARCO ERA5                       | 1.46 (17)    | 1.25 (17)     | 0.08 (2)               | 0.20 (2)                |                                                                                            |
| AWS MUR SST                     | 31.16 (1297) | 30.89 (1297)  | 0.47 (2)               | 1.11 (2)                | obstore first tried EC2 instance credentials (12 s timeout) until `skip_signature` was set |
| AWS NWM `chrtout`               | 9.99 (554)   | 10.06 (554)   | 0.30 (2)               | 0.84 (2)                |                                                                                            |

Reading:

- **Neither store is faster.** Opens are made of small sequential requests issued by zarr / xarray (F2), so latency dominates, not the client. The differences above are within run-to-run noise. Slices were identical in bytes and close in time.
- **Each fails on one real server.**
  - fsspec on Planetary Computer: signing.
  - obstore on dynamical.org: no `Content-Length`.
- **Recommendation:**
  - **fsspec + aiohttp as the baseline** (P1). It is lighter than it sounds, about ten pure-Python or small wheels, and users' own interpreters often have it already.
  - **obstore as an optional extra**, used for signed Azure (Planetary Computer, P3) when importable.
  - Revisit if obstore gains a lenient HTTP mode.

## 4. Constraints from the codebase and the environments

### 4.1 Where the extension assumes a local file

Mapped on `main` (v0.13.0). A remote URL breaks at these points; none needs a rewrite.

| Where                                                                                                            | Assumption                                           | With a URL                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `package.json` `customEditors` (8 editors, filename patterns only), `ScientificDataEditorProvider`               | A document is a file the explorer shows              | A URL is never offered to a custom editor (§ 6.2)                                               |
| `DataViewerPanel` (`_fileUri: vscode.Uri`, tab title `path.basename(fileUri.fsPath)`, dedup on `uri.toString()`) | Identity = file URI                                  | Works with any `vscode.Uri`; title must come from the location                                  |
| `UIController.loadFile` → `workspace.fs.stat(Uri.file(fileUri.fsPath))` + `maxFileSize`                          | The file can be stat-ed before Python runs           | **Throws**: load fails before Python. Skip for remote; the budget replaces `maxFileSize`        |
| `DataProcessor.buildGetDataInfoCliArgs(uri.fsPath, …)`, `buildCreatePlotCliArgs(uri.fsPath, …)`                  | The path is `fsPath`                                 | `fsPath` of `https://h/a.zarr` is `/a.zarr`: host and scheme lost (`s3://b/k` loses the bucket) |
| `UIController` save / save-as / export defaults (`path.dirname(currentFile)`)                                    | Plots are saved next to the data                     | No local folder: default to the workspace folder or `~/` (§ 6.5)                                |
| `cli.py` `file_path: Path`; `resolve_store_path`                                                                 | Positional path, `pathlib.Path`                      | `Path("https://h/a.zarr")` → `https:/h/a.zarr`                                                  |
| `formats/detect.py`, `formats/zarr.py` (`is_dir`, `exists`, `stat`, suffix)                                      | Format from the file system                          | Everything returns False; falls back to the `.zarr` suffix, no v2/v3 label                      |
| `opening._open_with_engine`                                                                                      | `Path` or `ZipStore` to xarray, no `storage_options` | Needs a store object (§ 7.1)                                                                    |
| `info/extract.py` `fileSize=os.path.getsize(file_path)` (required in `results.py` and `types.ts`)                | Size known                                           | **Raises** → whole info fails. Make it optional                                                 |
| Webview: `currentFile` (File Information path + Copy), `generateDefaultFileName` (last `/` segment)              | A path                                               | Show the URL; build names from the store name                                                   |

Good news: no file watcher, and no webview message carries the path (the host keeps it), so the protocol barely changes.

### 4.2 Timeouts and process model

- Info has a 5 min timeout, `DATA_INFO_TIMEOUT_MS` (its comment already mentions a "remote store").
- Plots have `plotTimeoutMs`, 20 s by default. Too short for a remote first read: P1 gives remote plots their own default (60 s).
- Cancellation already works per operation: SIGTERM, then SIGKILL after 1 s.
- One process per request is kept. The numbers in § 3 show it is acceptable **with** the metadata cache and no-index opening. A persistent worker stays out of scope.

### 4.3 Python packages

| Environment                                                          | `fsspec` | `aiohttp` | `obstore` / `s3fs` / `gcsfs` |
| -------------------------------------------------------------------- | -------- | --------- | ---------------------------- |
| Extension-owned uv env (`ALL_REQUIREMENTS`), checked on this machine | no       | no        | no                           |
| Dev `.venv` (`requirements-dev.txt`)                                 | yes      | yes       | no                           |
| Users' own interpreters                                              | unknown  | unknown   | unknown                      |

`zarr` lists `fsspec` and `obstore` only under its `remote` extra; xarray depends on neither.

### 4.4 `xarray-eopf` is not an option today

EOPF's STAC assets say `engine: "eopf-zarr"`, the xarray plugin `xarray-eopf`:

- **0.3.1** (current) requires **`zarr<3,>=2.11`** and Python ≥ 3.11, plus dask, dask-image, flox, numba (0.2.6), rioxarray, s3fs and xcube-resampling. Installing it next to our `zarr>=3` downgrades zarr to 2.18.7 (checked with `uv pip compile`).
- **0.2.6** accepts `zarr>=3.0`, but brings the same heavy stack.

Its "native" mode is documented as a thin layer over the built-in `zarr` engine, and the prototype opens every EOPF collection tried with plain `engine="zarr"`. So we **ignore the `engine` hint** when the engine is not installed or not allow-listed, and note it in the File Information ("catalog suggests engine `eopf-zarr`; opened with `zarr`"). Its "analysis" mode (rectified grids, band stacks) is a product feature, not a viewer one.

## 5. Concepts

### 5.1 `DatasetLocation`

One value type replaces `vscode.Uri` as the identity of what a panel shows:

```ts
type DatasetLocation =
  | { kind: 'file'; uri: vscode.Uri } // today
  | {
      kind: 'remote';
      url: string; // normalised, e.g. https://… or s3://bucket/key (§ 7.2)
      format: 'zarr'; // later: 'kerchunk' | 'netcdf' | 'opendap'
      group?: string; // sub-group to reveal (STAC sub-group asset)
      openHints?: RemoteOpenHints; // allow-listed subset of STAC xarray:/zarr: fields
      origin?: StacOrigin; // catalog, collection, item, asset key, titles: for display and "reveal in catalog"
    };
```

- **Identity** (deduplication, restore, recents) is `kind` + `url` + `group`.
- **Display** comes from `origin` when present: `S2A_MSIL2A_20261118… · product`, not `…T161704.zarr`.
- `format` keeps the door open for remote NetCDF / OPeNDAP / COG without another refactor.

### 5.2 Catalog model (TypeScript)

A STAC _source_ is a URL plus a kind, probed once from its landing document:

- **API:** `conformsTo` contains `…/item-search`.
- **Static catalog:** `type: Catalog` / `Collection` with `child` / `item` links.

The tree shows:

```
Remote Data
├── Recent
│   └── https://data.dynamical.org/noaa/gfs/forecast/latest.zarr
├── Bookmarks
└── Catalogs
    ├── EOPF Sentinel Zarr Samples          (API)
    │   ├── Sentinel-2 Level-2A             (collection; "Search…" action)
    │   │   ├── S2A_MSIL2A_20261118T120401… (item: date, cloud cover, tile)
    │   │   │   ├── ▣ product               (Zarr v2, root)      ← open
    │   │   │   ├── ▣ SR_10m                (sub-group)          ← open root, reveal group
    │   │   │   └── …
    │   │   └── Load more…                  (next page)
    │   └── …
    ├── Copernicus Marine                   (static)
    │   └── GLOBAL_ANALYSISFORECAST_PHY_001_024 → cmems_mod_glo_phy_anfc_0.083deg_P1D-m → ▣ timeChunked / geoChunked / downsampled4
    └── Planetary Computer                  (API; collection assets, signed)
```

Only assets whose media type contains `zarr` are openable (later: kerchunk, netcdf). The others (thumbnails, zip, metadata JSON) are shown greyed out. A thumbnail can be previewed in the item's hover.

## 6. User experience

### 6.1 Entry points

| Entry point                                                    | Phase | Behaviour                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command **Scientific Data Viewer: Open Remote Dataset…**       | P1    | Quick input. It **pre-fills from the clipboard** when that holds a URL. Below the box: recent URLs and "Try a public example" items (an EOPF S2 product found through the catalog, dynamical GFS, ARCO ERA5). Validation runs as the user types: scheme allow-list (§ 9); `s3://` and `gs://` accepted. |
| **Remote Data** view (Explorer side bar, or its own container) | P2    | Tree of § 5.2. Context menu: _Open_, _Open in New Tab_, _Copy URL_, _Copy as xarray code_, _Bookmark_, _Open item in STAC Browser_ (web)                                                                                                                                                                |
| Collection **Search…**                                         | P2    | Quick inputs, no map:<br>• date range: presets "last 7 / 30 days", or a custom range;<br>• bbox: presets from recent searches, `lon,lat,lon,lat`, or a place name later;<br>• sort: least cloudy / most recent when the collection has `eo:cloud_cover`.<br>Results go to a "Search results" node.      |
| Links                                                          | P1    | `vscode://eschalk0.scientific-data-viewer/open?url=…` (a `UriHandler`), so a README, a notebook or a STAC browser can open a dataset in VS Code                                                                                                                                                         |
| Walkthrough step "Explore a remote dataset"                    | P2    | Opens the Remote Data view on the EOPF catalog                                                                                                                                                                                                                                                          |

### 6.2 The panel

- **How it is created.** P1 uses the same `DataViewerPanel` and the same webview, built by `createWebviewPanel` (not a custom editor). Custom editors only open documents that a file system provider can serve. Registering a `FileSystemProvider` for a scheme `sdv-remote:` is a plausible alternative: it would give tab restore and "Open With" for free. But it means implementing `stat` / `readDirectory` semantics for something that is not a file, and its interaction with `CustomReadonlyEditorProvider` must be checked first (spike, § 10 P0).
- **Restore on reload.** It needs a `WebviewPanelSerializer` (none today) that stores `DatasetLocation` in the webview state.
- **Header.** The File Information section shows:
  - the **URL** (with copy) instead of the path, a _Remote_ badge, and the host;
  - the catalog origin (collection, item, asset title) when opened from STAC;
  - "Size": not shown. Instead, it shows **"Metadata: 0.9 MB in 45 requests, 3.9 s"**, which tells the user what the open cost.
- **Engine hint.** "Engine: zarr (catalog suggests `eopf-zarr`)" when the hint was ignored.

### 6.3 Opening a sub-group asset

EOPF lists `SR_10m` = `<root>.zarr/measurements/reflectance/r10m`. Two choices:

- **(a) Open the sub-group as its own store.** Fast, and it shows only that group. The user loses the context: no sibling groups and no root attributes.
- **(b) Open the root and scroll to the group** (the outline already supports "scroll to header"). It costs the root's metadata, 0.9 MB for S2 L2A.

**Recommendation: (b) by default**, when the root is known: another asset of the item is a prefix of this href, or `zarr:node_type` says so. Fall back to (a) when no root is known.

### 6.4 The download budget

The plotting request gets a budget, setting `scientificDataViewer.remote.maxDownloadMB` (default **64 MB**; § 7.3 for the estimate). When the estimate of the plot the user asked for is above it, the backend does not read. It returns a `PlotCostTooHigh` result with:

- the estimate ("this map reads ~422 MiB: the store is chunked by 105 lead times × 121 × 121");
- cheaper options it computed:
  - a **coarser overview level** (multiscales, F7);
  - a **sibling store with another chunking**, when the STAC item has one (Copernicus Marine `timeChunked` for maps, `geoChunked` for series, F6);
  - a **series** instead of a map, when the store is chunked for series (GFS: 11.7 MiB).

Strided indexing (`::10`) is not offered: it still reads every chunk.

The webview shows them as buttons, plus **Plot anyway**. The budget never blocks the **info** view: metadata is small, and the open cost is shown after the fact.

### 6.5 Saving and exporting

Saving a plot "next to the data" has no meaning remotely. The default folder becomes the first workspace folder, else the user's home. The file name comes from the store name (`latest.zarr` → `noaa_gfs_forecast_latest`) plus the variable.

### 6.6 Errors the user can act on

| Situation                                | Detected by                                                                                    | Message                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline, DNS, proxy, TLS                 | aiohttp `ClientConnectorError`, `ClientSSLError`                                               | "Cannot reach `host`. Check the connection or proxy (`HTTPS_PROXY`)" (+ link to settings)                                                                                                                                                                                       |
| Private / needs login                    | 401, 403 on the **root** metadata, Azure 409 "public access not permitted"                     | "`host` refused anonymous access. Authenticated data is not supported yet" (P4)                                                                                                                                                                                                 |
| Not found                                | 404 on every metadata key                                                                      | "No Zarr store at this URL" + "Did you mean the parent `….zarr`?" when a parent path ends in `.zarr`                                                                                                                                                                            |
| **No consolidated metadata, no listing** | Tree opened with **zero variables and zero child groups** while `zarr.json` / `.zgroup` exists | "This store has no consolidated metadata, and its server does not list keys over HTTPS: its variables cannot be discovered. Ask the provider to consolidate it (`zarr.consolidate_metadata`)". Later (P3): list public S3 buckets that allow it, via obstore's unsigned S3 mode |
| Too big                                  | Estimate > budget                                                                              | § 6.4                                                                                                                                                                                                                                                                           |
| Slow                                     | Progress notification after 2 s, with **Cancel**; timeout                                      | "Timed out after 60 s while reading `…/zos/0.0.0`" (the last key requested)                                                                                                                                                                                                     |

## 7. Backend design

### 7.1 Location and store

New module `python/sdv_backend/remote/` (no new layer: `opening` already sits above `formats`):

| Function / class                                | Role                                                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse_location(arg) -> LocalPath \| RemoteUrl` | The CLI's positional argument becomes a location: a path, or a URL with an allow-listed scheme. `--group`, `--open-hints <json>` are new options                  |
| `public_https(url) -> str`                      | `gs://b/k` → `https://storage.googleapis.com/b/k`; `s3://b/k` → `https://b.s3.<region>.amazonaws.com/k`, region from `x-amz-bucket-region` of one `HEAD` (cached) |
| `open_store(url, hints) -> zarr Store`          | `FsspecStore.from_url(https, read_only=True, storage_options={client_kwargs: {trust_env: True, timeout}, headers: {User-Agent}})`, wrapped (below)                |
| `ForbiddenAsMissing` wrapper                    | 403 on a **metadata** key → "absent", so zarr's v3 → v2 probe works on S3-compatible stores without public listing                                                |
| `MetadataCache` wrapper                         | Metadata documents on disk, per store URL, with an expiry (§ 7.4)                                                                                                 |
| `RequestStats` wrapper                          | Counts requests, bytes and the last key: for the File Information "open cost" and timeout messages                                                                |
| `estimate_read(da, isel) -> bytes`              | § 7.3                                                                                                                                                             |
| `detect_overviews(tree)`                        | GeoZarr `multiscales` layout, else sibling groups named like resolutions (`r10m`, `r60m`…) with the same variables                                                |

`opening._open_with_engine` gains a remote branch that opens with:

- the store object;
- `engine="zarr"`;
- `chunks=None`;
- `create_default_indexes=False` for **info**, when xarray ≥ 2025.7.1 (feature-detected with `inspect.signature`, like other gates);
- `consolidated=None`, so zarr tries consolidated metadata, then falls back.

For **plots**, the indexes the selection needs are built after opening, only on the dimensions it slices by label. Today's slicing is by position (`isel`), so no index is needed at all. Everything above `opening` (info extraction, plotting) is unchanged, except for:

- `fileSize` becomes optional;
- format detection is skipped for remote URLs: the location says `zarr`;
- the v2 / v3 label comes from which metadata key answered.

**obstore** is one Rust wheel covering S3 / GCS / Azure / HTTP, with a Planetary Computer credential provider. It was measured against fsspec in § 3.3:

- it is **not faster**: opens are latency-bound;
- it **fails on dynamical.org**, which sends no `Content-Length`;
- it **signs Azure natively**.

So it is an optional store, used for signed Azure in P3 when importable. fsspec + aiohttp stay the baseline: they work on every other store tested, and users' interpreters often have them already.

### 7.2 URL forms accepted

| Input                                                 | Normalised to                                                                | Phase |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | ----- |
| `https://host/path.zarr` (any path, `.zarr` optional) | itself                                                                       | P1    |
| `s3://bucket/key`                                     | `https://bucket.s3.<region>.amazonaws.com/key` (anonymous)                   | P1    |
| `gs://bucket/key`, `gcs://`                           | `https://storage.googleapis.com/bucket/key`                                  | P1    |
| `https://…/zarr.json`, `…/.zmetadata`, `…/.zgroup`    | the store root (like `resolve_store_path` for local files)                   | P1    |
| `https://….zarr.zip`                                  | `ZipStore` needs random access: via fsspec `zip::https://…` (range requests) | P3    |
| `az://`, `abfs://` + Planetary Computer               | signed HTTPS (SAS token from the anonymous endpoint, per collection)         | P3    |
| `https://…kerchunk.json`, `reference://`              | the existing Kerchunk path, with remote targets                              | P3    |
| `http://`                                             | allowed with a warning (some institutional THREDDS-like servers)             | P1    |

Rejected: `file://` (use the normal open), and every other scheme.

### 7.3 Download estimate

Exact for unsharded stores, an upper bound for sharded ones (prototype `estimate_bytes`). For each dimension:

- **indexed with an integer:** one chunk wide;
- **sliced:** the chunks it overlaps.

Multiply the widths, then multiply by the **stored** dtype's itemsize, not the decoded one: `scale_factor` turns `uint16` into `float64`, which overestimated EOPF ×4 in the first prototype run. That is the uncompressed size; compression makes the real download smaller (ERA5: 3.96 MB estimated, 2.23 MB read). Missing chunks (never written because they would only hold the fill value) make it smaller still: the EOPF S2 tile of § 3.1 is mostly outside the swath, 0.19 MiB read for 6.39 estimated.

The estimate runs on metadata only, so it is free, and it is shown:

- next to **Create Plot** ("≈ 4 MB"), updated when the user changes a selection (P2: through a cheap `estimate` CLI mode, served from the metadata cache);
- in the "too expensive" result (§ 6.4).

### 7.4 Metadata cache

- **Where:** `globalStorageUri/remote-cache/<sha256(url)[:16]>/`.
- **What:** the metadata documents, plus **chunks of 1D arrays up to 256 KiB**. Those are the coordinate and time values that xarray reads at open (F3). No data chunks in P1.
- **Expiry:** 1 hour by default (`remote.metadataCacheMinutes`); `latest.zarr`-style stores change every few hours. **Refresh** in the panel bypasses it.
- **Size:** capped at 200 MB (LRU by store).
- **Effect:** measured in § 3.1 (F4). Combined with no-index opening, a reopen costs 0–4 requests.
- **The backend writes the cache, not the host.** It is the backend that knows which keys are metadata. The host passes the cache folder with `--cache-dir`, so the backend never decides where to write. The `artefacts/` rule is for development scripts, not runtime.

A chunk cache (fsspec `blockcache` / `simplecache`) is a later option. Re-plotting the same slice with another colormap re-downloads it today, so it may be worth it in P3, bounded in size.

## 8. Catalog browsing (TypeScript)

- **Where it runs:** in the extension host, with `fetch`. The `engines.vscode` floor must allow it: `^1.74.0` → **`^1.82.0`** (Node 18, global `fetch`). The AI tools design already proposes `^1.95.0`; whichever lands first sets the floor.
- **Why TypeScript:**
  - expanding a node is one HTTP request, not a Python process;
  - it works before the Python environment is ready;
  - STAC is simple JSON. A STAC client covering `/collections`, `/collections/{id}/items` (`next` links), `POST /search`, and static `child` / `item` links is about 300 lines.
- **Proxy:** VS Code's proxy support for extensions applies to Node's `http` / `https` modules. Support for `fetch` is newer and was reported fragile in 2026 (`http.fetchAdditionalSupport`). P0 checks it behind a corporate proxy (ACRI-ST). The fallback is `https.request`.
  - The Python side does not see VS Code's proxy settings. aiohttp reads `HTTPS_PROXY` / `NO_PROXY` only with `trust_env=True`, so the backend sets it.
  - P1 also passes `http.proxy`, when set, as `HTTPS_PROXY` in the subprocess environment.
- **Paging:** 20 items per page and a _Load more…_ node. Never walk a whole catalog: Copernicus Marine alone has 364 products.
- **Caching:** collections lists for 1 hour in memory; item pages not cached. Planetary Computer SAS tokens until their `msft:expiry`.
- **Defaults:**
  - Shipped catalogs: EOPF, Copernicus Marine and Planetary Computer.
  - `scientificDataViewer.remote.catalogs` adds others or removes these, as an array of `{ "name", "url" }`. EODC and others may add Zarr collections.
  - Each catalog shows its license / provider link: data terms differ.

## 9. Security and privacy

Remote data and catalogs are **untrusted input**, like local files today, plus three new concerns.

1. **Open hints from catalogs are an allow-list**, never passed through:
   - kept: `consolidated` (bool), `zarr_format` (2 | 3), `group` (str), `decode_times`, `use_cftime`, `mask_and_scale` (bool);
   - `engine`: only if in our engine table and installed (§ 4.4);
   - dropped: `chunks` (we never use dask);
   - `storage_options`: only `anon: true` (or the equivalent), never keys or tokens, never `client_kwargs`.
2. **No credentials, ever, in P1–P3:**
   - The backend sends no `Authorization` header.
   - A Planetary Computer SAS token is requested from Microsoft's anonymous endpoint, for the collection being opened. It is only sent to the storage account that collection names.
3. **Requests go where the user points.** A catalog can point to any host: Planetary Computer assets live on other domains. Following links from an untrusted catalog could make the extension request internal URLs (`http://10.…`). The mitigations are:
   - show the target host before opening (tree tooltip, File Information);
   - refuse `localhost` / private IP ranges **when the URL came from a catalog**, but accept them typed by the user (local test servers are legitimate).
4. **The webview is unchanged.** Remote attributes go through xarray's HTML repr, which escapes values. The CSP already forbids scripts. A remote `title` attribute is no more dangerous than a local one.
5. **Cost safety:** the download budget (§ 6.4), the request timeouts, and cancel.
6. **Privacy:** requests carry a generic `User-Agent: scientific-data-viewer/<version>`, no user data. No telemetry is added. Recents and bookmarks stay in `globalState`, on the machine.

## 10. Plan

| Phase                     | Content                                                                                                                                                                                                                                                                                                                                                                                                              | Size (dev-days) |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **P0 — spikes**           | (1) panel identity: `createWebviewPanel` + serializer vs a `sdv-remote:` file system provider feeding the custom editors; (2) `fetch` behind a proxy in the extension host, minimum `engines.vscode`; (3) ~~obstore vs fsspec~~ done in this design (§ 3.3): fsspec by default                                                                                                                                       | 2               |
| **P1 — open a URL**       | `DatasetLocation`; command _Open Remote Dataset…_ (+ URI handler, recents, examples); backend `remote/` (location, HTTPS forms, 403 wrapper, stats, metadata cache, no-index open, empty-tree detection, estimate + budget + `PlotCostTooHigh`); File Information for remote; save defaults; `fsspec` + `aiohttp` in `ALL_REQUIREMENTS` (+ `ENVIRONMENT_REVISION`), package check message for own interpreters; docs | 8–10            |
| **P2 — catalogs**         | _Remote Data_ view: catalogs setting, API + static walking, paging, item details (date, cloud, thumbnail hover), Zarr assets → open root and reveal group, collection search (date, bbox, sort), bookmarks; walkthrough step; `engines.vscode` bump                                                                                                                                                                  | 8–10            |
| **P3 — comfort**          | Overviews (multiscales) as a plot option and cheap default; cheaper-alternative suggestions; live estimate next to Create Plot; remote Kerchunk; `.zarr.zip` over HTTP; Planetary Computer signing (obstore); optional bounded chunk cache; `datacube` extension shown before opening                                                                                                                                | 6–8             |
| **P4 — later, on demand** | Authentication (S3 profiles, Earthdata `.netrc`, CDSE / DestinE tokens) with VS Code `SecretStorage`; OPeNDAP / THREDDS; remote NetCDF / COG by range requests; Icechunk; a persistent Python worker                                                                                                                                                                                                                 | -               |

**P1 alone is a release.** "Paste a Zarr URL and look inside" is already unique in VS Code. Announce it with the EOPF example (growth plan §3: EOPF Discourse, Pangeo).

### 10.1 Next prototypes

Each one is small, can be thrown away, and answers one question before P1 / P2 code is written. They follow the repository rules: scripts in `scripts/prototypes/`, outputs in `artefacts/prototypes/<name>/`.

| #   | Prototype                                                                                                                                                                                                                                                 | Question it answers                                                                                                  | Done when                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A   | **Backend URL patch on a branch.** `get_data_info.py info https://…` and `plot …` through a minimal `remote/` module (location, HTTPS forms, 403 wrapper, no-index open, `fileSize` optional), run against the 13 stores of § 3.1                         | Does the existing info / plot code work unchanged above `opening`, apart from the places listed in § 4.1?            | The JSON of each store is produced and displayed by the real webview (`scripts/qa/webview` harness with a URL) |
| B   | **Panel identity spike** (extension, F5 debug only): open a `vscode.Uri.parse('sdv-remote:/…')` through (1) `createWebviewPanel` + `WebviewPanelSerializer`, (2) a read-only `FileSystemProvider` + `vscode.openWith(…, 'zarrEditor')`; reload the window | Which route restores tabs, works with "Open Recent", and needs the least special-casing in `DataViewerPanel`?        | Both routes tried; a decision recorded in § 6.2                                                                |
| C   | **STAC tree view on recorded fixtures**: a `TreeDataProvider` over saved JSON of EOPF / Copernicus Marine / Planetary Computer (no network), with paging and asset classification                                                                         | Is the tree readable for real catalogs (item names, 20-per-page, assets greyed out)? What does an item need to show? | A screenshot per catalog and one round of feedback                                                             |
| D   | **Cost badge mock-up** in the webview: the estimate next to _Create Plot_, and the "too expensive" choice (overview / sibling store / series / plot anyway) on GFS, CMIP6 and Copernicus Marine geo-chunked                                               | Do users understand "≈ 422 MiB" and the alternatives without reading docs?                                           | Tried with two colleagues; wording fixed                                                                       |
| E   | **Local "hostile" HTTP Zarr server** (`http.server` + options: 403 instead of 404, no listing, latency, 500 on one chunk)                                                                                                                                 | Can every error of § 6.6 be reproduced offline, for tests?                                                           | The server is the pytest fixture of § 11                                                                       |
| F   | **obstore vs fsspec** on the same stores (`remote_zarr.py --store obstore`, done for § 3.3)                                                                                                                                                               | Which store is the default for P1, and what does each add to the uv environment?                                     | **Done** (§ 3.3): fsspec + aiohttp by default, obstore optional for signed Azure                               |
| G   | **Proxy check**: fetch a STAC page from the extension host (`fetch` and `https.request`) and open a store from the backend (`trust_env=True`) behind the ACRI-ST proxy                                                                                    | Do both halves work behind a corporate proxy, and with which VS Code settings?                                       | Both work, or the limitation is documented in the settings' descriptions                                       |

## 11. Testing

| Level                     | How                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python unit (offline)     | A pytest fixture serves `artefacts/sample-data` Zarr stores over **local HTTP** (`http.server` in a thread). Options: answer 403 instead of 404 for missing keys (S3 behaviour), no directory listing, latency injection. Covers HTTPS opening v2 / v3, consolidated or not (empty-tree detection), the 403 wrapper, estimate vs `nbytes`, cache hit / expiry, budget refusal |
| TypeScript unit (offline) | Recorded STAC JSON (EOPF landing, collections, an item page with `next`, a PC collection, a CMEMS static chain) as fixtures; the tree provider and asset classification tested on them                                                                                                                                                                                        |
| Integration (`npm test`)  | Open a `http://127.0.0.1:<port>/…zarr` location in a panel; info and plot; cancel during a slow (latency-injected) read                                                                                                                                                                                                                                                       |
| Live (network)            | The prototype, then a `scripts/qa/remote/` check of a handful of public stores, in `paranoia.sh --full` only. It is reported, not blocking: public services move (the EOPF archive rolls, `latest` moves)                                                                                                                                                                     |
| Manual                    | A test plan item per entry point, run once behind the ACRI-ST proxy                                                                                                                                                                                                                                                                                                           |

## 12. Open questions for the maintainer

1. **Default budget**: 64 MB uncompressed (the prototype's), or 100 MB?
2. **P1 panel identity**: accept `createWebviewPanel` + serializer (known APIs), or wait for the P0 file-system-provider spike?
3. **`engines.vscode` floor**: bump to `^1.82` for `fetch` in P2, or stay on `https.request`?
4. **Where should the Remote Data view live**: the Explorer side bar (discoverable, crowded) or its own activity bar icon (needs an icon)?
5. **Ship Planetary Computer by default** even though it needs signing (P3)? Until then it could be listed with its Zarr assets marked "needs signing — P3".
6. **EOPF**: is the rolling one-year sample archive a stable enough flagship example, or should the walkthrough use a fixed product we know will stay (e.g. a dynamical.org analysis store)?
7. **Release vehicle**: P1 alone as 0.16, or P1 + P2 together?

## Appendix A — sources

- EOPF STAC API landing page and the EOPF 101 STAC tutorial: <https://stac.core.eopf.eodc.eu>, <https://eopf-toolkit.github.io/eopf-101/32_eopf_stac_zarr_tutorial.html>
- EOPF STAC assets workshop (DLR, 2025-04-16): <https://zarr.eopf.copernicus.eu/wp-content/uploads/2025/04/2025-04-16_STAC-Assets-for-EOPF-Zarr.pdf>
- `xarray-eopf`: <https://pypi.org/project/xarray-eopf/>, <https://eopf-sample-service.github.io/xarray-eopf/guide/>
- STAC zarr extension: <https://github.com/stac-extensions/zarr>; STAC + Zarr best practices (EOAP): <https://eoap.github.io/zarr-cloud-native-format/compliance/stac-zarr-best-practices/>; Cloud-Native Geo "Zarr + STAC": <https://guide.cloudnativegeo.org/cookbooks/zarr-stac-report/>
- Planetary Computer, reading Zarr: <https://planetarycomputer.microsoft.com/docs/quickstarts/reading-zarr-data>
- Copernicus Marine static STAC: <https://stac.marine.copernicus.eu/metadata/catalog.stac.json>
- ARCO ERA5: <https://github.com/google-research/arco-era5>; Google public ERA5: <https://cloud.google.com/storage/docs/public-datasets/era5>
- GeoZarr / multiscales: <https://github.com/zarr-developers/geozarr-spec>, <https://eopf-explorer.github.io/data-model/geozarr-minispec/>
- Web viewers: EOPF Explorer launch <https://developmentseed.org/blog/2026-02-13-eopf-explorer-launch>, Browzarr <https://developmentseed.org/datacube-guide/latest/visualization/browzarr.html>, GridLook (EGU26-9862) <https://meetingorganizer.copernicus.org/EGU26/EGU26-9862.html>
- VS Code: virtual workspaces (`fsPath` only for `file:`) <https://code.visualstudio.com/api/extension-guides/virtual-workspaces>; network / proxy <https://code.visualstudio.com/docs/setup/network>; Debrief STAC <https://debrief.github.io/debrief-vscode-extension>
- Previous scoping: [`docs/v0.13/OUT_OF_SCOPE.md`](../v0.13/OUT_OF_SCOPE.md) § Remote, cloud, and compute (this design lifts the "`https://` dataset URLs" item, keeps the others)
