import { Logger } from '../common/Logger';

/**
 * Interface for theme color definitions
 */
interface ThemeColors {
    foreground: string;
    editorBackground: string;
    editorForeground: string;
    panelBackground: string;
    panelBorder: string;
    buttonBackground: string;
    buttonForeground: string;
    inputBackground: string;
    inputForeground: string;
    inputBorder: string;
    listHoverBackground: string;
    listActiveSelectionBackground: string;
    listActiveSelectionForeground: string;
    listInactiveSelectionBackground: string;
    listInactiveSelectionForeground: string;
    errorForeground: string;
    descriptionForeground: string;
    textCodeBlockBackground: string;
    textPreformatForeground: string;
}

/**
 * Theme manager for handling VS Code theme operations
 */
export class ThemeManager {
    /**
     * Apply theme overrides to webview HTML content
     */
    static applyThemeToWebviewContent(
        htmlContent: string,
        exportTheme: string,
    ): string {
        // If no theme is specified, don't apply any theme
        if (!exportTheme || exportTheme.trim() === '') {
            return htmlContent;
        }

        // I am not really proud of this part, but it works for now
        // String replacement does the job to fix the HTML theme.

        // Maybe in the future we will have a true webview export by creating one from scratch
        // and not revealing the webview panel

        // Implementations notes
        // - Remove existing style in the html tag
        // - Insert the theme CSS at the beginning of the SDV's style tag
        // The SDV CSS code does not use the vscode-dark or vscode-light indicators.
        // However xarray does:
        // >   body.vscode-dark -> overrides xarray CSS variables to use dark mode
        // So, we must artificially set the class to the actual theme being exported.
        // > <body role="document" class="vscode-light" data-vscode-theme-kind="vscode-light" data-vscode-theme-name="Solarized Light" data-vscode-theme-id="Solarized Light">
        // > <body role="document" class="vscode-dark" data-vscode-theme-kind="vscode-dark" data-vscode-theme-name="Monokai" data-vscode-theme-id="Monokai">
        // We can ignore data-vscode-theme-name and data-vscode-theme-id when replacing the body tag.
        // They will be irrelevant. They can be removed at some point if this causes issues.

        // Generate theme-specific CSS variables
        const themeCSS = ThemeManager.generateThemeCSSVariables(exportTheme);
        const themeMode = ThemeManager.getThemeMode(exportTheme);
        const sdvStyleTag = '<style id="scientific-data-viewer-style">';
        return (
            '<!DOCTYPE html><html lang="en">' +
            htmlContent
                .substring(htmlContent.indexOf('<head>')) // just after the html tag
                .replace(sdvStyleTag, sdvStyleTag + '\n' + themeCSS)
                .replaceAll(
                    '"vscode-dark"', // quotes are needed to not overwrite the xarray body.vscode-dark section
                    `"vscode-${themeMode}"`,
                )
                .replaceAll(
                    '"vscode-light"', // quotes are needed to not overwrite the xarray body.vscode-dark section
                    `"vscode-${themeMode}"`,
                )
        );
    }

    /**
     * Generate CSS variables for a specific theme
     * Uses predefined color sets for common VS Code themes
     */
    private static generateThemeCSSVariables(themeName: string): string {
        if (!themeName || themeName.trim() === '') {
            // Return empty string to use default VS Code variables
            return '';
        }
        const themeColors = this.getThemeColorSet(themeName);
        if (!themeColors) {
            Logger.warn(
                `Unknown theme: ${themeName}, return empty string to use default VS Code variables`,
            );
            return '';
        }

        Logger.debug(`Generating CSS variables for theme: ${themeName}`);

        return `
    /* Theme override for: ${themeName} */
    :root {
        --vscode-foreground: ${themeColors.foreground};
        --vscode-editor-background: ${themeColors.editorBackground};
        --vscode-editor-foreground: ${themeColors.editorForeground};
        --vscode-panel-background: ${themeColors.panelBackground};
        --vscode-panel-border: ${themeColors.panelBorder};
        --vscode-button-background: ${themeColors.buttonBackground};
        --vscode-button-foreground: ${themeColors.buttonForeground};
        --vscode-input-background: ${themeColors.inputBackground};
        --vscode-input-foreground: ${themeColors.inputForeground};
        --vscode-input-border: ${themeColors.inputBorder};
        --vscode-list-hoverBackground: ${themeColors.listHoverBackground};
        --vscode-list-activeSelectionBackground: ${themeColors.listActiveSelectionBackground};
        --vscode-list-activeSelectionForeground: ${themeColors.listActiveSelectionForeground};
        --vscode-list-inactiveSelectionBackground: ${themeColors.listInactiveSelectionBackground};
        --vscode-list-inactiveSelectionForeground: ${themeColors.listInactiveSelectionForeground};
        --vscode-errorForeground: ${themeColors.errorForeground};
        --vscode-descriptionForeground: ${themeColors.descriptionForeground};
        --vscode-textCodeBlock-background: ${themeColors.textCodeBlockBackground};
        --vscode-textPreformat-foreground: ${themeColors.textPreformatForeground};
        --vscode-editor-font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        --vscode-font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        --vscode-font-size: 13px;
        --vscode-font-weight: normal;
    }
    `;
    }

    private static getThemeMode(themeName: string): 'dark' | 'light' {
        // Empirical observation.
        // Relies on the fact that all theme names include 'Dark or 'Light'.
        return ThemeManager.normalizeThemeName(themeName).includes('dark')
            ? 'dark'
            : 'light';
    }

