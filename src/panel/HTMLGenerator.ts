import { getDisplayName, getVersion } from '../common/vscodeutils';
import { ICONS } from '../shared/icons';
import { formatLoadTime } from '../shared/time';
import {
    readWebviewAsset,
    WEBVIEW_SCRIPT,
    WEBVIEW_STYLESHEET,
} from './WebviewAssets';
import * as vscode from 'vscode';

export interface WebviewAssetOptions {
    webview: vscode.Webview;
    extensionUri: vscode.Uri;
}

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
    static generateMainHTML(
        devMode: boolean,
        lastLoadTime: string | null,
        panelId: number,
        assetOptions?: WebviewAssetOptions,
        useLocalTime = false,
    ): string {
        const cspBlock = this.getContentSecurityPolicyBlock(assetOptions);
        const cssBlock = this.getStylesheetBlock(devMode, assetOptions);
        const scriptBlock = this.getScriptBlock(devMode, assetOptions);

        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    ${cspBlock}
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${getDisplayName()}</title>
    ${cssBlock}
</head>
<body>
    ${this.generateHeader(devMode, lastLoadTime, panelId, useLocalTime)}
    ${this.generateLoadingAndError()}
    ${this.generateContent()}
    ${scriptBlock}
</body>
</html>`;
    }

    /**
     * Content-Security-Policy of the live webview: only the extension's own
     * script and stylesheet may load; plots are `data:` PNGs. Inline styles
     * stay allowed for the xarray HTML repr (its `<style>` blocks and
     * CSS-only toggles); inline scripts and event handlers are not.
     */
    static getContentSecurityPolicy(cspSource: string): string {
        return [
            "default-src 'none'",
            `img-src ${cspSource} data:`,
            `style-src ${cspSource} 'unsafe-inline'`,
            `font-src ${cspSource}`,
            `script-src ${cspSource}`,
        ].join('; ');
    }

    private static getContentSecurityPolicyBlock(
        assetOptions?: WebviewAssetOptions,
    ): string {
        const cspSource = assetOptions?.webview.cspSource;
        if (
            !this.canUseExternalAssets(assetOptions) ||
            typeof cspSource !== 'string' ||
            cspSource === ''
        ) {
            return '';
        }
        return `<meta http-equiv="Content-Security-Policy" content="${this.getContentSecurityPolicy(cspSource)}">`;
    }

    private static getWebviewAssetUri(
        assetOptions: WebviewAssetOptions,
        pathSegments: string[],
    ): vscode.Uri {
        return assetOptions.webview.asWebviewUri(
            vscode.Uri.joinPath(assetOptions.extensionUri, ...pathSegments),
        );
    }

    private static canUseExternalAssets(
        assetOptions?: WebviewAssetOptions,
    ): assetOptions is WebviewAssetOptions {
        return (
            !!assetOptions &&
            typeof assetOptions.webview.asWebviewUri === 'function'
        );
    }

    private static getStylesheetBlock(
        devMode: boolean,
        assetOptions?: WebviewAssetOptions,
    ): string {
        if (this.canUseExternalAssets(assetOptions)) {
            const cssUri = this.getWebviewAssetUri(
                assetOptions,
                WEBVIEW_STYLESHEET,
            );
            const cacheBuster = devMode ? `?v=${Date.now()}` : '';
            return `<link rel="stylesheet" href="${cssUri}${cacheBuster}">`;
        }

        return this.getInlineStylesheetBlock(devMode);
    }

    private static getScriptBlock(
        devMode: boolean,
        assetOptions?: WebviewAssetOptions,
    ): string {
        if (this.canUseExternalAssets(assetOptions)) {
            const scriptUri = this.getWebviewAssetUri(
                assetOptions,
                WEBVIEW_SCRIPT,
            );
            const cacheBuster = devMode ? `?v=${Date.now()}` : '';
            return `<script src="${scriptUri}${cacheBuster}"></script>`;
        }

        return this.getInlineScriptBlock(devMode);
    }

    static getInlineStylesheetBlock(devMode: boolean): string {
        return `<style id="scientific-data-viewer-style">
        ${readWebviewAsset(WEBVIEW_STYLESHEET, devMode)}
    </style>`;
    }

    static getInlineScriptBlock(devMode: boolean): string {
        // A literal "</script" inside the code would end the element early.
        const code = readWebviewAsset(WEBVIEW_SCRIPT, devMode).replace(
            /<\/script/gi,
            '<\\/script',
        );
        return `<script>
        ${code}
    </script>`;
    }

    private static readonly CONTENT_SECURITY_POLICY_PATTERN =
        /<meta\b[^>]*\bhttp-equiv="Content-Security-Policy"[^>]*>\s*/gi;

    private static readonly EXTERNAL_STYLESHEET_PATTERN =
        /<link\b[^>]*\bhref="[^"]*\/styles\.css(?:\?[^"]*)?"[^>]*>/i;

    private static readonly EXTERNAL_SCRIPT_PATTERN =
        /<script\b[^>]*\bsrc="[^"]*\/webview\.js(?:\?[^"]*)?"[^>]*>\s*<\/script>/i;

    /**
     * Replace `asWebviewUri` asset references with their inline equivalents.
     *
     * The live webview loads styles.css and the webview script over
     * `vscode-resource` URIs, which resolve to nothing outside VS Code. Any
     * document meant to be read standalone (exported HTML) must carry them
     * inline instead. The webview's Content-Security-Policy is dropped too:
     * it only allows `vscode-resource` sources, so it would block the inlined
     * script in a browser.
     */
    static inlineWebviewAssets(htmlContent: string, devMode: boolean): string {
        // Function replacers keep `$`-sequences in the CSS/JS literal.
        return htmlContent
            .replace(this.CONTENT_SECURITY_POLICY_PATTERN, () => '')
            .replace(this.EXTERNAL_STYLESHEET_PATTERN, () =>
                this.getInlineStylesheetBlock(devMode),
            )
            .replace(this.EXTERNAL_SCRIPT_PATTERN, () =>
                this.getInlineScriptBlock(devMode),
            );
    }

    static generateHeader(
        devMode: boolean,
        lastLoadTime: string | null,
        panelId: number,
        useLocalTime = false,
    ): string {
        return /*html*/ `
    <div class="header">
        <div class="title" id="top-level-title">${getDisplayName()} <small>v${getVersion()} ${
            devMode ? escapeHtml(`<${panelId}>`) : ''
        }</small></div>
        <div class="controls" id="header-controls">
            ${this.generateTimestamp(lastLoadTime, useLocalTime)}
            <div class="tree-controls">
                <button id="exportWebviewButton" class="header-control-button" title="Export Webview Content" aria-label="Export Webview Content">${ICONS.export}</button>
                <button id="collapseAllButton" class="header-control-button" title="Collapse All Sections" aria-label="Collapse All Sections">${ICONS.collapseAll}</button>
                <button id="expandAllButton" class="header-control-button" title="Expand All Sections" aria-label="Expand All Sections">${ICONS.expandAll}</button>
                <button id="refreshButton" class="header-control-button" title="Refresh" aria-label="Refresh">${ICONS.refresh}</button>
            </div>
        </div>
    </div>`;
    }

    static generateTimestamp(
        lastLoadTime: string | null,
        useLocalTime = false,
    ): string {
        return /*html*/ `
        <div id="timestamp" class="timestamp hidden">
        <span id="timestampText">Loaded: ${
            lastLoadTime ? formatLoadTime(lastLoadTime, useLocalTime) : '--'
        }</span>
        <span class="timestamp-icon">${ICONS.clock}</span>
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
                    Copy
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
                        Copy
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
                                Copy
                            </button>
                            <pre id="pythonPath">Loading Python path...</pre>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Extension Configuration</summary>
                            <button data-target-id="extensionConfig" class="text-copy-button">
                                Copy
                            </button>
                            <pre id="extensionConfig">Loading configuration...</pre>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Show xarray version information</summary>
                            <button data-target-id="showVersions" class="text-copy-button">
                                Copy
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
                    <button id="createAllPlotsButton" class="plot-control-button" title="Not optimized for large datasets, can cause crashes">${ICONS.warning} Plot All</button>
                    <button id="cancelAllPlotsButton" class="plot-control-button cancel-button hidden" title="Cancel all running plot operations">${ICONS.stop} Cancel All</button>
                    <button id="resetAllPlotsButton" class="plot-control-button">Reset All Plots</button>
                    <button id="saveAllPlotsButton" class="plot-control-button">Save All Plots</button>
                </div>

                <!-- One card: time range, dimension slices, plot parameters -->
                <div class="plot-controls-card"><div class="plot-controls-content">
                    <div class="time-controls-section" style="display: none;">
                        <div class="plot-controls-subsection">
                            <div class="plot-controls-heading">
                                <h5 class="plot-controls-subsection-title">Time range</h5>
                                <button type="button" id="clearTimeControlsButton" class="plot-reset-button" data-action="clear-time" title="Clear the time range">Reset</button>
                            </div>
                            <p class="dimension-slices-hint">Plot only the values between two dates of a datetime variable.</p>
                            <div class="plot-fields plot-fields--time">
                                <div class="plot-field">
                                    <label for="datetimeVariableSelect" class="plot-field-label"><span class="plot-field-name">Datetime variable</span></label>
                                    <select id="datetimeVariableSelect" class="datetime-variable-select" data-time="variable">
                                        <option value="">Select datetime variable...</option>
                                        <!-- Options will be populated dynamically -->
                                    </select>
                                </div>
                                <div class="plot-field">
                                    <label for="startDatetimeInput" class="plot-field-label"><span class="plot-field-name">Start</span></label>
                                    <input type="datetime-local" id="startDatetimeInput" class="datetime-input" data-time="start" />
                                    <input type="text" id="startDatetimeTextInput" class="datetime-text-input" data-time="start-text" placeholder="YYYY-MM-DD HH:MM:SS" aria-label="Start (text)" />
                                </div>
                                <div class="plot-field">
                                    <label for="endDatetimeInput" class="plot-field-label"><span class="plot-field-name">End</span></label>
                                    <input type="datetime-local" id="endDatetimeInput" class="datetime-input" data-time="end" />
                                    <input type="text" id="endDatetimeTextInput" class="datetime-text-input" data-time="end-text" placeholder="YYYY-MM-DD HH:MM:SS" aria-label="End (text)" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Dimension Slices (Issue #117) and plot parameters -->
                    <div class="dimension-slices-section" style="display: none;">
                        <div class="plot-controls-subsection dimension-slices-isel">
                            <div class="plot-controls-heading">
                                <h5 class="plot-controls-subsection-title">Dimension slices <code>isel</code></h5>
                                <button type="button" id="clearDimensionSlicesButton" class="plot-reset-button" data-action="clear-plot-controls" title="Clear the dimension slices">Reset</button>
                            </div>
                            <p class="dimension-slices-hint">Start alone selects one index (<code>130</code>); start, stop and step select a slice (<code>100:120</code>, <code>0:24:2</code>; stop excluded). The slider moves start and stop. See <a href="https://docs.xarray.dev/en/stable/user-guide/indexing.html" target="_blank" rel="noopener noreferrer">Indexing and selecting data</a>.</p>
                            <div id="dimensionSlicesContainer" class="plot-fields plot-fields--slices"></div>
                        </div>
                        <div class="plot-controls-subsection plot-parameters">
                            <div class="plot-controls-heading">
                                <h5 class="plot-controls-subsection-title">Plot parameters <code>plot</code></h5>
                                <button type="button" id="clearPlotParametersButton" class="plot-reset-button" data-action="clear-plot-controls" title="Reset the plot parameters">Reset</button>
                            </div>
                            <p class="dimension-slices-hint">Passed to the xarray plot call; empty fields keep xarray's defaults. See <a href="https://docs.xarray.dev/en/latest/user-guide/plotting.html" target="_blank" rel="noopener noreferrer">xarray plotting</a>.</p>
                            <!-- Rendered by the webview script from its plot-parameter table -->
                            <div id="globalPlotParameters" class="dimension-slices-facets"></div>
                        </div>
                    </div>
                </div></div>
            </details>
        </div>`;
    }
}
