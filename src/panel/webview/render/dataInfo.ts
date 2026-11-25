import { ICONS } from '../../../shared/icons';
import { joinId } from '../../../shared/ids';
import { displayGlobalError, hideGlobalError } from '../errors';
import { closePlotEditor, refreshSettingsSummaries } from '../plotEditor';
import { groupScope, groupVariables, setPlotModel } from '../plotSettings';
import { globalState } from '../state';
import { clampPlotTimeout, escapeHtml, formatFileSize } from '../util';
import {
    decodingModeText,
    displayExtensionConfig,
    displayHtmlRepresentation,
    displayOpenReport,
    OpenReportView,
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
    open_report?: OpenReportView;
    dimensions_flattened?: Record<string, Record<string, number>>;
    coordinates_flattened?: Record<string, VariableInfo[]>;
    variables_flattened?: Record<string, VariableInfo[]>;
    attributes_flattened?: Record<string, Record<string, unknown>>;
    encoding_flattened?: Record<string, Record<string, unknown>>;
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
    nestedAttributesView: boolean;
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
        displayOpenReport(dataInfo.open_report);
    }
    displayPythonPath(state?.python?.pythonPath);
    displayExtensionConfig(extensionConfig);
    displayTimestamp(
        data.lastLoadTime,
        false,
        extensionConfig?.showLoadTimeInLocalTime !== false,
    );
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
        nestedAttributesView: config.nestedAttributesView !== false,
    };
    globalState.plotTimeoutMs = clampPlotTimeout(config.plotTimeoutMs);
    globalState.currentDatasetFilePath = filePath;

    hideGlobalError();
    // The plot settings are kept (Refresh); the editor is rebuilt on demand
    closePlotEditor();
    setPlotModel(data);

    const filePathCode = document.getElementById('filePathCode');
    if (filePathCode) {
        filePathCode.textContent = filePath ?? '';
    }
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.innerHTML = renderFileInformation(data);
    }

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
                .map((groupName) => renderGroup(data, groupName, flags))
                .join('');
            refreshSettingsSummaries(groupInfoContainer);
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
    if (data.open_report) {
        parts.push(
            `<strong>Decoding:</strong> ${escapeHtml(decodingModeText(data.open_report))} ${renderRawModeButton(data.open_report.raw === true)}`,
        );
    }
    return `<p>${parts.join(' · ')}</p>`;
}

/** "Reopen raw" / "Reopen decoded" (handled by the `set-raw-mode` action). */
export function renderRawModeButton(isRaw: boolean): string {
    return isRaw
        ? /*html*/ `<a href="#" class="small-button-link" data-action="set-raw-mode" data-raw="false" title="Reload this file with CF decoding">Reopen decoded</a>`
        : /*html*/ `<a href="#" class="small-button-link" data-action="set-raw-mode" data-raw="true" title="Reload this file without CF decoding (no masking, scaling, time or coordinate decoding), for this tab only">Reopen raw</a>`;
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
                    ${renderGroupPlotSection(data, groupName)}
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
        /**
         * Plot section: `.group-plot-section` with data-group, host of the
         * plot settings editor (`data-settings-scope`)
         */
        plotGroup?: string;
    },
): string {
    const { open, count, plotGroup } = options;
    const plotAttrs =
        plotGroup === undefined
            ? ''
            : ` data-group="${escapeHtml(plotGroup)}" data-settings-scope="${escapeHtml(groupScope(plotGroup))}"`;
    return /*html*/ `
                    <details class="group-section${plotGroup === undefined ? '' : ' group-plot-section'}" id="${id}"${open ? ' open' : ''}${plotAttrs}>
                        <summary class="group-section-summary"><h4>${title}</h4>${count ? countBadge(count) : ''}</summary>
                        ${content}
                    </details>`;
}

/**
 * Plot section of a group: Plot group (its own data variables), Settings
 * (the editor of this group, and of its parents up to the whole file), and
 * the summary of the settings that apply to the group. Absent when neither
 * the group nor its subgroups hold a data variable.
 */
function renderGroupPlotSection(data: DataInfo, groupName: string): string {
    const prefix = groupName === '/' ? '/' : `${groupName}/`;
    const hasVariables = Object.entries(data.variables_flattened ?? {}).some(
        ([group, variables]) =>
            (group === groupName || group.startsWith(prefix)) &&
            variables.length > 0,
    );
    if (!hasVariables) {
        return '';
    }
    const count = groupVariables(groupName).length;
    const plotButton =
        count > 0
            ? /*html*/ `<button type="button" class="plot-action-button" data-action="plot-group" title="Plot the ${count === 1 ? 'data variable' : `${count} data variables`} of this group, 5 at a time (subgroups have their own button)">${ICONS.play} Plot group</button>`
            : '';
    const settingsTitle =
        groupName === '/'
            ? 'Slices and plot parameters of every variable of the file'
            : 'Slices and plot parameters of the variables of this group and its subgroups, or of the whole file';
    return renderGroupSection(
        joinId(['data-group', groupName, 'plot']),
        'Plot',
        /*html*/ `<div class="group-plot-content">
                        <div class="plot-controls-row">
                            ${plotButton}
                            <button type="button" class="plot-action-button plot-settings-button" data-action="open-settings" aria-expanded="false" title="${escapeHtml(settingsTitle)}">${ICONS.settings} Settings</button>
                        </div>
                        <div class="plot-settings-summary"></div>
                        <div class="plot-editor-host"></div>
                    </div>`,
        { open: true, plotGroup: groupName },
    );
}
