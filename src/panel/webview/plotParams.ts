import { escapeHtml } from './util';

/**
 * The plot parameters: one table drives the controls of the settings editor
 * (plotEditor.ts), their reading, checking and merging (plotSettings.ts).
 *
 * Every value is kept as the text of its control (`RawParams`, '' = not set
 * at this level), so an editor can be removed and rebuilt from the store
 * without losing anything, a wrong number included.
 */

type PlotParameterKind =
    'dimension' | 'bool' | 'int' | 'float' | 'text' | 'colWrap' | 'choice';

/** Fieldsets of the plot parameters, in display order */
const PLOT_PARAMETER_GROUPS = [
    'Facets',
    'Axes',
    'Color',
    'Flags',
    'Figure',
] as const;
type PlotParameterGroup = (typeof PLOT_PARAMETER_GROUPS)[number];

export interface PlotParameter {
    /** createPlot payload field, and `data-param` of the control */
    key: string;
    label: string;
    /** Short help shown after the label (the full help is in `title`) */
    hint?: string;
    kind: PlotParameterKind;
    /** Fieldset the control is shown in */
    group: PlotParameterGroup;
    title: string;
    /** Value used when no level sets it (bool), always sent */
    default?: boolean;
    /** Minimum (int, colWrap) */
    min?: number;
    /** Reject values <= 0 (float) */
    positive?: boolean;
    /** Example shown in an empty input that inherits nothing */
    placeholder?: string;
    /** choice only: the values offered after the empty (automatic) one */
    choices?: readonly string[];
    /** choice only: label of the empty value */
    emptyLabel?: string;
    /** colWrap only: title of the "auto" checkbox */
    autoTitle?: string;
}

