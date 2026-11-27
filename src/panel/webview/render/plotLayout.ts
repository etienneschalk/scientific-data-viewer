import { CreatePlotResponse } from '../../../shared/plotLayout';
import { LAYOUT_ROLE_PARAMETERS } from '../plotParams';
import { escapeHtml } from '../util';

/**
 * One line under a plot: what was drawn and where each dimension went.
 * Items set in the plot controls are outlined and marked `•` like the
 * changed controls (see changedFields.ts); the others were chosen by the
 * backend. Notes explain user choices that could not be used. Each item is
 * a button (`edit-setting`) that opens the plot settings on its field.
 */
export function renderPlotLayout(response: CreatePlotResponse): string {
    const { layout, appliedSlices = {} } = response;
    if (!layout) {
        return '';
    }
    const item = (
        name: string,
        value: unknown,
        user: boolean,
        title: string,
        focus: string,
    ) =>
        /*html*/ `<button type="button" class="plot-layout-item${user ? ' plot-layout-item--user' : ''}" data-action="edit-setting" ${focus} title="${escapeHtml(`${title}. Click to change it.`)}">${escapeHtml(name)} <code>${escapeHtml(String(value))}</code></button>`;
    const dimension = (dim: string) =>
        `data-focus-dimension="${escapeHtml(dim)}"`;
    const items = [
        ...Object.entries(appliedSlices).map(([dim, value]) =>
            item(
                dim,
                value,
                true,
                'Dimension slice (isel) you set',
                dimension(dim),
            ),
        ),
        ...layout.squeezed.map((dim) =>
            item(
                dim,
                0,
                false,
                'Size 1: index 0 taken automatically',
                dimension(dim),
            ),
        ),
        ...layout.choices.map((choice) => {
            // The role comes from the backend: only own keys of the table
            const param = Object.prototype.hasOwnProperty.call(
                LAYOUT_ROLE_PARAMETERS,
                choice.role,
            )
                ? LAYOUT_ROLE_PARAMETERS[choice.role]
                : undefined;
            return item(
                choice.role,
                choice.value,
                choice.source === 'user',
                choice.source === 'user'
                    ? 'Plot parameter you set'
                    : 'Chosen automatically: set this plot parameter to change it',
                param ? `data-focus-param="${escapeHtml(param)}"` : '',
            );
        }),
    ];
    const notes = layout.notes.length
        ? /*html*/ `<ul class="plot-layout-notes">${layout.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
        : '';
    return /*html*/ `
        <div class="plot-layout-line">
            <span class="plot-layout-kind" title="Plot kind">${escapeHtml(layout.kind)}</span>
            ${items.join('')}
            <span class="plot-layout-legend">outlined <span class="plot-layout-marker">•</span>: set by you · others: automatic · click one to change it</span>
        </div>
        ${notes}`;
}
