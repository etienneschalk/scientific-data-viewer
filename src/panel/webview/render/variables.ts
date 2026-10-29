import { ICONS } from '../../../shared/icons';
import { joinId } from '../../../shared/ids';
import { attributeValueStrings, escapeHtml, formatFileSize } from '../util';

/** A coordinate or data variable as sent by the Python backend. */
export interface VariableInfo {
    name: string;
    dtype?: string;
    shape?: number[];
    dimensions?: string[];
    size_bytes?: number;
    attributes?: Record<string, unknown>;
    encoding?: Record<string, unknown>;
    display_value?: string;
}

export function renderGroupDimensions(
    dimensions: Record<string, number>,
    groupName: string,
): string {
    const items = Object.entries(dimensions)
        .map(
            ([name, size]) =>
                `<strong id="${joinId(['data-group', groupName, 'dimension', name])}">${escapeHtml(name)}</strong>: ${escapeHtml(size)}`,
        )
        .join(', ');
    return /*html*/ `<div class="dimensions-compact">(${items})</div>`;
}

/**
 * Renders a nested attributes object as a collapsible tree (for Zarr .zattrs and similar).
 * Used when nestedAttributesView feature flag is on.
 */
export function renderAttributesTree(
    attrsObj: Record<string, unknown>,
    idParts: string[],
): string {
    if (!attrsObj || typeof attrsObj !== 'object') {
        return '';
    }
    const entries = Object.entries(attrsObj);
    if (entries.length === 0) {
        return /*html*/ `<p class="muted-text">No attributes.</p>`;
    }
    return entries
        .map(([key, value]) => {
            const safeKey = escapeHtml(key);
            const childIdParts = [...idParts, 'attr', key];
            const nodeId = joinId(childIdParts);
            if (
                value !== null &&
                typeof value === 'object' &&
                !Array.isArray(value)
            ) {
                return /*html*/ `
                    <details class="attributes-tree-node" id="${nodeId}">
                        <summary class="attribute-tree-summary"><span class="attribute-name">${safeKey}</span></summary>
                        <div class="attributes-tree-children">${renderAttributesTree(value as Record<string, unknown>, childIdParts)}</div>
                    </details>`;
            }
            if (Array.isArray(value)) {
                const items = value
                    .map((item, i) => {
                        if (
                            item !== null &&
                            typeof item === 'object' &&
                            !Array.isArray(item)
                        ) {
                            const inner = renderAttributesTree(item, [
                                ...childIdParts,
                                String(i),
                            ]);
                            return /*html*/ `<details class="attributes-tree-node"><summary class="attribute-tree-summary">[${i}]</summary><div class="attributes-tree-children">${inner}</div></details>`;
                        }
                        return /*html*/ `<div class="attribute-item"><span class="attribute-value muted-text">${escapeHtml(attributeValueStrings(item).displayStr)}</span></div>`;
                    })
                    .join('');
                return /*html*/ `
                    <details class="attributes-tree-node" id="${nodeId}">
                        <summary class="attribute-tree-summary"><span class="attribute-name">${safeKey}</span> <span class="muted-text">(${value.length} items)</span></summary>
                        <div class="attributes-tree-children">${items}</div>
                    </details>`;
            }
            const { valueStr, displayStr } = attributeValueStrings(value);
            return /*html*/ `
                <div class="attribute-item" id="${nodeId}">
                    <span class="attribute-name" title="${safeKey}">${safeKey}</span>
                    <span> : </span>
                    <span class="attribute-value muted-text" title="${escapeHtml(valueStr)}">${escapeHtml(displayStr)}</span>
                </div>`;
        })
        .join('\n');
}

function renderAttributeItem(
    id: string,
    attrName: string,
    value: unknown,
): string {
    const safeName = escapeHtml(attrName);
    const { valueStr, displayStr } = attributeValueStrings(value);
    return /*html*/ `
        <div class="attribute-item" id="${id}">
            <span class="attribute-name" title="${safeName}">${safeName} : </span>
            <span class="attribute-value muted-text" title="${escapeHtml(valueStr)}">${escapeHtml(displayStr)}</span>
        </div>`;
}

/** Pill with the number of entries of a section, after its title. */
export function countBadge(count: number): string {
    return /*html*/ `<span class="count-badge">${count}</span>`;
}

/** Flat `name : value` rows; `itemKind` is the id part of each row. */
export function renderKeyValueItems(
    entries: Record<string, unknown>,
    parentId: string,
    itemKind: 'attribute' | 'encoding-entry',
): string {
    return Object.entries(entries)
        .map(([name, value]) =>
            renderAttributeItem(
                joinId([parentId, itemKind, name]),
                name,
                value,
            ),
        )
        .join('');
}

/**
 * One collapsible section of a variable card (Attributes, Xarray Encoding,
 * Plot): a small pane header, open or closed by default.
 */
