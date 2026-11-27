/**
 * Plot settings editor: one panel, opened under the Plot buttons of a
 * variable or a group (`[data-settings-scope]`, the "host"), built from the
 * store when opened and removed when closed. One editor is open at a time,
 * so a file with many variables never holds more than one set of controls.
 *
 * Tabs choose the level the controls write to: the host's own level, then
 * every level it inherits from (parent groups, the whole file). An empty
 * control shows in grey what it falls back to.
 *
 * Each host also shows a summary: every setting that applies to it, with
 * the level that sets it; a click opens the editor on that level and field.
 */
import { ICONS } from '../../shared/icons';
import { refreshChangedFields } from './changedFields';
import {
    initDimensionSliceRows,
    readSliceTexts,
    renderDimensionSliceFields,
} from './dimensionSlices';
import {
    PLOT_PARAMETER_BY_KEY,
    readPlotParameterTexts,
    renderPlotParameters,
    validatePlotParameterInput,
} from './plotParams';
import {
    countLevelSettings,
    effectiveSettings,
    inheritedSettings,
    levelSettings,
    clearLevelSettings,
    ScopeKey,
    scopeChain,
    scopeDescription,
    scopeDimensions,
    scopeHasFlags,
    scopeSourceLabel,
    scopeTitle,
    settingSource,
    updateLevelSettings,
} from './plotSettings';
import { escapeHtml, findByData } from './util';

interface OpenEditor {
    host: HTMLElement;
    element: HTMLElement;
    chain: ScopeKey[];
    active: ScopeKey;
}

let current: OpenEditor | null = null;

/**
 * True while the editor's content is replaced or removed. Chrome fires
 * `change` on a focused box as it is removed: storing it then would put
 * back the values a Reset just cleared.
 */
let replacing = false;

function withoutCapture(update: () => void): void {
    replacing = true;
    try {
        update();
    } finally {
        replacing = false;
    }
}

/** Where a parameter or a dimension slice should get the focus. */
export interface SettingTarget {
    param?: string;
    dimension?: string;
}

/** Variable or group Plot section holding `element`. */
function settingsHost(element: Element): HTMLElement | null {
    return element.closest<HTMLElement>('[data-settings-scope]');
}

function hostScope(host: HTMLElement): ScopeKey {
    return host.dataset.settingsScope ?? '';
}

function setExpanded(host: HTMLElement, expanded: boolean): void {
    host.querySelector('.plot-settings-button')?.setAttribute(
        'aria-expanded',
        String(expanded),
    );
}

/** Open the host and the cards around it, so the editor is seen. */
function revealHost(host: HTMLElement): void {
    let details: HTMLDetailsElement | null = host.closest('details');
    while (details) {
        details.open = true;
        details = details.parentElement?.closest('details') ?? null;
    }
}

export function closePlotEditor(): void {
    if (!current) {
        return;
    }
    const { element } = current;
    withoutCapture(() => element.remove());
    setExpanded(current.host, false);
    current = null;
}

/**
 * Open the editor of `host` (closing any other one) on the level `active`
 * (default: the host's own), and put the focus on `focus` if given.
 */
export function openPlotEditor(
    host: HTMLElement,
    active?: ScopeKey,
    focus?: SettingTarget,
): void {
    if (current && current.host !== host) {
        closePlotEditor();
    }
    const container = host.querySelector<HTMLElement>('.plot-editor-host');
    if (!container) {
        return;
    }
    const chain = scopeChain(hostScope(host));
    if (!current) {
        const element = document.createElement('div');
        element.className = 'plot-editor';
        element.setAttribute('role', 'region');
        element.setAttribute('aria-label', 'Plot settings');
        container.appendChild(element);
        current = { host, element, chain, active: chain[0] };
        setExpanded(host, true);
    }
    current.chain = chain;
    current.active = active && chain.includes(active) ? active : chain[0];
    revealHost(host);
    renderEditor();
    if (focus) {
        focusSetting(focus);
    }
}

/** Settings button: open the editor of its host, or close it. */
export function togglePlotEditor(button: HTMLElement): void {
    const host = settingsHost(button);
    if (!host) {
        return;
    }
    if (current?.host === host) {
        closePlotEditor();
    } else {
        openPlotEditor(host);
    }
}

/**
 * A summary item or an item of the layout line under a plot: open the
 * editor on the level that sets it (`data-scope`, else the one found now,
 * else the host's own) with the focus on its field.
 */
export function editSetting(element: HTMLElement): void {
    const host = settingsHost(element);
    if (!host) {
        return;
    }
    const target: SettingTarget = {
        param: element.dataset.focusParam,
        dimension: element.dataset.focusDimension,
    };
    const scope =
        element.dataset.scope ?? settingSource(hostScope(host), target);
    openPlotEditor(host, scope, target);
}