/** Plot parameters, in display order. */
export const PLOT_PARAMETERS: PlotParameter[] = [
    {
        key: 'facetRow',
        label: 'row',
        hint: 'facets',
        kind: 'dimension',
        group: 'Facets',
        title: 'xarray row: dimension to facet along rows',
    },
    {
        key: 'facetCol',
        label: 'col',
        hint: 'facets',
        kind: 'dimension',
        group: 'Facets',
        title: 'xarray col: dimension to facet along columns',
    },
    {
        key: 'colWrap',
        label: 'col_wrap',
        hint: 'max columns',
        kind: 'colWrap',
        min: 1,
        group: 'Facets',
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
        title: 'xarray x: dimension for the x-axis',
    },
    {
        key: 'plotY',
        label: 'y',
        kind: 'dimension',
        group: 'Axes',
        title: 'xarray y: dimension for the y-axis',
    },
    {
        key: 'plotHue',
        label: 'hue',
        hint: 'colors',
        kind: 'dimension',
        group: 'Axes',
        title: 'xarray hue: dimension mapped to colors',
    },
    {
        key: 'xincrease',
        label: 'xincrease',
        kind: 'bool',
        default: true,
        group: 'Axes',
        title: 'xarray xincrease: false reverses the x-axis',
    },
    {
        key: 'yincrease',
        label: 'yincrease',
        kind: 'bool',
        default: true,
        group: 'Axes',
        title: 'xarray yincrease: false reverses the y-axis',
    },
    {
        key: 'vmin',
        label: 'vmin',
        kind: 'float',
        group: 'Color',
        placeholder: 'auto',
        title: 'Color scale minimum (float)',
    },
    {
        key: 'vmax',
        label: 'vmax',
        kind: 'float',
        group: 'Color',
        placeholder: 'auto',
        title: 'Color scale maximum (float)',
    },
    {
        key: 'cmap',
        label: 'cmap',
        hint: 'colormap',
        kind: 'text',
        group: 'Color',
        placeholder: 'e.g. viridis, seaborn:rocket',
        title: 'Matplotlib colormap name (viridis, magma...), or seaborn:<name> for a seaborn colormap or palette (seaborn:rocket, seaborn:mako_r, seaborn:light:seagreen; needs the seaborn package)',
    },
    {
        key: 'norm',
        label: 'norm',
        hint: 'scale',
        kind: 'choice',
        choices: ['log'],
        emptyLabel: 'linear',
        group: 'Color',
        title: 'log: colors follow log10(value), colorbar in data units (images); log data axis (lines). Values <= 0 are not shown. linear by default',
    },
    {
        key: 'robust',
        label: 'robust',
        hint: '2–98 %',
        kind: 'bool',
        default: false,
        group: 'Color',
        title: 'xarray robust: use 2nd/98th percentiles for color limits (helps with outliers)',
    },
    {
        key: 'addColorbar',
        label: 'add_colorbar',
        kind: 'bool',
        default: true,
        group: 'Color',
        title: 'xarray add_colorbar: false hides the colorbar',
    },
    {
        key: 'useFlags',
        label: 'flags',
        hint: 'CF meanings',
        kind: 'bool',
        default: true,
        group: 'Flags',
        title: 'CF flag variables (flag_values / flag_masks + flag_meanings): one color per meaning, named in the colorbar, one panel per bit flag. false: plot the raw numbers',
    },
    {
        key: 'flagSelect',
        label: 'flag_select',
        hint: 'meanings',
        kind: 'text',
        group: 'Flags',
        placeholder: 'e.g. cloud, water',
        title: 'CF flag meanings to draw, separated by commas (case, _ and spaces ignored). flag_values: the others in grey; bit flags: only their panels',
    },
    {
        key: 'flagCombine',
        label: 'flag_combine',
        hint: 'bits',
        kind: 'choice',
        choices: ['any', 'all', 'none'],
        emptyLabel: 'per flag',
        group: 'Flags',
        title: 'Bit flags (flag_masks) in one map: any = set for at least one (OR), all = set for all (AND), none = set for none (the clear points). Uses the flag_select meanings, else all. Empty: one panel per flag',
    },
    {
        key: 'hideFlags',
        label: 'hide_flags',
        hint: 'ancillary',
        kind: 'text',
        group: 'Flags',
        placeholder: 'e.g. cloud, land',
        title: "Hide the points where a flag variable named in the variable's ancillary_variables has one of these meanings set (commas)",
    },
    {
        key: 'size',
        label: 'size',
        hint: 'height, in',
        kind: 'float',
        positive: true,
        group: 'Figure',
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
        placeholder: 'e.g. 100',
        title: 'Number of bins for histogram-style plots',
    },
    {
        key: 'addLegend',
        label: 'add_legend',
        kind: 'bool',
        default: true,
        group: 'Figure',
        title: 'xarray add_legend (true by default; left out where xarray cannot use it)',
    },
];

export const PLOT_PARAMETER_BY_KEY = new Map(
    PLOT_PARAMETERS.map((param) => [param.key, param]),
);

/**
 * Parameter behind each role of the layout line under a plot (render/
 * plotLayout.ts), so a click on an item opens its control.
 */
export const LAYOUT_ROLE_PARAMETERS: Record<string, string> = {
    row: 'facetRow',
    col: 'facetCol',
    col_wrap: 'colWrap',
    x: 'plotX',
    y: 'plotY',
    hue: 'plotHue',
    size: 'size',
    aspect: 'aspect',
    bins: 'bins',
    norm: 'norm',
    flags: 'useFlags',
    hide_flags: 'hideFlags',
};

export type PlotParameterValue = string | number | boolean | undefined;

/** Text of the controls of one level, by parameter key ('' or absent: not set). */
export type RawParams = Record<string, string>;

/** Value of a level after this one, shown in grey in an empty control. */
export interface InheritedValue {
    raw: string;
    /** Where it is set: `file`, `group /a`... */
    source: string;
}

/** Text of a set value, as the controls and the summaries show it. */
export function displayPlotValue(raw: string): string {
    return raw.trim();
}

