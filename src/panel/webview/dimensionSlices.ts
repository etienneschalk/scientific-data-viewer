/**
 * Dimension slices (Issue #117), passed to `isel()` before plotting. Each
 * dimension has three boxes (start : stop : step) and a two-handle slider
 * for start and stop, kept in sync both ways; the step is never touched by
 * the slider.
 *
 * Value sent to the backend: nothing when every box is empty, an integer
 * index when start is set and stop is empty (handles on top of each other;
 * a step is then ignored and shown so), otherwise the slice string
 * `start:stop[:step]`.
 *
 * The slider works on inclusive indices 0..size-1: handles at 5 and 9 mean
 * `5:10`. Both handles are equal, so they can cross; the selection goes from
 * the lower to the higher one. A box is only rewritten when the index it
 * stands for changes: moving one handle changes one box (both when the
 * handles cross, or when an index becomes a range).
 *
 * Negative start / stop count from the end, as in Python: the handles show
 * them at their positive position, and the typed text is kept until its own
 * handle is moved (then the box gets the positive index). Values beyond the
 * dimension are clamped on the slider only. A negative step reverses the
 * slice, which the slider cannot show: it is disabled. A stop at or before
 * start selects nothing: the stop box is outlined in red.
 */
import { joinId } from '../../shared/ids';
import { escapeHtml } from './util';

type SlicePart = 'start' | 'stop' | 'step';
const PARTS: SlicePart[] = ['start', 'stop', 'step'];

/** Element ids: the start box keeps the historical id of the single input. */
function sliceInputId(
    groupSafeId: string | undefined,
    dimName: string,
): string {
    return groupSafeId === undefined
        ? `dim-slice-${joinId([dimName])}`
        : `group-dim-${groupSafeId}-${joinId([dimName])}`;
}

/**
 * Field of every dimension: label, the three boxes, then the slider (not
 * shown for dimensions of size 1).
 */
export function renderDimensionSliceFields(
    dimSizes: Record<string, number>,
    groupName: string | null,
    groupSafeId?: string,
): string {
    const groupAttr =
        groupName === null ? '' : ` data-group="${escapeHtml(groupName)}"`;
    return Object.keys(dimSizes)
        .sort()
        .map((dimName) => {
            const size = dimSizes[dimName];
            const id = sliceInputId(groupSafeId, dimName);
            const dim = escapeHtml(dimName);
            const part = (name: SlicePart) =>
                /*html*/ `<input type="text" id="${name === 'start' ? id : `${id}-${name}`}" class="dimension-slice-input slice-part" data-part="${name}" data-dimension="${dim}"${groupAttr} placeholder="${name}" inputmode="numeric" pattern="-?[0-9]*" autocomplete="off" aria-label="${dim} ${name}" />`;
            const max = Math.max(size - 1, 0);
            const handle = (name: 'from' | 'to', value: number) =>
                /*html*/ `<input type="range" id="${id}-${name}" class="slice-range-handle" min="0" max="${max}" step="1" value="${value}" aria-label="${dim} ${name === 'from' ? 'first' : 'last'} index" />`;
            return /*html*/ `
                <div class="plot-field dimension-slice-row" data-dimension="${dim}" data-size="${escapeHtml(size)}">
                    <label for="${id}" class="plot-field-label"><span class="plot-field-name">${dim}</span><span class="plot-field-hint">size ${escapeHtml(size)}</span></label>
                    <div class="slice-boxes" role="group" aria-label="${dim} slice">
                        ${part('start')}<span class="slice-colon" aria-hidden="true">:</span>${part('stop')}<span class="slice-colon" aria-hidden="true">:</span>${part('step')}
                    </div>
                    ${
                        size > 1
                            ? /*html*/ `<div class="slice-range" style="--slice-from: 0; --slice-to: 1">${handle('from', 0)}${handle('to', max)}</div>`
                            : ''
                    }
                </div>`;
        })
        .join('');
}

interface SliceField {
    row: HTMLElement;
    size: number;
    boxes: Record<SlicePart, HTMLInputElement>;
    handles: HTMLInputElement[];
    range: HTMLElement | null;
}

function sliceField(row: HTMLElement): SliceField | null {
    const box = (part: SlicePart) =>
        row.querySelector<HTMLInputElement>(`.slice-part[data-part="${part}"]`);
    const start = box('start');
    const stop = box('stop');
    const step = box('step');
    if (!start || !stop || !step) {
        return null;
    }
    return {
        row,
        size: Number(row.dataset.size) || 0,
        boxes: { start, stop, step },
        handles: Array.from(
            row.querySelectorAll<HTMLInputElement>('.slice-range-handle'),
        ),
        range: row.querySelector<HTMLElement>('.slice-range'),
    };
}

