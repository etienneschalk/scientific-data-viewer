import * as vscode from 'vscode';
import { Logger } from './Logger';
import { DataViewerPanel } from '../DataViewerPanel';
import { PythonManager } from '../python/PythonManager';
import {
    CORE_PACKAGES,
    EXTENDED_PACKAGES,
    ExtensionVirtualEnvironmentManager,
    PLOT_PACKAGES,
} from '../python/ExtensionVirtualEnvironmentManager';
import { ErrorBoundary } from './ErrorBoundary';
import { getDisplayName, getVersion } from './vscodeutils';
import {
    getDevMode,
    getOverridePythonInterpreter,
    getUseExtensionOwnEnvironment,
    SDV_EXTENSION_ID,
} from './config';

export type HealthStatus = 'healthy' | 'warning' | 'error';

export interface HealthcheckResult {
    status: HealthStatus;
    message: string;
    details?: string;
}

export interface HealthcheckReport {
    extensionInfo: {
        name: string;
        version: string;
        timestamp: Date;
    };
    overallStatus: HealthStatus;
    issues: HealthcheckResult[];
    components: {
        panes: HealthcheckResult;
        panesWithErrors: HealthcheckResult;
        pythonEnvironment: HealthcheckResult;
        dependencies: HealthcheckResult;
        supportedFormats: HealthcheckResult;
        configuration: HealthcheckResult;
        errorBoundary: HealthcheckResult;
        memory: HealthcheckResult;
    };
    recommendations: string[];
}

const COMPONENT_LABELS: Record<keyof HealthcheckReport['components'], string> =
    {
        panes: 'Panes',
        panesWithErrors: 'Panes with Error',
        pythonEnvironment: 'Python Environment',
        dependencies: 'Dependencies',
        supportedFormats: 'Supported Formats',
        configuration: 'Configuration',
        errorBoundary: 'Error Boundary',
        memory: 'Memory Usage',
    };

/** xarray engine → package providing it. */
const FORMAT_ENGINES: Record<string, string> = {
    netcdf4: 'netCDF4',
    h5netcdf: 'h5netcdf',
    scipy: 'scipy',
    zarr: 'zarr',
    cfgrib: 'cfgrib',
    rasterio: 'rioxarray',
    cdflib: 'cdflib',
};

