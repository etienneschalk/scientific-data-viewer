import { joinId } from '../../shared/ids';
import {
    readDimensionSlices,
    renderDimensionSliceFields,
    resetDimensionSlices,
} from './dimensionSlices';
import { escapeHtml } from './util';

type PlotParameterKind =
    'dimension' | 'bool' | 'int' | 'float' | 'text' | 'colWrap';

/** Fieldsets of the plot parameters, in display order */
const PLOT_PARAMETER_GROUPS = ['Facets', 'Axes', 'Color', 'Figure'] as const;
type PlotParameterGroup = (typeof PLOT_PARAMETER_GROUPS)[number];

export interface PlotParameter {
    /** createPlot payload field */
    key: string;
    label: string;
    /** Short help shown after the label (the full help is in `title`) */
    hint?: string;
    kind: PlotParameterKind;
    /** Fieldset the control is shown in */
    group: PlotParameterGroup;
    /** Element id in the Global Plot Controls */
    id: string;
    /** Element id prefix in a Group Plot Controls block (`-<safe group id>` appended) */
    groupId: string;
    title: string;
    /** Checkbox default (bool) */
    default?: boolean;
    /** Minimum (int, colWrap) */
    min?: number;
    /** Reject values <= 0 (float) */
    positive?: boolean;
    placeholder?: string;
    /** colWrap only: the "auto" checkbox */
    autoId?: string;
    groupAutoId?: string;
    autoTitle?: string;
}

/**
 * Plot parameters shared by the Global Plot Controls and every Group Plot
 * Controls block, in display order. Each entry drives rendering, reading,
 * resetting and merging. `id` / `groupId` keep the historical element ids.
 */
