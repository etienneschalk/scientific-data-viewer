# Xarray Plot API GUI Design (Generated)

_Generated: 2026-03-24 14:02:02 UTC_
_Source parsed: `https://raw.githubusercontent.com/pydata/xarray/main/xarray/plot/dataarray_plot.py`_

## Scope

This document is generated from parsed source code only (AST), with no LLM interpretation or manual GUI recommendations.

## Method / Overload Summary

| Method       | Overloads | Impl signatures parsed |
| ------------ | --------: | ---------------------: |
| `contour`    |         3 |                      1 |
| `contourf`   |         3 |                      1 |
| `hist`       |         0 |                      1 |
| `imshow`     |         3 |                      1 |
| `line`       |         3 |                      1 |
| `pcolormesh` |         3 |                      1 |
| `plot`       |         0 |                      1 |
| `scatter`    |         3 |                      1 |
| `step`       |         3 |                      1 |
| `surface`    |         3 |                      1 |

## Common Kwargs Across Parsed Methods

_No universal kwargs found across all parsed method implementations._

## Common Kwargs Across Many Methods (Practical Common Controls)

`add_colorbar`, `add_labels`, `aspect`, `cbar_ax`, `cbar_kwargs`, `center`, `cmap`, `col`, `col_wrap`, `colors`, `extend`, `figsize`, `infer_intervals`, `levels`, `norm`, `robust`, `row`, `size`, `subplot_kws`, `vmax`, `vmin`, `xincrease`, `xlim`, `xscale`, `xticks`, `yincrease`, `ylim`, `yscale`, `yticks`

## Method-Specific Kwargs (API Signatures)

### `contour`

`add_colorbar`, `add_labels`, `aspect`, `cbar_ax`, `cbar_kwargs`, `center`, `cmap`, `col`, `col_wrap`, `colors`, `extend`, `figsize`, `infer_intervals`, `levels`, `norm`, `robust`, `row`, `size`, `subplot_kws`, `vmax`, `vmin`, `xincrease`, `xlim`, `xscale`, `xticks`, `yincrease`, `ylim`, `yscale`, `yticks`

### `contourf`

`add_colorbar`, `add_labels`, `aspect`, `cbar_ax`, `cbar_kwargs`, `center`, `cmap`, `col`, `col_wrap`, `colors`, `extend`, `figsize`, `infer_intervals`, `levels`, `norm`, `robust`, `row`, `size`, `subplot_kws`, `vmax`, `vmin`, `xincrease`, `xlim`, `xscale`, `xticks`, `yincrease`, `ylim`, `yscale`, `yticks`

### `hist`

`aspect`, `figsize`, `size`, `xincrease`, `xlim`, `xscale`, `xticks`, `yincrease`, `ylim`, `yscale`, `yticks`

### `imshow`

`add_colorbar`, `add_labels`, `aspect`, `cbar_ax`, `cbar_kwargs`, `center`, `cmap`, `col`, `col_wrap`, `colors`, `extend`, `figsize`, `infer_intervals`, `levels`, `norm`, `robust`, `row`, `size`, `subplot_kws`, `vmax`, `vmin`, `xincrease`, `xlim`, `xscale`, `xticks`, `yincrease`, `ylim`, `yscale`, `yticks`

### `line`

`_labels`, `add_legend`, `aspect`, `col`, `figsize`, `hue`, `row`, `size`, `xincrease`, `xlim`, `xscale`, `xticks`, `yincrease`, `ylim`, `yscale`, `yticks`

### `pcolormesh`

`add_colorbar`, `add_labels`, `aspect`, `cbar_ax`, `cbar_kwargs`, `center`, `cmap`, `col`, `col_wrap`, `colors`, `extend`, `figsize`, `infer_intervals`, `levels`, `norm`, `robust`, `row`, `size`, `subplot_kws`, `vmax`, `vmin`, `xincrease`, `xlim`, `xscale`, `xticks`, `yincrease`, `ylim`, `yscale`, `yticks`

### `plot`

`col`, `col_wrap`, `hue`, `row`, `subplot_kws`

### `scatter`

`add_colorbar`, `add_labels`, `add_legend`, `add_title`, `aspect`, `cmap`, `col`, `col_wrap`, `extend`, `figsize`, `hue`, `hue_style`, `levels`, `linewidth`, `markersize`, `norm`, `row`, `size`, `subplot_kws`, `vmax`, `vmin`, `xincrease`, `xlim`, `xscale`, `xticks`, `yincrease`, `ylim`, `yscale`, `yticks`

### `step`

`col`, `drawstyle`, `ds`, `row`, `where`

### `surface`

`add_colorbar`, `add_labels`, `aspect`, `cbar_ax`, `cbar_kwargs`, `center`, `cmap`, `col`, `col_wrap`, `colors`, `extend`, `figsize`, `infer_intervals`, `levels`, `norm`, `robust`, `row`, `size`, `subplot_kws`, `vmax`, `vmin`, `xincrease`, `xlim`, `xscale`, `xticks`, `yincrease`, `ylim`, `yscale`, `yticks`

