import { CSSGenerator } from './CSSGenerator';
import { JavaScriptGenerator } from './JavaScriptGenerator';

/**
 * HTML generation utilities to break down the monolithic DataViewerPanel
 */
export class HTMLGenerator {
    private static formatTimestamp(isoString: string): string {
        return new Date(isoString).toLocaleTimeString();
    }

    private static getCSS(devMode: boolean): string {
        return CSSGenerator.get(devMode);
    }

    private static getJavaScriptCode(devMode: boolean): string {
        return JavaScriptGenerator.get(devMode);
    }

    static generateMainHTML(devMode: boolean, lastLoadTime: string | null): string {
        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scientific Data Viewer</title>
    <style>
        ${this.getCSS(devMode)}
    </style>
</head>
<body>
    ${this.generateHeader(lastLoadTime)}
    ${this.generateLoadingAndError()}
    ${this.generateContent()}
    <script>
        ${this.getJavaScriptCode(devMode)}
    </script>
</body>
</html>`;
    }

    static generateHeader(lastLoadTime: string | null): string {
        return /*html*/ `
    <div class="header">
        <div class="title" id="top-level-title">Scientific Data Viewer <small>v0.3.0</small></div>
        <div class="controls" id="header-controls">
            ${this.generateTimestamp(lastLoadTime)}
            <div class="tree-controls">
                <button id="expandAllButton" class="tree-control-button" title="Expand all sections">📂 Expand All</button>
                <button id="collapseAllButton" class="tree-control-button" title="Collapse all sections">📁 Collapse All</button>
            </div>
            <button id="refreshButton">Refresh</button>
        </div>
    </div>`;
    }

    static generateTimestamp(lastLoadTime: string | null): string {
        return /*html*/ `
        <div id="timestamp" class="timestamp hidden">
            <span class="timestamp-icon">🕒</span>
            <span id="timestampText">Last loaded: ${
                lastLoadTime ? this.formatTimestamp(lastLoadTime) : '--'
            }</span>
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
                <div id="filePathContainer" class="file-path-container hidden">
                    <p><strong>File Path:</strong></p>
                    <button id="copyPathButton" class="copy-button">
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
        <div id="group-info-container" class="group-info-container hidden"></div>
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
        <div class="info-section hidden">
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
                    <button id="textCopyButton" class="text-copy-button hidden">
                        📋 Copy
                    </button>
                    <div id="textRepresentation" class="text-representation"></div>
                </div>
            </details>
        </div>`;
    }

    static generateTextRepresentationForGroups(): string {
        return /*html*/ `
        <div class="info-section hidden">
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
                            <button id="pythonPathCopyButton" class="troubleshooting-copy-button hidden">
                                📋 Copy
                            </button>
                            <div id="pythonPath" class="troubleshooting-content">
                                Loading Python path...
                            </div>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Extension Configuration</summary>
                            <button id="extensionConfigCopyButton" class="troubleshooting-copy-button hidden">
                                📋 Copy
                            </button>
                            <div id="extensionConfig" class="troubleshooting-content">
                                Loading configuration...
                            </div>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Show xarray version information</summary>
                            <button id="showVersionsCopyButton" class="troubleshooting-copy-button hidden">
                                📋 Copy
                            </button>
                            <div id="showVersions" class="troubleshooting-content">
                                Loading version information...
                            </div>
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
                    <button id="plotAllButton" class="plot-control-button" title="Not optimized for large datasets, can cause crashes">⚠️ Plot All</button>
                    <button id="resetAllPlotsButton" class="plot-control-button">Reset All Plots</button>
                    <button id="saveAllPlotsButton" class="plot-control-button">Save All Plots</button>
                </div>
                <div 
                    id="plotAllProgress" 
                    class="plot-progress hidden" 
                >
                    Progress: 0/0 (0%)
                </div>
            </details>
        </div>`;
    }
}
