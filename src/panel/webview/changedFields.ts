/**
 * Visual cue on the plot controls the user changed: every `.plot-field`
 * (dimension slice, plot parameter; global or group) whose controls differ
 * from their default gets the `plot-field--changed` class, outlined by the
 * stylesheet. Everything left at its default is chosen automatically by the
 * backend, so the outlines are exactly what the user asked for.
 *
 * The default of a control is what its markup says: empty for text, number
 * and select (first option ''), the `checked` attribute for checkboxes, and
 * "use the global value" (`data-inherit`) for group checkboxes. Sliders
 * mirror the slice boxes and are not looked at.
 */

const CHANGED_CLASS = 'plot-field--changed';

function isControlChanged(
    control: HTMLInputElement | HTMLSelectElement,
): boolean {
    if (control instanceof HTMLSelectElement) {
        return control.value !== '';
    }
    if (control.type === 'checkbox') {
        return control.hasAttribute('data-inherit')
            ? false
            : control.checked !== control.defaultChecked;
    }
    return control.value.trim() !== '';
}

/** Outline one `.plot-field` when any of its controls is changed. */
function updateChangedField(field: Element): void {
    const changed = Array.from(
        field.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
            'input:not([type="range"]), select',
        ),
    ).some(isControlChanged);
    field.classList.toggle(CHANGED_CLASS, changed);
}

/** Update every plot field under `root` (after rendering or a reset). */
export function refreshChangedFields(root: ParentNode = document): void {
    root.querySelectorAll('.plot-field').forEach(updateChangedField);
}

/**
 * `input` / `change` listener of the document. A control can rewrite its
 * neighbours (a slider its boxes), so the whole subsection of the target is
 * updated.
 */
export function handleChangedFieldEvent(target: EventTarget | null): void {
    if (!(target instanceof Element) || !target.closest('.plot-field')) {
        return;
    }
    const scope =
        target.closest('.plot-controls-subsection') ??
        target.closest('.plot-field');
    if (scope) {
        refreshChangedFields(scope);
    }
}
