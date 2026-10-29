import { joinId } from '../../../shared/ids';
import { displayGlobalError, hideGlobalError } from '../errors';
import {
    globalPlotScope,
    groupPlotScope,
    renderDimensionSliceInputs,
    renderPlotParameters,
    setDimensionOptions,
} from '../plotParams';
import { globalState } from '../state';
import {
    collectDatetimeVariables,
    DatetimeVariablesByGroup,
    datetimeOptionsHtml,
    populateDatetimeVariables,
} from '../timeControls';
import { clampPlotTimeout, escapeHtml, formatFileSize } from '../util';
import {
    displayExtensionConfig,
    displayHtmlRepresentation,
    displayPythonPath,
    displayShowVersions,
    displayTextRepresentation,
    displayTimestamp,
} from './representations';
import {
    countBadge,
    renderAttributesTree,
    renderCoordinateVariable,
    renderDataVariable,
    renderGroupDimensions,
    renderKeyValueItems,
    VariableInfo,
} from './variables';

/** Result of the Python `info` command (only the fields the webview reads). */
export interface DataInfo {
    error?: string;
    format?: string;
    format_info?: { display_name?: string; available_engines?: string[] };
    used_engine?: string;
    fileSize?: number;
    decode_cf_degraded?: boolean;
    dimensions_flattened?: Record<string, Record<string, number>>;
    coordinates_flattened?: Record<string, VariableInfo[]>;
    variables_flattened?: Record<string, VariableInfo[]>;
    attributes_flattened?: Record<string, Record<string, unknown>>;
    encoding_flattened?: Record<string, Record<string, unknown>>;
    datetime_variables?: DatetimeVariablesByGroup;
    xarray_html_repr?: string;
    xarray_text_repr?: string;
    xarray_html_repr_flattened?: Record<string, string>;
    xarray_text_repr_flattened?: Record<string, string>;
    xarray_show_versions?: string;
}

/** Payload of the `dataLoaded` event (only these keys are relied upon). */
export interface DataLoadedPayload {
    data?: {
        currentFile?: string | null;
        dataInfo?: DataInfo | null;
        lastLoadTime?: string | null;
    };
    python?: { pythonPath?: string | null };
    extension?: { extensionConfig?: Record<string, unknown> };
}

interface DisplayFlags {
    globalTimeControls: boolean;
    globalDimensionSlices: boolean;
    groupTimeControls: boolean;
    groupDimensionSlices: boolean;
    nestedAttributesView: boolean;
    isFirstRootGroup?: boolean;
}

export function displayAll(state: DataLoadedPayload): void {
    const data = state?.data ?? {};
    const dataInfo = data.dataInfo ?? null;
    const extensionConfig = state?.extension?.extensionConfig;
    displayDataInfo(dataInfo, data.currentFile ?? null, extensionConfig);
    if (dataInfo && !dataInfo.error) {
        displayHtmlRepresentation(dataInfo.xarray_html_repr, false);
        displayTextRepresentation(dataInfo.xarray_text_repr, false);
        displayHtmlRepresentation(dataInfo.xarray_html_repr_flattened, true);
        displayTextRepresentation(dataInfo.xarray_text_repr_flattened, true);
        displayShowVersions(dataInfo.xarray_show_versions);
    }
    displayPythonPath(state?.python?.pythonPath);
    displayExtensionConfig(extensionConfig);
    displayTimestamp(
        data.lastLoadTime,
        false,
        extensionConfig?.showLoadTimeInLocalTime !== false,
    );
}

/** Render the global plot parameters once (exported HTML keeps its own). */
export function renderGlobalPlotParameters(): void {
    const container = document.getElementById('globalPlotParameters');
    if (container && container.children.length === 0) {
        container.innerHTML = renderPlotParameters(globalPlotScope(), []);
    }
}

