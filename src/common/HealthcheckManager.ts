import * as vscode from 'vscode';
import { Logger } from './Logger';
import { DataViewerPanel } from '../DataViewerPanel';
import { PythonManager } from '../python/PythonManager';
import { ExtensionVirtualEnvironmentManager } from '../python/ExtensionVirtualEnvironmentManager';
import { ErrorBoundary } from './ErrorBoundary';
import { getDisplayName, getVersion } from './vscodeutils';
import {
    getDevMode,
    getOverridePythonInterpreter,
    getUseExtensionOwnEnvironment,
} from './config';

export interface HealthcheckResult {
    status: 'healthy' | 'warning' | 'error';
    message: string;
    details?: string;
    timestamp: Date;
}

export interface HealthcheckReport {
    extensionInfo: {
        name: string;
        version: string;
        timestamp: Date;
    };
    overallStatus: 'healthy' | 'warning' | 'error';
    issues: HealthcheckResult[];
    components: {
        panes: HealthcheckResult;
        panesWithErrors: HealthcheckResult;
        pythonEnvironment: HealthcheckResult;
        dependencies: HealthcheckResult;
        configuration: HealthcheckResult;
        errorBoundary: HealthcheckResult;
        memory: HealthcheckResult;
        supportedFormats: HealthcheckResult;
        logging: HealthcheckResult;
        performance: HealthcheckResult;
    };
    recommendations: string[];
}

export class HealthcheckManager {
    private static instance: HealthcheckManager | null = null;

    public static getInstance(): HealthcheckManager {
        if (!HealthcheckManager.instance) {
            HealthcheckManager.instance = new HealthcheckManager();
        }
        return HealthcheckManager.instance;
    }

    private constructor() {}

    /**
     * Run a comprehensive healthcheck and generate a report
     */
    public async runHealthcheck(
        pythonManager: PythonManager,
    ): Promise<HealthcheckReport> {
        Logger.info('🏥 Running comprehensive healthcheck...');

        const timestamp = new Date();
        const issues: HealthcheckResult[] = [];
        const recommendations: string[] = [];

        // Check panes
        const panesResult = this.checkPanes();
        if (panesResult.status !== 'healthy') {
            issues.push(panesResult);
        }

        // Check panes with errors
        const panesWithErrorsResult = this.checkPanesWithErrors();
        if (panesWithErrorsResult.status !== 'healthy') {
            issues.push(panesWithErrorsResult);
        }

        // Check Python environment
        const pythonResult = await this.checkPythonEnvironment(pythonManager);
        if (pythonResult.status !== 'healthy') {
            issues.push(pythonResult);
        }

        // Check dependencies
        const dependenciesResult = await this.checkDependencies(pythonManager);
        if (dependenciesResult.status !== 'healthy') {
            issues.push(dependenciesResult);
        }

        // Check configuration
        const configResult = await this.checkConfiguration();
        if (configResult.status !== 'healthy') {
            issues.push(configResult);
        }

        // Check error boundary
        const errorBoundaryResult = this.checkErrorBoundary();
        if (errorBoundaryResult.status !== 'healthy') {
            issues.push(errorBoundaryResult);
        }

        // Check memory usage
        const memoryResult = this.checkMemoryUsage();
        if (memoryResult.status !== 'healthy') {
            issues.push(memoryResult);
        }

        // Check supported formats
        const supportedFormatsResult = await this.checkSupportedFormats(
            pythonManager
        );
        if (supportedFormatsResult.status !== 'healthy') {
            issues.push(supportedFormatsResult);
        }

        // Check logging system
        const loggingResult = this.checkLoggingSystem();
        if (loggingResult.status !== 'healthy') {
            issues.push(loggingResult);
        }

        // Check performance metrics
        const performanceResult = this.checkPerformanceMetrics();
        if (performanceResult.status !== 'healthy') {
            issues.push(performanceResult);
        }

        // Generate recommendations
        this.generateRecommendations(issues, recommendations);

        // Determine overall status
        const overallStatus = this.determineOverallStatus(issues);

        const report: HealthcheckReport = {
            extensionInfo: {
                name: getDisplayName(),
                version: getVersion(),
                timestamp,
            },
            overallStatus,
            issues,
            components: {
                panes: panesResult,
                panesWithErrors: panesWithErrorsResult,
                pythonEnvironment: pythonResult,
                dependencies: dependenciesResult,
                configuration: configResult,
                errorBoundary: errorBoundaryResult,
                memory: memoryResult,
                supportedFormats: supportedFormatsResult,
                logging: loggingResult,
                performance: performanceResult,
            },
            recommendations,
        };

        Logger.info(`🏥 Healthcheck completed with status: ${overallStatus}`);
        return report;
    }