## Kwarg x Method Matrix (API Signatures)

| Kwarg             | Methods                                                                                     | contour | contourf | hist | imshow | line | pcolormesh | plot | scatter | step | surface |
| ----------------- | ------------------------------------------------------------------------------------------- | ------- | -------- | ---- | ------ | ---- | ---------- | ---- | ------- | ---- | ------- |
| `_labels`         | `line`                                                                                      |         |          |      |        | Y    |            |      |         |      |         |
| `add_colorbar`    | `contour`, `contourf`, `imshow`, `pcolormesh`, `scatter`, `surface`                         | Y       | Y        |      | Y      |      | Y          |      | Y       |      | Y       |
| `add_labels`      | `contour`, `contourf`, `imshow`, `pcolormesh`, `scatter`, `surface`                         | Y       | Y        |      | Y      |      | Y          |      | Y       |      | Y       |
| `add_legend`      | `line`, `scatter`                                                                           |         |          |      |        | Y    |            |      | Y       |      |         |
| `add_title`       | `scatter`                                                                                   |         |          |      |        |      |            |      | Y       |      |         |
| `aspect`          | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `cbar_ax`         | `contour`, `contourf`, `imshow`, `pcolormesh`, `surface`                                    | Y       | Y        |      | Y      |      | Y          |      |         |      | Y       |
| `cbar_kwargs`     | `contour`, `contourf`, `imshow`, `pcolormesh`, `surface`                                    | Y       | Y        |      | Y      |      | Y          |      |         |      | Y       |
| `center`          | `contour`, `contourf`, `imshow`, `pcolormesh`, `surface`                                    | Y       | Y        |      | Y      |      | Y          |      |         |      | Y       |
| `cmap`            | `contour`, `contourf`, `imshow`, `pcolormesh`, `scatter`, `surface`                         | Y       | Y        |      | Y      |      | Y          |      | Y       |      | Y       |
| `col`             | `contour`, `contourf`, `imshow`, `line`, `pcolormesh`, `plot`, `scatter`, `step`, `surface` | Y       | Y        |      | Y      | Y    | Y          | Y    | Y       | Y    | Y       |
| `col_wrap`        | `contour`, `contourf`, `imshow`, `pcolormesh`, `plot`, `scatter`, `surface`                 | Y       | Y        |      | Y      |      | Y          | Y    | Y       |      | Y       |
| `colors`          | `contour`, `contourf`, `imshow`, `pcolormesh`, `surface`                                    | Y       | Y        |      | Y      |      | Y          |      |         |      | Y       |
| `drawstyle`       | `step`                                                                                      |         |          |      |        |      |            |      |         | Y    |         |
| `ds`              | `step`                                                                                      |         |          |      |        |      |            |      |         | Y    |         |
| `extend`          | `contour`, `contourf`, `imshow`, `pcolormesh`, `scatter`, `surface`                         | Y       | Y        |      | Y      |      | Y          |      | Y       |      | Y       |
| `figsize`         | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `hue`             | `line`, `plot`, `scatter`                                                                   |         |          |      |        | Y    |            | Y    | Y       |      |         |
| `hue_style`       | `scatter`                                                                                   |         |          |      |        |      |            |      | Y       |      |         |
| `infer_intervals` | `contour`, `contourf`, `imshow`, `pcolormesh`, `surface`                                    | Y       | Y        |      | Y      |      | Y          |      |         |      | Y       |
| `levels`          | `contour`, `contourf`, `imshow`, `pcolormesh`, `scatter`, `surface`                         | Y       | Y        |      | Y      |      | Y          |      | Y       |      | Y       |
| `linewidth`       | `scatter`                                                                                   |         |          |      |        |      |            |      | Y       |      |         |
| `markersize`      | `scatter`                                                                                   |         |          |      |        |      |            |      | Y       |      |         |
| `norm`            | `contour`, `contourf`, `imshow`, `pcolormesh`, `scatter`, `surface`                         | Y       | Y        |      | Y      |      | Y          |      | Y       |      | Y       |
| `robust`          | `contour`, `contourf`, `imshow`, `pcolormesh`, `surface`                                    | Y       | Y        |      | Y      |      | Y          |      |         |      | Y       |
| `row`             | `contour`, `contourf`, `imshow`, `line`, `pcolormesh`, `plot`, `scatter`, `step`, `surface` | Y       | Y        |      | Y      | Y    | Y          | Y    | Y       | Y    | Y       |
| `size`            | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `subplot_kws`     | `contour`, `contourf`, `imshow`, `pcolormesh`, `plot`, `scatter`, `surface`                 | Y       | Y        |      | Y      |      | Y          | Y    | Y       |      | Y       |
| `vmax`            | `contour`, `contourf`, `imshow`, `pcolormesh`, `scatter`, `surface`                         | Y       | Y        |      | Y      |      | Y          |      | Y       |      | Y       |
| `vmin`            | `contour`, `contourf`, `imshow`, `pcolormesh`, `scatter`, `surface`                         | Y       | Y        |      | Y      |      | Y          |      | Y       |      | Y       |
| `where`           | `step`                                                                                      |         |          |      |        |      |            |      |         | Y    |         |
| `xincrease`       | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `xlim`            | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `xscale`          | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `xticks`          | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `yincrease`       | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `ylim`            | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `yscale`          | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |
| `yticks`          | `contour`, `contourf`, `hist`, `imshow`, `line`, `pcolormesh`, `scatter`, `surface`         | Y       | Y        | Y    | Y      | Y    | Y          |      | Y       |      | Y       |

