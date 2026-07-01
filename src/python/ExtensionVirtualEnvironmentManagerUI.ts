import * as vscode from 'vscode';
import { Logger } from '../common/Logger';
import { quoteIfNeeded } from '../common/utils';
import {
    showErrorMessage,
    showErrorMessageAndProposeHelpToInstallUv,
} from '../common/vscodeutils';
import { ExtensionVirtualEnvironmentManager } from './ExtensionVirtualEnvironmentManager';
import { updateUseExtensionOwnEnvironment } from '../common/config';
import { ExtensionVirtualEnvironment } from '../types';

export class ExtensionVirtualEnvironmentManagerUI {
    constructor(
        private extensionEnvManager: ExtensionVirtualEnvironmentManager,
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
                case '$(plus) Create':
                    await this.create();
                    break;
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

            // Update the configuration to use the extension environment
            await updateUseExtensionOwnEnvironment(true);
            vscode.window.showInformationMessage(
                'Extension virtual environment created successfully! The extension will now use its own isolated environment.',
            );
        } catch (error) {
            Logger.error(
                `🔧 ❌ Failed to create extension environment: ${error}`,
            );
            const uvInstallationUrl =
                this.extensionEnvManager.UV_INSTALLATION_URL;
            showErrorMessageAndProposeHelpToInstallUv(error, uvInstallationUrl);
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
                    await updateUseExtensionOwnEnvironment(false);
                    vscode.window.showInformationMessage(
                        'Extension virtual environment deleted successfully!',
                    );
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
            const lastUpdated = envInfo.lastUpdated.toLocaleString();
            const packageVersions =
                await this.extensionEnvManager.getInstalledPackageVersions();
            const installedCount = packageVersions.filter(
                (pkg) => pkg.version !== null,
            ).length;

            const toolUsed = envInfo.createdWithUv
                ? `uv (Python ${quoteIfNeeded(
                      this.extensionEnvManager.PYTHON_VERSION,
                  )})`
                : 'Unknown';

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