    /**
     * Get color set for a specific theme
     */
    private static getThemeColorSet(themeName: string): ThemeColors | null {
        // Common VS Code themes
        const themes: { [key: string]: ThemeColors } = {
            'default dark+': {
                foreground: '#d4d4d4',
                editorBackground: '#1e1e1e',
                editorForeground: '#d4d4d4',
                panelBackground: '#252526',
                panelBorder: '#3c3c3c',
                buttonBackground: '#0e639c',
                buttonForeground: '#ffffff',
                inputBackground: '#3c3c3c',
                inputForeground: '#cccccc',
                inputBorder: '#3c3c3c',
                listHoverBackground: '#2a2d2e',
                listActiveSelectionBackground: '#094771',
                listActiveSelectionForeground: '#ffffff',
                listInactiveSelectionBackground: '#3c3c3c',
                listInactiveSelectionForeground: '#cccccc',
                errorForeground: '#f48771',
                descriptionForeground: '#cccccc',
                textCodeBlockBackground: '#1e1e1e',
                textPreformatForeground: '#d4d4d4',
            },
            'default light+': {
                foreground: '#333333',
                editorBackground: '#ffffff',
                editorForeground: '#333333',
                panelBackground: '#f3f3f3',
                panelBorder: '#e1e1e1',
                buttonBackground: '#0078d4',
                buttonForeground: '#ffffff',
                inputBackground: '#ffffff',
                inputForeground: '#333333',
                inputBorder: '#cecece',
                listHoverBackground: '#e8e8e8',
                listActiveSelectionBackground: '#0078d4',
                listActiveSelectionForeground: '#ffffff',
                listInactiveSelectionBackground: '#e4e6ea',
                listInactiveSelectionForeground: '#333333',
                errorForeground: '#a1260d',
                descriptionForeground: '#666666',
                textCodeBlockBackground: '#f8f8f8',
                textPreformatForeground: '#333333',
            },
            'solarized dark': {
                foreground: '#839496',
                editorBackground: '#002b36',
                editorForeground: '#839496',
                panelBackground: '#073642',
                panelBorder: '#586e75',
                buttonBackground: '#268bd2',
                buttonForeground: '#fdf6e3',
                inputBackground: '#073642',
                inputForeground: '#839496',
                inputBorder: '#586e75',
                listHoverBackground: '#073642',
                listActiveSelectionBackground: '#268bd2',
                listActiveSelectionForeground: '#fdf6e3',
                listInactiveSelectionBackground: '#073642',
                listInactiveSelectionForeground: '#839496',
                errorForeground: '#dc322f',
                descriptionForeground: '#93a1a1',
                textCodeBlockBackground: '#002b36',
                textPreformatForeground: '#839496',
            },
            'solarized light': {
                foreground: '#586e75',
                editorBackground: '#fdf6e3',
                editorForeground: '#586e75',
                panelBackground: '#eee8d5',
                panelBorder: '#93a1a1',
                buttonBackground: '#268bd2',
                buttonForeground: '#fdf6e3',
                inputBackground: '#fdf6e3',
                inputForeground: '#586e75',
                inputBorder: '#93a1a1',
                listHoverBackground: '#eee8d5',
                listActiveSelectionBackground: '#268bd2',
                listActiveSelectionForeground: '#fdf6e3',
                listInactiveSelectionBackground: '#eee8d5',
                listInactiveSelectionForeground: '#586e75',
                errorForeground: '#dc322f',
                descriptionForeground: '#93a1a1',
                textCodeBlockBackground: '#fdf6e3',
                textPreformatForeground: '#586e75',
            },
            'high contrast dark': {
                foreground: '#ffffff',
                editorBackground: '#000000',
                editorForeground: '#ffffff',
                panelBackground: '#000000',
                panelBorder: '#ffffff',
                buttonBackground: '#ffffff',
                buttonForeground: '#000000',
                inputBackground: '#000000',
                inputForeground: '#ffffff',
                inputBorder: '#ffffff',
                listHoverBackground: '#000000',
                listActiveSelectionBackground: '#ffffff',
                listActiveSelectionForeground: '#000000',
                listInactiveSelectionBackground: '#000000',
                listInactiveSelectionForeground: '#ffffff',
                errorForeground: '#ff6b6b',
                descriptionForeground: '#ffffff',
                textCodeBlockBackground: '#000000',
                textPreformatForeground: '#ffffff',
            },
            'high contrast light': {
                foreground: '#000000',
                editorBackground: '#ffffff',
                editorForeground: '#000000',
                panelBackground: '#ffffff',
                panelBorder: '#000000',
                buttonBackground: '#000000',
                buttonForeground: '#ffffff',
                inputBackground: '#ffffff',
                inputForeground: '#000000',
                inputBorder: '#000000',
                listHoverBackground: '#ffffff',
                listActiveSelectionBackground: '#000000',
                listActiveSelectionForeground: '#ffffff',
                listInactiveSelectionBackground: '#ffffff',
                listInactiveSelectionForeground: '#000000',
                errorForeground: '#ff6b6b',
                descriptionForeground: '#000000',
                textCodeBlockBackground: '#ffffff',
                textPreformatForeground: '#000000',
            },
        };

        return themes[ThemeManager.normalizeThemeName(themeName)] || null;
    }

    private static normalizeThemeName(themeName: string) {
        return themeName.toLowerCase().trim();
    }
}