## All Parsed Signatures and Params

### `contour`

#### overload (line 1884)

**Returns:** `QuadContourSet`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `DataArray`                       |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `float \| None`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `None`                            |
| `col`             | `kwonly`     | `None`  | `None`                            |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 1924)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col`             | `kwonly`     | ∅       | `Hashable`                        |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 1964)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | ∅       | `Hashable`                        |
| `col`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### implementation (line 2004)

**Returns:** `QuadContourSet`

| Param    | Kind         | Default | Annotation   |
| -------- | ------------ | ------- | ------------ |
| `x`      | `positional` | ∅       | `np.ndarray` |
| `y`      | `positional` | ∅       | `np.ndarray` |
| `z`      | `positional` | ∅       | `np.ndarray` |
| `ax`     | `positional` | ∅       | `Axes`       |
| `kwargs` | `varkw`      | ∅       | `Any`        |

### `contourf`

#### overload (line 2017)

**Returns:** `QuadContourSet`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `DataArray`                       |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `None`                            |
| `col`             | `kwonly`     | `None`  | `None`                            |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 2057)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col`             | `kwonly`     | ∅       | `Hashable`                        |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 2097)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | ∅       | `Hashable`                        |
| `col`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### implementation (line 2137)

**Returns:** `QuadContourSet`

| Param    | Kind         | Default | Annotation   |
| -------- | ------------ | ------- | ------------ |
| `x`      | `positional` | ∅       | `np.ndarray` |
| `y`      | `positional` | ∅       | `np.ndarray` |
| `z`      | `positional` | ∅       | `np.ndarray` |
| `ax`     | `positional` | ∅       | `Axes`       |
| `kwargs` | `varkw`      | ∅       | `Any`        |

### `hist`

#### implementation (line 642)

**Returns:** `tuple[np.ndarray, np.ndarray, BarContainer \| Polygon]`

| Param       | Kind         | Default | Annotation                    |
| ----------- | ------------ | ------- | ----------------------------- |
| `darray`    | `positional` | ∅       | `DataArray`                   |
| `figsize`   | `kwonly`     | `None`  | `Iterable[float] \| None`     |
| `size`      | `kwonly`     | `None`  | `float \| None`               |
| `aspect`    | `kwonly`     | `None`  | `AspectOptions`               |
| `ax`        | `kwonly`     | `None`  | `Axes \| None`                |
| `xincrease` | `kwonly`     | `None`  | `bool \| None`                |
| `yincrease` | `kwonly`     | `None`  | `bool \| None`                |
| `xscale`    | `kwonly`     | `None`  | `ScaleOptions`                |
| `yscale`    | `kwonly`     | `None`  | `ScaleOptions`                |
| `xticks`    | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `yticks`    | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `xlim`      | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `ylim`      | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `kwargs`    | `varkw`      | ∅       | `Any`                         |

### `imshow`

#### overload (line 1667)

