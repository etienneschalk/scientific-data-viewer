import { DatetimeVariableInfo, globalState } from './state';
import { escapeHtml } from './util';

/**
 * Time controls (global and per group) share one markup: a
 * `.time-controls-section` holding elements with `data-time` roles
 * `variable` (select), `start` / `end` (datetime-local) and `start-text` /
 * `end-text` (free text kept in sync with the datetime-local inputs).
 */
type TimeRole = 'variable' | 'start' | 'end' | 'start-text' | 'end-text';

export interface TimeControlsValues {
    datetimeVariableName?: string;
    /** datetime-local value ("YYYY-MM-DDTHH:mm") */
    startDatetime?: string;
    endDatetime?: string;
}

// datetime-local "YYYY-MM-DDTHH:mm" -> text "YYYY-MM-DD HH:MM:SS"
export function convertDatetimeLocalToText(datetimeLocal: string): string {
    if (!datetimeLocal) {
        return '';
    }
    const [date, time] = datetimeLocal.split('T');
    if (!time) {
        return datetimeLocal;
    }
    const [hours, minutes] = time.split(':');
    return `${date} ${hours}:${minutes || '00'}:00`;
}

// Text ("YYYY-MM-DD HH:MM:SS" or variations) -> datetime-local, '' when invalid
export function convertTextToDatetimeLocal(textValue: string): string {
    if (!textValue) {
        return '';
    }
    let dateStr = textValue.trim();
    if (dateStr.includes(' ')) {
        dateStr = dateStr.replace(' ', 'T');
    }
    if (!dateStr.includes('T')) {
        dateStr += 'T00:00';
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return '';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ISO ("2025-01-01T12:30:00[.000]") -> datetime-local ("2025-01-01T12:30")
function isoToDatetimeLocal(isoString: string | null): string {
    if (!isoString) {
        return '';
    }
    const dateTime = String(isoString).split('T');
    if (dateTime.length !== 2) {
        return '';
    }
    const time = dateTime[1].split(':');
    if (time.length < 2) {
        return '';
    }
    return `${dateTime[0]}T${time[0]}:${time[1]}`;
}

/**
 * datetime-local -> naive ISO "YYYY-MM-DDTHH:mm:ss" (no timezone conversion:
 * pandas reads it as the exact time entered).
 */
export function convertDatetimeLocalToISO(
    datetimeLocal: string | undefined,
): string | undefined {
    if (!datetimeLocal) {
        return undefined;
    }
    const colonCount = (datetimeLocal.match(/:/g) || []).length;
    if (colonCount === 1) {
        return `${datetimeLocal}:00`;
    }
    if (colonCount === 0) {
        return `${datetimeLocal}T00:00:00`;
    }
    return datetimeLocal;
}

function timeElement<T extends HTMLElement = HTMLInputElement>(
    section: ParentNode,
    role: TimeRole,
): T | null {
    return section.querySelector<T>(`[data-time="${role}"]`);
}

function setTimeBound(
    section: ParentNode,
    bound: 'start' | 'end',
    datetimeLocal: string,
): void {
    const input = timeElement(section, bound);
    const text = timeElement(section, `${bound}-text`);
    if (input) {
        input.value = datetimeLocal;
    }
    if (text) {
        text.value = convertDatetimeLocalToText(datetimeLocal);
    }
}

/** Prefill start/end with the selected datetime variable's min/max. */
function prefillTimeRange(section: ParentNode, fullPath: string): void {
    const varData = fullPath ? globalState.datetimeVarsMap.get(fullPath) : null;
    if (!varData) {
        return;
    }
    setTimeBound(section, 'start', isoToDatetimeLocal(varData.min));
    setTimeBound(section, 'end', isoToDatetimeLocal(varData.max));
}

export function clearTimeControls(section: ParentNode): void {
    const select = timeElement<HTMLSelectElement>(section, 'variable');
    if (select) {
        select.value = '';
    }
    setTimeBound(section, 'start', '');
    setTimeBound(section, 'end', '');
}

/** Handle change/input events on any time control (global or group). */
export function handleTimeControlEvent(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const role = target.dataset.time;
    const section = target.closest('.time-controls-section');
    if (!role || !section) {
        return;
    }
    const value = (target as HTMLInputElement).value;
    if (role === 'variable') {
        prefillTimeRange(section, value);
    } else if (role === 'start' || role === 'end') {
        const text = timeElement(section, `${role}-text`);
        if (text) {
            text.value = convertDatetimeLocalToText(value);
        }
    } else if (role === 'start-text' || role === 'end-text') {
        const input = timeElement(
            section,
            role === 'start-text' ? 'start' : 'end',
        );
        if (!input) {
            return;
        }
        if (!value.trim()) {
            input.value = '';
            return;
        }
        const datetimeLocal = convertTextToDatetimeLocal(value);
        if (datetimeLocal) {
            input.value = datetimeLocal;
        }
    }
}

/** Current values of a time section (undefined when empty). */
export function readTimeControls(
    section: ParentNode | null,
): TimeControlsValues {
    if (!section) {
        return {};
    }
    return {
        datetimeVariableName:
            timeElement<HTMLSelectElement>(section, 'variable')?.value ||
            undefined,
        startDatetime: timeElement(section, 'start')?.value || undefined,
        endDatetime: timeElement(section, 'end')?.value || undefined,
    };
}

export function globalTimeControlsSection(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
        '#section-global-plot-controls .time-controls-section',
    );
}

export type DatetimeVariablesByGroup = Record<
    string,
    Array<string | { name: string; min?: string | null; max?: string | null }>
>;

/** Sorted unique (by name) datetime variables of the given groups. */
export function collectDatetimeVariables(
    datetimeVariables: DatetimeVariablesByGroup,
    groupNames: string[],
): Array<{ name: string; fullPath: string }> {
    const byName = new Map<string, { name: string; fullPath: string }>();
    for (const groupName of groupNames) {
        for (const varInfo of datetimeVariables[groupName] ?? []) {
            const name = typeof varInfo === 'string' ? varInfo : varInfo.name;
            const fullPath = groupName === '/' ? name : `${groupName}/${name}`;
            if (!byName.has(name)) {
                byName.set(name, { name, fullPath });
            }
        }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function datetimeOptionsHtml(
    placeholder: string,
    variables: Array<{ name: string; fullPath: string }>,
): string {
    return (
        `<option value="">${escapeHtml(placeholder)}</option>` +
        variables
            .map(
                (v) =>
                    `<option value="${escapeHtml(v.fullPath)}">${escapeHtml(v.name)}</option>`,
            )
            .join('')
    );
}

/**
 * Record every datetime variable (for range prefill) and fill the global
 * select (unless the globalTimeControls flag is off).
 */
export function populateDatetimeVariables(
    datetimeVariables: DatetimeVariablesByGroup | undefined,
    globalTimeControls: boolean,
): void {
    const byGroup = datetimeVariables ?? {};
    const datetimeVarsMap = new Map<string, DatetimeVariableInfo>();
    for (const [groupName, vars] of Object.entries(byGroup)) {
        for (const varInfo of vars) {
            const name = typeof varInfo === 'string' ? varInfo : varInfo.name;
            const fullPath = groupName === '/' ? name : `${groupName}/${name}`;
            datetimeVarsMap.set(fullPath, {
                name,
                fullPath,
                group: groupName,
                min: typeof varInfo === 'object' ? (varInfo.min ?? null) : null,
                max: typeof varInfo === 'object' ? (varInfo.max ?? null) : null,
            });
        }
    }
    globalState.datetimeVarsMap = datetimeVarsMap;

    const section = globalTimeControlsSection();
    if (!section) {
        return;
    }
    const select = timeElement<HTMLSelectElement>(section, 'variable');
    if (!globalTimeControls || datetimeVarsMap.size === 0 || !select) {
        section.style.display = 'none';
        if (select) {
            select.value = '';
        }
        return;
    }
    section.style.display = 'block';

    // Rebuilt on every load (Refresh): keep the selection only if it still exists.
    const previous = select.value;
    select.innerHTML = datetimeOptionsHtml(
        'Select datetime variable...',
        collectDatetimeVariables(byGroup, Object.keys(byGroup)),
    );
    select.value = datetimeVarsMap.has(previous) ? previous : '';
}