    /**
     * Generate a markdown report from the healthcheck results
     */
    public generateMarkdownReport(
        report: HealthcheckReport,
        pythonManager: PythonManager
    ): string {
        const statusIcon = {
            healthy: '✅',
            warning: '⚠️',
            error: '❌',
        };

        const statusColor = {
            healthy: '🟢',
            warning: '🟡',
            error: '🔴',
        };

        let markdown = `# ${report.extensionInfo.name} Healthcheck Report\n\n`;
        markdown += `- **Generated:** ${report.extensionInfo.timestamp.toISOString()}\n`;
        markdown += `- **Extension Version:** ${report.extensionInfo.version}\n`;
        markdown += `- **Overall Status:** ${
            statusIcon[report.overallStatus]
        } ${
            statusColor[report.overallStatus]
        } ${report.overallStatus.toUpperCase()}\n\n`;

        // System information
        markdown += `## ℹ️ System Information\n\n`;
        markdown += `- **VS Code Version:** ${vscode.version}\n`;
        markdown += `- **Platform:** ${process.platform}\n`;
        markdown += `- **Node.js Version:** ${process.version}\n`;
        markdown += `- **Extension Path:** ${
            vscode.extensions.getExtension('eschalk0.scientific-data-viewer')
                ?.extensionPath || 'Unknown'
        }\n\n`;

        // Environment Information
        markdown += `## 🐍 Environment Information\n\n`;
        const envInfo = pythonManager.getCurrentEnvironmentInfo();
        if (envInfo) {
            markdown += `- **Status:** ${
                envInfo.initialized
                    ? envInfo.ready
                        ? '✅ Ready'
                        : '⚠️ Not Ready'
                    : '❌ Not Initialized'
            }\n`;
            markdown += `- **Source:** ${envInfo.source || 'Unknown'}\n`;
            markdown += `- **Python Path:** ${envInfo.path || 'Not set'}\n`;
            markdown += `- **Initialized:** ${
                envInfo.initialized ? 'Yes' : 'No'
            }\n`;
            markdown += `- **Ready:** ${envInfo.ready ? 'Yes' : 'No'}\n\n`;
        } else {
            markdown += `- **Status:** ❌ No environment information available\n`;
            markdown += `- **Source:** Unknown\n`;
            markdown += `- **Python Path:** Not set\n`;
            markdown += `- **Initialized:** No\n`;
            markdown += `- **Ready:** No\n\n`;
        }

        // Issues section - separate by status
        const errorIssues = report.issues.filter(
            (issue) => issue.status === 'error'
        );
        const warningIssues = report.issues.filter(
            (issue) => issue.status === 'warning'
        );
        const healthyIssues = report.issues.filter(
            (issue) => issue.status === 'healthy'
        );

        if (errorIssues.length > 0) {
            markdown += `## ❌ Errors Found\n\n`;
            errorIssues.forEach((issue, index) => {
                markdown += `### ${index + 1}. ${issue.message}\n\n`;
                if (issue.details) {
                    markdown += `${issue.details}\n\n`;
                }
            });
        }

        if (warningIssues.length > 0) {
            markdown += `## ⚠️ Warnings\n\n`;
            warningIssues.forEach((issue, index) => {
                markdown += `### ${index + 1}. ${issue.message}\n\n`;
                if (issue.details) {
                    markdown += `${issue.details}\n\n`;
                }
            });
        }

        if (errorIssues.length === 0 && warningIssues.length === 0) {
            markdown += `## ✅ All Systems Healthy\n\n`;
            markdown += `All systems are operating normally.\n\n`;
        }

        // Component details - bullet points
        markdown += `## 🔧 Component Status\n\n`;
        markdown += `- **Panes**: ${
            statusIcon[report.components.panes.status]
        } ${report.components.panes.status} - ${
            report.components.panes.message
        }\n`;
        markdown += `- **Panes with Error**: ${
            statusIcon[report.components.panesWithErrors.status]
        } ${report.components.panesWithErrors.status} - ${
            report.components.panesWithErrors.message
        }\n`;
        markdown += `- **Python Environment**: ${
            statusIcon[report.components.pythonEnvironment.status]
        } ${report.components.pythonEnvironment.status} - ${
            report.components.pythonEnvironment.message
        }\n`;
        markdown += `- **Dependencies**: ${
            statusIcon[report.components.dependencies.status]
        } ${report.components.dependencies.status} - ${
            report.components.dependencies.message
        }\n`;
        markdown += `- **Configuration**: ${
            statusIcon[report.components.configuration.status]
        } ${report.components.configuration.status} - ${
            report.components.configuration.message
        }\n`;
        markdown += `- **Error Boundary**: ${
            statusIcon[report.components.errorBoundary.status]
        } ${report.components.errorBoundary.status} - ${
            report.components.errorBoundary.message
        }\n`;
        markdown += `- **Memory Usage**: ${
            statusIcon[report.components.memory.status]
        } ${report.components.memory.status} - ${
            report.components.memory.message
        }\n`;
        markdown += `- **Supported Formats**: ${
            statusIcon[report.components.supportedFormats.status]
        } ${report.components.supportedFormats.status} - ${
            report.components.supportedFormats.message
        }\n`;
        markdown += `- **Logging System**: ${
            statusIcon[report.components.logging.status]
        } ${report.components.logging.status} - ${
            report.components.logging.message
        }\n`;
        markdown += `- **Performance**: ${
            statusIcon[report.components.performance.status]
        } ${report.components.performance.status} - ${
            report.components.performance.message
        }\n\n`;

        // Recommendations
        if (report.recommendations.length > 0) {
            markdown += `## 💡 Recommendations\n\n`;
            report.recommendations.forEach((rec, index) => {
                markdown += `${index + 1}. ${rec}\n`;
            });
            markdown += `\n`;
        }

        // Configuration Details
        markdown += `## ⚙️ Configuration Details\n\n`;
        const config = vscode.workspace.getConfiguration(
            'scientificDataViewer'
        );
        markdown += `\`\`\`json\n${JSON.stringify(
            config,
            null,
            2
        )}\n\`\`\`\n\n`;

        return markdown;
    }