**Returns:** `AxesImage`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `DataArray`                       |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `float \| None`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `None`                            |
| `col`             | `kwonly`     | `None`  | `None`                            |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 1707)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col`             | `kwonly`     | ∅       | `Hashable`                        |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 1747)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | ∅       | `Hashable`                        |
| `col`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### implementation (line 1787)

**Returns:** `AxesImage`

| Param    | Kind         | Default | Annotation               |
| -------- | ------------ | ------- | ------------------------ |
| `x`      | `positional` | ∅       | `np.ndarray`             |
| `y`      | `positional` | ∅       | `np.ndarray`             |
| `z`      | `positional` | ∅       | `np.ma.core.MaskedArray` |
| `ax`     | `positional` | ∅       | `Axes`                   |
| `kwargs` | `varkw`      | ∅       | `Any`                    |

### `line`

#### overload (line 320)

**Returns:** `list[Line3D]`

| Param        | Kind         | Default | Annotation                    |
| ------------ | ------------ | ------- | ----------------------------- |
| `darray`     | `positional` | ∅       | `DataArray`                   |
| `args`       | `vararg`     | ∅       | `Any`                         |
| `row`        | `kwonly`     | `None`  | `None`                        |
| `col`        | `kwonly`     | `None`  | `None`                        |
| `figsize`    | `kwonly`     | `None`  | `Iterable[float] \| None`     |
| `aspect`     | `kwonly`     | `None`  | `AspectOptions`               |
| `size`       | `kwonly`     | `None`  | `float \| None`               |
| `ax`         | `kwonly`     | `None`  | `Axes \| None`                |
| `hue`        | `kwonly`     | `None`  | `Hashable \| None`            |
| `x`          | `kwonly`     | `None`  | `Hashable \| None`            |
| `y`          | `kwonly`     | `None`  | `Hashable \| None`            |
| `xincrease`  | `kwonly`     | `None`  | `bool \| None`                |
| `yincrease`  | `kwonly`     | `None`  | `bool \| None`                |
| `xscale`     | `kwonly`     | `None`  | `ScaleOptions`                |
| `yscale`     | `kwonly`     | `None`  | `ScaleOptions`                |
| `xticks`     | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `yticks`     | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `xlim`       | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `ylim`       | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `add_legend` | `kwonly`     | `True`  | `bool`                        |
| `_labels`    | `kwonly`     | `True`  | `bool`                        |
| `kwargs`     | `varkw`      | ∅       | `Any`                         |

#### overload (line 347)

**Returns:** `FacetGrid[T_DataArray]`

| Param        | Kind         | Default | Annotation                    |
| ------------ | ------------ | ------- | ----------------------------- |
| `darray`     | `positional` | ∅       | `T_DataArray`                 |
| `args`       | `vararg`     | ∅       | `Any`                         |
| `row`        | `kwonly`     | ∅       | `Hashable`                    |
| `col`        | `kwonly`     | `None`  | `Hashable \| None`            |
| `figsize`    | `kwonly`     | `None`  | `Iterable[float] \| None`     |
| `aspect`     | `kwonly`     | `None`  | `AspectOptions`               |
| `size`       | `kwonly`     | `None`  | `float \| None`               |
| `ax`         | `kwonly`     | `None`  | `Axes \| None`                |
| `hue`        | `kwonly`     | `None`  | `Hashable \| None`            |
| `x`          | `kwonly`     | `None`  | `Hashable \| None`            |
| `y`          | `kwonly`     | `None`  | `Hashable \| None`            |
| `xincrease`  | `kwonly`     | `None`  | `bool \| None`                |
| `yincrease`  | `kwonly`     | `None`  | `bool \| None`                |
| `xscale`     | `kwonly`     | `None`  | `ScaleOptions`                |
| `yscale`     | `kwonly`     | `None`  | `ScaleOptions`                |
| `xticks`     | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `yticks`     | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `xlim`       | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `ylim`       | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `add_legend` | `kwonly`     | `True`  | `bool`                        |
| `_labels`    | `kwonly`     | `True`  | `bool`                        |
| `kwargs`     | `varkw`      | ∅       | `Any`                         |

#### overload (line 374)

**Returns:** `FacetGrid[T_DataArray]`

| Param        | Kind         | Default | Annotation                    |
| ------------ | ------------ | ------- | ----------------------------- |
| `darray`     | `positional` | ∅       | `T_DataArray`                 |
| `args`       | `vararg`     | ∅       | `Any`                         |
| `row`        | `kwonly`     | `None`  | `Hashable \| None`            |
| `col`        | `kwonly`     | ∅       | `Hashable`                    |
| `figsize`    | `kwonly`     | `None`  | `Iterable[float] \| None`     |
| `aspect`     | `kwonly`     | `None`  | `AspectOptions`               |
| `size`       | `kwonly`     | `None`  | `float \| None`               |
| `ax`         | `kwonly`     | `None`  | `Axes \| None`                |
| `hue`        | `kwonly`     | `None`  | `Hashable \| None`            |
| `x`          | `kwonly`     | `None`  | `Hashable \| None`            |
| `y`          | `kwonly`     | `None`  | `Hashable \| None`            |
| `xincrease`  | `kwonly`     | `None`  | `bool \| None`                |
| `yincrease`  | `kwonly`     | `None`  | `bool \| None`                |
| `xscale`     | `kwonly`     | `None`  | `ScaleOptions`                |
| `yscale`     | `kwonly`     | `None`  | `ScaleOptions`                |
| `xticks`     | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `yticks`     | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `xlim`       | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `ylim`       | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `add_legend` | `kwonly`     | `True`  | `bool`                        |
| `_labels`    | `kwonly`     | `True`  | `bool`                        |
| `kwargs`     | `varkw`      | ∅       | `Any`                         |

#### implementation (line 402)

**Returns:** `list[Line3D] \| FacetGrid[T_DataArray]`

| Param        | Kind         | Default | Annotation                    |
| ------------ | ------------ | ------- | ----------------------------- |
| `darray`     | `positional` | ∅       | `T_DataArray`                 |
| `args`       | `vararg`     | ∅       | `Any`                         |
| `row`        | `kwonly`     | `None`  | `Hashable \| None`            |
| `col`        | `kwonly`     | `None`  | `Hashable \| None`            |
| `figsize`    | `kwonly`     | `None`  | `Iterable[float] \| None`     |
| `aspect`     | `kwonly`     | `None`  | `AspectOptions`               |
| `size`       | `kwonly`     | `None`  | `float \| None`               |
| `ax`         | `kwonly`     | `None`  | `Axes \| None`                |
| `hue`        | `kwonly`     | `None`  | `Hashable \| None`            |
| `x`          | `kwonly`     | `None`  | `Hashable \| None`            |
| `y`          | `kwonly`     | `None`  | `Hashable \| None`            |
| `xincrease`  | `kwonly`     | `None`  | `bool \| None`                |
| `yincrease`  | `kwonly`     | `None`  | `bool \| None`                |
| `xscale`     | `kwonly`     | `None`  | `ScaleOptions`                |
| `yscale`     | `kwonly`     | `None`  | `ScaleOptions`                |
| `xticks`     | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `yticks`     | `kwonly`     | `None`  | `ArrayLike \| None`           |
| `xlim`       | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `ylim`       | `kwonly`     | `None`  | `tuple[float, float] \| None` |
| `add_legend` | `kwonly`     | `True`  | `bool`                        |
| `_labels`    | `kwonly`     | `True`  | `bool`                        |
| `kwargs`     | `varkw`      | ∅       | `Any`                         |

### `pcolormesh`

#### overload (line 2150)

**Returns:** `QuadMesh`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `DataArray`                       |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `None`                            |
| `col`             | `kwonly`     | `None`  | `None`                            |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 2190)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col`             | `kwonly`     | ∅       | `Hashable`                        |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 2230)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | ∅       | `Hashable`                        |
| `col`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### implementation (line 2270)

