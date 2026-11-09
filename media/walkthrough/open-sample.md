# Open the sample file

**Open Sample File** opens `sample_climate.nc`, a small NetCDF-4 file (about 120 KB)
shipped with the extension. It is a copy kept in the extension's storage, so plots
you save next to it never land in the extension's install folder.

The data is synthetic (made up for this tour, not real observations) but follows
the [CF conventions](https://cfconventions.org), like most climate data:

| Group       | Variable          | Dimensions       | What it is                                  |
| ----------- | ----------------- | ---------------- | ------------------------------------------- |
| `/`         | `tas`             | `time, lat, lon` | Monthly near-surface air temperature (K)    |
| `/`         | `tas_global_mean` | `time`           | Its area-weighted global mean (K)           |
| `/`         | `sftlf`           | `lat, lon`       | Land area fraction (%)                      |
| `/stations` | `tas`             | `station, time`  | Temperature series at three grid points (K) |

- Two years (24 months, 2020-2021) on a global 5° grid.
- `tas` is stored as packed integers (`scale_factor` / `add_offset`) and
  compressed: open its **Xarray Encoding** section to see how.
- Global attributes (`title`, `Conventions`, `history`...) and variable
  attributes (`units`, `long_name`, `standard_name`) are all shown.

If the viewer reports a missing package, go back to **Set up Python**.

You can open your own files the same way: click a supported file in the
Explorer, drag it into the editor area, or right-click it and choose
**Open Scientific Data Viewer**.
