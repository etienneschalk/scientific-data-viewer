import { CSSGenerator } from './CSSGenerator';
import { JavaScriptGenerator } from './JavaScriptGenerator';

/**
 * HTML generation utilities to break down the monolithic DataViewerPanel
 */
export class HTMLGenerator {
    static generateMainHTML(plottingCapabilities: boolean, content: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scientific Data Viewer</title>
    <style>
        ${this.getCSSStyles()}
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
        <div class="title">Scientific Data Viewer</div>
        <div class="controls">
            ${this.generateTimestamp(lastLoadTime)}
            <button id="refreshButton">Refresh</button>
        </div>
    </div>`;
    }

    static generatePlottingControls(plottingCapabilities: boolean): string {
        if (!plottingCapabilities) {
            return '';
        }
        
        return `
            <select id="variableSelect">
                <option value="">Select a variable...</option>
            </select>
            <select id="plotTypeSelect">
                <option value="auto" selected>Auto (Recommended)</option>
                <!-- <option value="line">Line Plot</option> -->
                <!-- <option value="heatmap">Heatmap</option> -->
                <!-- <option value="histogram">Histogram</option> -->
            </select>
            <button id="plotButton" disabled>Create Plot</button>`;
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
            <h3>File Information</h3>
            <div id="filePathContainer" class="file-path-container hidden">
                <p><strong>File Path:</strong></p>
                <code id="filePathCode" class="file-path-code"></code>
                <button id="copyPathButton" class="copy-button">
                    📋 Copy
                </button>
            </div>
            <div id="fileInfo"></div>
        </div>`;
    }

    static generateDimensionsAndVariables(plottingCapabilities: boolean): string {
        return `
        <div id="group-info-container" class="group-info-container hidden">
        <!-- This is for datatree groups -->
        </div>
        <!-- This is for non-datatree groups -->
        <div class="info-section">
            <h3>Dimensions</h3>
            <div id="dimensions" class="dimensions"></div>
        </div>

        <div class="info-section">
            <h3>Coordinates</h3>
            <div id="coordinates" class="coordinates"></div>
        </div>
        
        <div class="info-section">
            <h3>Variables</h3>
            <div id="variables" class="variables"></div>
        </div>`;
    }

    static generateHtmlRepresentation(): string {
        return `
        <div class="info-section">
            <h3>Xarray HTML Representation</h3>
            <div id="htmlRepresentation" class="html-representation"></div>
        </div>`;
    }

    static generateHtmlRepresentationForGroups(): string {
        return `
        <div class="info-section hidden">
            <h3>Xarray HTML Representation (for each group)</h3>
            <div id="htmlRepresentationForGroups" class="html-representation-for-groups"></div>
        </div>`;
    }

    static generateTextRepresentation(): string {
        return `
        <div class="info-section">
            <h3>Xarray Text Representation</h3>
            <div class="text-representation-container">
                <button id="textCopyButton" class="text-copy-button hidden">
                    📋 Copy
                </button>
                <div id="textRepresentation" class="text-representation"></div>
            </div>
        </div>`;
    }

    static generateTextRepresentationForGroups(): string {
        return `
        <div class="info-section hidden">
            <h3>Xarray Text Representation (for each group)</h3>
            <div id="textRepresentationForGroups" class="text-representation-for-groups"></div>
        </div>`;
    }

    static generateTroubleshooting(): string {
        return `
        <div class="troubleshooting-section">
            <h3>Troubleshooting</h3>
            <details>
                <summary>Python Interpreter Path</summary>
                <div class="troubleshooting-content-container">
                    <button id="pythonPathCopyButton" class="troubleshooting-copy-button hidden">
                        📋 Copy
                    </button>
                    <div id="pythonPath" class="troubleshooting-content">Loading Python path...</div>
                </div>
            </details>
            <details>
                <summary>Extension Configuration</summary>
                <div class="troubleshooting-content-container">
                    <button id="extensionConfigCopyButton" class="troubleshooting-copy-button hidden">
                        📋 Copy
                    </button>
                    <div id="extensionConfig" class="troubleshooting-content">Loading configuration...</div>
                </div>
            </details>
            <details>
                <summary>Show xarray version information</summary>
                <div class="troubleshooting-content-container">
                    <button id="showVersionsCopyButton" class="troubleshooting-copy-button hidden">
                        📋 Copy
                    </button>
                    <div id="showVersions" class="troubleshooting-content">Loading version information...</div>
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
            <h3>Global Plot Controls</h3>
            <div class="global-plot-controls">
                <button id="plotAllButton" class="plot-control-button">Plot All</button>
                <button id="resetAllPlotsButton" class="plot-control-button">Reset All Plots</button>
                <button id="saveAllPlotsButton" class="plot-control-button">Save All Plots</button>
            </div>
            <div id="plotAllProgress" class="plot-progress hidden" style="margin-top: 10px; padding: 8px; background-color: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-size: 14px; color: var(--vscode-foreground);">
                Progress: 0/0 (0%)
            </div>
        </div>`;
    }

    private static formatTimestamp(isoString: string): string {
        const date = new Date(isoString);
        return date.toLocaleTimeString();
    }

    private static getCSSStyles(): string {
        return CSSGenerator.getStyles();
    }


    private static getJavaScriptCode(plottingCapabilities: boolean): string {
        return JavaScriptGenerator.getCode(plottingCapabilities);
    }
}