/** A tab of the editor: show the controls of that level. */
export function selectEditorTab(tab: HTMLElement): void {
    if (current && tab.dataset.scope) {
        current.active = tab.dataset.scope;
        renderEditor();
        current.element
            .querySelector<HTMLElement>(
                '.plot-editor-tab[aria-selected="true"]',
            )
            ?.focus();
    }
}

/** Reset button of a block: clear that block at the level shown. */
export function resetEditorBlock(button: HTMLElement): void {
    if (!current) {
        return;
    }
    const part = button.dataset.part;
    clearLevelSettings(
        current.active,
        part === 'params' || part === 'slices' ? part : undefined,
    );
    renderEditor();
}

/** Plot button of the editor: the main Plot button of its host. */
export function plotFromEditor(): void {
    current?.host
        .querySelector<HTMLButtonElement>(
            '.plot-controls-row [data-action="create-plot"], .plot-controls-row [data-action="plot-group"]',
        )
        ?.click();
}

function tabsHtml(): string {
    if (!current) {
        return '';
    }
    const { chain, active } = current;
    return chain
        .map((scope) => {
            const count = countLevelSettings(scope);
            return /*html*/ `<button type="button" role="tab" class="plot-editor-tab" data-action="editor-tab" data-scope="${escapeHtml(scope)}" aria-selected="${scope === active}" title="${escapeHtml(`Settings of ${scopeDescription(scope)}`)}">${escapeHtml(scopeTitle(scope))}${count > 0 ? `<span class="count-badge">${count}</span>` : ''}</button>`;
        })
        .join('');
}

function blockHeading(title: string, part: string, help: string): string {
    return /*html*/ `
            <div class="plot-controls-heading">
                <h5 class="plot-controls-subsection-title">${title}</h5>
                <button type="button" class="plot-reset-button" data-action="editor-reset" data-part="${part}" title="${help}">Reset</button>
            </div>`;
}

function renderEditor(): void {
    if (!current) {
        return;
    }
    const { element, chain, active, host } = current;
    const index = chain.indexOf(active);
    const level = levelSettings(active);
    const inherited = inheritedSettings(chain, index);
    const dims = scopeDimensions(active);
    const isLast = index === chain.length - 1;
    const isGroupHost = hostScope(host).startsWith('g:');
    const slices = Object.keys(dims).length
        ? /*html*/ `<div class="plot-fields plot-fields--slices dimension-slices-container">${renderDimensionSliceFields(dims, { values: level.slices, inherited: inherited.slices })}</div>`
        : '<p class="muted-text">No dimensions.</p>';
    const html = /*html*/ `
        <div class="plot-editor-head">
            <div class="plot-editor-tabs" role="tablist" aria-label="Level of the settings">${tabsHtml()}</div>
            <button type="button" class="plot-editor-close" data-action="editor-close" title="Close the plot settings (Escape)" aria-label="Close the plot settings">${ICONS.close}</button>
        </div>
        <p class="plot-editor-hint">These settings apply to <strong>${escapeHtml(scopeDescription(active))}</strong>. ${
            isLast
                ? 'An empty field is chosen automatically for each variable.'
                : 'An empty field takes the value shown in grey, from a tab to its right; without one, it is chosen automatically.'
        }</p>
        <div class="plot-controls-subsection dimension-slices-isel">
            ${blockHeading('Dimension slices <code>isel</code>', 'slices', 'Clear the dimension slices of this level')}
            <p class="dimension-slices-hint">Start with an empty stop selects one index (<code>130</code>); start, stop and step select a slice (<code>100:120</code>, <code>0:24:2</code>; stop excluded; negative counts from the end). The slider moves start and stop. See <a href="https://docs.xarray.dev/en/stable/user-guide/indexing.html" target="_blank" rel="noopener noreferrer">Indexing and selecting data</a>.</p>
            ${slices}
        </div>
        <div class="plot-controls-subsection plot-parameters">
            ${blockHeading('Plot parameters <code>plot</code>', 'params', 'Clear the plot parameters of this level')}
            <p class="dimension-slices-hint">Passed to the xarray plot call. A field set at this level is outlined. See <a href="https://docs.xarray.dev/en/latest/user-guide/plotting.html" target="_blank" rel="noopener noreferrer">xarray plotting</a>.</p>
            <div class="dimension-slices-facets">${renderPlotParameters({
                dimNames: Object.keys(dims).sort(),
                values: level.params,
                inherited: inherited.params,
                showFlags: scopeHasFlags(active),
            })}</div>
        </div>
        <div class="plot-editor-footer">
            <button type="button" class="create-plot-button" data-action="editor-plot">${isGroupHost ? 'Plot group' : 'Create Plot'}</button>
            <span class="plot-editor-tip">Enter: plot · Escape: close</span>
            <button type="button" class="plot-action-button" data-action="editor-close">Close</button>
        </div>`;
    withoutCapture(() => {
        element.innerHTML = html;
    });
    initDimensionSliceRows(element);
    // A wrong number kept in the store is outlined again
    element
        .querySelectorAll('.plot-input')
        .forEach((input) => validatePlotParameterInput(input));
    refreshChangedFields(element);
}