const STATUS_ICON: Record<HealthStatus, string> = {
    healthy: '✅',
    warning: '⚠️',
    error: '❌',
};
const STATUS_COLOR: Record<HealthStatus, string> = {
    healthy: '🟢',
    warning: '🟡',
    error: '🔴',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HIGH_HEAP_MB = 500;
const MAX_ERRORS_PER_COMPONENT = 5;

const errorDetails = (error: unknown) =>
    `Error: ${error instanceof Error ? error.message : String(error)}`;

/**
 * Run the healthcheck and build its report.
 */
export async function runHealthcheck(
    pythonManager: PythonManager,
    extensionEnvManager: ExtensionVirtualEnvironmentManager,
): Promise<HealthcheckReport> {
    Logger.info('🏥 Running healthcheck...');

    const packages = await checkPackages(pythonManager);
    const components: HealthcheckReport['components'] = {
        panes: checkPanes(),
        panesWithErrors: checkPanesWithErrors(),
        pythonEnvironment: checkPythonEnvironment(pythonManager),
        dependencies: packages.dependencies,
        supportedFormats: packages.supportedFormats,
        configuration: await checkConfiguration(extensionEnvManager),
        errorBoundary: checkErrorBoundary(),
        memory: checkMemoryUsage(),
    };
    const issues = Object.values(components).filter(
        (result) => result.status !== 'healthy',
    );
    const overallStatus: HealthStatus = issues.some(
        (issue) => issue.status === 'error',
    )
        ? 'error'
        : issues.length > 0
          ? 'warning'
          : 'healthy';

    Logger.info(`🏥 Healthcheck completed with status: ${overallStatus}`);
    return {
        extensionInfo: {
            name: getDisplayName(),
            version: getVersion(),
            timestamp: new Date(),
        },
        overallStatus,
        issues,
        components,
        recommendations: generateRecommendations(components),
    };
}

/**
 * Generate a markdown report from the healthcheck results
 */
export function generateMarkdownReport(
    report: HealthcheckReport,
    pythonManager: PythonManager,
): string {
    const lines: string[] = [];
    const envInfo = pythonManager.getCurrentEnvironmentInfo();

    lines.push(
        `# ${report.extensionInfo.name} Healthcheck Report`,
        '',
        `- **Generated:** ${report.extensionInfo.timestamp.toISOString()}`,
        `- **Extension Version:** ${report.extensionInfo.version}`,
        `- **Overall Status:** ${STATUS_ICON[report.overallStatus]} ${
            STATUS_COLOR[report.overallStatus]
        } ${report.overallStatus.toUpperCase()}`,
        '',
        '## ℹ️ System Information',
        '',
        `- **VS Code Version:** ${vscode.version}`,
        `- **Platform:** ${process.platform}`,
        `- **Node.js Version:** ${process.version}`,
        `- **Extension Path:** ${
            vscode.extensions.getExtension('eschalk0.scientific-data-viewer')
                ?.extensionPath || 'Unknown'
        }`,
        '',
        '## 🐍 Environment Information',
        '',
        `- **Status:** ${
            envInfo.initialized
                ? envInfo.ready
                    ? '✅ Ready'
                    : '⚠️ Not Ready'
                : '❌ Not Initialized'
        }`,
        `- **Source:** ${envInfo.source || 'Unknown'}`,
        `- **Python Path:** ${envInfo.path || 'Not set'}`,
        `- **Initialized:** ${envInfo.initialized ? 'Yes' : 'No'}`,
        `- **Ready:** ${envInfo.ready ? 'Yes' : 'No'}`,
        '',
        '## 🔧 Component Status',
        '',
    );
    for (const [key, label] of Object.entries(COMPONENT_LABELS)) {
        const result =
            report.components[key as keyof HealthcheckReport['components']];
        lines.push(
            `- **${label}**: ${STATUS_ICON[result.status]} ${result.status} - ${result.message}`,
        );
    }
    lines.push('');

    const sections: Array<[HealthStatus, string]> = [
        ['error', '## ❌ Errors Found'],
        ['warning', '## ⚠️ Warnings'],
    ];
    for (const [status, heading] of sections) {
        const issues = report.issues.filter((issue) => issue.status === status);
        if (issues.length === 0) {
            continue;
        }
        lines.push(heading, '');
        issues.forEach((issue, index) => {
            lines.push(`### ${index + 1}. ${issue.message}`, '');
            if (issue.details) {
                lines.push(issue.details, '');
            }
        });
    }
    if (report.issues.length === 0) {
        lines.push(
            '## ✅ All Systems Healthy',
            '',
            'All systems are operating normally.',
            '',
        );
    }

    lines.push(...errorHistoryMarkdown());

    if (report.recommendations.length > 0) {
        lines.push('## 💡 Recommendations', '');
        report.recommendations.forEach((rec, index) =>
            lines.push(`${index + 1}. ${rec}`),
        );
        lines.push('');
    }

    lines.push(
        '## ⚙️ Configuration Details',
        '',
        '```json',
        JSON.stringify(
            vscode.workspace.getConfiguration(SDV_EXTENSION_ID),
            null,
            2,
        ),
        '```',
        '',
    );
    return lines.join('\n');
}

/**
 * Open the healthcheck report in a new (untitled) editor
 */
export async function openHealthcheckReport(
    report: HealthcheckReport,
    pythonManager: PythonManager,
): Promise<void> {
    const markdown = generateMarkdownReport(report, pythonManager);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const untitledUri = vscode.Uri.parse(
        `untitled:SDV-Healthcheck-${timestamp}.md`,
    );
    const doc = await vscode.workspace.openTextDocument(untitledUri);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(untitledUri, new vscode.Position(0, 0), markdown);
    await vscode.workspace.applyEdit(edit);
    await vscode.window.showTextDocument(doc, {
        preview: false,
        preserveFocus: false,
        viewColumn: vscode.ViewColumn.One,
    });
}

function checkPanes(): HealthcheckResult {
    const paneCount = DataViewerPanel.getPanelCount();
    if (paneCount === 0) {
        return {
            status: 'healthy',
            message: 'No data viewer panes are currently open',
        };
    }
    if (paneCount > 10) {
        return {
            status: 'warning',
            message: `High number of open panes: ${paneCount}`,
            details:
                'Having many open panes may impact performance. Consider closing unused panes.',
        };
    }
    return {
        status: 'healthy',
        message: `${paneCount} panes open (${DataViewerPanel.getActivePanelCount()} active)`,
    };
}

function checkPanesWithErrors(): HealthcheckResult {
    try {
        const totalPanes = DataViewerPanel.getPanelCount();
        const errorPanels = DataViewerPanel.getPanelsWithErrors();
        if (errorPanels.length === 0) {
            return {
                status: 'healthy',
                message: 'No panes with errors',
                details: `All ${totalPanes} data viewer panes are functioning normally.`,
            };
        }
        const panelList = errorPanels
            .map(
                (panel) =>
                    `- ⚠️ Panel <${panel.getId()}>: ${panel.getFileUri().fsPath}`,
            )
            .join('\n');
        return {
            status: 'warning',
            message: `${errorPanels.length} of ${totalPanes} panes have errors`,
            details:
                `Some data viewer panes encountered errors while loading data.\n\n` +
                `${panelList}\n\n` +
                `Consider refreshing or reopening these panes.`,
        };
    } catch (error) {
        return {
            status: 'error',
            message: 'Failed to check panes with errors',
            details: errorDetails(error),
        };
    }
}

function checkPythonEnvironment(
    pythonManager: PythonManager,
): HealthcheckResult {
    const envInfo = pythonManager.getCurrentEnvironmentInfo();
    if (!envInfo.initialized) {
        return {
            status: 'warning',
            message: 'Python environment not yet initialized',
            details:
                'The Python environment is still being initialized. This is normal during startup.',
        };
    }
    if (!envInfo.path) {
        return {
            status: 'error',
            message: 'Python environment not ready: no interpreter found',
            details:
                'Install Python, or select an interpreter with "Python: Select Interpreter".',
        };
    }
    if (!envInfo.ready) {
        return {
            status: 'error',
            message: 'Python environment not ready',
            details: `Python environment is initialized but missing core packages. Source: ${
                envInfo.source || 'unknown'
            }. Path: ${envInfo.path}`,
        };
    }
    return {
        status: 'healthy',
        message: `Python environment ready (${envInfo.source || 'unknown'})`,
        details: `Interpreter: ${envInfo.path}`,
    };
}

const listOrNone = (items: readonly string[]) =>
    items.length > 0 ? items.join(', ') : 'None';

/**
 * Package availability (one Python call) and the format engines it enables.
 */
async function checkPackages(pythonManager: PythonManager): Promise<{
    dependencies: HealthcheckResult;
    supportedFormats: HealthcheckResult;
}> {
    const pythonPath = pythonManager.pythonPath;
    if (!pythonPath) {
        const result: HealthcheckResult = {
            status: 'error',
            message: 'Python interpreter not available',
            details:
                'Cannot check packages or format support without a Python interpreter.',
        };
        return { dependencies: result, supportedFormats: result };
    }

    let availability: Record<string, boolean>;
    try {
        availability = await pythonManager.checkPackagesAvailability(
            pythonPath,
            [...CORE_PACKAGES, ...PLOT_PACKAGES, ...EXTENDED_PACKAGES],
        );
    } catch (error) {
        const result: HealthcheckResult = {
            status: 'error',
            message: 'Failed to check package availability',
            details: errorDetails(error),
        };
        return { dependencies: result, supportedFormats: result };
    }

    return {
        dependencies: dependenciesResult(availability),
        supportedFormats: supportedFormatsResult(availability),
    };
}

function dependenciesResult(
    availability: Record<string, boolean>,
): HealthcheckResult {
    const split = (packages: readonly string[]) => ({
        available: packages.filter((pkg) => availability[pkg] === true),
        missing: packages.filter((pkg) => availability[pkg] !== true),
    });
    const core = split(CORE_PACKAGES);
    const plot = split(PLOT_PACKAGES);
    const extended = split(EXTENDED_PACKAGES);
    const details = [
        `- ✅ Available core packages: ${listOrNone(core.available)}`,
        `- ❌ Missing core packages: ${listOrNone(core.missing)}`,
        `- ✅ Available plotting packages: ${listOrNone(plot.available)}`,
        `- ⚠️ Missing plotting packages: ${listOrNone(plot.missing)}`,
        `- ✅ Available extended packages: ${listOrNone(extended.available)}`,
        `- ⚠️ Missing extended packages: ${listOrNone(extended.missing)}`,
    ].join('\n');

    if (core.missing.length > 0) {
        return {
            status: 'error',
            message: `Missing core packages: ${core.missing.join(', ')}`,
            details: `Core packages are required for basic functionality.\n\n${details}`,
        };
    }
    const optionalMissing = [...plot.missing, ...extended.missing];
    if (optionalMissing.length > 0) {
        return {
            status: 'warning',
            message: `Missing optional packages: ${optionalMissing.join(', ')}`,
            details: `All core packages are available, but some optional packages are missing.\n\n${details}`,
        };
    }
    const total =
        CORE_PACKAGES.length + PLOT_PACKAGES.length + EXTENDED_PACKAGES.length;
    return {
        status: 'healthy',
        message: `All packages available (${total}/${total})`,
        details,
    };
}

function supportedFormatsResult(
    availability: Record<string, boolean>,
): HealthcheckResult {
    const engines = Object.keys(FORMAT_ENGINES);
    const available = engines.filter(
        (engine) => availability[FORMAT_ENGINES[engine]] === true,
    );
    const missing = engines.filter((engine) => !available.includes(engine));

    if (available.length === 0) {
        return {
            status: 'error',
            message: 'No format engines available',
            details:
                `No data format engines are available.\n\n` +
                `- ❌ Missing engines: ${missing.join(', ')}\n` +
                `- 📦 Required packages: ${Object.values(FORMAT_ENGINES).join(', ')}`,
        };
    }
    if (missing.length > 0) {
        return {
            status: 'warning',
            message: `Limited format support: ${available.length}/${engines.length} engines available`,
            details:
                `Some format engines are missing, limiting data format support.\n\n` +
                `- ✅ Available engines: ${available.join(', ')}\n` +
                `- ❌ Missing engines: ${missing.join(', ')}`,
        };
    }
    return {
        status: 'healthy',
        message: `Full format support: ${available.length}/${engines.length} engines available`,
        details: `- ✅ Available engines: ${available.join(', ')}`,
    };
}

async function checkConfiguration(
    extensionEnvManager: ExtensionVirtualEnvironmentManager,
): Promise<HealthcheckResult> {
    const devMode = getDevMode();
    const overridePython = getOverridePythonInterpreter();
    const useExtensionOwnEnv = getUseExtensionOwnEnvironment();
    const summary = `Dev mode: ${devMode}, Override Python: ${!!overridePython}, Use own env: ${useExtensionOwnEnv}`;

    if (
        useExtensionOwnEnv &&
        !overridePython &&
        !extensionEnvManager.ready &&
        !(await extensionEnvManager.isUvAvailable())
    ) {
        return {
            status: 'error',
            message: 'Configuration has errors',
            details: `- Using extension own environment but uv is not available (${extensionEnvManager.UV_INSTALLATION_URL})\n\n${summary}`,
        };
    }
    if (useExtensionOwnEnv && overridePython) {
        return {
            status: 'warning',
            message: 'Configuration has warnings',
            details: `- The override Python interpreter takes precedence over the extension own environment\n\n${summary}`,
        };
    }
    if (devMode) {
        return {
            status: 'warning',
            message: 'Configuration has warnings',
            details: `- Development mode is enabled (this is normal for development)\n\n${summary}`,
        };
    }
    return {
        status: 'healthy',
        message: 'Configuration is valid',
        details: summary,
    };
}

function recentErrors() {
    const since = Date.now() - DAY_MS;
    return ErrorBoundary.getInstance()
        .getErrorHistory()
        .filter((entry) => entry.timestamp.getTime() > since);
}

function checkErrorBoundary(): HealthcheckResult {
    const history = ErrorBoundary.getInstance().getErrorHistory();
    const recent = recentErrors();
    if (history.length === 0) {
        return {
            status: 'healthy',
            message: 'No errors recorded',
        };
    }
    if (recent.length === 0) {
        return {
            status: 'healthy',
            message: `${history.length} errors recorded, none in the last 24 hours`,
        };
    }
    return {
        status: 'warning',
        message: `${recent.length} errors recorded in the last 24 hours`,
        details: recent
            .map(
                (entry, index) =>
                    `${index + 1}. [${entry.timestamp.toISOString()}] ${entry.context.component || 'Unknown'}.${entry.context.operation}: ${entry.error.message}`,
            )
            .join('\n'),
    };
}

function checkMemoryUsage(): HealthcheckResult {
    const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024);
    const memUsage = process.memoryUsage();
    const heapUsedMB = toMB(memUsage.heapUsed);
    const details = `Heap used: ${heapUsedMB}MB, Heap total: ${toMB(
        memUsage.heapTotal,
    )}MB, RSS: ${toMB(memUsage.rss)}MB, External: ${toMB(memUsage.external)}MB (extension host process, shared with other extensions)`;
    return heapUsedMB > HIGH_HEAP_MB
        ? {
              status: 'warning',
              message: `High memory usage: ${heapUsedMB}MB heap used`,
              details,
          }
        : {
              status: 'healthy',
              message: `Memory usage normal: ${heapUsedMB}MB heap used`,
              details,
          };
}

