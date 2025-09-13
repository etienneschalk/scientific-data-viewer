import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * Interface for feature flag definitions
 */
export interface FeatureFlagDefinition {
    /** The default value for the feature flag */
    default: boolean;
    /** Description of what the feature flag does */
    description: string;
    /** Whether this is an experimental feature that might be dangerous */
    experimental?: boolean;
    /** Markdown description with additional details and warnings */
    markdownDescription?: string;
}

/**
 * Registry of all available feature flags
 * Maps the configuration key to the flag definition
 */
export const FEATURE_FLAGS: Record<string, FeatureFlagDefinition> = {
    'allowMultipleTabsForSameFile': {
        default: false,
        description: "Allow opening multiple tabs for the same file. When enabled, each 'Open in Data Viewer' action creates a new tab. When disabled (default), focuses on existing tab if file is already open.",
        experimental: true,
        markdownDescription: "**Experimental Feature** - Allow opening multiple tabs for the same file. When enabled, each 'Open in Data Viewer' action creates a new tab. When disabled (default), focuses on existing tab if file is already open.\n\n⚠️ **Warning**: This feature is experimental and may cause unexpected behavior or performance issues."
    }
};

/**
 * Manager class for handling feature flags in the VSCode extension
 */
export class FeatureFlagsManager {
    private static instance: FeatureFlagsManager;
    private configuration: vscode.WorkspaceConfiguration;
    private _disposables: vscode.Disposable[] = [];
    private _onConfigurationChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    private constructor() {
        this.configuration = vscode.workspace.getConfiguration('scientificDataViewer');
        this._setupConfigurationListener();
    }

    /**
     * Get the singleton instance of the FeatureFlagsManager
     */
    public static getInstance(): FeatureFlagsManager {
        if (!FeatureFlagsManager.instance) {
            FeatureFlagsManager.instance = new FeatureFlagsManager();
        }
        return FeatureFlagsManager.instance;
    }

    /**
     * Event that fires when configuration changes
     */
    public get onConfigurationChanged(): vscode.Event<void> {
        return this._onConfigurationChanged.event;
    }

    /**
     * Set up configuration change listener
     */
    private _setupConfigurationListener(): void {
        const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('scientificDataViewer')) {
                Logger.info('Scientific Data Viewer configuration changed, refreshing feature flags...');
                this.refresh();
                this._onConfigurationChanged.fire();
            }
        });
        
        this._disposables.push(configChangeListener);
    }

    /**
     * Check if a feature flag is enabled
     * @param flagName The name of the feature flag to check (e.g., 'allowMultipleTabsForSameFile')
     * @returns true if the feature flag is enabled, false otherwise
     */
    public isEnabled(flagName: string): boolean {
        try {
            const flagValue = this.configuration.get(flagName);
            
            // If the flag is explicitly set, use that value
            if (typeof flagValue === 'boolean') {
                return flagValue;
            }
            
            // Otherwise, use the default value from the registry
            const flagDefinition = FEATURE_FLAGS[flagName];
            if (flagDefinition) {
                return flagDefinition.default;
            }
            
            // If flag is not found in registry, log a warning and return false
            Logger.warn(`Feature flag '${flagName}' not found in registry. Defaulting to false.`);
            return false;
        } catch (error) {
            Logger.error(`Error checking feature flag '${flagName}': ${error}`);
            return false;
        }
    }

    /**
     * Get all feature flags with their current values
     * @returns Object containing all feature flags and their values
     */
    public getAllFlags(): Record<string, boolean> {
        const result: Record<string, boolean> = {};
        
        for (const flagName of Object.keys(FEATURE_FLAGS)) {
            result[flagName] = this.isEnabled(flagName);
        }
        
        return result;
    }

    /**
     * Get the definition of a specific feature flag
     * @param flagName The name of the feature flag
     * @returns The feature flag definition or undefined if not found
     */
    public getFlagDefinition(flagName: string): FeatureFlagDefinition | undefined {
        return FEATURE_FLAGS[flagName];
    }

    /**
     * Check if a feature flag is experimental
     * @param flagName The name of the feature flag to check
     * @returns true if the feature flag is experimental, false otherwise
     */
    public isExperimental(flagName: string): boolean {
        const definition = this.getFlagDefinition(flagName);
        return definition?.experimental === true;
    }

    /**
     * Get all experimental feature flags that are currently enabled
     * @returns Array of experimental feature flag names that are enabled
     */
    public getEnabledExperimentalFlags(): string[] {
        const enabledFlags: string[] = [];
        
        for (const [flagName, definition] of Object.entries(FEATURE_FLAGS)) {
            if (definition.experimental && this.isEnabled(flagName)) {
                enabledFlags.push(flagName);
            }
        }
        
        return enabledFlags;
    }

    /**
     * Log a warning if any experimental features are enabled
     */
    public logExperimentalWarnings(): void {
        const enabledExperimentalFlags = this.getEnabledExperimentalFlags();
        
        if (enabledExperimentalFlags.length > 0) {
            Logger.warn(`Experimental features enabled: ${enabledExperimentalFlags.join(', ')}`);
            Logger.warn('Experimental features may cause unexpected behavior or performance issues. Use with caution.');
        }
    }

    /**
     * Refresh the configuration (useful when settings change)
     */
    public refresh(): void {
        this.configuration = vscode.workspace.getConfiguration('scientificDataViewer');
    }

    /**
     * Dispose of the feature flags manager and clean up listeners
     */
    public dispose(): void {
        this._onConfigurationChanged.dispose();
        this._disposables.forEach(disposable => disposable.dispose());
        this._disposables = [];
    }

    /**
     * Get a human-readable description of all feature flags
     * @returns Formatted string describing all feature flags
     */
    public getFeatureFlagsDescription(): string {
        const lines: string[] = [];
        lines.push('Available Feature Flags:');
        lines.push('');
        
        for (const [flagName, definition] of Object.entries(FEATURE_FLAGS)) {
            const status = this.isEnabled(flagName) ? '✅ Enabled' : '❌ Disabled';
            const experimental = definition.experimental ? ' (Experimental)' : '';
            lines.push(`• ${flagName}${experimental}: ${status}`);
            lines.push(`  ${definition.description}`);
            lines.push('');
        }
        
        return lines.join('\n');
    }
}