export const PLOT_PARAMETERS: PlotParameter[] = [
    {
        key: 'facetRow',
        label: 'row',
        hint: 'facets',
        kind: 'dimension',
        group: 'Facets',
        id: 'facetRowSelect',
        groupId: 'group-facet-row',
        title: 'xarray row: dimension to facet along rows',
    },
    {
        key: 'facetCol',
        label: 'col',
        hint: 'facets',
        kind: 'dimension',
        group: 'Facets',
        id: 'facetColSelect',
        groupId: 'group-facet-col',
        title: 'xarray col: dimension to facet along columns',
    },
    {
        key: 'colWrap',
        label: 'col_wrap',
        hint: 'max columns',
        kind: 'colWrap',
        min: 1,
        group: 'Facets',
        id: 'plotColWrapInput',
        groupId: 'group-plot-col-wrap',
        autoId: 'plotColWrapAutoCheckbox',
        groupAutoId: 'group-plot-col-wrap-auto',
        placeholder: 'e.g. 4',
        title: 'xarray col_wrap: max columns in faceted grid (positive integer)',
        autoTitle:
            "xarray col_wrap='auto' (wrap facets automatically; xarray 2026.04+)",
    },
    {
        key: 'plotX',
        label: 'x',
        kind: 'dimension',
        group: 'Axes',
        id: 'plotXSelect',
        groupId: 'group-plot-x',
        title: 'xarray x: dimension for the x-axis',
    },
    {
        key: 'plotY',
        label: 'y',
        kind: 'dimension',
        group: 'Axes',
        id: 'plotYSelect',
        groupId: 'group-plot-y',
        title: 'xarray y: dimension for the y-axis',
    },
    {
        key: 'plotHue',
        label: 'hue',
        hint: 'colors',
        kind: 'dimension',
        group: 'Axes',
        id: 'plotHueSelect',
        groupId: 'group-plot-hue',
        title: 'xarray hue: dimension mapped to colors',
    },
    {
        key: 'xincrease',
        label: 'xincrease',
        kind: 'bool',
        default: true,
        group: 'Axes',
        id: 'xIncreaseCheckbox',
        groupId: 'group-x-increase',
        title: 'xarray xincrease (uncheck to reverse x-axis)',
    },
    {
        key: 'yincrease',
        label: 'yincrease',
        kind: 'bool',
        default: true,
        group: 'Axes',
        id: 'yIncreaseCheckbox',
        groupId: 'group-y-increase',
        title: 'xarray yincrease (uncheck to reverse y-axis)',
    },
    {
        key: 'vmin',
        label: 'vmin',
        kind: 'float',
        group: 'Color',
        id: 'plotVminInput',
        groupId: 'group-plot-vmin',
        placeholder: 'auto',
        title: 'Color scale minimum (float)',
    },
    {
        key: 'vmax',
        label: 'vmax',
        kind: 'float',
        group: 'Color',
        id: 'plotVmaxInput',
        groupId: 'group-plot-vmax',
        placeholder: 'auto',
        title: 'Color scale maximum (float)',
    },
    {
        key: 'cmap',
        label: 'cmap',
        hint: 'colormap',
        kind: 'text',
        group: 'Color',
        id: 'plotCmapInput',
        groupId: 'group-plot-cmap',
        placeholder: 'e.g. viridis',
        title: 'Matplotlib colormap name (user must provide a valid existing cmap)',
    },
    {
        key: 'robust',
        label: 'robust',
        hint: '2–98 %',
        kind: 'bool',
        default: false,
        group: 'Color',
        id: 'robustCheckbox',
        groupId: 'group-robust',
        title: 'xarray robust: use 2nd/98th percentiles for color limits (helps with outliers)',
    },
    {
        key: 'addColorbar',
        label: 'add_colorbar',
        kind: 'bool',
        default: true,
        group: 'Color',
        id: 'addColorbarCheckbox',
        groupId: 'group-add-colorbar',
        title: 'xarray add_colorbar (uncheck to hide colorbar when applicable)',
    },
    {
        key: 'size',
        label: 'size',
        hint: 'height, in',
        kind: 'float',
        positive: true,
        group: 'Figure',
        id: 'plotSizeInput',
        groupId: 'group-plot-size',
        placeholder: 'e.g. 5',
        title: 'xarray size in inches (fig height, float)',
    },
    {
        key: 'aspect',
        label: 'aspect',
        hint: 'width / height',
        kind: 'float',
        positive: true,
        group: 'Figure',
        id: 'plotAspectInput',
        groupId: 'group-plot-aspect',
        placeholder: 'e.g. 1.5',
        title: 'xarray aspect (fig width = aspect * size, float)',
    },
    {
        key: 'bins',
        label: 'bins',
        hint: 'histogram',
        kind: 'int',
        min: 1,
        group: 'Figure',
        id: 'plotBinsInput',
        groupId: 'group-bins',
        placeholder: 'e.g. 100',
        title: 'Number of bins for histogram-style plots',
    },
    {
        key: 'addLegend',
        label: 'add_legend',
        kind: 'bool',
        default: true,
        group: 'Figure',
        id: 'addLegendCheckbox',
        groupId: 'group-add-legend',
        title: 'xarray add_legend (default on: typical xarray plot defaults; backend omits when unsafe for imshow)',
    },
];

export type PlotParameterValue = string | number | boolean | undefined;

/** Values read from one scope: one entry per PLOT_PARAMETERS key, plus the slices. */
export interface PlotControlsValues {
    [key: string]: PlotParameterValue | Record<string, string | number>;
    dimensionSlices: Record<string, string | number>;
}

/**
 * Either the global controls (`groupName === null`) or one group's
 * controls. It decides element ids and the data-group attribute.
 */
export interface PlotScope {
    groupName: string | null;
    safeId?: string;
}

export function globalPlotScope(): PlotScope {
    return { groupName: null };
}

export function groupPlotScope(groupName: string): PlotScope {
    return { groupName, safeId: joinId(['group-plot', groupName]) };
}

function plotParamElementId(
    scope: PlotScope,
    param: PlotParameter,
    which: 'main' | 'auto' = 'main',
): string {
    if (scope.groupName === null) {
        return (which === 'auto' ? param.autoId : param.id) ?? '';
    }
    const base = which === 'auto' ? param.groupAutoId : param.groupId;
    return `${base}-${scope.safeId}`;
}