    /**
     * Open the healthcheck report in a new editor
     */
    public async openHealthcheckReport(
        report: HealthcheckReport,
        pythonManager: PythonManager
    ): Promise<void> {
        const markdown = this.generateMarkdownReport(report, pythonManager);
        
        // Create an untitled document with a custom name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const untitledUri = vscode.Uri.parse(`untitled:SDV-Healthcheck-${timestamp}.md`);
        
        // Open the untitled document
        const doc = await vscode.workspace.openTextDocument(untitledUri);
        
        // Set the content
        const edit = new vscode.WorkspaceEdit();
        edit.insert(untitledUri, new vscode.Position(0, 0), markdown);
        await vscode.workspace.applyEdit(edit);
        
        // Show the document
        await vscode.window.showTextDocument(doc, {
            preview: false,
            preserveFocus: false,
            viewColumn: vscode.ViewColumn.One,
        });
        await vscode.window.showTextDocument(doc);
    }

    private checkPanes(): HealthcheckResult {
        const paneCount = DataViewerPanel.getPanelCount();
        const activePaneCount = DataViewerPanel.getActivePanelCount();

        if (paneCount === 0) {
            return {
                status: 'warning',
                message: 'No data viewer panes are currently open',
                details:
                    'Consider opening a scientific data file to test the extension functionality.',
                timestamp: new Date(),
            };
        }

        if (paneCount > 10) {
            return {
                status: 'warning',
                message: `High number of open panes: ${paneCount}`,
                details:
                    'Having many open panes may impact performance. Consider closing unused panes.',
                timestamp: new Date(),
            };
        }

        return {
            status: 'healthy',
            message: `${paneCount} panes open (${activePaneCount} active)`,
            timestamp: new Date(),
        };
    }

