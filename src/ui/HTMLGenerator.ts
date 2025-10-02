import { CSSGenerator } from './CSSGenerator';
import { JavaScriptGenerator } from './JavaScriptGenerator';

/**
 * HTML generation utilities to break down the monolithic DataViewerPanel
 */
export class HTMLGenerator {
    static generateMainHTML(plottingCapabilities: boolean, content: string, devMode: boolean): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scientific Data Viewer</title>
    <style>
        ${this.getCSSStyles(devMode)}
    </style>
</head>
<body>
    ${content}
    <script>
        ${this.getJavaScriptCode(plottingCapabilities)}
    </script>
</body>
</html>`;
    }

    static generateHeader(plottingCapabilities: boolean, lastLoadTime: string | null): string {
        return `
    <div class="header">
        <div class="title" id="title">Scientific Data Viewer <small>v0.3.0</small></div>
        <div class="controls">
            ${this.generateTimestamp(lastLoadTime)}
            <button id="refreshButton">Refresh</button>
        </div>
    </div>`;
    }

    static generateTimestamp(lastLoadTime: string | null): string {
        if (!lastLoadTime) {
            return '<div id="timestamp" class="timestamp hidden"><span class="timestamp-icon">🕒</span><span id="timestampText">Last loaded: --</span></div>';
        }
        
        return `
        <div id="timestamp" class="timestamp">
            <span class="timestamp-icon">🕒</span>
            <span id="timestampText">Last loaded: ${this.formatTimestamp(lastLoadTime)}</span>
        </div>`;
    }

    static generateLoadingAndError(): string {
        return `
    <div id="loading" class="loading">Loading data...</div>
    <div id="error" class="error hidden"></div>`;
    }

    static generateContent(plottingCapabilities: boolean): string {
        return `
    <div id="content" class="hidden">
        ${this.generateFileInfo()}
        ${this.generateHtmlRepresentation()}
        ${this.generateTextRepresentation()}
        ${this.generateHtmlRepresentationForGroups()}
        ${this.generateTextRepresentationForGroups()}
        ${this.generatePlottingSections(plottingCapabilities)}
        ${this.generateDimensionsAndVariables(plottingCapabilities)}
        ${this.generateTroubleshooting()}
    </div>`;
    }

    static generateFileInfo(): string {
        return `
        <div class="info-section">
            <details class="sticky-group-details" open> <summary><h3>File Information</h3></summary>
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

    static generateDimensionsAndVariables(plottingCapabilities: boolean): string {
        return `
        <div id="group-info-container" class="group-info-container hidden">
        <!-- This is for datatree groups -->
        </div>
        <!-- This is for non-datatree groups -->
        <div class="info-section">
            <details class="sticky-group-details" open> <summary><h3>Dimensions</h3></summary>
                <div id="dimensions" class="dimensions"></div>
            </details>
        </div>

        <div class="info-section">
            <details class="sticky-group-details" open> <summary><h3>Coordinates</h3></summary>
                <div id="coordinates" class="coordinates"></div>
            </details>
        </div>
        
        <div class="info-section">
            <details class="sticky-group-details" open> <summary><h3>Variables</h3></summary>
                <div id="variables" class="variables"></div>
            </details>
        </div>`;
    }

    static generateHtmlRepresentation(): string {
        return `
        <div class="info-section">
            <details class="sticky-group-details" open> <summary><h3>Xarray HTML Representation</h3></summary>
                <div id="htmlRepresentation" class="html-representation"></div>
            </details>
        </div>`;
    }

    static generateHtmlRepresentationForGroups(): string {
        return `
        <div class="info-section hidden">
            <details class="sticky-group-details"> <summary><h3>Xarray HTML Representation (for each group)</h3></summary>
                <div id="htmlRepresentationForGroups" class="html-representation-for-groups"></div>
            </details>
        </div>`;
    }

    static generateTextRepresentation(): string {
        return `
        <div class="info-section">
            <details class="sticky-group-details"> <summary><h3>Xarray Text Representation</h3></summary>
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
        return `
        <div class="info-section hidden">
            <details class="sticky-group-details"> <summary><h3>Xarray Text Representation (for each group)</h3></summary>
                <div id="textRepresentationForGroups" class="text-representation-for-groups"></div>
            </details>
        </div>`;
    }

    static generateTroubleshooting(): string {
        return `
        <div class="info-section">
            <details class="sticky-group-details"> <summary><h3>Troubleshooting</h3></summary>
                <div class="info-section">
                    <details open>
                        <summary>Python Interpreter Path</summary>
                            <button id="pythonPathCopyButton" class="troubleshooting-copy-button hidden">
                                📋 Copy
                            </button>
                            <div id="pythonPath" class="troubleshooting-content">Loading Python path...</div>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Extension Configuration</summary>
                            <button id="extensionConfigCopyButton" class="troubleshooting-copy-button hidden">
                                📋 Copy
                            </button>
                            <div id="extensionConfig" class="troubleshooting-content">Loading configuration...</div>
                    </details>
                </div>
                <div class="info-section">
                    <details open>
                        <summary>Show xarray version information</summary>
                            <button id="showVersionsCopyButton" class="troubleshooting-copy-button hidden">
                                📋 Copy
                            </button>
                            <div id="showVersions" class="troubleshooting-content">Loading version information...</div>
                    </details>
                </div>
            </details>
        </div>`;
    }

    static generatePlottingSections(plottingCapabilities: boolean): string {
        if (!plottingCapabilities) {
            return '';
        }
        
        return `
        <div class="info-section">
            <details class="sticky-group-details"> <summary><h3>Global Plot Controls</h3></summary>
                <div class="global-plot-controls">
                    <button id="plotAllButton" class="plot-control-button" title="Not optimized for large datasets, can cause crashes">⚠️ Plot All</button>
                    <button id="resetAllPlotsButton" class="plot-control-button">Reset All Plots</button>
                    <button id="saveAllPlotsButton" class="plot-control-button">Save All Plots</button>
                </div>
                <div id="plotAllProgress" class="plot-progress hidden" style="margin-top: 10px; padding: 8px; background-color: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 14px; color: var(--vscode-foreground);">
                    Progress: 0/0 (0%)
                </div>
            </details>
        </div>`;
    }

    private static formatTimestamp(isoString: string): string {
        const date = new Date(isoString);
        return date.toLocaleTimeString();
    }

    private static getCSSStyles(devMode: boolean): string {
        return CSSGenerator.getStyles(devMode);
    }


    private static getJavaScriptCode(plottingCapabilities: boolean): string {
        return JavaScriptGenerator.getCode(plottingCapabilities);
    }
}