function groupAttribute(scope: PlotScope): string {
    return scope.groupName === null
        ? ''
        : ` data-group="${escapeHtml(scope.groupName)}"`;
}

function dimensionOptionsHtml(dimNames: string[]): string {
    return (
        '<option value="">None</option>' +
        dimNames
            .map(
                (d) =>
                    `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`,
            )
            .join('')
    );
}

/** Label of a field: the xarray name, then a short muted hint. */
function fieldLabel(id: string, name: string, hint?: string): string {
    return /*html*/ `<label for="${id}" class="plot-field-label"><span class="plot-field-name">${escapeHtml(name)}</span>${hint ? `<span class="plot-field-hint">${escapeHtml(hint)}</span>` : ''}</label>`;
}

/** Control of one parameter (the cell's second line). */
function renderPlotParameterControl(
    scope: PlotScope,
    param: PlotParameter,
    dimNames: string[],
): string {
    const id = plotParamElementId(scope, param);
    const groupAttr = groupAttribute(scope);
    const title = escapeHtml(param.title);
    const placeholder = escapeHtml(param.placeholder);
    switch (param.kind) {
        case 'dimension':
            return /*html*/ `<select id="${id}" class="facet-select" data-param="${param.key}"${groupAttr} title="${title}">${dimensionOptionsHtml(dimNames)}</select>`;
        case 'bool':
            return /*html*/ `<span class="plot-field-check"><input type="checkbox" id="${id}" class="plot-checkbox" data-param="${param.key}"${groupAttr}${param.default ? ' checked' : ''} title="${title}" /></span>`;
        case 'colWrap': {
            const autoId = plotParamElementId(scope, param, 'auto');
            return /*html*/ `
                <span class="plot-field-pair">
                    <input type="number" id="${id}" class="plot-input" min="1" data-param="${param.key}"${groupAttr} placeholder="${placeholder}" title="${title}" />
                    <label for="${autoId}" class="plot-inline-check" title="${escapeHtml(param.autoTitle)}"><input type="checkbox" id="${autoId}" class="plot-checkbox plot-col-wrap-auto" data-param="${param.key}Auto"${groupAttr} />auto</label>
                </span>`;
        }
        case 'int':
            return /*html*/ `<input type="number" id="${id}" class="plot-input"${param.min !== undefined ? ` min="${param.min}"` : ''} data-param="${param.key}"${groupAttr} placeholder="${placeholder}" title="${title}" />`;
        default:
            // float and text
            return /*html*/ `<input type="text" id="${id}" class="plot-input" data-param="${param.key}"${groupAttr} placeholder="${placeholder}" title="${title}" />`;
    }
}

/**
 * HTML of the plot parameters of a scope: one fieldset per group (Facets,
 * Axes...), each parameter a cell (name above, control below) of a grid
 * whose columns line up across fieldsets.
 */
export function renderPlotParameters(
    scope: PlotScope,
    dimNames: string[],
): string {
    return PLOT_PARAMETER_GROUPS.map((group) => {
        const cells = PLOT_PARAMETERS.filter((param) => param.group === group)
            .map(
                (param) => /*html*/ `
                    <div class="plot-field" title="${escapeHtml(param.title)}">
                        ${fieldLabel(plotParamElementId(scope, param), param.label, param.hint)}
                        ${renderPlotParameterControl(scope, param, dimNames)}
                    </div>`,
            )
            .join('');
        return /*html*/ `
                <div class="plot-fieldset">
                    <div class="plot-fieldset-caption">${group}</div>
                    <div class="plot-fields">${cells}</div>
                </div>`;
    }).join('');
}

/** Replace the options of every dimension select under `root`, keeping valid selections. */
export function setDimensionOptions(
    root: ParentNode,
    dimNames: string[],
): void {
    root.querySelectorAll<HTMLSelectElement>(
        'select.facet-select[data-param]',
    ).forEach((select) => {
        const previous = select.value;
        select.innerHTML = dimensionOptionsHtml(dimNames);
        select.value = dimNames.includes(previous) ? previous : '';
    });
}

