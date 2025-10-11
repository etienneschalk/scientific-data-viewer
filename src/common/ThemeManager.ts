import * as vscode from 'vscode';
import { Logger } from './Logger';

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
     * Get all available VS Code themes
     */
    static async getAvailableThemes(): Promise<vscode.ColorTheme[]> {
        try {
            // Get all installed extensions that contribute themes
            const extensions = vscode.extensions.all;
            const themes: vscode.ColorTheme[] = [];
            
            // Get the current theme
            const currentTheme = vscode.window.activeColorTheme;
            themes.push(currentTheme);
            
            // Note: VS Code doesn't provide a direct API to list all themes
            // We can only access the current theme and its properties
            Logger.debug(`Current theme kind: ${currentTheme.kind}`);
            
            return themes;
        } catch (error) {
            Logger.error(`Failed to get available themes: ${error}`);
            return [];
        }
    }

    /**
     * Check if a theme exists by name
     */
    static async isThemeValid(themeName: string): Promise<boolean> {
        if (!themeName || themeName.trim() === '') {
            return false;
        }
        
        try {
            // VS Code doesn't provide a direct way to validate theme names
            // We'll return true for now and let the CSS generation handle invalid themes
            return true;
        } catch (error) {
            Logger.error(`Failed to validate theme: ${error}`);
            return false;
        }
    }

    /**
     * Generate CSS variables for a specific theme
     * Uses predefined color sets for common VS Code themes
     */
    static generateThemeCSSVariables(themeName?: string): string {
        if (!themeName || themeName.trim() === '') {
            // Return empty string to use default VS Code variables
            return '';
        }

        Logger.debug(`Generating CSS variables for theme: ${themeName}`);
        
        // Predefined theme color sets
        const themeColors = this.getThemeColorSet(themeName);
        if (!themeColors) {
            Logger.warn(`Unknown theme: ${themeName}, using default dark theme`);
            return this.generateThemeCSSVariables('Default Dark+');
        }

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

    /**
     * Get color set for a specific theme
     */
    private static getThemeColorSet(themeName: string): ThemeColors | null {
        const normalizedName = themeName.toLowerCase().trim();
        
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
                textPreformatForeground: '#d4d4d4'
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
                textPreformatForeground: '#333333'
            },
            'monokai dark': {
                foreground: '#f8f8f2',
                editorBackground: '#272822',
                editorForeground: '#f8f8f2',
                panelBackground: '#2f3129',
                panelBorder: '#3e3d32',
                buttonBackground: '#a6e22e',
                buttonForeground: '#272822',
                inputBackground: '#3e3d32',
                inputForeground: '#f8f8f2',
                inputBorder: '#3e3d32',
                listHoverBackground: '#3e3d32',
                listActiveSelectionBackground: '#a6e22e',
                listActiveSelectionForeground: '#272822',
                listInactiveSelectionBackground: '#3e3d32',
                listInactiveSelectionForeground: '#f8f8f2',
                errorForeground: '#f92672',
                descriptionForeground: '#75715e',
                textCodeBlockBackground: '#272822',
                textPreformatForeground: '#f8f8f2'
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
                textPreformatForeground: '#839496'
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
                textPreformatForeground: '#586e75'
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
                textPreformatForeground: '#ffffff'
            }
        };

        return themes[normalizedName] || null;
    }

    public static getThemeMode(themeName: string): 'dark' | 'light' {
        // Empirical observation. Must add explicitly "Dark" or "Light" to the theme name.
        return themeName.toLowerCase().trim().includes('dark') ? 'dark' : 'light';
    }

    /**
     * Get the current theme's CSS variables as a string
     */
    static getCurrentThemeCSSVariables(): string {
        const currentTheme = vscode.window.activeColorTheme;
        Logger.debug(`Getting CSS variables for current theme kind: ${currentTheme.kind}`);
        
        // For now, return empty string to use the default VS Code CSS variables
        // In a real implementation, you would extract the actual color values from the theme
        return '';
    }

    /**
     * Generate CSS for theme override in exported HTML
     */
    static generateExportThemeCSS(themeName?: string): string {
        if (!themeName || themeName.trim() === '') {
            // Use current theme variables
            return this.getCurrentThemeCSSVariables();
        }

        // Generate CSS variables for the specified theme
        return this.generateThemeCSSVariables(themeName);
    }
}
