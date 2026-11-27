/**
 * Plot settings of every level, and how they combine.
 *
 * Levels (`ScopeKey`): a data variable (`v:/group/name`), a group
 * (`g:/group`). The chain of a variable goes from the variable to its group,
 * then up the parent groups to the root group `/`, which is the whole file.
 * For each setting (a plot parameter, or the slice of one dimension) the
 * first level of the chain that sets it wins; without one, the backend
 * chooses (bool parameters: their default).
 *
 * The store holds the text of the controls of each level, so the settings
 * editor (plotEditor.ts) can be built when opened and removed when closed.
 * It lives as long as the tab and survives Refresh.
 */
import type { VariableInfo } from './render/variables';
import {
    InheritedSlice,
    SliceTexts,
    sliceDisplay,
    sliceValueFromTexts,
} from './dimensionSlices';
import {
    displayPlotValue,
    InheritedValue,
    parsePlotParameter,
    PLOT_PARAMETERS,
    RawParams,
} from './plotParams';

/** `v:<variable path>` or `g:<group path>` */
export type ScopeKey = string;

export function variableScope(variablePath: string): ScopeKey {
    return `v:${variablePath}`;
}

export function groupScope(groupPath: string): ScopeKey {
    return `g:${groupPath}`;
}

function parseScope(key: ScopeKey): {
    kind: 'variable' | 'group';
    path: string;
} {
    return {
        kind: key.startsWith('v:') ? 'variable' : 'group',
        path: key.slice(2),
    };
}

/** Path of a data variable (its `data-variable`): `/name` in the root group. */
export function dataVariablePath(group: string, name: string): string {
    return `${group === '/' ? '' : group}/${name}`;
}

// ---------------------------------------------------------------- model

interface VariableModel {
    name: string;
    group: string;
    dims: Record<string, number>;
    /** CF flags, or ancillary_variables (hide_flags) */
    flagRelated: boolean;
}

interface GroupModel {
    /** Dimensions of the group and of its subgroups (largest size) */
    dims: Record<string, number>;
    flagRelated: boolean;
    /** Paths of the group's own data variables */
    variables: string[];
}

const model = {
    groups: new Map<string, GroupModel>(),
    variables: new Map<string, VariableModel>(),
};

export interface PlotModelInput {
    dimensions_flattened?: Record<string, Record<string, number>>;
    variables_flattened?: Record<string, VariableInfo[]>;
}

function isInSubtree(group: string, ancestor: string): boolean {
    return (
        group === ancestor ||
        (ancestor === '/'
            ? group.startsWith('/')
            : group.startsWith(`${ancestor}/`))
    );
}

/** Groups, variables and dimensions of the file (each `dataLoaded`). */
export function setPlotModel(data: PlotModelInput): void {
    model.groups.clear();
    model.variables.clear();
    const groupDims = data.dimensions_flattened ?? {};
    const groupNames = Object.keys(groupDims);
    for (const group of groupNames) {
        for (const variable of data.variables_flattened?.[group] ?? []) {
            const dims: Record<string, number> = {};
            (variable.dimensions ?? []).forEach((dim, i) => {
                dims[dim] = variable.shape?.[i] ?? 0;
            });
            model.variables.set(dataVariablePath(group, variable.name), {
                name: variable.name,
                group,
                dims,
                flagRelated:
                    !!variable.flags ||
                    'ancillary_variables' in (variable.attributes ?? {}),
            });
        }
    }
    const variables = Array.from(model.variables.entries());
    for (const group of groupNames) {
        const dims: Record<string, number> = {};
        for (const other of groupNames.filter((name) =>
            isInSubtree(name, group),
        )) {
            for (const [dim, size] of Object.entries(groupDims[other] ?? {})) {
                dims[dim] = Math.max(dims[dim] ?? 0, size);
            }
        }
        model.groups.set(group, {
            dims,
            flagRelated: variables.some(
                ([, v]) => isInSubtree(v.group, group) && v.flagRelated,
            ),
            variables: variables
                .filter(([, v]) => v.group === group)
                .map(([path]) => path),
        });
    }
}

/** Group of a data variable path. */
export function variableGroup(variablePath: string): string {
    const known = model.variables.get(variablePath);
    if (known) {
        return known.group;
    }
    const slash = variablePath.lastIndexOf('/');
    return slash <= 0 ? '/' : variablePath.slice(0, slash);
}

/** The group, then its parents up to `/` (only groups of the file). */
function groupAncestors(group: string): string[] {
    const chain: string[] = [];
    let current = group;
    for (;;) {
        if (model.groups.size === 0 || model.groups.has(current)) {
            chain.push(current);
        }
        if (current === '/') {
            return chain;
        }
        const slash = current.lastIndexOf('/');
        current = slash <= 0 ? '/' : current.slice(0, slash);
    }
}

