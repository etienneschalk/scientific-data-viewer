# Explore and plot

## Browse the structure

- **File Information**: path, size, format and the xarray engine used.
- **Xarray HTML / Text Representation**: the views xarray users know, for the
  whole file and for each group.
- **Group: /** and **Group: /stations**: each group of the file lists its
  **Dimensions**, **Coordinates**, **Variables** and **Attributes**. Expand a
  variable to see its attributes and its **Xarray Encoding**.
- **Scientific Data Structure** (Explorer side bar): an outline of the open file.
  Click an entry to scroll the viewer to it.

## Create a plot

1. Find a variable, for example `tas_global_mean`, and click **Create Plot**: a
   line plot of the global mean over the year.
2. Try `sftlf` (a map) and `tas`: with three dimensions, the plot gets one panel
   per month. In **Group: /stations**, `tas` is drawn as a station × time image;
   set **x** to `time` and **hue** to `station` in **Plot parameters** to get one
   line per station.
3. Open **Plot parameters** to choose the axes, a colormap, the facets or the
   color range. Parameters you change are outlined; **Reset** brings back the
   defaults.
4. Use **Dimension slices** to plot a subset, e.g. `time` `0 : 6` for the first
   half of the year, or a single index such as `6` for July 2020.
5. **Save**, **Save As...** or **Open** the image. **Plot All**, in **Global Plot
   Controls**, plots every variable at once (experimental).

This step is checked after your first plot.

Plots are drawn by xarray and matplotlib, in the same Python environment.