/** What an empty control falls back to: the inherited value, else the default. */
function fallbackText(
    param: PlotParameter,
    inherited?: InheritedValue,
): string {
    if (inherited) {
        return `${displayPlotValue(inherited.raw)} (${inherited.source})`;
    }
    switch (param.kind) {
        case 'bool':
            return `${param.default ? 'true' : 'false'} (default)`;
        case 'choice':
            return param.emptyLabel ?? 'auto';
        case 'dimension':
            return 'auto';
        default:
            return param.placeholder ?? 'auto';
    }
}

/** Element id of a control: one editor is open at a time. */
export function plotSettingId(key: string): string {
    return `plot-setting-${key}`;
}

export interface ParameterRenderContext {
    /** Dimensions offered by the dimension selects */
    dimNames: string[];
    /** Values set at the level being edited */
    values: RawParams;
    /** Value each empty control falls back to, from the levels after this one */
    inherited: Record<string, InheritedValue | undefined>;
    /** Show the Flags fieldset (a CF flag variable, or ancillary_variables) */
    showFlags: boolean;
}

/** Label of a field: the xarray name, then a short muted hint. */
function fieldLabel(id: string, name: string, hint?: string): string {
    return /*html*/ `<label for="${id}" class="plot-field-label"><span class="plot-field-name">${escapeHtml(name)}</span>${hint ? `<span class="plot-field-hint">${escapeHtml(hint)}</span>` : ''}</label>`;
}