**Returns:** `QuadMesh`

| Param             | Kind         | Default | Annotation             |
| ----------------- | ------------ | ------- | ---------------------- |
| `x`               | `positional` | ∅       | `np.ndarray`           |
| `y`               | `positional` | ∅       | `np.ndarray`           |
| `z`               | `positional` | ∅       | `np.ndarray`           |
| `ax`              | `positional` | ∅       | `Axes`                 |
| `xscale`          | `positional` | `None`  | `ScaleOptions \| None` |
| `yscale`          | `positional` | `None`  | `ScaleOptions \| None` |
| `infer_intervals` | `positional` | `None`  | ∅                      |
| `kwargs`          | `varkw`      | ∅       | `Any`                  |

### `plot`

#### implementation (line 226)

**Returns:** `Any`

| Param         | Kind         | Default | Annotation               |
| ------------- | ------------ | ------- | ------------------------ |
| `darray`      | `positional` | ∅       | `DataArray`              |
| `row`         | `kwonly`     | `None`  | `Hashable \| None`       |
| `col`         | `kwonly`     | `None`  | `Hashable \| None`       |
| `col_wrap`    | `kwonly`     | `None`  | `int \| None`            |
| `ax`          | `kwonly`     | `None`  | `Axes \| None`           |
| `hue`         | `kwonly`     | `None`  | `Hashable \| None`       |
| `subplot_kws` | `kwonly`     | `None`  | `dict[str, Any] \| None` |
| `kwargs`      | `varkw`      | ∅       | `Any`                    |

### `scatter`

#### overload (line 1117)

**Returns:** `PathCollection`

