/**
 * CSS generation utilities to separate styles from the main panel
 */
export class CSSGenerator {
    static getStyles(): string {
        return [
            this.getBaseStyles(),
            this.getHeaderStyles(),
            this.getButtonStyles(),
            this.getFormStyles(),
            this.getInfoSectionStyles(),
            this.getDataTableStyles(),
            this.getRepresentationStyles(),
            this.getTroubleshootingStyles(),
            this.getPlottingStyles()
        ].join('\n');
    }

    private static getBaseStyles(): string {
        return `
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            font-weight: var(--vscode-font-weight);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
            line-height: 1.5;
        }
        
        * {
            box-sizing: border-box;
        }
        
        .hidden {
            display: none !important;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .error {
            color: #ff6b6b;
            background-color: #2d1b1b;
            border: 2px solid #ff6b6b;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            font-weight: 500;
            box-shadow: 0 2px 8px rgba(255, 107, 107, 0.2);
        }
        
        .error h3 {
            color: #ff6b6b;
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 1.2em;
        }
        
        .error p {
            margin: 8px 0;
            line-height: 1.5;
        }
        
        .error strong {
            color: #ff8a8a;
        }
        
        .error code {
            background-color: #1a0f0f;
            color: #ffa8a8;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
        }
        
        .error ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .error li {
            margin: 5px 0;
            line-height: 1.4;
        }`;
    }

    private static getHeaderStyles(): string {
        return `
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .title {
            font-size: 1.5em;
            font-weight: bold;
        }
        
        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .timestamp {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-left: 10px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .timestamp-icon {
            font-size: 0.8em;
        }`;
    }

    private static getButtonStyles(): string {
        return `
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: inherit;
            transition: background-color 0.2s ease;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }
        
        .copy-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            min-width: 60px;
        }
        
        .copy-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .copy-button.copied {
            background-color: var(--vscode-charts-green);
            color: var(--vscode-foreground);
        }`;
    }

    private static getFormStyles(): string {
        return `
        select {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: inherit;
        }
        
        select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }`;
    }

    private static getInfoSectionStyles(): string {
        return `
        .info-section {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .info-section h3 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }

        .info-section h4 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }
        
        .dimensions, .variables, .coordinates {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
            margin-top: 10px;
        }
        
        .dimension-item, .variable-item {
            padding: 6px 8px;
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
        }
        
        .variable-row {
            display: flex;
            flex-direction: column;
            gap: 0;
            margin-bottom: 8px;
        }
        
        .dimension-item:hover, .variable-item:hover {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        
        .variable-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }
        
        .variable-item {
            display: flex;
            align-items: center;
            gap: 0;
            flex-wrap: wrap;
            flex: 1;
        }
        
        
        .variable-item .variable-name {
            font-weight: bold;
            flex: 1;
            min-width: 120px;
            padding-right: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .variable-item .dtype-shape {
            flex: 1;
            min-width: 100px;
            padding: 0 12px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .variable-item .dims {
            flex: 1;
            min-width: 100px;
            padding: 0 12px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .variable-item .size {
            flex: 1;
            min-width: 80px;
            padding-left: 12px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            text-align: right;
        }
        
        /* Responsive design for small screens */
        @media (max-width: 768px) {
            .variable-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 1px;
                padding: 4px 8px;
            }
            
            .variable-item .variable-name,
            .variable-item .dtype-shape,
            .variable-item .dims,
            .variable-item .size {
                flex: none;
                min-width: auto;
                width: 100%;
                padding: 1px 0;
                text-align: left;
                line-height: 1.2;
            }
            
            .variable-item .size {
                text-align: right;
            }
        }
        
        /* For very small screens, make it even more compact */
        @media (max-width: 480px) {
            .variable-item {
                padding: 3px 6px;
                gap: 0;
            }
            
            .variable-item .variable-name,
            .variable-item .dtype-shape,
            .variable-item .dims,
            .variable-item .size {
                padding: 0.5px 0;
                line-height: 1.1;
            }
            
            .variable-item .variable-name {
                font-size: 0.95em;
            }
            
            .variable-item .dtype-shape,
            .variable-item .dims,
            .variable-item .size {
                font-size: 0.85em;
            }
            
            .variable-plot-controls {
                padding: 6px;
            }
        }`;
    }