function displayDataInfo(
    data: DataInfo | null,
    filePath: string | null,
    extensionConfig: Record<string, unknown> | undefined,
): void {
    if (!data) {
        displayGlobalError('No data available');
        return;
    }
    if (data.error) {
        displayGlobalError(data.error);
        return;
    }

    // Feature flags (default true when config not available)
    const config = extensionConfig ?? {};
    const flags: DisplayFlags = {
        globalTimeControls: config.globalTimeControls !== false,
        globalDimensionSlices: config.globalDimensionSlices !== false,
        groupTimeControls: config.groupTimeControls !== false,
        groupDimensionSlices: config.groupDimensionSlices !== false,
        nestedAttributesView: config.nestedAttributesView !== false,
    };
    globalState.plotTimeoutMs = clampPlotTimeout(config.plotTimeoutMs);
    globalState.currentDatasetFilePath = filePath;

    hideGlobalError();
    renderGlobalPlotParameters();

    const filePathCode = document.getElementById('filePathCode');
    if (filePathCode) {
        filePathCode.textContent = filePath ?? '';
    }
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.innerHTML = renderFileInformation(data);
    }

    // Datetime variables first: group time selects prefill from this map.
    populateDatetimeVariables(
        data.datetime_variables,
        flags.globalTimeControls,
    );

    const groupInfoContainer = document.getElementById('group-info-container');
    if (groupInfoContainer) {
        groupInfoContainer.classList.remove('hidden');
        const groups =
            data.dimensions_flattened &&
            data.coordinates_flattened &&
            data.variables_flattened
                ? Object.keys(data.dimensions_flattened)
                : [];
        if (groups.length > 0) {
            groupInfoContainer.innerHTML = groups
                .map((groupName, index) =>
                    renderGroup(data, groupName, {
                        ...flags,
                        isFirstRootGroup: index === 0,
                    }),
                )
                .join('');
            // Open the first group by default
            const firstGroup = groupInfoContainer.querySelector('details');
            if (firstGroup) {
                firstGroup.open = true;
            }
        } else {
            groupInfoContainer.innerHTML =
                '<p class="muted-text">No data available</p>';
        }
    }

    populateDimensionSlices(data, flags.globalDimensionSlices);

    document.getElementById('loading')?.classList.add('hidden');
    document.getElementById('content')?.classList.remove('hidden');
}

function renderFileInformation(data: DataInfo): string {
    const parts: string[] = [];
    if (data.fileSize) {
        parts.push(
            `<strong>Size:</strong> ${escapeHtml(formatFileSize(data.fileSize))}`,
        );
    }
    parts.push(
        `<strong>Format:</strong> ${escapeHtml(
            data.format || data.format_info?.display_name || 'Unknown',
        )}`,
    );
    if (data.format_info) {
        const engines = data.format_info.available_engines ?? [];
        parts.push(
            `<strong>Available Engines:</strong> ${escapeHtml(engines.join(', ') || 'None')}`,
        );
        if (data.used_engine) {
            parts.push(
                `<strong>Used Engine:</strong> ${escapeHtml(data.used_engine)}`,
            );
        }
    }
    if (data.decode_cf_degraded) {
        parts.push('<strong>Mode:</strong> degraded (decode_cf=False)');
    }
    return `<p>${parts.join(' · ')}</p>`;
}