function focusSetting(target: SettingTarget): void {
    if (!current) {
        return;
    }
    const { element } = current;
    let field: HTMLElement | null = null;
    let control: HTMLElement | null = null;
    if (target.param && PLOT_PARAMETER_BY_KEY.has(target.param)) {
        // A key of PLOT_PARAMETERS (constant identifiers), safe in a selector
        field = element.querySelector<HTMLElement>(
            `.plot-field[data-field="${target.param}"]`,
        );
        control =
            field?.querySelector<HTMLElement>(
                'input:not([type="checkbox"]), select',
            ) ?? null;
    } else if (target.dimension) {
        field = findByData(
            element,
            '.dimension-slice-row',
            'dimension',
            target.dimension,
        );
        control =
            field?.querySelector<HTMLElement>(
                '.slice-part[data-part="start"]',
            ) ?? null;
    }
    if (!field) {
        return;
    }
    control?.focus();
    if (typeof field.scrollIntoView === 'function') {
        field.scrollIntoView({ block: 'nearest' });
    }
    const focused = field;
    focused.classList.add('plot-field--focus');
    setTimeout(() => focused.classList.remove('plot-field--focus'), 1600);
}

/**
 * `input` / `change` listener (after the slice and number handlers): store
 * what the open editor shows for its level.
 */
export function handlePlotEditorEvent(target: EventTarget | null): void {
    if (
        !current ||
        replacing ||
        !(target instanceof Element) ||
        !current.element.contains(target) ||
        !target.closest('.plot-field')
    ) {
        return;
    }
    updateLevelSettings(current.active, {
        params: readPlotParameterTexts(current.element),
        slices: readSliceTexts(current.element),
    });
    const tabs = current.element.querySelector('.plot-editor-tabs');
    if (tabs) {
        tabs.innerHTML = tabsHtml();
    }
}

/** `keydown` listener: Enter in a box plots, Escape closes the editor. */
export function handlePlotEditorKey(event: KeyboardEvent): void {
    if (
        !current ||
        event.isComposing ||
        !(event.target instanceof Element) ||
        !current.element.contains(event.target)
    ) {
        return;
    }
    if (event.key === 'Escape') {
        const host = current.host;
        closePlotEditor();
        host.querySelector<HTMLElement>('.plot-settings-button')?.focus();
        event.preventDefault();
    } else if (
        event.key === 'Enter' &&
        event.target instanceof HTMLInputElement &&
        event.target.type === 'text'
    ) {
        // The change event first, so the store has the value
        event.target.dispatchEvent(new Event('change', { bubbles: true }));
        plotFromEditor();
        event.preventDefault();
    }
}

// ---------------------------------------------------------------- summaries

/** Items of a summary: each setting that applies, with the level that sets it. */
export function renderSettingsSummary(scope: ScopeKey): string {
    const items = effectiveSettings(scope);
    if (items.length === 0) {
        return /*html*/ `<span class="plot-settings-label">Settings: all automatic</span>`;
    }
    const chips = items.map((item) => {
        const focus =
            item.kind === 'param'
                ? `data-focus-param="${escapeHtml(item.id)}"`
                : `data-focus-dimension="${escapeHtml(item.id)}"`;
        const title = `${item.label} = ${item.display}, set for ${scopeDescription(item.source)}. Click to change it.`;
        return /*html*/ `<button type="button" class="settings-chip${item.source === scope ? ' settings-chip--here' : ''}" data-action="edit-setting" data-scope="${escapeHtml(item.source)}" ${focus} title="${escapeHtml(title)}"><span class="settings-chip-name">${escapeHtml(item.label)}</span><code>${escapeHtml(item.display)}</code><span class="settings-chip-source">${escapeHtml(scopeSourceLabel(item.source))}</span></button>`;
    });
    return /*html*/ `<span class="plot-settings-label">Settings:</span>${chips.join('')}`;
}

const renderedSummaries = new WeakMap<Element, string>();

/** Rewrite the summary of every host under `root` whose content changed. */
export function refreshSettingsSummaries(root: ParentNode = document): void {
    root.querySelectorAll<HTMLElement>('[data-settings-scope]').forEach(
        (host) => {
            const summary = host.querySelector('.plot-settings-summary');
            if (!summary) {
                return;
            }
            const html = renderSettingsSummary(hostScope(host));
            if (renderedSummaries.get(summary) !== html) {
                summary.innerHTML = html;
                renderedSummaries.set(summary, html);
            }
        },
    );
}