function generateRecommendations(
    components: HealthcheckReport['components'],
): string[] {
    const recommendations: string[] = [];
    const statusOf = (key: keyof HealthcheckReport['components']) =>
        components[key].status;

    if (Object.values(components).some((c) => c.status === 'error')) {
        recommendations.push(
            '🚨 **URGENT**: Address all error-level issues first as they may prevent the extension from working properly',
        );
    }
    if (statusOf('pythonEnvironment') === 'error') {
        recommendations.push(
            '🔧 **Error Fix**: Try refreshing the Python environment using the "Refresh Python Environment" command',
        );
    }
    if (statusOf('dependencies') === 'error') {
        recommendations.push(
            '🔧 **Error Fix**: Install missing core packages using the "Install Python Packages" command or refresh the Python environment',
        );
    }
    if (statusOf('dependencies') === 'warning') {
        recommendations.push(
            '⚠️ **Warning**: Consider installing missing optional packages for enhanced functionality',
        );
    }
    if (statusOf('panes') === 'warning') {
        recommendations.push(
            '⚠️ **Warning**: Consider closing unused data viewer panes to improve performance',
        );
    }
    if (statusOf('memory') === 'warning') {
        recommendations.push(
            '⚠️ **Warning**: Consider restarting VS Code if memory usage continues to be high',
        );
    }
    if (statusOf('configuration') !== 'healthy') {
        recommendations.push(
            '⚠️ **Warning**: Review your extension configuration settings',
        );
    }
    if (recentErrors().length > 0) {
        recommendations.push(
            '⚠️ **Recent Errors**: Some errors have been recorded recently. Check the error history section for details.',
        );
    }
    if (recommendations.length === 0) {
        recommendations.push(
            '✅ No specific recommendations at this time - all systems are healthy!',
        );
    }
    return recommendations;
}