function renderGroup(
    data: DataInfo,
    groupName: string,
    flags: DisplayFlags,
): string {
    const dimensions = data.dimensions_flattened?.[groupName];
    const dimensionsHtml =
        dimensions && Object.keys(dimensions).length > 0
            ? renderGroupDimensions(dimensions, groupName)
            : /*html*/ `<p class="muted-text">No dimensions found in this group.</p>`;

    const coordinates = data.coordinates_flattened?.[groupName];
    const coordinatesHtml =
        coordinates && coordinates.length > 0
            ? coordinates
                  .map((variable) =>
                      renderCoordinateVariable(variable, groupName),
                  )
                  .join('')
            : /*html*/ `<p class="muted-text">No coordinates found in this group.</p>`;

    const variables = data.variables_flattened?.[groupName];
    const variablesHtml =
        variables && variables.length > 0
            ? variables
                  .map((variable) => renderDataVariable(variable, groupName))
                  .join('')
            : /*html*/ `<p class="muted-text">No variables found in this group.</p>`;

    // Flat list, or collapsible tree when nestedAttributesView is on
    const groupId = joinId(['data-group', groupName]);
    const attributes = data.attributes_flattened?.[groupName] ?? {};
    const attributeCount = Object.keys(attributes).length;
    let attributesHtml = /*html*/ `<p class="muted-text">No attributes found in this group.</p>`;
    if (attributeCount > 0) {
        attributesHtml = flags.nestedAttributesView
            ? renderAttributesTree(attributes, [
                  'data-group',
                  groupName,
                  'attributes',
              ])
            : renderKeyValueItems(attributes, groupId, 'attribute');
    }

    // Collapsed by default; absent when the encoding is not reported
    const encoding = data.encoding_flattened?.[groupName] ?? {};
    const encodingCount = Object.keys(encoding).length;

    const dimensionCount = Object.keys(dimensions ?? {}).length;
    const coordinateCount = coordinates?.length ?? 0;
    const variableCount = variables?.length ?? 0;

    const section = (
        name: string,
        title: string,
        content: string,
        count?: number,
        open = true,
    ) =>
        renderGroupSection(
            joinId(['data-group', groupName, name]),
            title,
            /*html*/ `<div class="${name}">${content}</div>`,
            { open, count },
        );

    return /*html*/ `
        <div class="info-section" id="${groupId}">
            <details class="group-card">
                <summary class="group-card-summary">
                    <h3>Group: ${escapeHtml(groupName)}</h3>
                    <span class="group-card-meta">${escapeHtml(
                        [
                            plural(dimensionCount, 'dimension'),
                            plural(coordinateCount, 'coordinate'),
                            plural(variableCount, 'variable'),
                        ].join(' · '),
                    )}</span>
                </summary>
                <div class="group-card-body">
                    ${renderGroupPlotControls(data, groupName, flags)}
                    ${section('dimensions', 'Dimensions', dimensionsHtml, dimensionCount)}
                    ${section('coordinates', 'Coordinates', coordinatesHtml, coordinateCount)}
                    ${section('variables', 'Variables', variablesHtml, variableCount)}
                    ${section('attributes', 'Attributes', attributesHtml, attributeCount)}
                    ${encodingCount > 0 ? section('encoding', 'Xarray Encoding', renderKeyValueItems(encoding, groupId, 'encoding-entry'), encodingCount, false) : ''}
                </div>
            </details>
        </div>
        `;
}

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * One collapsible section of a group card (pane header style, like the
 * sections of a variable card).
 */
function renderGroupSection(
    id: string,
    title: string,
    content: string,
    options: {
        open: boolean;
        count?: number;
        /** Group Plot Controls: `.group-plot-controls-section` with data-group */
        plotGroup?: string;
    },
): string {
    const { open, count, plotGroup } = options;
    const plotAttrs =
        plotGroup === undefined ? '' : ` data-group="${escapeHtml(plotGroup)}"`;
    return /*html*/ `
                    <details class="group-section${plotGroup === undefined ? '' : ' group-plot-controls-section'}" id="${id}"${open ? ' open' : ''}${plotAttrs}>
                        <summary class="group-section-summary"><h4>${title}</h4>${count ? countBadge(count) : ''}</summary>
                        ${content}
                    </details>`;
}