    private checkPanesWithErrors(): HealthcheckResult {
        try {
            const panesWithErrors = DataViewerPanel.getPanelsWithErrorsCount();
            const totalPanes = DataViewerPanel.getPanelCount();
            const errorPanels = DataViewerPanel.getPanelsWithErrors();

            if (panesWithErrors > 0) {
                const errorDetails = errorPanels
                    .map(
                        (panel) =>
                            `- ⚠️ Panel ${panel.getId()}: ${
                                panel.getFileUri().fsPath
                            }`
                    )
                    .join('\n');

                return {
                    status: 'warning',
                    message: `${panesWithErrors} of ${totalPanes} panes have errors`,
                    details:
                        `Some data viewer panes encountered errors while loading data.\n\n` +
                        `- Total panes: ${totalPanes}\n` +
                        `- Panes with errors: ${panesWithErrors}\n\n` +
                        `${errorDetails}\n\n` +
                        `Consider refreshing or reopening these panes.`,
                    timestamp: new Date(),
                };
            }

            return {
                status: 'healthy',
                message: 'No panes with errors',
                details: `All ${totalPanes} data viewer panes are functioning normally.`,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to check panes with errors',
                details: `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };
        }
    }

    private async checkPythonEnvironment(
        pythonManager: PythonManager
    ): Promise<HealthcheckResult> {
        try {
            const envInfo = pythonManager.getCurrentEnvironmentInfo();

            if (!envInfo) {
                return {
                    status: 'error',
                    message: 'Python environment not initialized',
                    details:
                        'The Python environment has not been properly initialized. Try refreshing the Python environment.',
                    timestamp: new Date(),
                };
            }

            if (!envInfo.initialized) {
                return {
                    status: 'warning',
                    message: 'Python environment not yet initialized',
                    details:
                        'The Python environment is still being initialized. This is normal during startup.',
                    timestamp: new Date(),
                };
            }

            if (!envInfo.ready) {
                return {
                    status: 'error',
                    message: 'Python environment not ready',
                    details: `Python environment is initialized but missing core packages. Source: ${
                        envInfo.source || 'unknown'
                    }. Path: ${envInfo.path || 'unknown'}`,
                    timestamp: new Date(),
                };
            }

            return {
                status: 'healthy',
                message: `Python environment ready (${
                    envInfo.source || 'unknown'
                })`,
                details: `Interpreter: ${envInfo.path || 'unknown'}`,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to check Python environment',
                details: `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };
        }
    }

