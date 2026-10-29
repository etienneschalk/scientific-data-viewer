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

export function renderAttributeItem(
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

function renderVariableAttributes(
    attributes: Record<string, unknown>,
    parentId: string,
): string {
    const items = Object.entries(attributes)
        .map(([attrName, value]) =>
            renderAttributeItem(
                joinId([parentId, 'attribute', attrName]),
                attrName,
                value,
            ),
        )
        .join('');
    return /*html*/ `<div class="attributes-container">${items}</div>`;
}

/**
 * Shared markup of coordinate and data variables.
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
    const hasAttributes = Object.keys(attributes).length > 0;
    const attributesContent = hasAttributes
        ? renderVariableAttributes(attributes, baseId)
        : '';
    const displayValueBlock = variable.display_value
        ? `<div class="variable-display-value"><code>${escapeHtml(variable.display_value)}</code></div>`
        : '';

    return /*html*/ `
        <details class="variable-details" id="${baseId}" data-variable="${escapeHtml(dataVariable)}">
            <summary class="variable-summary ${hasAttributes ? '' : 'not-clickable'}">
                <span class="variable-name" title="${escapeHtml(dataVariable)}">${escapeHtml(variable.name)}</span>
                <span class="dims" title="${escapeHtml(dimsStr)}">${escapeHtml(dimsStr)}</span>
                <span class="dtype-shape" title="${escapeHtml(variable.dtype)}"><code>${escapeHtml(variable.dtype)}</code></span>
                <span class="dtype-shape" title="${escapeHtml(shapeStr)}">${escapeHtml(shapeStr)}</span>
                ${sizeStr ? `<span class="size">${escapeHtml(sizeStr)}</span>` : ''}
            </summary>
            <div class="variable-details-content">
                ${displayValueBlock}
                <div id="${joinId(['data-group', groupName, kind, variable.name, 'attributes'])}">${attributesContent}</div>
            </div>
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
    return (
        renderVariableDetails(
            variable,
            groupName,
            'variable',
            fullVariableName,
        ) + renderVariablePlotControls(fullVariableName)
    );
}

/** Per-variable plot block; its buttons are handled through `data-action`. */
function renderVariablePlotControls(variableName: string): string {
    return /*html*/ `
        <div class="variable-plot-controls" data-variable="${escapeHtml(variableName)}">
            <div class="plot-controls-row">
                <button class="create-plot-button" data-action="create-plot">Create Plot</button>
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
            </div>
        </div>`;
}