function boxTexts(field: SliceField): [string, string, string] {
    const { start, stop, step } = field.boxes;
    return [start.value.trim(), stop.value.trim(), step.value.trim()];
}

/** Value of one dimension: undefined, an index, or a slice string. */
function sliceValue(field: SliceField): string | number | undefined {
    const [start, stop, step] = boxTexts(field);
    if (!start && !stop && !step) {
        return undefined;
    }
    if (start && !stop) {
        const index = Number(start);
        return Number.isInteger(index) ? index : start;
    }
    return `${start}:${stop}${step ? `:${step}` : ''}`;
}

/** Dimension slices typed under `root`: {dim: int | "slice string"}. */
export function readDimensionSlices(
    root: ParentNode,
): Record<string, string | number> {
    const dimensionSlices: Record<string, string | number> = {};
    root.querySelectorAll<HTMLElement>('.dimension-slice-row').forEach(
        (row) => {
            const field = sliceField(row);
            const dim = row.dataset.dimension;
            const value = field ? sliceValue(field) : undefined;
            if (dim && value !== undefined) {
                dimensionSlices[dim] = value;
            }
        },
    );
    return dimensionSlices;
}

/** Index typed in a box, counted from the end when negative; null if not an integer. */
function parseIndex(text: string, size: number): number | null {
    const value = Number(text);
    if (text === '' || !Number.isInteger(value)) {
        return null;
    }
    return value < 0 ? size + value : value;
}

function clampIndex(value: number, size: number): number {
    return Math.min(Math.max(value, 0), Math.max(size - 1, 0));
}

/** First selected index (inclusive) of a start box; null if not an integer. */
function firstIndex(start: string, size: number): number | null {
    if (start === '') {
        return 0;
    }
    const index = parseIndex(start, size);
    return index === null ? null : clampIndex(index, size);
}

/** Last selected index (inclusive) of a stop box, given the start box. */
function lastIndex(start: string, stop: string, size: number): number | null {
    if (stop === '') {
        // An index alone, else up to the end
        return start === '' ? size - 1 : firstIndex(start, size);
    }
    const index = parseIndex(stop, size);
    return index === null ? null : clampIndex(index - 1, size);
}

function isReversed(step: string): boolean {
    const value = Number(step);
    return step !== '' && Number.isInteger(value) && value < 0;
}

/**
 * Feedback on the boxes: step ignored by an index, slider disabled by a
 * negative step, empty selection (stop at or before start) outlined.
 */
function updateBoxState(field: SliceField): void {
    const { size, boxes, handles, range, row } = field;
    const [start, stop, step] = boxTexts(field);

    const stepIgnored = start !== '' && stop === '' && step !== '';
    row.classList.toggle('slice-step-ignored', stepIgnored);
    boxes.step.title = stepIgnored
        ? 'Ignored: stop is empty, so start selects a single index'
        : '';

    const reversed = isReversed(step);
    handles.forEach((handle) => {
        handle.disabled = reversed;
    });
    range?.classList.toggle('slice-range--disabled', reversed);
    if (range) {
        range.title = reversed
            ? 'A negative step reverses the slice: use the boxes'
            : '';
    }

    // Python clamps start and stop to 0..size before slicing
    const bound = (index: number) => Math.min(Math.max(index, 0), size);
    const first = start === '' ? 0 : parseIndex(start, size);
    const end = stop === '' ? null : parseIndex(stop, size);
    const empty =
        !reversed &&
        first !== null &&
        end !== null &&
        bound(end) <= bound(first);
    const message = empty
        ? 'Stop must be greater than start (stop is excluded): this selects nothing'
        : '';
    boxes.stop.setCustomValidity(message);
    // An attribute, unlike the custom validity, is kept by the HTML export
    if (empty) {
        boxes.stop.setAttribute('aria-invalid', 'true');
    } else {
        boxes.stop.removeAttribute('aria-invalid');
    }
    boxes.stop.title = message;
}

function setHandles(field: SliceField, from: number, to: number): void {
    const [first, second] = field.handles;
    if (!first || !second || !field.range) {
        return;
    }
    first.value = String(from);
    second.value = String(to);
    updateRangeFill(field);
}