/** Levels whose settings apply to `key`, from `key` itself to the whole file. */
export function scopeChain(key: ScopeKey): ScopeKey[] {
    const { kind, path } = parseScope(key);
    return kind === 'variable'
        ? [key, ...groupAncestors(variableGroup(path)).map(groupScope)]
        : groupAncestors(path).map(groupScope);
}

/** Dimensions a level can slice or place (with their sizes). */
export function scopeDimensions(key: ScopeKey): Record<string, number> {
    const { kind, path } = parseScope(key);
    return (
        (kind === 'variable'
            ? model.variables.get(path)?.dims
            : model.groups.get(path)?.dims) ?? {}
    );
}

/** Show the Flags fieldset for this level. */
export function scopeHasFlags(key: ScopeKey): boolean {
    const { kind, path } = parseScope(key);
    return (
        (kind === 'variable'
            ? model.variables.get(path)?.flagRelated
            : model.groups.get(path)?.flagRelated) ?? false
    );
}

/** Data variables of a group (not of its subgroups). */
export function groupVariables(group: string): string[] {
    return model.groups.get(group)?.variables ?? [];
}

/** Tab of the settings editor: `This variable`, `Group /a`, `Whole file`. */
export function scopeTitle(key: ScopeKey): string {
    const { kind, path } = parseScope(key);
    if (kind === 'variable') {
        return 'This variable';
    }
    return path === '/' ? 'Whole file' : `Group ${path}`;
}

/** Where a value comes from, in a summary or a grey control: `file`... */
export function scopeSourceLabel(key: ScopeKey): string {
    const { kind, path } = parseScope(key);
    if (kind === 'variable') {
        return 'variable';
    }
    return path === '/' ? 'file' : `group ${path}`;
}

/** What a level's settings apply to, for the editor's hint. */
export function scopeDescription(key: ScopeKey): string {
    const { kind, path } = parseScope(key);
    if (kind === 'variable') {
        return 'this variable only';
    }
    return path === '/'
        ? 'every variable of the file'
        : `every variable of group ${path} and of its subgroups`;
}

// ---------------------------------------------------------------- store

/** Settings set at one level: control texts, '' / absent = not set. */
export interface LevelSettings {
    params: RawParams;
    slices: Record<string, SliceTexts>;
}

const store = new Map<ScopeKey, LevelSettings>();
const listeners: Array<() => void> = [];

function isSliceSet(texts: SliceTexts | undefined): texts is SliceTexts {
    return !!texts && texts.some((text) => text.trim() !== '');
}

/** Copy of what a level sets. */
export function levelSettings(key: ScopeKey): LevelSettings {
    const level = store.get(key);
    return { params: { ...level?.params }, slices: { ...level?.slices } };
}

/** Number of values a level sets (tab badges). */
export function countLevelSettings(key: ScopeKey): number {
    const level = store.get(key);
    return level
        ? Object.keys(level.params).length + Object.keys(level.slices).length
        : 0;
}

function saveLevel(key: ScopeKey, level: LevelSettings): void {
    const params = Object.fromEntries(
        Object.entries(level.params).filter(([, raw]) => raw.trim() !== ''),
    );
    const slices = Object.fromEntries(
        Object.entries(level.slices).filter(([, texts]) => isSliceSet(texts)),
    );
    if (Object.keys(params).length + Object.keys(slices).length === 0) {
        store.delete(key);
    } else {
        store.set(key, { params, slices });
    }
    listeners.forEach((listener) => listener());
}

/** Merge the controls read from an editor into a level (absent keys are kept). */
export function updateLevelSettings(
    key: ScopeKey,
    patch: Partial<LevelSettings>,
): void {
    const level = levelSettings(key);
    saveLevel(key, {
        params: { ...level.params, ...patch.params },
        slices: { ...level.slices, ...patch.slices },
    });
}

/** Clear the parameters, the slices, or both, of one level. */
export function clearLevelSettings(
    key: ScopeKey,
    part?: 'params' | 'slices',
): void {
    const level = levelSettings(key);
    saveLevel(key, {
        params: part === 'slices' ? level.params : {},
        slices: part === 'params' ? level.slices : {},
    });
}

/** Called after every change of the store. */
export function onPlotSettingsChange(listener: () => void): void {
    listeners.push(listener);
}

// ---------------------------------------------------------------- resolution

interface Resolved<T> {
    value: T;
    source: ScopeKey;
}

function resolveParam(
    chain: ScopeKey[],
    key: string,
): Resolved<string> | undefined {
    for (const scope of chain) {
        const raw = store.get(scope)?.params[key];
        if (raw !== undefined && raw.trim() !== '') {
            return { value: raw, source: scope };
        }
    }
    return undefined;
}