| Param          | Kind         | Default | Annotation                |
| -------------- | ------------ | ------- | ------------------------- |
| `darray`       | `positional` | ∅       | `DataArray`               |
| `args`         | `vararg`     | ∅       | `Any`                     |
| `x`            | `kwonly`     | `None`  | `Hashable \| None`        |
| `y`            | `kwonly`     | `None`  | `Hashable \| None`        |
| `z`            | `kwonly`     | `None`  | `Hashable \| None`        |
| `hue`          | `kwonly`     | `None`  | `Hashable \| None`        |
| `hue_style`    | `kwonly`     | `None`  | `HueStyleOptions`         |
| `markersize`   | `kwonly`     | `None`  | `Hashable \| None`        |
| `linewidth`    | `kwonly`     | `None`  | `Hashable \| None`        |
| `figsize`      | `kwonly`     | `None`  | `Iterable[float] \| None` |
| `size`         | `kwonly`     | `None`  | `float \| None`           |
| `aspect`       | `kwonly`     | `None`  | `float \| None`           |
| `ax`           | `kwonly`     | `None`  | `Axes \| None`            |
| `row`          | `kwonly`     | `None`  | `None`                    |
| `col`          | `kwonly`     | `None`  | `None`                    |
| `col_wrap`     | `kwonly`     | `None`  | `int \| None`             |
| `xincrease`    | `kwonly`     | `True`  | `bool \| None`            |
| `yincrease`    | `kwonly`     | `True`  | `bool \| None`            |
| `add_legend`   | `kwonly`     | `None`  | `bool \| None`            |
| `add_colorbar` | `kwonly`     | `None`  | `bool \| None`            |
| `add_labels`   | `kwonly`     | `True`  | `bool \| Iterable[bool]`  |
| `add_title`    | `kwonly`     | `True`  | `bool`                    |
| `subplot_kws`  | `kwonly`     | `None`  | `dict[str, Any] \| None`  |
| `xscale`       | `kwonly`     | `None`  | `ScaleOptions`            |
| `yscale`       | `kwonly`     | `None`  | `ScaleOptions`            |
| `xticks`       | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `yticks`       | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `xlim`         | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `ylim`         | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `cmap`         | `kwonly`     | `None`  | `str \| Colormap \| None` |
| `vmin`         | `kwonly`     | `None`  | `float \| None`           |
| `vmax`         | `kwonly`     | `None`  | `float \| None`           |
| `norm`         | `kwonly`     | `None`  | `Normalize \| None`       |
| `extend`       | `kwonly`     | `None`  | `ExtendOptions`           |
| `levels`       | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `kwargs`       | `varkw`      | ∅       | ∅                         |

#### overload (line 1158)

**Returns:** `FacetGrid[T_DataArray]`

| Param          | Kind         | Default | Annotation                |
| -------------- | ------------ | ------- | ------------------------- |
| `darray`       | `positional` | ∅       | `T_DataArray`             |
| `args`         | `vararg`     | ∅       | `Any`                     |
| `x`            | `kwonly`     | `None`  | `Hashable \| None`        |
| `y`            | `kwonly`     | `None`  | `Hashable \| None`        |
| `z`            | `kwonly`     | `None`  | `Hashable \| None`        |
| `hue`          | `kwonly`     | `None`  | `Hashable \| None`        |
| `hue_style`    | `kwonly`     | `None`  | `HueStyleOptions`         |
| `markersize`   | `kwonly`     | `None`  | `Hashable \| None`        |
| `linewidth`    | `kwonly`     | `None`  | `Hashable \| None`        |
| `figsize`      | `kwonly`     | `None`  | `Iterable[float] \| None` |
| `size`         | `kwonly`     | `None`  | `float \| None`           |
| `aspect`       | `kwonly`     | `None`  | `float \| None`           |
| `ax`           | `kwonly`     | `None`  | `Axes \| None`            |
| `row`          | `kwonly`     | `None`  | `Hashable \| None`        |
| `col`          | `kwonly`     | ∅       | `Hashable`                |
| `col_wrap`     | `kwonly`     | `None`  | `int \| None`             |
| `xincrease`    | `kwonly`     | `True`  | `bool \| None`            |
| `yincrease`    | `kwonly`     | `True`  | `bool \| None`            |
| `add_legend`   | `kwonly`     | `None`  | `bool \| None`            |
| `add_colorbar` | `kwonly`     | `None`  | `bool \| None`            |
| `add_labels`   | `kwonly`     | `True`  | `bool \| Iterable[bool]`  |
| `add_title`    | `kwonly`     | `True`  | `bool`                    |
| `subplot_kws`  | `kwonly`     | `None`  | `dict[str, Any] \| None`  |
| `xscale`       | `kwonly`     | `None`  | `ScaleOptions`            |
| `yscale`       | `kwonly`     | `None`  | `ScaleOptions`            |
| `xticks`       | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `yticks`       | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `xlim`         | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `ylim`         | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `cmap`         | `kwonly`     | `None`  | `str \| Colormap \| None` |
| `vmin`         | `kwonly`     | `None`  | `float \| None`           |
| `vmax`         | `kwonly`     | `None`  | `float \| None`           |
| `norm`         | `kwonly`     | `None`  | `Normalize \| None`       |
| `extend`       | `kwonly`     | `None`  | `ExtendOptions`           |
| `levels`       | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `kwargs`       | `varkw`      | ∅       | ∅                         |

#### overload (line 1199)

**Returns:** `FacetGrid[T_DataArray]`