/** Highlight between the two handles (CSS uses the fractions). */
function updateRangeFill(field: SliceField): void {
    const [first, second] = field.handles;
    if (!first || !second || !field.range) {
        return;
    }
    const max = Math.max(field.size - 1, 1);
    const values = [Number(first.value), Number(second.value)];
    field.range.style.setProperty(
        '--slice-from',
        String(Math.min(...values) / max),
    );
    field.range.style.setProperty(
        '--slice-to',
        String(Math.max(...values) / max),
    );
}

/** Boxes → slider. Leaves the slider alone when a box is not an integer. */
function syncHandlesFromBoxes(field: SliceField): void {
    updateBoxState(field);
    const [start, stop, step] = boxTexts(field);
    if (isReversed(step)) {
        return;
    }
    const first = firstIndex(start, field.size);
    const last = lastIndex(start, stop, field.size);
    if (first === null || last === null) {
        return;
    }
    setHandles(field, first, Math.max(last, first));
}

/**
 * Slider → start and stop boxes. A box keeps its text (negative, empty...)
 * while the index it stands for does not change, so moving one handle
 * rewrites one box; the step box is never written.
 */
function syncBoxesFromHandles(
    field: SliceField,
    moved: HTMLInputElement,
): void {
    const [first, second] = field.handles;
    if (!first || !second) {
        return;
    }
    const { size, boxes } = field;
    const low = Math.min(Number(first.value), Number(second.value));
    const high = Math.max(Number(first.value), Number(second.value));
    const movedValue = Number(moved.value);
    let [start, stop] = boxTexts(field);

    // A box that is not an integer is only replaced by its own handle
    const startIndex = firstIndex(start, size);
    if (startIndex !== low && (startIndex !== null || movedValue === low)) {
        start = low === 0 && high !== low ? '' : String(low);
    }
    if (low === high) {
        // Handles together: an index (start set, stop empty)
        start = start === '' ? String(low) : start;
        stop = '';
    } else {
        const stopIndex = lastIndex(start, stop, size);
        if (stopIndex !== high && (stopIndex !== null || movedValue === high)) {
            stop = high === size - 1 && start === '' ? '' : String(high + 1);
        }
    }
    boxes.start.value = start;
    boxes.stop.value = stop;
    updateBoxState(field);
    updateRangeFill(field);
}

/**
 * A full slice typed or pasted in a box (`0:24:2`) is spread over the box
 * and the next ones; focus moves to the box after the last colon, so typing
 * `1:5` goes from box to box. An open stop after a start (`5:`, `5::2`)
 * means "to the end" in Python, while an empty stop box selects an index:
 * the stop box gets the dimension size, selected so typing replaces it.
 */
function spreadSliceText(field: SliceField, box: HTMLInputElement): void {
    if (!box.value.includes(':')) {
        return;
    }
    const offset = PARTS.indexOf(box.dataset.part as SlicePart);
    const pieces = box.value
        .split(':')
        .slice(0, PARTS.length - offset)
        .map((piece) => piece.trim());
    pieces.forEach((piece, i) => {
        field.boxes[PARTS[offset + i]].value = piece;
    });
    const openStop = offset === 0 && pieces[0] !== '' && pieces[1] === '';
    if (openStop) {
        field.boxes.stop.value = String(field.size);
    }
    const next = field.boxes[PARTS[offset + pieces.length - 1]];
    next.focus();
    if (openStop && next === field.boxes.stop) {
        next.select();
    } else {
        next.setSelectionRange(next.value.length, next.value.length);
    }
}

/** `input` / `change` listener of the document: keeps boxes and slider in sync. */
export function handleDimensionSliceEvent(target: EventTarget | null): void {
    if (!(target instanceof HTMLInputElement)) {
        return;
    }
    const row = target.closest<HTMLElement>('.dimension-slice-row');
    const field = row ? sliceField(row) : null;
    if (!field) {
        return;
    }
    if (target.classList.contains('slice-range-handle')) {
        syncBoxesFromHandles(field, target);
    } else if (target.classList.contains('slice-part')) {
        spreadSliceText(field, target);
        syncHandlesFromBoxes(field);
    }
}

/** Clear every dimension slice under `root` (boxes and sliders). */
export function resetDimensionSlices(root: ParentNode): void {
    root.querySelectorAll<HTMLElement>('.dimension-slice-row').forEach(
        (row) => {
            const field = sliceField(row);
            if (!field) {
                return;
            }
            PARTS.forEach((part) => {
                field.boxes[part].value = '';
            });
            updateBoxState(field);
            setHandles(field, 0, Math.max(field.size - 1, 0));
        },
    );
}