function errorHistoryMarkdown(): string[] {
    const history = ErrorBoundary.getInstance().getErrorHistory();
    if (history.length === 0) {
        return [
            '## ✅ Error History',
            '',
            'No errors have been recorded. The extension is running smoothly!',
            '',
        ];
    }
    const lines = [
        '## 🚨 Error History',
        '',
        `Total errors recorded: **${history.length}**`,
        '',
    ];
    const byComponent = new Map<string, typeof history>();
    for (const entry of history) {
        const component = String(entry.context.component || 'Unknown');
        byComponent.set(component, [
            ...(byComponent.get(component) ?? []),
            entry,
        ]);
    }
    for (const [component, errors] of byComponent) {
        lines.push(`### Component: ${component} (${errors.length} errors)`, '');
        // Most recent first
        errors
            .slice(-MAX_ERRORS_PER_COMPONENT)
            .reverse()
            .forEach((entry, index) => {
                lines.push(
                    `${index + 1}. [${entry.timestamp.toISOString()}] (*${timeAgo(entry.timestamp)}*) - \`${entry.context.operation}\``,
                    `   - **Error:** ${entry.error.message}`,
                );
                if (entry.context.data) {
                    lines.push(
                        `   - **Data:** \`${JSON.stringify(entry.context.data)}\``,
                    );
                }
                if (entry.context.userAction) {
                    lines.push(
                        `   - **User Action:** ${entry.context.userAction}`,
                    );
                }
                lines.push('');
            });
        if (errors.length > MAX_ERRORS_PER_COMPONENT) {
            lines.push(
                `*... and ${errors.length - MAX_ERRORS_PER_COMPONENT} more errors*`,
                '',
            );
        }
    }
    return lines;
}

function timeAgo(timestamp: Date): string {
    const diffMinutes = Math.floor((Date.now() - timestamp.getTime()) / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const plural = (n: number, unit: string) =>
        `${n} ${unit}${n === 1 ? '' : 's'} ago`;
    if (diffMinutes < 1) {
        return 'Just now';
    }
    if (diffMinutes < 60) {
        return plural(diffMinutes, 'minute');
    }
    if (diffHours < 24) {
        return plural(diffHours, 'hour');
    }
    if (diffDays < 7) {
        return plural(diffDays, 'day');
    }
    return timestamp.toLocaleDateString();
}