function paramElement(root: ParentNode, key: string): HTMLInputElement | null {
    // `key` comes from PLOT_PARAMETERS (constant identifiers), safe in a selector.
    return root.querySelector<HTMLInputElement>(`[data-param="${key}"]`);
}

function readNumber(
    element: HTMLInputElement,
    param: PlotParameter,
): number | undefined {
    const raw = element.value.trim();
    if (raw === '') {
        return undefined;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
        return undefined;
    }
    if (param.kind === 'int' || param.kind === 'colWrap') {
        if (!Number.isInteger(n) || n < (param.min ?? 1)) {
            return undefined;
        }
    }
    if (param.positive && n <= 0) {
        return undefined;
    }
    return n;
}

/** Value of one parameter, or undefined when the control is empty or invalid. */
function readPlotParameter(
    root: ParentNode,
    param: PlotParameter,
): PlotParameterValue {
    const element = paramElement(root, param.key);
    if (!element) {
        return undefined;
    }
    switch (param.kind) {
        case 'bool':
            return element.checked;
        case 'colWrap': {
            const auto = paramElement(root, `${param.key}Auto`);
            if (auto && auto.checked) {
                return 'auto';
            }
            return readNumber(element, param);
        }
        case 'int':
        case 'float':
            return readNumber(element, param);
        default: {
            const value = element.value.trim();
            return value === '' ? undefined : value;
        }
    }
}

/** All plot options of a scope root (global section or group section). */
export function readPlotControls(root: ParentNode): PlotControlsValues {
    const values: PlotControlsValues = {
        dimensionSlices: readDimensionSlices(root),
    };
    for (const param of PLOT_PARAMETERS) {
        values[param.key] = readPlotParameter(root, param);
    }
    return values;
}

function isPlotParameterSet(
    param: PlotParameter,
    value: PlotControlsValues[string],
): boolean {
    if (value === undefined) {
        return false;
    }
    return param.kind !== 'bool' || value !== param.default;
}

/**
 * Group values win when set; a group control left empty (or a checkbox left
 * at its default) falls back to the global control. Dimension slices: the
 * group's slices replace the global ones when the group has any.
 */
export function mergePlotControls(
    groupValues: PlotControlsValues | null,
    globalValues: PlotControlsValues,
): PlotControlsValues {
    const groupSlices = groupValues?.dimensionSlices ?? {};
    const merged: PlotControlsValues = {
        dimensionSlices:
            Object.keys(groupSlices).length > 0
                ? groupSlices
                : globalValues.dimensionSlices,
    };
    for (const param of PLOT_PARAMETERS) {
        const groupValue = groupValues?.[param.key];
        merged[param.key] = isPlotParameterSet(param, groupValue)
            ? groupValue
            : globalValues[param.key];
    }
    return merged;
}

/** Reset dimension slices and plot parameters under `root` to their defaults. */
export function resetPlotControls(root: ParentNode): void {
    resetDimensionSlices(root);
    for (const param of PLOT_PARAMETERS) {
        const element = paramElement(root, param.key);
        if (!element) {
            continue;
        }
        if (param.kind === 'bool') {
            element.checked = param.default === true;
        } else {
            element.value = '';
            element.disabled = false;
        }
        if (param.kind === 'colWrap') {
            const auto = paramElement(root, `${param.key}Auto`);
            if (auto) {
                auto.checked = false;
            }
        }
    }
}

/** col_wrap "auto" disables the numeric input next to it. */
export function syncColWrapAutoCheckbox(autoCheckbox: HTMLInputElement): void {
    const root = autoCheckbox.closest('.dimension-slices-facets');
    const numberInput = root ? paramElement(root, 'colWrap') : null;
    if (numberInput) {
        numberInput.disabled = autoCheckbox.checked;
    }
}

export function renderDimensionSliceInputs(
    scope: PlotScope,
    dimSizes: Record<string, number>,
): string {
    return renderDimensionSliceFields(dimSizes, scope.groupName, scope.safeId);
}