    private async checkDependencies(
        pythonManager: PythonManager
    ): Promise<HealthcheckResult> {
        try {
            const corePackages = ['xarray'];
            const plotPackages = ['matplotlib'];
            const extendedPackages = [
                'netCDF4',
                'h5netcdf',
                'zarr',
                'h5py',
                'scipy',
                'cfgrib',
                'rioxarray',
            ];

            const allPackages = [
                ...corePackages,
                ...plotPackages,
                ...extendedPackages,
            ];

            if (!pythonManager.pythonPath) {
                return {
                    status: 'error',
                    message: 'Python interpreter not available',
                    details:
                        'Cannot check package availability without a Python interpreter.',
                    timestamp: new Date(),
                };
            }

            const packageAvailability =
                await pythonManager.checkPackagesAvailability(
                    pythonManager.pythonPath,
                    allPackages
                );

            const availablePackages = Object.keys(packageAvailability).filter(
                (pkg) => packageAvailability[pkg] === true
            );
            const missingPackages = Object.keys(packageAvailability).filter(
                (pkg) => packageAvailability[pkg] === false
            );

            const coreMissing = missingPackages.filter((pkg) =>
                corePackages.includes(pkg)
            );
            const plotMissing = missingPackages.filter((pkg) =>
                plotPackages.includes(pkg)
            );
            const extendedMissing = missingPackages.filter((pkg) =>
                extendedPackages.includes(pkg)
            );

            // Create detailed package lists
            const coreAvailable = corePackages.filter(
                (pkg) => packageAvailability[pkg] === true
            );
            const plotAvailable = plotPackages.filter(
                (pkg) => packageAvailability[pkg] === true
            );
            const extendedAvailable = extendedPackages.filter(
                (pkg) => packageAvailability[pkg] === true
            );

            let status: 'healthy' | 'warning' | 'error' = 'healthy';
            let message = '';
            let details = '';

            if (coreMissing.length > 0) {
                status = 'error';
                message = `Missing core packages: ${coreMissing.join(', ')}`;
                details =
                    `Core packages are required for basic functionality.\n\n` +
                    `- ✅ Available core packages: ${
                        coreAvailable.length > 0
                            ? coreAvailable.join(', ')
                            : 'None'
                    }\n` +
                    `- ❌ Missing core packages: ${coreMissing.join(', ')}\n` +
                    `- ✅ Available plotting packages: ${
                        plotAvailable.length > 0
                            ? plotAvailable.join(', ')
                            : 'None'
                    }\n` +
                    `- ⚠️ Missing plotting packages: ${
                        plotMissing.length > 0 ? plotMissing.join(', ') : 'None'
                    }\n` +
                    `- ✅ Available extended packages: ${
                        extendedAvailable.length > 0
                            ? extendedAvailable.join(', ')
                            : 'None'
                    }\n` +
                    `- ⚠️ Missing extended packages: ${
                        extendedMissing.length > 0
                            ? extendedMissing.join(', ')
                            : 'None'
                    }`;
            } else if (plotMissing.length > 0 || extendedMissing.length > 0) {
                status = 'warning';
                message = `Missing optional packages: ${[
                    ...plotMissing,
                    ...extendedMissing,
                ].join(', ')}`;
                details =
                    `All core packages are available, but some optional packages are missing.\n\n` +
                    `- ✅ Available core packages: ${coreAvailable.join(
                        ', '
                    )}\n` +
                    `- ✅ Available plotting packages: ${
                        plotAvailable.length > 0
                            ? plotAvailable.join(', ')
                            : 'None'
                    }\n` +
                    `- ⚠️ Missing plotting packages: ${
                        plotMissing.length > 0 ? plotMissing.join(', ') : 'None'
                    }\n` +
                    `- ✅ Available extended packages: ${
                        extendedAvailable.length > 0
                            ? extendedAvailable.join(', ')
                            : 'None'
                    }\n` +
                    `- ⚠️ Missing extended packages: ${
                        extendedMissing.length > 0
                            ? extendedMissing.join(', ')
                            : 'None'
                    }`;
            } else {
                message = `All packages available (${availablePackages.length}/${allPackages.length})`;
                details =
                    `- ✅ Available core packages: ${coreAvailable.join(
                        ', '
                    )}\n` +
                    `- ✅ Available plotting packages: ${plotAvailable.join(
                        ', '
                    )}\n` +
                    `- ✅ Available extended packages: ${extendedAvailable.join(
                        ', '
                    )}`;
            }

            return {
                status,
                message,
                details,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to check package availability',
                details: `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };
        }
    }

    private async checkConfiguration(): Promise<HealthcheckResult> {
        try {
            const devMode = getDevMode();
            const overridePython = getOverridePythonInterpreter();
            const useExtensionOwnEnv = getUseExtensionOwnEnvironment();

            const issues: string[] = [];
            const warnings: string[] = [];

            if (devMode) {
                warnings.push(
                    '- Development mode is enabled (this is normal for development)'
                );
            }

            if (overridePython && !overridePython.trim()) {
                issues.push('- Python interpreter override is set but empty');
            }

            if (useExtensionOwnEnv && !overridePython) {
                // Check if uv is available when using extension own environment
                const uvAvailable = await this.checkUvAvailability();
                if (!uvAvailable) {
                    issues.push(
                        '- Using extension own environment but uv is not available'
                    );
                }
            }

            if (issues.length === 0 && warnings.length === 0) {
                return {
                    status: 'healthy',
                    message: 'Configuration is valid',
                    details: `Dev mode: ${devMode}, Override Python: ${!!overridePython}, Use own env: ${useExtensionOwnEnv}`,
                    timestamp: new Date(),
                };
            }

            if (issues.length > 0) {
                return {
                    status: 'error',
                    message: 'Configuration has errors',
                    details: `Errors: ${issues.join('; ')}${
                        warnings.length > 0
                            ? ` Warnings: \n\n${warnings.join('\n')}`
                            : ''
                    }`,
                    timestamp: new Date(),
                };
            } else {
                return {
                    status: 'warning',
                    message: 'Configuration has warnings',
                    details: `Warnings: \n\n${warnings.join('\n')}`,
                    timestamp: new Date(),
                };
            }
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to check configuration',
                details: `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };
        }
    }

