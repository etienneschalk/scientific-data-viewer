import { getDisplayName, getVersion } from '../common/vscodeutils';
import { CSSGenerator } from './CSSGenerator';
import { JavaScriptGenerator } from './JavaScriptGenerator';

function escapeHtml(unsafe: string): string {
    return unsafe
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

/**
 * HTML generation utilities to break down the monolithic DataViewerPanel
 */
export class HTMLGenerator {
    private static formatTimestamp(isoString: string): string {
        return new Date(isoString).toISOString();
    }

    private static getCSS(devMode: boolean): string {
        return CSSGenerator.get(devMode);
    }

    private static getJavaScriptCode(devMode: boolean): string {
        return JavaScriptGenerator.get(devMode);
    }

    static generateMainHTML(
        devMode: boolean,
        lastLoadTime: string | null,
        panelId: number,
    ): string {
        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${getDisplayName()}</title>
    <style id="scientific-data-viewer-style">
        ${this.getCSS(devMode)}
    </style>
</head>
<body>
    ${this.generateHeader(devMode, lastLoadTime, panelId)}
    ${this.generateLoadingAndError()}
    ${this.generateContent()}
    <script>
        ${this.getJavaScriptCode(devMode)}
    </script>
</body>
</html>`;
    }

    static generateHeader(
        devMode: boolean,
        lastLoadTime: string | null,
        panelId: number,
    ): string {
        return /*html*/ `
    <div class="header">
        <div class="title" id="top-level-title">${getDisplayName()} <small>v${getVersion()} ${
            devMode ? escapeHtml(`<${panelId}>`) : ''
        }</small></div>
        <div class="controls" id="header-controls">
            ${this.generateTimestamp(lastLoadTime)}
            <div class="tree-controls">
                <button id="exportWebviewButton" class="header-control-button" title="Export Webview Content">🖼️</button>
                <button id="collapseAllButton" class="header-control-button" title="Collapse All Sections">📁</button>
                <button id="expandAllButton" class="header-control-button" title="Expand All Sections">📂</button>
                <button id="refreshButton" class="header-control-button" title="Refresh">🔄</button>
            </div>
        </div>
    </div>`;
    }

    static generateTimestamp(lastLoadTime: string | null): string {
        return /*html*/ `
        <div id="timestamp" class="timestamp hidden">
        <span id="timestampText">Loaded: ${
            lastLoadTime ? this.formatTimestamp(lastLoadTime) : '--'
        }</span>
        <span class="timestamp-icon">🕒</span>
        </div>
        `;
    }

    static generateLoadingAndError(): string {
        return /*html*/ `
    <div id="loading" class="loading">Loading data...</div>
    <div id="error" class="error hidden"></div>
    `;
    }

    static generateContent(): string {
        return /*html*/ `
    <div id="content" class="hidden">
        ${this.generateFileInfo()}
        ${this.generateHtmlRepresentation()}
        ${this.generateTextRepresentation()}
        ${this.generateHtmlRepresentationForGroups()}
        ${this.generateTextRepresentationForGroups()}
        ${this.generatePlottingSections()}
        ${this.generateDimensionsAndVariables()}
        ${this.generateTroubleshooting()}
    </div>
    `;
    }

    static generateFileInfo(): string {
        return /*html*/ `
        <div class="info-section">
            <details class="sticky-group-details" open id="section-file-information"> <summary><h3>File Information</h3></summary>
                <div id="filePathContainer" class="file-path-container">
                    <p><strong>File Path:</strong></p>
                    <button data-target-id="filePathCode" class="text-copy-button">
                    📋 Copy
                    </button>
                    <code id="filePathCode" class="file-path-code"></code>
                </div>
                <div id="fileInfo"></div>
            </details>
        </div>`;
    }

    static generateDimensionsAndVariables(): string {
        return /*html*/ `
        <!-- This is for datatree groups -->
        <div id="group-info-container" class="group-info-container"></div>
        `;
    }

    static generateHtmlRepresentation(): string {
        return /*html*/ `
        <div class="info-section">
            <details class="sticky-group-details" open id="section-html-representation"> <summary><h3>Xarray HTML Representation</h3></summary>
                <div id="htmlRepresentation" class="html-representation"></div>
            </details>
        </div>`;
    }

    static generateHtmlRepresentationForGroups(): string {
        return /*html*/ `
        <div class="info-section">
            <details class="sticky-group-details" id="section-html-representation-for-groups"> <summary><h3>Xarray HTML Representation (for each group)</h3></summary>
                <div id="htmlRepresentationForGroups" class="html-representation-for-groups"></div>
            </details>
        </div>`;
    }

    static generateTextRepresentation(): string {
        return /*html*/ `
        <div class="info-section">
            <details class="sticky-group-details" id="section-text-representation">
                <summary><h3>Xarray Text Representation</h3></summary>
                <div class="text-representation-container">
                    <button data-target-id="textRepresentation" class="text-copy-button">
                        📋 Copy
                    </button>
                    <pre id="textRepresentation" class="text-representation"></pre>
                </div>
            </details>
        </div>`;
    }

    static generateTextRepresentationForGroups(): string {
        return /*html*/ `
        <div class="info-section">
            <details class="sticky-group-details" id="section-text-representation-for-groups">
            <summary><h3>Xarray Text Representation (for each group)</h3></summary>
                <div id="textRepresentationForGroups" class="text-representation-for-groups"></div>
            </details>
        </div>`;
    }

    static generateTroubleshooting(): string {
        return /*html*/ `
        <div class="info-section">
            <details class="sticky-group-details" id="section-troubleshooting">
                <summary><h3>Troubleshooting</h3></summary>
                <div class="info-section">
                    <details open>
                        <summary>Python Interpreter Path</summary>
                            <button data-target-id="pythonPath" class="text-copy-button">
                                📋 Copy
                            </button>
                            <pre id="pythonPath">Loading Python path...</pre>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Extension Configuration</summary>
                            <button data-target-id="extensionConfig" class="text-copy-button">
                                📋 Copy
                            </button>
                            <pre id="extensionConfig">Loading configuration...</pre>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Show xarray version information</summary>
                            <button data-target-id="showVersions" class="text-copy-button">
                                📋 Copy
                            </button>
                            <pre id="showVersions">Loading version information...</pre>
                    </details>
                </div>
            </details>
        </div>`;
    }

    static generatePlottingSections(): string {
        return /*html*/ `
        <div class="info-section">
            <details class="sticky-group-details" id="section-global-plot-controls">
                <summary><h3>Global Plot Controls</h3></summary>
                <div class="global-plot-controls">
                    <button id="createAllPlotsButton" class="plot-control-button" title="Not optimized for large datasets, can cause crashes">⚠️ Plot All</button>
                    <button id="cancelAllPlotsButton" class="plot-control-button cancel-button hidden" title="Cancel all running plot operations">🛑 Cancel All</button>
                    <button id="resetAllPlotsButton" class="plot-control-button">Reset All Plots</button>
                    <button id="saveAllPlotsButton" class="plot-control-button">Save All Plots</button>
                </div>

                <!-- Time Controls Subsection -->
                <div class="time-controls-section" style="display: none;">
                    <h4>Time Controls</h4>
                    <div class="time-controls-row">
                        <label for="datetimeVariableSelect">Select Datetime Variable:</label>
                        <select id="datetimeVariableSelect" class="datetime-variable-select">
                            <option value="">Select datetime variable...</option>
                            <!-- Options will be populated dynamically -->
                        </select>
                    </div>
                    <div class="time-controls-row">
                        <label for="startDatetimeInput">Start Time:</label>
                        <input type="datetime-local" id="startDatetimeInput" class="datetime-input" />
                        <input type="text" id="startDatetimeTextInput" class="datetime-text-input" placeholder="YYYY-MM-DD HH:MM:SS" />
                    </div>
                    <div class="time-controls-row">
                        <label for="endDatetimeInput">End Time:</label>
                        <input type="datetime-local" id="endDatetimeInput" class="datetime-input" />
                        <input type="text" id="endDatetimeTextInput" class="datetime-text-input" placeholder="YYYY-MM-DD HH:MM:SS" />
                    </div>
                    <div class="time-controls-row">
                        <button id="clearTimeControlsButton" class="plot-control-button">Clear Time Controls</button>
                    </div>
                </div>

                <!-- Dimension Slices (Issue #117) -->
                <div class="dimension-slices-section" style="display: none;">
                    <div class="plot-controls-subsection dimension-slices-isel">
                        <h5 class="plot-controls-subsection-title">Dimension Slices (passed to isel)</h5>
                        <p class="dimension-slices-hint">Index or slice per dimension (e.g. <code>0:24:2</code>, <code>100:120</code>, or <code>130</code>). Applied as isel() before plotting. See <a href="https://docs.xarray.dev/en/stable/user-guide/indexing.html" target="_blank" rel="noopener noreferrer">Indexing and selecting data</a>.</p>
                        <div id="dimensionSlicesContainer"></div>
                    </div>
                    <div class="plot-controls-subsection plot-parameters">
                        <h5 class="plot-controls-subsection-title">Plot Parameters (passed to plot)</h5>
                        <p class="dimension-slices-hint">Plot options follow <a href="https://docs.xarray.dev/en/latest/user-guide/plotting.html" target="_blank" rel="noopener noreferrer">xarray plotting</a>.</p>
                    <div class="dimension-slices-facets">
                        <div class="dimension-slices-row">
                            <label for="facetRowSelect">row:</label>
                            <select id="facetRowSelect" class="facet-select">
                                <option value="">None</option>
                            </select>
                            <label for="facetColSelect">col:</label>
                            <select id="facetColSelect" class="facet-select">
                                <option value="">None</option>
                            </select>
                            <label for="plotColWrapInput">col_wrap:</label>
                            <input type="number" id="plotColWrapInput" class="plot-col-wrap-input" min="1" placeholder="e.g. 4" title="xarray col_wrap: max columns in faceted grid (positive integer)" />
                        </div>
                        <div class="dimension-slices-row">
                            <label for="plotXSelect">x:</label>
                            <select id="plotXSelect" class="facet-select">
                                <option value="">None</option>
                            </select>
                            <label for="plotYSelect">y:</label>
                            <select id="plotYSelect" class="facet-select">
                                <option value="">None</option>
                            </select>
                            <label for="plotHueSelect">hue:</label>
                            <select id="plotHueSelect" class="facet-select">
                                <option value="">None</option>
                            </select>
                        </div>
                        <div class="dimension-slices-row">
                            <label for="xIncreaseCheckbox" class="plot-checkbox-label">xincrease:</label>
                            <input type="checkbox" id="xIncreaseCheckbox" class="plot-checkbox" checked title="xarray xincrease (uncheck to reverse x-axis)" />
                            <label for="yIncreaseCheckbox" class="plot-checkbox-label">yincrease:</label>
                            <input type="checkbox" id="yIncreaseCheckbox" class="plot-checkbox" checked title="xarray yincrease (uncheck to reverse y-axis)" />
                            <label for="robustCheckbox" class="plot-checkbox-label">robust:</label>
                            <input type="checkbox" id="robustCheckbox" class="plot-checkbox" title="xarray robust: use 2nd/98th percentiles for color limits (helps with outliers)" />
                        </div>
                        <div class="dimension-slices-row">
                            <label for="plotBinsInput">bins:</label>
                            <input type="number" id="plotBinsInput" class="bins-input" min="1" placeholder="e.g. 100" title="Number of bins for histogram-style plots" />
                            <label for="plotAspectInput">aspect:</label>
                            <input type="text" id="plotAspectInput" class="plot-aspect-size-input" placeholder="e.g. 1 or 1.5" title="xarray aspect (fig width = aspect * size, float)" />
                            <label for="plotSizeInput">size:</label>
                            <input type="text" id="plotSizeInput" class="plot-aspect-size-input" placeholder="e.g. 4 or 5.5" title="xarray size in inches (fig height, float)" />
                        </div>
                        <div class="dimension-slices-row">
                            <label for="plotCmapInput">cmap:</label>
                            <input type="text" id="plotCmapInput" class="plot-cmap-input" placeholder="e.g. viridis, plasma" title="Matplotlib colormap name (user must provide a valid existing cmap)" />
                        </div>
                    </div>
                    </div>
                    <div class="time-controls-row">
                        <button id="clearDimensionSlicesButton" class="plot-control-button">Clear Dimension Slices and Plot Parameters</button>
                    </div>
                </div>
            </details>
        </div>`;
    }
}