/** Group time controls and plot parameters (same markup roles as the global ones). */
function renderGroupPlotControls(
    data: DataInfo,
    groupName: string,
    flags: DisplayFlags,
): string {
    const scope = groupPlotScope(groupName);
    const safeId = scope.safeId;
    const groupAttr = `data-group="${escapeHtml(groupName)}"`;
    const groupDims = data.dimensions_flattened?.[groupName] ?? {};
    const dimNames = Object.keys(groupDims).sort();
    const timeVars = collectDatetimeVariables(data.datetime_variables ?? {}, [
        groupName,
    ]);

    const heading = (title: string, action: string, help: string) => /*html*/ `
                        <div class="plot-controls-heading">
                            <h5 class="plot-controls-subsection-title">${title}</h5>
                            <button type="button" class="plot-reset-button" data-action="${action}" title="${help}">Reset</button>
                        </div>`;
    const timeField = (role: 'start' | 'end', label: string) => /*html*/ `
                            <div class="plot-field">
                                <label for="group-${role}-datetime-${safeId}" class="plot-field-label"><span class="plot-field-name">${label}</span></label>
                                <input type="datetime-local" id="group-${role}-datetime-${safeId}" class="datetime-input" data-time="${role}" ${groupAttr} />
                                <input type="text" id="group-${role}-datetime-text-${safeId}" class="datetime-text-input" data-time="${role}-text" placeholder="YYYY-MM-DD HH:MM:SS" aria-label="${label} (text)" ${groupAttr} />
                            </div>`;

    const timeControlsHtml =
        flags.groupTimeControls && timeVars.length > 0
            ? /*html*/ `
                <div class="group-plot-controls time-controls-section">
                    <div class="plot-controls-subsection">
                        ${heading('Time range', 'clear-time', 'Clear the time range')}
                        <p class="dimension-slices-hint">Plot only the values between two dates of a datetime variable; overrides the global time range.</p>
                        <div class="plot-fields plot-fields--time">
                            <div class="plot-field">
                                <label for="group-datetime-select-${safeId}" class="plot-field-label"><span class="plot-field-name">Datetime variable</span></label>
                                <select id="group-datetime-select-${safeId}" class="datetime-variable-select" data-time="variable" ${groupAttr}>
                                    ${datetimeOptionsHtml('Select...', timeVars)}
                                </select>
                            </div>
                            ${timeField('start', 'Start')}
                            ${timeField('end', 'End')}
                        </div>
                    </div>
                </div>`
            : '';

    const dimensionSlicesHtml =
        flags.groupDimensionSlices && dimNames.length > 0
            ? /*html*/ `
                <div class="group-plot-controls dimension-slices-section">
                    <div class="plot-controls-subsection dimension-slices-isel">
                        ${heading('Dimension slices <code>isel</code>', 'clear-plot-controls', 'Clear the dimension slices')}
                        <p class="dimension-slices-hint">Start alone selects one index (<code>130</code>); start, stop and step select a slice (<code>100:120</code>, <code>0:24:2</code>; stop excluded). The slider moves start and stop. See <a href="https://docs.xarray.dev/en/stable/user-guide/indexing.html" target="_blank" rel="noopener noreferrer">Indexing and selecting data</a>.</p>
                        <div class="plot-fields plot-fields--slices dimension-slices-container">
                            ${renderDimensionSliceInputs(scope, groupDims)}
                        </div>
                    </div>
                    <div class="plot-controls-subsection plot-parameters">
                        ${heading('Plot parameters <code>plot</code>', 'clear-plot-controls', 'Reset the plot parameters')}
                        <p class="dimension-slices-hint">Override the global plot parameters for this group; empty fields use the global ones. See <a href="https://docs.xarray.dev/en/latest/user-guide/plotting.html" target="_blank" rel="noopener noreferrer">xarray plotting</a>.</p>
                        <div class="dimension-slices-facets">
                            ${renderPlotParameters(scope, dimNames)}
                        </div>
                    </div>
                </div>`
            : '';

    if (!timeControlsHtml && !dimensionSlicesHtml) {
        return '';
    }

    return renderGroupSection(
        joinId(['data-group', groupName, 'group-plot-controls']),
        'Group Plot Controls',
        /*html*/ `<div class="plot-controls-content">${timeControlsHtml}${dimensionSlicesHtml}</div>`,
        { open: !!flags.isFirstRootGroup, plotGroup: groupName },
    );
}

/** Global dimension slices: every dimension of every group (max size), sorted. */
function populateDimensionSlices(
    data: DataInfo,
    globalDimensionSlices: boolean,
): void {
    const section = document.querySelector<HTMLElement>(
        '#section-global-plot-controls .dimension-slices-section',
    );
    if (!section) {
        return;
    }
    const dims = data.dimensions_flattened ?? {};
    if (!globalDimensionSlices || Object.keys(dims).length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const mergedDimensions: Record<string, number> = {};
    for (const groupDims of Object.values(dims)) {
        for (const [dimName, size] of Object.entries(groupDims ?? {})) {
            const existing = mergedDimensions[dimName];
            if (existing === undefined || size > existing) {
                mergedDimensions[dimName] = size;
            }
        }
    }
    const dimNames = Object.keys(mergedDimensions).sort();

    const container = document.getElementById('dimensionSlicesContainer');
    if (container) {
        container.innerHTML =
            dimNames.length > 0
                ? renderDimensionSliceInputs(
                      globalPlotScope(),
                      mergedDimensions,
                  )
                : '<p class="muted-text">No dimensions in any group.</p>';
    }
    const parameters = document.getElementById('globalPlotParameters');
    if (parameters) {
        setDimensionOptions(parameters, dimNames);
    }
}
