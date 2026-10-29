/**
 * Dimension slices (Issue #117), passed to `isel()` before plotting. Each
 * dimension has three boxes (start : stop : step) and a two-handle slider
 * for start and stop, kept in sync both ways; the step is never touched by
 * the slider.
 *
 * Value sent to the backend: nothing when every box is empty, an integer
 * index when only start is set (handles on top of each other), otherwise
 * the slice string `start:stop[:step]`.
 *
 * The slider works on inclusive indices 0..size-1: handles at 5 and 9 mean
 * `5:10`. Both handles are equal, so they can cross; the selection goes from
 * the lower to the higher one.
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

/** Value of one dimension: undefined, an index, or a slice string. */
function sliceValue(field: SliceField): string | number | undefined {
    const [start, stop, step] = PARTS.map((part) =>
        field.boxes[part].value.trim(),
    );
    if (!start && !stop && !step) {
        return undefined;
    }
    if (!stop && !step) {
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
    const { size, boxes } = field;
    const [start, stop, step] = PARTS.map((part) => boxes[part].value.trim());
    const startIndex = start === '' ? 0 : parseIndex(start, size);
    if (
        startIndex === null ||
        (step !== '' && parseIndex(step, size) === null)
    ) {
        return;
    }
    let last: number | null;
    if (stop === '') {
        // Index alone: both handles on it; open slice: up to the end
        last = start !== '' && step === '' ? startIndex : size - 1;
    } else {
        const stopIndex = parseIndex(stop, size);
        last = stopIndex === null ? null : stopIndex - 1;
    }
    if (last === null) {
        return;
    }
    const from = clampIndex(startIndex, size);
    setHandles(field, from, Math.max(clampIndex(last, size), from));
}

/** Slider → start and stop boxes (the step box is kept). */
function syncBoxesFromHandles(field: SliceField): void {
    const [first, second] = field.handles;
    if (!first || !second) {
        return;
    }
    const from = Math.min(Number(first.value), Number(second.value));
    const to = Math.max(Number(first.value), Number(second.value));
    const { start, stop, step } = field.boxes;
    if (from === 0 && to === field.size - 1) {
        // Whole dimension: no selection
        start.value = '';
        stop.value = '';
    } else if (from === to) {
        // Handles together: an index (one-element slice when a step is set)
        start.value = String(from);
        stop.value = step.value.trim() === '' ? '' : String(from + 1);
    } else {
        start.value = String(from);
        stop.value = String(to + 1);
    }
    updateRangeFill(field);
}

/**
 * A full slice typed or pasted in a box (`0:24:2`) is spread over the box
 * and the next ones; focus moves to the box after the last colon, so typing
 * `1:5` goes from box to box.
 */
function spreadSliceText(field: SliceField, box: HTMLInputElement): void {
    if (!box.value.includes(':')) {
        return;
    }
    const offset = PARTS.indexOf(box.dataset.part as SlicePart);
    const pieces = box.value.split(':').slice(0, PARTS.length - offset);
    pieces.forEach((piece, i) => {
        field.boxes[PARTS[offset + i]].value = piece.trim();
    });
    const next = field.boxes[PARTS[offset + pieces.length - 1]];
    next.focus();
    next.setSelectionRange(next.value.length, next.value.length);
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
        syncBoxesFromHandles(field);
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
            setHandles(field, 0, Math.max(field.size - 1, 0));
        },
    );
}
