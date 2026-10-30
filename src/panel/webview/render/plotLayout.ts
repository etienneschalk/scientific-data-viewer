import { CreatePlotResponse } from '../../../shared/plotLayout';
import { escapeHtml } from '../util';

/**
 * One line under a plot: what was drawn and where each dimension went.
 * Items set in the plot controls are outlined like the changed controls
 * (see changedFields.ts); the others were chosen by the backend. Notes
 * explain user choices that could not be used.
 */
export function renderPlotLayout(response: CreatePlotResponse): string {
    const { layout, appliedSlices = {} } = response;
    if (!layout) {
        return '';
    }
    const item = (name: string, value: unknown, user: boolean, title: string) =>
        /*html*/ `<span class="plot-layout-item${user ? ' plot-layout-item--user' : ''}" title="${escapeHtml(title)}">${escapeHtml(name)} <code>${escapeHtml(String(value))}</code></span>`;
    const items = [
        ...Object.entries(appliedSlices).map(([dim, value]) =>
            item(dim, value, true, 'Dimension slice (isel) you set'),
        ),
        ...layout.squeezed.map((dim) =>
            item(dim, 0, false, 'Size 1: index 0 taken automatically'),
        ),
        ...layout.choices.map((choice) =>
            item(
                choice.role,
                choice.value,
                choice.source === 'user',
                choice.source === 'user'
                    ? 'Plot parameter you set'
                    : 'Chosen automatically: set this plot parameter to change it',
            ),
        ),
    ];
    const notes = layout.notes.length
        ? /*html*/ `<ul class="plot-layout-notes">${layout.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
        : '';
    return /*html*/ `
        <div class="plot-layout-line">
            <span class="plot-layout-kind" title="Plot kind">${escapeHtml(layout.kind)}</span>
            ${items.join('')}
            <span class="plot-layout-legend">outlined: set by you · others: automatic</span>
        </div>
        ${notes}`;
}