| Param          | Kind         | Default | Annotation                |
| -------------- | ------------ | ------- | ------------------------- |
| `darray`       | `positional` | ∅       | `T_DataArray`             |
| `args`         | `vararg`     | ∅       | `Any`                     |
| `x`            | `kwonly`     | `None`  | `Hashable \| None`        |
| `y`            | `kwonly`     | `None`  | `Hashable \| None`        |
| `z`            | `kwonly`     | `None`  | `Hashable \| None`        |
| `hue`          | `kwonly`     | `None`  | `Hashable \| None`        |
| `hue_style`    | `kwonly`     | `None`  | `HueStyleOptions`         |
| `markersize`   | `kwonly`     | `None`  | `Hashable \| None`        |
| `linewidth`    | `kwonly`     | `None`  | `Hashable \| None`        |
| `figsize`      | `kwonly`     | `None`  | `Iterable[float] \| None` |
| `size`         | `kwonly`     | `None`  | `float \| None`           |
| `aspect`       | `kwonly`     | `None`  | `float \| None`           |
| `ax`           | `kwonly`     | `None`  | `Axes \| None`            |
| `row`          | `kwonly`     | ∅       | `Hashable`                |
| `col`          | `kwonly`     | `None`  | `Hashable \| None`        |
| `col_wrap`     | `kwonly`     | `None`  | `int \| None`             |
| `xincrease`    | `kwonly`     | `True`  | `bool \| None`            |
| `yincrease`    | `kwonly`     | `True`  | `bool \| None`            |
| `add_legend`   | `kwonly`     | `None`  | `bool \| None`            |
| `add_colorbar` | `kwonly`     | `None`  | `bool \| None`            |
| `add_labels`   | `kwonly`     | `True`  | `bool \| Iterable[bool]`  |
| `add_title`    | `kwonly`     | `True`  | `bool`                    |
| `subplot_kws`  | `kwonly`     | `None`  | `dict[str, Any] \| None`  |
| `xscale`       | `kwonly`     | `None`  | `ScaleOptions`            |
| `yscale`       | `kwonly`     | `None`  | `ScaleOptions`            |
| `xticks`       | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `yticks`       | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `xlim`         | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `ylim`         | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `cmap`         | `kwonly`     | `None`  | `str \| Colormap \| None` |
| `vmin`         | `kwonly`     | `None`  | `float \| None`           |
| `vmax`         | `kwonly`     | `None`  | `float \| None`           |
| `norm`         | `kwonly`     | `None`  | `Normalize \| None`       |
| `extend`       | `kwonly`     | `None`  | `ExtendOptions`           |
| `levels`       | `kwonly`     | `None`  | `ArrayLike \| None`       |
| `kwargs`       | `varkw`      | ∅       | ∅                         |

#### implementation (line 1240)

**Returns:** `PathCollection`

| Param        | Kind         | Default | Annotation               |
| ------------ | ------------ | ------- | ------------------------ |
| `xplt`       | `positional` | ∅       | `DataArray \| None`      |
| `yplt`       | `positional` | ∅       | `DataArray \| None`      |
| `ax`         | `positional` | ∅       | `Axes`                   |
| `add_labels` | `positional` | `True`  | `bool \| Iterable[bool]` |
| `kwargs`     | `varkw`      | ∅       | ∅                        |

### `step`

#### overload (line 542)

**Returns:** `list[Line3D]`

| Param       | Kind         | Default | Annotation                      |
| ----------- | ------------ | ------- | ------------------------------- |
| `darray`    | `positional` | ∅       | `DataArray`                     |
| `args`      | `vararg`     | ∅       | `Any`                           |
| `where`     | `kwonly`     | `"pre"` | `Literal["pre", "post", "mid"]` |
| `drawstyle` | `kwonly`     | `None`  | `str \| None`                   |
| `ds`        | `kwonly`     | `None`  | `str \| None`                   |
| `row`       | `kwonly`     | `None`  | `None`                          |
| `col`       | `kwonly`     | `None`  | `None`                          |
| `kwargs`    | `varkw`      | ∅       | `Any`                           |

#### overload (line 555)

**Returns:** `FacetGrid[DataArray]`

| Param       | Kind         | Default | Annotation                      |
| ----------- | ------------ | ------- | ------------------------------- |
| `darray`    | `positional` | ∅       | `DataArray`                     |
| `args`      | `vararg`     | ∅       | `Any`                           |
| `where`     | `kwonly`     | `"pre"` | `Literal["pre", "post", "mid"]` |
| `drawstyle` | `kwonly`     | `None`  | `str \| None`                   |
| `ds`        | `kwonly`     | `None`  | `str \| None`                   |
| `row`       | `kwonly`     | ∅       | `Hashable`                      |
| `col`       | `kwonly`     | `None`  | `Hashable \| None`              |
| `kwargs`    | `varkw`      | ∅       | `Any`                           |

#### overload (line 568)

**Returns:** `FacetGrid[DataArray]`

| Param       | Kind         | Default | Annotation                      |
| ----------- | ------------ | ------- | ------------------------------- |
| `darray`    | `positional` | ∅       | `DataArray`                     |
| `args`      | `vararg`     | ∅       | `Any`                           |
| `where`     | `kwonly`     | `"pre"` | `Literal["pre", "post", "mid"]` |
| `drawstyle` | `kwonly`     | `None`  | `str \| None`                   |
| `ds`        | `kwonly`     | `None`  | `str \| None`                   |
| `row`       | `kwonly`     | `None`  | `Hashable \| None`              |
| `col`       | `kwonly`     | ∅       | `Hashable`                      |
| `kwargs`    | `varkw`      | ∅       | `Any`                           |