    private async checkUvAvailability(): Promise<boolean> {
        try {
            // Check if uv command is available in the system PATH
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            try {
                const { stdout } = await execAsync('uv --version', {
                    timeout: 5000,
                });
                // If we get here, uv is available
                Logger.debug(`uv is available: ${stdout.trim()}`);
                return true;
            } catch (error) {
                Logger.debug(
                    `uv is not available: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
                return false;
            }
        } catch (error) {
            Logger.debug(
                `Failed to check uv availability: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return false;
        }
    }

    private checkErrorBoundary(): HealthcheckResult {
        try {
            const errorBoundary = ErrorBoundary.getInstance();
            // We don't have a direct way to check if there are errors, but we can check if it's properly initialized
            return {
                status: 'healthy',
                message: 'Error boundary is active',
                details:
                    'Error boundary is properly initialized and monitoring for errors.',
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Error boundary not properly initialized',
                details: `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };
        }
    }

    private checkMemoryUsage(): HealthcheckResult {
        try {
            const memUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const rssMB = Math.round(memUsage.rss / 1024 / 1024);

            if (heapUsedMB > 500) {
                return {
                    status: 'warning',
                    message: `High memory usage: ${heapUsedMB}MB heap used`,
                    details: `Heap used: ${heapUsedMB}MB, Heap total: ${heapTotalMB}MB, RSS: ${rssMB}MB`,
                    timestamp: new Date(),
                };
            }

            return {
                status: 'healthy',
                message: `Memory usage normal: ${heapUsedMB}MB heap used`,
                details: `Heap used: ${heapUsedMB}MB, Heap total: ${heapTotalMB}MB, RSS: ${rssMB}MB`,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to check memory usage',
                details: `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };
        }
    }

    private generateRecommendations(
        issues: HealthcheckResult[],
        recommendations: string[]
    ): void {
        const errorIssues = issues.filter((issue) => issue.status === 'error');
        const warningIssues = issues.filter(
            (issue) => issue.status === 'warning'
        );

        if (errorIssues.length > 0) {
            recommendations.push(
                '🚨 **URGENT**: Address all error-level issues first as they may prevent the extension from working properly'
            );
        }

        if (
            errorIssues.some((issue) =>
                issue.message.includes('Python environment')
            )
        ) {
            recommendations.push(
                '🔧 **Error Fix**: Try refreshing the Python environment using the "Refresh Python Environment" command'
            );
        }

        if (
            errorIssues.some((issue) => issue.message.includes('core packages'))
        ) {
            recommendations.push(
                '🔧 **Error Fix**: Install missing core packages using the "Install Python Packages" command or refresh the Python environment'
            );
        }

        if (warningIssues.some((issue) => issue.message.includes('packages'))) {
            recommendations.push(
                '⚠️ **Warning**: Consider installing missing optional packages for enhanced functionality'
            );
        }

        if (warningIssues.some((issue) => issue.message.includes('panes'))) {
            recommendations.push(
                '⚠️ **Warning**: Consider closing unused data viewer panes to improve performance'
            );
        }

        if (warningIssues.some((issue) => issue.message.includes('memory'))) {
            recommendations.push(
                '⚠️ **Warning**: Consider restarting VS Code if memory usage continues to be high'
            );
        }

        if (
            warningIssues.some((issue) =>
                issue.message.includes('configuration')
            )
        ) {
            recommendations.push(
                '⚠️ **Warning**: Review your extension configuration settings'
            );
        }

        if (recommendations.length === 0) {
            recommendations.push(
                '✅ No specific recommendations at this time - all systems are healthy!'
            );
        }
    }

    private async checkSupportedFormats(
        pythonManager: PythonManager
    ): Promise<HealthcheckResult> {
        try {
            // Use the same format mapping as generateSupportedFormatsInfo
            const formatEngineMap: Record<string, string[]> = {
                // NetCDF formats
                '.nc': ['netcdf4', 'h5netcdf', 'scipy'],
                '.nc4': ['netcdf4', 'h5netcdf'],
                '.netcdf': ['netcdf4', 'h5netcdf', 'scipy'],
                '.cdf': ['netcdf4', 'h5netcdf', 'scipy'],
                // Zarr format
                '.zarr': ['zarr'],
                // HDF5 formats
                '.h5': ['h5netcdf', 'h5py', 'netcdf4'],
                '.hdf5': ['h5netcdf', 'h5py', 'netcdf4'],
                // GRIB formats
                '.grib': ['cfgrib'],
                '.grib2': ['cfgrib'],
                '.grb': ['cfgrib'],
                // GeoTIFF formats
                '.tif': ['rasterio'],
                '.tiff': ['rasterio'],
                '.geotiff': ['rasterio'],
                // JPEG-2000 formats
                '.jp2': ['rasterio'],
                '.jpeg2000': ['rasterio'],
                // Sentinel-1 SAFE format
                '.safe': ['rasterio'],
            };

            const supportedExtensions = Object.keys(formatEngineMap);
            const formatEngines = {
                netcdf4: ['netCDF4'],
                h5netcdf: ['h5netcdf'],
                scipy: ['scipy'],
                zarr: ['zarr'],
                h5py: ['h5py'],
                cfgrib: ['cfgrib'],
                rasterio: ['rioxarray'],
            };

            if (!pythonManager.pythonPath) {
                return {
                    status: 'error',
                    message:
                        'Cannot check supported formats without Python interpreter',
                    details:
                        'Python interpreter is required to check format support.',
                    timestamp: new Date(),
                };
            }

            // Collect all unique packages needed for engines
            const allEnginePackages = [
                ...new Set(Object.values(formatEngines).flat()),
            ];

            // Single call to check all packages
            const packageAvailability =
                await pythonManager.checkPackagesAvailability(
                    pythonManager.pythonPath,
                    allEnginePackages
                );

            // Check which engines are available
            const availableEngines: string[] = [];
            const missingEngines: string[] = [];

            for (const [engine, packages] of Object.entries(formatEngines)) {
                const allPackagesAvailable = packages.every(
                    (pkg) => packageAvailability[pkg] === true
                );
                if (allPackagesAvailable) {
                    availableEngines.push(engine);
                } else {
                    missingEngines.push(engine);
                }
            }

            const totalEngines = Object.keys(formatEngines).length;
            const availableEngineCount = availableEngines.length;

            if (availableEngineCount === 0) {
                return {
                    status: 'error',
                    message: 'No format engines available',
                    details:
                        `No data format engines are available.\n\n` +
                        `- ❌ Missing engines: ${missingEngines.join(', ')}\n` +
                        `- 📦 Required packages: ${allEnginePackages.join(
                            ', '
                        )}`,
                    timestamp: new Date(),
                };
            }

            if (availableEngineCount < totalEngines) {
                return {
                    status: 'warning',
                    message: `Limited format support: ${availableEngineCount}/${totalEngines} engines available`,
                    details:
                        `Some format engines are missing, limiting data format support.\n\n` +
                        `- ✅ Available engines: ${availableEngines.join(
                            ', '
                        )}\n` +
                        `- ❌ Missing engines: ${missingEngines.join(', ')}`,
                    timestamp: new Date(),
                };
            }

            return {
                status: 'healthy',
                message: `Full format support: ${availableEngineCount}/${totalEngines} engines available`,
                details:
                    `All format engines are available for comprehensive data format support.\n\n` +
                    `- ✅ Available engines: ${availableEngines.join(', ')}`,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to check supported formats',
                details: `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };
        }
    }

    private checkLoggingSystem(): HealthcheckResult {
        try {
            // Check if logging is properly initialized
            const logger = Logger;

            // Test logging functionality
            const testMessage = 'Healthcheck logging test';
            logger.debug(testMessage);

            return {
                status: 'healthy',
                message: 'Logging system operational',
                details: 'Logger is properly initialized and functional.',
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Logging system not operational',
                details: `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };
        }
    }

    private checkPerformanceMetrics(): HealthcheckResult {
        try {
            const memUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const rssMB = Math.round(memUsage.rss / 1024 / 1024);
            const externalMB = Math.round(memUsage.external / 1024 / 1024);

            // Check if we're using too much memory
            if (heapUsedMB > 1000) {
                return {
                    status: 'warning',
                    message: `High memory usage: ${heapUsedMB}MB heap used`,
                    details: `Heap used: ${heapUsedMB}MB, Heap total: ${heapTotalMB}MB, RSS: ${rssMB}MB, External: ${externalMB}MB`,
                    timestamp: new Date(),
                };
            }

            // Check if we have reasonable memory usage
            if (heapUsedMB > 500) {
                return {
                    status: 'warning',
                    message: `Moderate memory usage: ${heapUsedMB}MB heap used`,
                    details: `Heap used: ${heapUsedMB}MB, Heap total: ${heapTotalMB}MB, RSS: ${rssMB}MB, External: ${externalMB}MB`,
                    timestamp: new Date(),
                };
            }

            return {
                status: 'healthy',
                message: `Good performance: ${heapUsedMB}MB heap used`,
                details: `Heap used: ${heapUsedMB}MB, Heap total: ${heapTotalMB}MB, RSS: ${rssMB}MB, External: ${externalMB}MB`,
                timestamp: new Date(),
            };
        } catch (error) {
            return {
                status: 'error',
                message: 'Failed to check performance metrics',
                details: `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };
        }
    }

    private determineOverallStatus(
        issues: HealthcheckResult[]
    ): 'healthy' | 'warning' | 'error' {
        if (issues.some((issue) => issue.status === 'error')) {
            return 'error';
        }
        if (issues.some((issue) => issue.status === 'warning')) {
            return 'warning';
        }
        return 'healthy';
    }
}
