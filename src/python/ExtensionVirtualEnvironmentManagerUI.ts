import * as vscode from 'vscode';
import { Logger } from '../common/Logger';
import {
    showErrorMessage,
    showErrorMessageAndProposeHelpToInstallUv,
} from '../common/vscodeutils';
import {
    ExtensionVirtualEnvironment,
    ExtensionVirtualEnvironmentManager,
} from './ExtensionVirtualEnvironmentManager';
import {
    getUseExtensionOwnEnvironment,
    updateUseExtensionOwnEnvironment,
} from '../common/config';

export class ExtensionVirtualEnvironmentManagerUI {
    /**
     * @param extensionEnvManager  The environment manager
     * @param refreshPython        Re-initialise the Python environment; called
     *                             when the setting written by this UI does not
     *                             change (no configuration change event fires)
     */
    constructor(
        private extensionEnvManager: ExtensionVirtualEnvironmentManager,
        private refreshPython: () => Promise<void>,
    ) {}

    /**
     * Manage the extension virtual environment
     */
    async manage(): Promise<void> {
        try {
            const envInfo = this.extensionEnvManager.retrieve();

            if (!envInfo.isCreated) {
                const createAction = await vscode.window.showQuickPick(
                    [
                        {
                            label: '$(plus) Create',
                            description: 'Create a new environment',
                        },
                        {
                            label: '$(close) Cancel',
                            description: 'Cancel environment creation',
                        },
                    ],
                    {
                        placeHolder:
                            'Extension virtual environment not found. What would you like to do?',
                        title: 'Extension Environment Setup',
                    },
                );

                if (createAction?.label === '$(plus) Create') {
                    await this.create();
                }
                return;
            }

            const action = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(sync) Update Packages',
                        description: 'Update all packages in the environment',
                    },
                    {
                        label: '$(trash) Delete',
                        description: 'Remove the environment',
                    },
                    {
                        label: '$(folder-opened) Open in Explorer',
                        description:
                            'Open the environment folder in file explorer',
                    },
                    {
                        label: '$(info) Information',
                        description:
                            'View detailed environment information in a new editor tab',
                    },
                    {
                        label: '$(close) Cancel',
                        description: 'Close this menu',
                    },
                ],
                {
                    placeHolder: 'Extension Virtual Environment Management',
                    title: 'Extension Environment Status',
                },
            );

            switch (action?.label) {
                case '$(sync) Update Packages':
                    await this.update();
                    break;
                case '$(trash) Delete':
                    await this.delete();
                    break;
                case '$(folder-opened) Open in Explorer':
                    vscode.commands.executeCommand(
                        'revealFileInOS',
                        vscode.Uri.file(envInfo.path),
                    );
                    break;
                case '$(info) Information':
                    await this.showInfo(envInfo);
                    break;
            }
        } catch (error) {
            Logger.error(
                `🔧 ❌ Failed to manage extension environment: ${error}`,
            );
            showErrorMessage(
                `Failed to manage extension environment: ${error}`,
            );
        }
    }

    /**
     * Create the extension virtual environment
     */
    private async create(): Promise<void> {
        try {
            await this.extensionEnvManager.create();
        } catch (error) {
            Logger.error(
                `🔧 ❌ Failed to create extension environment: ${error}`,
            );
            const uvInstallationUrl =
                this.extensionEnvManager.UV_INSTALLATION_URL;
            showErrorMessageAndProposeHelpToInstallUv(error, uvInstallationUrl);
            return;
        }

        // The environment exists from here on: a failure to write the
        // setting must not be reported as a failed creation.
        await this.setUseExtensionOwnEnvironment(true);
        vscode.window.showInformationMessage(
            getUseExtensionOwnEnvironment()
                ? 'Extension virtual environment created successfully! The extension will now use its own isolated environment.'
                : 'Extension virtual environment created successfully.',
        );
    }

    /**
     * Write useExtensionOwnEnvironment (user settings) and make sure the
     * Python environment is refreshed: when the effective value does not
     * change, no configuration event fires, so refresh explicitly.
     */
    private async setUseExtensionOwnEnvironment(value: boolean): Promise<void> {
        const before = getUseExtensionOwnEnvironment();
        try {
            await updateUseExtensionOwnEnvironment(value);
        } catch (error) {
            Logger.error(
                `🔧 ❌ Failed to update useExtensionOwnEnvironment: ${error}`,
            );
            showErrorMessage(
                `Could not set scientificDataViewer.python.useExtensionOwnEnvironment to ${value}: ${error}`,
                true,
                true,
            );
        }
        const after = getUseExtensionOwnEnvironment();
        if (after !== value) {
            vscode.window.showWarningMessage(
                `scientificDataViewer.python.useExtensionOwnEnvironment is set to ${after} in the workspace settings, which take precedence over the user setting just written.`,
            );
        }
        if (after === before) {
            await this.refreshPython();
        }
    }

    /**
     * Update packages in the extension virtual environment
     */
    private async update(): Promise<void> {
        try {
            Logger.info('📦 Updating extension environment packages...');
            const updated = await this.extensionEnvManager.update();

            if (updated) {
                vscode.window.showInformationMessage(
                    'Extension environment packages updated successfully!',
                );
            } else {
                showErrorMessage(
                    'Failed to update extension environment packages.',
                );
            }
        } catch (error) {
            Logger.error(
                `📦 ❌ Failed to update extension environment packages: ${error}`,
            );
            showErrorMessage(`Failed to update packages: ${error}`, true, true);
        }
    }

    /**
     * Delete the extension virtual environment
     */
    private async delete(): Promise<void> {
        try {
            const action = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(trash) Delete',
                        description:
                            'Are you sure? Permanently delete the extension virtual environment',
                    },
                    {
                        label: '$(close) Cancel',
                        description: 'Keep the environment and return to menu',
                    },
                ],
                {
                    placeHolder:
                        'Are you sure you want to delete the extension virtual environment?',
                    title: 'Delete Environment Confirmation',
                },
            );

            if (action?.label === '$(trash) Delete') {
                Logger.info('🗑️ Deleting extension virtual environment...');
                const deleted = await this.extensionEnvManager.delete();

                if (deleted) {
                    vscode.window.showInformationMessage(
                        'Extension virtual environment deleted successfully!',
                    );
                    await this.setUseExtensionOwnEnvironment(false);
                } else {
                    showErrorMessage(
                        'Failed to delete extension virtual environment.',
                    );
                }
            }
        } catch (error) {
            Logger.error(
                `🗑️ ❌ Failed to delete extension environment: ${error}`,
            );
            showErrorMessage(
                `Failed to delete extension environment: ${error}`,
            );
        }
    }

    /**
     * Show environment information in a new text editor tab
     */
    private async showInfo(
        envInfo: ExtensionVirtualEnvironment,
    ): Promise<void> {
        try {
            const lastUpdated =
                this.extensionEnvManager.getLastUpdated()?.toLocaleString() ??
                'Unknown';
            const packageVersions =
                await this.extensionEnvManager.getInstalledPackageVersions();
            const installedCount = packageVersions.filter(
                (pkg) => pkg.version !== null,
            ).length;

            // The extension only ever creates its environment with uv
            const toolUsed = `uv (Python ${this.extensionEnvManager.PYTHON_VERSION})`;

            const packageLines =
                packageVersions.length > 0
                    ? packageVersions
                          .map((pkg) =>
                              pkg.version
                                  ? `  - ${pkg.name}: ${pkg.version}`
                                  : `  - ${pkg.name}: _not installed_`,
                          )
                          .join('\n')
                    : 'No packages installed';

            const envInfoContent = `
# Extension Virtual Environment Information

- 📁 Path: ${envInfo.path}
- 🐍 Python: ${envInfo.pythonPath}
- 🔧 Created with: ${toolUsed}
- 📦 Packages: ${installedCount} of ${packageVersions.length} installed
- 📅 Last Updated: ${lastUpdated}
- ${envInfo.isInitialized ? '✅ Status: Ready' : '❌ Status: Not Initialized'}

- 📦 Installed Packages:

${packageLines}



_Report generated on: ${new Date().toLocaleString()}_
    `;

            // Create a new text document with the environment information
            const doc = await vscode.workspace.openTextDocument({
                content: envInfoContent,
                language: 'markdown',
            });

            // Open the document in a new editor tab
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true,
            });

            Logger.info(
                '📋 Environment information displayed in new editor tab',
            );
        } catch (error) {
            Logger.error(
                `📋 ❌ Failed to show environment info in editor: ${error}`,
            );
            showErrorMessage(
                `Failed to show environment information: ${error}`,
            );
        }
    }
}