#### implementation (line 580)

**Returns:** `list[Line3D] \| FacetGrid[DataArray]`

| Param       | Kind         | Default | Annotation                      |
| ----------- | ------------ | ------- | ------------------------------- |
| `darray`    | `positional` | ∅       | `DataArray`                     |
| `args`      | `vararg`     | ∅       | `Any`                           |
| `where`     | `kwonly`     | `"pre"` | `Literal["pre", "post", "mid"]` |
| `drawstyle` | `kwonly`     | `None`  | `str \| None`                   |
| `ds`        | `kwonly`     | `None`  | `str \| None`                   |
| `row`       | `kwonly`     | `None`  | `Hashable \| None`              |
| `col`       | `kwonly`     | `None`  | `Hashable \| None`              |
| `kwargs`    | `varkw`      | ∅       | `Any`                           |

### `surface`

#### overload (line 2334)

**Returns:** `Poly3DCollection`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `DataArray`                       |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `None`                            |
| `col`             | `kwonly`     | `None`  | `None`                            |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 2374)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col`             | `kwonly`     | ∅       | `Hashable`                        |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### overload (line 2414)

**Returns:** `FacetGrid[T_DataArray]`

| Param             | Kind         | Default | Annotation                        |
| ----------------- | ------------ | ------- | --------------------------------- |
| `darray`          | `positional` | ∅       | `T_DataArray`                     |
| `x`               | `positional` | `None`  | `Hashable \| None`                |
| `y`               | `positional` | `None`  | `Hashable \| None`                |
| `figsize`         | `kwonly`     | `None`  | `Iterable[float] \| None`         |
| `size`            | `kwonly`     | `None`  | `float \| None`                   |
| `aspect`          | `kwonly`     | `None`  | `AspectOptions`                   |
| `ax`              | `kwonly`     | `None`  | `Axes \| None`                    |
| `row`             | `kwonly`     | ∅       | `Hashable`                        |
| `col`             | `kwonly`     | `None`  | `Hashable \| None`                |
| `col_wrap`        | `kwonly`     | `None`  | `int \| None`                     |
| `xincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `yincrease`       | `kwonly`     | `True`  | `bool \| None`                    |
| `add_colorbar`    | `kwonly`     | `None`  | `bool \| None`                    |
| `add_labels`      | `kwonly`     | `True`  | `bool`                            |
| `vmin`            | `kwonly`     | `None`  | `float \| None`                   |
| `vmax`            | `kwonly`     | `None`  | `float \| None`                   |
| `cmap`            | `kwonly`     | `None`  | `str \| Colormap \| None`         |
| `center`          | `kwonly`     | `None`  | `float \| Literal[False] \| None` |
| `robust`          | `kwonly`     | `False` | `bool`                            |
| `extend`          | `kwonly`     | `None`  | `ExtendOptions`                   |
| `levels`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `infer_intervals` | `kwonly`     | `None`  | ∅                                 |
| `colors`          | `kwonly`     | `None`  | `str \| ArrayLike \| None`        |
| `subplot_kws`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `cbar_ax`         | `kwonly`     | `None`  | `Axes \| None`                    |
| `cbar_kwargs`     | `kwonly`     | `None`  | `dict[str, Any] \| None`          |
| `xscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `yscale`          | `kwonly`     | `None`  | `ScaleOptions`                    |
| `xticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `yticks`          | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `xlim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `ylim`            | `kwonly`     | `None`  | `ArrayLike \| None`               |
| `norm`            | `kwonly`     | `None`  | `Normalize \| None`               |
| `kwargs`          | `varkw`      | ∅       | `Any`                             |

#### implementation (line 2454)

**Returns:** `Poly3DCollection`

| Param    | Kind         | Default | Annotation   |
| -------- | ------------ | ------- | ------------ |
| `x`      | `positional` | ∅       | `np.ndarray` |
| `y`      | `positional` | ∅       | `np.ndarray` |
| `z`      | `positional` | ∅       | `np.ndarray` |
| `ax`     | `positional` | ∅       | `Axes`       |
| `kwargs` | `varkw`      | ∅       | `Any`        |

## Parsing Algorithm

1. Load source text (URL or local file).
2. Parse with Python `ast.parse`.
3. Select top-level `FunctionDef` nodes for known plotting methods.
4. Mark overloads by decorator (`@overload`).
5. Extract parameters from `args`, `kwonlyargs`, varargs, kwargs, defaults, annotations.
6. Build per-method implementation kwarg sets.
7. Compute set intersection (common kwargs) and per-method differences.
8. Generate markdown tables: overload summary, kwarg matrix, full signature inventory.
9. Emit architecture suggestions derived from parsed groups.
10. Write output markdown.