    private static getDataTableStyles(): string {
        return `
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        
        .data-table th, .data-table td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
        }
        
        .data-table th {
            background-color: var(--vscode-list-hoverBackground);
            font-weight: bold;
        }
        
        .file-path-container {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 8px 0;
        }
        
        .file-path-code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
            padding: 4px 8px;
            border-radius: 3px;
            border: 1px solid var(--vscode-panel-border);
            flex: 1;
            word-break: break-all;
            font-size: 12px;
        }`;
    }

    private static getRepresentationStyles(): string {
        return `
        .html-representation {
            max-height: 500px;
            overflow: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            font-size: 12px;
        }
        
        .html-representation table {
            width: 100%;
            border-collapse: collapse;
            margin: 5px 0;
        }
        
        .html-representation th, .html-representation td {
            border: 1px solid var(--vscode-panel-border);
            padding: 4px 8px;
            text-align: left;
            font-size: 11px;
        }
        
        .html-representation th {
            background-color: var(--vscode-list-hoverBackground);
            font-weight: bold;
        }
        
        .text-representation {
            max-height: 400px;
            overflow: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
            font-size: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .text-representation-container {
            position: relative;
        }
        
        .text-copy-button {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            z-index: 10;
        }
        
        .text-copy-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .text-copy-button.copied {
            background-color: var(--vscode-charts-green);
            color: var(--vscode-foreground);
        }`;
    }

    private static getTroubleshootingStyles(): string {
        return `
        .troubleshooting-section {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .troubleshooting-section h3 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }
        
        .troubleshooting-content {
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
            font-size: 11px;
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textPreformat-foreground);
            padding: 10px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
            max-height: 300px;
            overflow: auto;
        }
        
        .troubleshooting-content-container {
            position: relative;
        }
        
        .troubleshooting-copy-button {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
            z-index: 10;
        }
        
        .troubleshooting-copy-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .troubleshooting-copy-button.copied {
            background-color: var(--vscode-charts-green);
            color: var(--vscode-foreground);
        }
        
        details summary {
            cursor: pointer;
            padding: 8px 0;
            font-weight: 500;
            color: var(--vscode-foreground);
        }
        
        details summary:hover {
            color: var(--vscode-button-hoverBackground);
        }
        
        details[open] summary {
            margin-bottom: 10px;
        }`;
    }

    private static getPlottingStyles(): string {
        return `
        .plot-container {
            margin: 20px 0;
            text-align: center;
        }
        
        .plot-container img {
            max-width: 100%;
            height: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .plot-controls {
            display: flex;
            gap: 10px;
            margin: 15px 0;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .plot-control-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .plot-control-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .plot-control-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
            opacity: 0.6;
        }
        
        .plot-error {
            color: #ff6b6b;
            background-color: #2d1b1b;
            border: 1px solid #ff6b6b;
            padding: 12px;
            border-radius: 4px;
            margin: 10px 0;
            font-weight: 500;
            text-align: center;
        }
        
        .plot-error.success {
            color: #4caf50;
            background-color: #1b2d1b;
            border: 1px solid #4caf50;
        }
        
        .plot-error.hidden {
            display: none;
        }
        
        .error-content {
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }
        
        .error-message {
            flex: 1;
            text-align: left;
        }
        
        .error-copy-button {
            background-color: transparent;
            color: inherit;
            border: 1px solid currentColor;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            white-space: nowrap;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }
        
        .error-copy-button:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }
        
        /* Per-variable plot controls */
        .variable-plot-controls {
            padding: 6px 8px;
            background-color: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
            margin-top: 2px;
        }
        
        .plot-controls-row {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .plot-type-select {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
        }
        
        .create-plot-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s ease;
        }
        
        .create-plot-button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .create-plot-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }
        
        .plot-image-container {
            text-align: center;
            margin: 10px 0;
        }
        
        .plot-image-container img {
            max-width: 100%;
            height: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .plot-actions {
            display: flex;
            gap: 8px;
            margin: 10px 0;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .plot-action-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            transition: background-color 0.2s ease;
        }
        
        .plot-action-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .plot-action-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
            opacity: 0.6;
        }
        
        .global-plot-controls {
            display: flex;
            gap: 10px;
            margin: 10px 0;
            justify-content: center;
            flex-wrap: wrap;
        }`;
    }
}