function renderVariableSection(
    id: string,
    title: string,
    content: string,
    options: {
        open: boolean;
        count?: number;
        /** Plot section: `.variable-plot-controls` with its data-variable */
        plotVariable?: string;
    },
): string {
    const { open, count, plotVariable } = options;
    const plotAttrs =
        plotVariable === undefined
            ? ''
            : ` data-variable="${escapeHtml(plotVariable)}"`;
    return /*html*/ `
                <details class="variable-section${plotVariable === undefined ? '' : ' variable-plot-controls'}" id="${id}"${open ? ' open' : ''}${plotAttrs}>
                    <summary class="variable-section-summary">
                        <span class="variable-section-title">${title}</span>
                        ${count === undefined ? '' : countBadge(count)}
                    </summary>
                    ${content}
                </details>`;
}

/**
 * Shared markup of coordinate and data variables: a card whose summary row
 * (name, dims, dtype, shape, size) shows or hides all its sections at once,
 * each section keeping its own open state.
 * @param dataVariable value of data-variable (full path for data variables)
 */
function renderVariableDetails(
    variable: VariableInfo,
    groupName: string,
    kind: 'coordinate' | 'variable',
    dataVariable: string,
): string {
    const shapeStr = variable.shape ? `(${variable.shape.join(', ')})` : '';
    const dimsStr = variable.dimensions
        ? `(${variable.dimensions.join(', ')})`
        : '';
    const sizeStr = variable.size_bytes
        ? formatFileSize(variable.size_bytes)
        : '';
    const baseId = joinId(['data-group', groupName, kind, variable.name]);
    const attributes = variable.attributes ?? {};
    const encoding = variable.encoding ?? {};
    const attributeCount = Object.keys(attributes).length;
    const encodingCount = Object.keys(encoding).length;

    const sections = [
        variable.display_value
            ? `<div class="variable-display-value"><code>${escapeHtml(variable.display_value)}</code></div>`
            : '',
        attributeCount > 0
            ? renderVariableSection(
                  joinId([baseId, 'attributes']),
                  'Attributes',
                  /*html*/ `<div class="attributes-container">${renderKeyValueItems(attributes, baseId, 'attribute')}</div>`,
                  { open: true, count: attributeCount },
              )
            : '',
        encodingCount > 0
            ? renderVariableSection(
                  joinId([baseId, 'encoding']),
                  'Xarray Encoding',
                  /*html*/ `<div class="attributes-container">${renderKeyValueItems(encoding, baseId, 'encoding-entry')}</div>`,
                  { open: false, count: encodingCount },
              )
            : '',
        kind === 'variable'
            ? renderVariableSection(
                  joinId([baseId, 'plot']),
                  'Plot',
                  renderPlotControls(),
                  { open: true, plotVariable: dataVariable },
              )
            : '',
    ].join('');

    return /*html*/ `
        <details class="variable-details" id="${baseId}" data-variable="${escapeHtml(dataVariable)}">
            <summary class="variable-summary ${sections ? '' : 'not-clickable'}">
                <span class="variable-name" title="${escapeHtml(dataVariable)}">${escapeHtml(variable.name)}</span>
                <span class="dims" title="${escapeHtml(dimsStr)}">${escapeHtml(dimsStr)}</span>
                <span class="dtype-shape" title="${escapeHtml(variable.dtype)}"><code>${escapeHtml(variable.dtype)}</code></span>
                <span class="dtype-shape" title="${escapeHtml(shapeStr)}">${escapeHtml(shapeStr)}</span>
                ${sizeStr ? `<span class="size">${escapeHtml(sizeStr)}</span>` : ''}
            </summary>
            <div class="variable-details-content">${sections}</div>
        </details>`;
}

export function renderCoordinateVariable(
    variable: VariableInfo,
    groupName: string,
): string {
    return renderVariableDetails(
        variable,
        groupName,
        'coordinate',
        variable.name,
    );
}

export function renderDataVariable(
    variable: VariableInfo,
    groupName: string,
): string {
    // For datatree variables, use full path (group/variable) for plotting
    const fullVariableName = `${groupName === '/' ? '' : groupName}/${variable.name}`;
    return renderVariableDetails(
        variable,
        groupName,
        'variable',
        fullVariableName,
    );
}

/**
 * Content of a data variable's Plot section (the section element is the
 * `.variable-plot-controls`); its buttons are handled through `data-action`.
 */
function renderPlotControls(): string {
    return /*html*/ `
                    <div class="plot-controls-row">
                        <button class="create-plot-button" data-action="create-plot">Create Plot</button>
                        <button class="plot-action-button cancel-button hidden" data-action="cancel-plot" title="Cancel this plot operation">${ICONS.stop} Cancel</button>
                    </div>
                    <div class="plot-container hidden">
                        <div class="plot-actions">
                            <button class="plot-action-button" data-action="reset-plot">Reset</button>
                            <button class="plot-action-button" data-action="save-plot">Save</button>
                            <button class="plot-action-button" data-action="save-plot-as">Save As...</button>
                            <button class="plot-action-button" data-action="open-plot">Open</button>
                        </div>
                        <div class="plot-error hidden"></div>
                        <div class="plot-image-container"></div>
                    </div>`;
}