/** Control of one parameter (the field's second line). */
function renderPlotParameterControl(
    param: PlotParameter,
    context: ParameterRenderContext,
): string {
    const id = plotSettingId(param.key);
    const raw = context.values[param.key] ?? '';
    const fallback = fallbackText(param, context.inherited[param.key]);
    const title = escapeHtml(param.title);
    const option = (value: string, label: string) =>
        `<option value="${escapeHtml(value)}"${value === raw ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const select = (values: readonly string[]) =>
        /*html*/ `<select id="${id}" class="plot-choice" data-param="${param.key}" title="${title}">${option('', fallback)}${values.map((value) => option(value, value)).join('')}</select>`;
    const input = (inputMode: string, value: string, disabled = false) =>
        /*html*/ `<input type="text" id="${id}" class="plot-input" data-param="${param.key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(fallback)}" title="${title}" inputmode="${inputMode}" autocomplete="off" spellcheck="false"${disabled ? ' disabled' : ''} />`;
    switch (param.kind) {
        case 'dimension':
            // A value set for dimensions no longer listed (Refresh) stays visible
            return select(
                raw && !context.dimNames.includes(raw)
                    ? [...context.dimNames, raw]
                    : context.dimNames,
            );
        case 'bool':
            return select(['true', 'false']);
        case 'choice':
            return select(param.choices ?? []);
        case 'colWrap': {
            const auto = raw === 'auto';
            return /*html*/ `
                <span class="plot-field-pair">
                    ${input('numeric', auto ? '' : raw, auto)}
                    <label for="${id}-auto" class="plot-inline-check" title="${escapeHtml(param.autoTitle)}"><input type="checkbox" id="${id}-auto" class="plot-checkbox plot-col-wrap-auto" data-param="${param.key}Auto"${auto ? ' checked' : ''} />auto</label>
                </span>`;
        }
        case 'int':
            return input('numeric', raw);
        case 'float':
            return input('decimal', raw);
        default:
            return input('text', raw);
    }
}

/**
 * HTML of the plot parameters of one level: one fieldset per group (Facets,
 * Axes...), each parameter a cell (name above, control below) of a grid
 * whose columns line up across fieldsets.
 */
export function renderPlotParameters(context: ParameterRenderContext): string {
    return PLOT_PARAMETER_GROUPS.filter(
        (group) => group !== 'Flags' || context.showFlags,
    )
        .map((group) => {
            const cells = PLOT_PARAMETERS.filter(
                (param) => param.group === group,
            )
                .map(
                    (param) => /*html*/ `
                    <div class="plot-field" data-field="${param.key}" title="${escapeHtml(param.title)}">
                        ${fieldLabel(plotSettingId(param.key), param.label, param.hint)}
                        ${renderPlotParameterControl(param, context)}
                    </div>`,
                )
                .join('');
            return /*html*/ `
                <div class="plot-fieldset">
                    <div class="plot-fieldset-caption">${group}</div>
                    <div class="plot-fields">${cells}</div>
                </div>`;
        })
        .join('');
}

/** Text of every parameter control under `root` (only the controls shown). */
export function readPlotParameterTexts(root: ParentNode): RawParams {
    const values: RawParams = {};
    for (const param of PLOT_PARAMETERS) {
        // `key` comes from PLOT_PARAMETERS (constant identifiers), safe in a selector
        const element = root.querySelector<
            HTMLInputElement | HTMLSelectElement
        >(`[data-param="${param.key}"]`);
        if (!element) {
            continue;
        }
        const auto =
            param.kind === 'colWrap'
                ? root.querySelector<HTMLInputElement>(
                      `[data-param="${param.key}Auto"]`,
                  )
                : null;
        values[param.key] = auto?.checked ? 'auto' : element.value.trim();
    }
    return values;
}

/** Why a number typed for `param` cannot be used, or null. */
function numberError(param: PlotParameter, text: string): string | null {
    const n = Number(text);
    if (!Number.isFinite(n)) {
        return `${param.label}: "${text}" is not a number${text.includes(',') ? ' (use a dot as decimal separator)' : ''}`;
    }
    const min = param.min ?? 1;
    if (
        (param.kind === 'int' || param.kind === 'colWrap') &&
        (!Number.isInteger(n) || n < min)
    ) {
        return `${param.label}: must be a whole number, at least ${min}`;
    }
    if (param.positive && n <= 0) {
        return `${param.label}: must be greater than 0`;
    }
    return null;
}

/** Value sent for a text, or why it cannot be used. Nothing for ''. */
export function parsePlotParameter(
    param: PlotParameter,
    raw: string,
): { value?: PlotParameterValue; error?: string } {
    const text = raw.trim();
    if (text === '') {
        return {};
    }
    switch (param.kind) {
        case 'bool':
            return { value: text === 'true' };
        case 'colWrap':
        case 'int':
        case 'float': {
            if (param.kind === 'colWrap' && text === 'auto') {
                return { value: 'auto' };
            }
            const error = numberError(param, text);
            return error ? { error } : { value: Number(text) };
        }
        default:
            return { value: text };
    }
}

/** `input` / `change` listener: outline a number typed wrong, with the reason. */
export function validatePlotParameterInput(target: EventTarget | null): void {
    if (
        !(target instanceof HTMLInputElement) ||
        !target.classList.contains('plot-input')
    ) {
        return;
    }
    const param = PLOT_PARAMETER_BY_KEY.get(target.dataset.param ?? '');
    if (!param || !['int', 'float', 'colWrap'].includes(param.kind)) {
        return;
    }
    const text = target.value.trim();
    const message =
        target.disabled || text === '' ? null : numberError(param, text);
    target.setCustomValidity(message ?? '');
    if (message) {
        target.setAttribute('aria-invalid', 'true');
    } else {
        target.removeAttribute('aria-invalid');
    }
    target.title = message ?? param.title;
}

/** col_wrap "auto" disables the number box next to it. */
export function syncColWrapAutoCheckbox(autoCheckbox: HTMLInputElement): void {
    const numberInput = autoCheckbox
        .closest('.plot-field')
        ?.querySelector<HTMLInputElement>('[data-param="colWrap"]');
    if (numberInput) {
        numberInput.disabled = autoCheckbox.checked;
        validatePlotParameterInput(numberInput);
    }
}