function resolveSlice(
    chain: ScopeKey[],
    dim: string,
): Resolved<SliceTexts> | undefined {
    for (const scope of chain) {
        const texts = store.get(scope)?.slices[dim];
        if (isSliceSet(texts)) {
            return { value: texts, source: scope };
        }
    }
    return undefined;
}

function slicedDimensions(chain: ScopeKey[]): string[] {
    const dims = new Set<string>();
    chain.forEach((scope) =>
        Object.keys(store.get(scope)?.slices ?? {}).forEach((dim) =>
            dims.add(dim),
        ),
    );
    return Array.from(dims).sort();
}

/** Values the level `chain[index]` falls back to: those of the levels after it. */
export function inheritedSettings(
    chain: ScopeKey[],
    index: number,
): {
    params: Record<string, InheritedValue | undefined>;
    slices: Record<string, InheritedSlice | undefined>;
} {
    const after = chain.slice(index + 1);
    const params: Record<string, InheritedValue | undefined> = {};
    for (const param of PLOT_PARAMETERS) {
        const resolved = resolveParam(after, param.key);
        if (resolved) {
            params[param.key] = {
                raw: resolved.value,
                source: scopeSourceLabel(resolved.source),
            };
        }
    }
    const slices: Record<string, InheritedSlice | undefined> = {};
    for (const dim of slicedDimensions(after)) {
        const resolved = resolveSlice(after, dim);
        if (resolved) {
            slices[dim] = {
                texts: resolved.value,
                source: scopeSourceLabel(resolved.source),
            };
        }
    }
    return { params, slices };
}

/** Level that sets a parameter or the slice of a dimension for `key`, if any. */
export function settingSource(
    key: ScopeKey,
    setting: { param?: string; dimension?: string },
): ScopeKey | undefined {
    const chain = scopeChain(key);
    if (setting.param) {
        return resolveParam(chain, setting.param)?.source;
    }
    return setting.dimension
        ? resolveSlice(chain, setting.dimension)?.source
        : undefined;
}

/** One setting that applies to a level, for its summary. */
export interface EffectiveSetting {
    kind: 'param' | 'slice';
    /** Parameter key or dimension name */
    id: string;
    label: string;
    display: string;
    source: ScopeKey;
}

/**
 * Everything set for a variable or a group, wherever it is set: slices
 * first (a variable: only its own dimensions), then the parameters in table
 * order.
 */
export function effectiveSettings(key: ScopeKey): EffectiveSetting[] {
    const chain = scopeChain(key);
    const { kind } = parseScope(key);
    const ownDims = scopeDimensions(key);
    const slices = slicedDimensions(chain)
        .filter((dim) => kind === 'group' || dim in ownDims)
        .flatMap((dim): EffectiveSetting[] => {
            const resolved = resolveSlice(chain, dim);
            return resolved
                ? [
                      {
                          kind: 'slice',
                          id: dim,
                          label: dim,
                          display: sliceDisplay(resolved.value),
                          source: resolved.source,
                      },
                  ]
                : [];
        });
    const params = PLOT_PARAMETERS.flatMap((param): EffectiveSetting[] => {
        const resolved = resolveParam(chain, param.key);
        return resolved
            ? [
                  {
                      kind: 'param',
                      id: param.key,
                      label: param.label,
                      display: displayPlotValue(resolved.value),
                      source: resolved.source,
                  },
              ]
            : [];
    });
    return [...slices, ...params];
}

/**
 * Options of the createPlot request of a variable (named fields, unset ones
 * undefined), and the numbers typed wrong at the level that wins, which
 * block the plot. Bool parameters are always sent.
 */
export function plotRequestFor(variablePath: string): {
    options: Record<string, unknown>;
    invalid: string[];
} {
    const chain = scopeChain(variableScope(variablePath));
    const dimensionSlices: Record<string, string | number> = {};
    for (const dim of slicedDimensions(chain)) {
        const resolved = resolveSlice(chain, dim);
        const value = resolved
            ? sliceValueFromTexts(resolved.value)
            : undefined;
        if (value !== undefined) {
            dimensionSlices[dim] = value;
        }
    }
    const options: Record<string, unknown> = {
        variable: variablePath,
        dimensionSlices,
    };
    const invalid: string[] = [];
    for (const param of PLOT_PARAMETERS) {
        const resolved = resolveParam(chain, param.key);
        if (!resolved) {
            if (param.kind === 'bool') {
                options[param.key] = param.default === true;
            }
            continue;
        }
        const { value, error } = parsePlotParameter(param, resolved.value);
        if (error) {
            invalid.push(`${scopeTitle(resolved.source)}: ${error}`);
        } else {
            options[param.key] = value;
        }
    }
    return { options, invalid };
}
