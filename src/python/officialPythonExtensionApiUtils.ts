import * as vscode from 'vscode';
import { Logger } from '../common/Logger';

/**
 * Get Python extension API if available
 */
export async function getPythonExtensionApi(): Promise<any | undefined> {
    const pythonExtension = vscode.extensions.getExtension('ms-python.python');

    if (!pythonExtension) {
        Logger.error(
            '🐍 ❌ The official Python extension was not found. Is it installed and enabled? Go to the Extensions pane and search for ms-python.python to verify that the official Python extension is both installed and enabled.',
        );
        return undefined;
    }

    if (!pythonExtension.isActive) {
        Logger.info(
            '🐍 💤 Python extension is not active, attempting to activate...',
        );
    }

    try {
        return await pythonExtension.activate();
    } catch (error) {
        Logger.error(`🐍 ❌ Failed to activate Python extension: ${error}`);
        return undefined;
    }
}

export async function getPythonInterpreterFromPythonExtension(): Promise<
    string | undefined
> {
    try {
        const pythonApi = await getPythonExtensionApi();

        if (!pythonApi) {
            Logger.warn(
                '🐍 ⚠️ Python extension API is not available after activation',
            );
            // Continue to VSCode configuration fallback
        } else {
            Logger.debug(
                '🐍 ✅ Python extension API is available after activation',
            );
            Logger.debug(
                `🐍 🔍 Python API structure: ${JSON.stringify(
                    Object.keys(pythonApi),
                )}`,
            );
            if (pythonApi.environments) {
                Logger.debug(
                    `🐍 🔍 Environments API methods: ${JSON.stringify(
                        Object.keys(pythonApi.environments),
                    )}`,
                );
            }
        }

        // Try the new environments API with resolveEnvironment (recommended approach)
        if (
            pythonApi &&
            pythonApi.environments &&
            typeof pythonApi.environments.getActiveEnvironmentPath ===
                'function'
        ) {
            try {
                const activeEnvironmentPath =
                    await pythonApi.environments.getActiveEnvironmentPath();
                Logger.debug(
                    `🐍 🔍 Python extension API active environment path: ${JSON.stringify(
                        activeEnvironmentPath,
                    )}`,
                );

                if (activeEnvironmentPath && activeEnvironmentPath.path) {
                    // Resolve the environment to get complete details and ensure it's valid
                    if (
                        typeof pythonApi.environments.resolveEnvironment ===
                        'function'
                    ) {
                        try {
                            const resolvedEnvironment =
                                await pythonApi.environments.resolveEnvironment(
                                    activeEnvironmentPath,
                                );
                            Logger.debug(
                                `🐍 🔍 Resolved environment details: ${JSON.stringify(
                                    resolvedEnvironment,
                                )}`,
                            );

                            if (resolvedEnvironment) {
                                // Use the resolved environment's path, which should be more reliable
                                const resolvedPath =
                                    resolvedEnvironment.path ||
                                    resolvedEnvironment.executable?.path ||
                                    activeEnvironmentPath.path;
                                Logger.info(
                                    `🐍 ✅ Using resolved Python environment: ${resolvedPath}`,
                                );
                                return resolvedPath;
                            } else {
                                Logger.warn(
                                    '🐍 ⚠️ Environment resolution returned undefined, using original path',
                                );
                                return activeEnvironmentPath.path;
                            }
                        } catch (resolveError) {
                            Logger.warn(
                                `🐍 ⚠️ Environment resolution failed: ${resolveError}, using original path`,
                            );
                            return activeEnvironmentPath.path;
                        }
                    } else {
                        Logger.debug(
                            '🐍 ⚠️ resolveEnvironment not available, using original path',
                        );
                        return activeEnvironmentPath.path;
                    }
                }
            } catch (envError) {
                Logger.debug(`🐍 ⚠️ Environments API error: ${envError}`);
                // Continue to VSCode configuration fallback
            }
        }

        // Try alternative environments API methods
        if (pythonApi && pythonApi.environments) {
            // Try getActiveInterpreter if available
            if (
                typeof pythonApi.environments.getActiveInterpreter ===
                'function'
            ) {
                try {
                    const activeInterpreter =
                        await pythonApi.environments.getActiveInterpreter();
                    Logger.debug(
                        `🐍 🔍 Python extension API active interpreter (alt): ${JSON.stringify(
                            activeInterpreter,
                        )}`,
                    );
                    return activeInterpreter?.path;
                } catch (altError) {
                    Logger.debug(
                        `🐍 ⚠️ Alternative environments API error: ${altError}`,
                    );
                }
            }

            // Try getActiveEnvironment if available
            if (
                typeof pythonApi.environments.getActiveEnvironment ===
                'function'
            ) {
                try {
                    const activeEnv =
                        await pythonApi.environments.getActiveEnvironment();
                    Logger.debug(
                        `🐍 🔍 Python extension API active environment (alt): ${JSON.stringify(
                            activeEnv,
                        )}`,
                    );
                    return activeEnv?.path;
                } catch (altError) {
                    Logger.debug(
                        `🐍 ⚠️ Alternative environments API error: ${altError}`,
                    );
                }
            }
        }

        // Fallback to old settings API if available
        if (
            pythonApi &&
            pythonApi.settings &&
            typeof pythonApi.settings.getInterpreterDetails === 'function'
        ) {
            try {
                const interpreterDetails =
                    await pythonApi.settings.getInterpreterDetails();
                Logger.debug(
                    `🐍 🔍 Python extension API interpreter details (legacy): ${JSON.stringify(
                        interpreterDetails,
                    )}`,
                );
                return interpreterDetails?.path;
            } catch (legacyError) {
                Logger.debug(`🐍 ⚠️ Legacy API error: ${legacyError}`);
            }
        }

        Logger.warn('🐍 ⚠️ No compatible Python extension API found');
    } catch (error) {
        Logger.warn(`🐍 ⚠️ Could not access Python extension API: ${error}`);
    }

    // Fallback: try to get from VSCode configuration
    try {
        const vscodePythonPath = vscode.workspace
            .getConfiguration('python')
            .get('defaultInterpreterPath') as string | undefined;
        if (vscodePythonPath) {
            Logger.debug(
                `🐍 🔍 Using Python path from VSCode configuration: ${vscodePythonPath}`,
            );
        }
        return vscodePythonPath;
    } catch (error) {
        Logger.warn(`🐍 ⚠️ Could not access Python configuration: ${error}`);
    }

    return undefined;
}

/**
 * Set up event listeners for Python environment changes and creation
 * Returns a disposable that should be disposed when the extension is deactivated
 */
export async function setupOfficialPythonExtensionChangeListeners(
    onDidChangeActiveEnvironmentPath: () => Promise<void>,
    onDidEnvironmentsChanged: (environment: any) => Promise<void>,
): Promise<vscode.Disposable | undefined> {
    try {
        const pythonApi = await getPythonExtensionApi();

        if (!pythonApi || !pythonApi.environments) {
            Logger.debug(
                '🐍 ⚠️ [Official Python Extension] Python extension API or environments API not available for event listeners',
            );
            return undefined;
        }

        const disposables: vscode.Disposable[] = [];

        // Listen for active interpreter changes (existing functionality)
        if (
            typeof pythonApi.environments.onDidChangeActiveEnvironmentPath ===
            'function'
        ) {
            Logger.info(
                '🐍 🔧 [Official Python Extension] Setting up Python interpreter change listener for onDidChangeActiveEnvironmentPath...',
            );

            const interpreterDisposable =
                pythonApi.environments.onDidChangeActiveEnvironmentPath(
                    async (event: any) => {
                        Logger.info(
                            `🐍 🔔 [Official Python Extension] Python interpreter changed: ${
                                event?.path || 'undefined'
                            }`,
                        );
                        await onDidChangeActiveEnvironmentPath();
                    },
                );

            disposables.push(interpreterDisposable);
        }

        // Listen for environment creation/removal/updates (NEW functionality)
        if (
            typeof pythonApi.environments.onDidEnvironmentsChanged ===
            'function'
        ) {
            Logger.info(
                '🐍 🔧 [Official Python Extension] Setting up Python environment change listener for onDidEnvironmentsChanged...',
            );

            const environmentDisposable =
                pythonApi.environments.onDidEnvironmentsChanged(
                    async (event: any) => {
                        // Add comprehensive debugging
                        Logger.debug(
                            `🐍 🔍 [Official Python Extension] Environment change event received: ${JSON.stringify(
                                event,
                                undefined,
                                2,
                            )}`,
                        );

                        // Handle newly created environments
                        if (event.added && event.added.length > 0) {
                            Logger.info(
                                `🐍 🆕 [Official Python Extension] New Python environments created: ${event.added.length}`,
                            );
                            for (const env of event.added) {
                                Logger.info(
                                    `🐍 🆕 New environment: ${
                                        env.path || env.id || 'unknown'
                                    }`,
                                );
                                await onDidEnvironmentsChanged(env);
                            }
                        }

                        // Handle removed environments
                        if (event.removed && event.removed.length > 0) {
                            Logger.info(
                                `🐍 🗑️ [Official Python Extension] Python environments removed: ${event.removed.length}`,
                            );
                            for (const env of event.removed) {
                                Logger.info(
                                    `🐍 🗑️ Removed environment: ${
                                        env.path || env.id || 'unknown'
                                    }`,
                                );
                                await onDidEnvironmentsChanged(env);
                            }
                        }

                        // Handle updated environments
                        if (event.updated && event.updated.length > 0) {
                            Logger.info(
                                `🐍 🔄 [Official Python Extension] Python environments updated: ${event.updated.length}`,
                            );
                            for (const env of event.updated) {
                                Logger.info(
                                    `🐍 🔄 Updated environment: ${
                                        env.path || env.id || 'unknown'
                                    }`,
                                );
                                await onDidEnvironmentsChanged(env);
                            }
                        }
                    },
                );

            disposables.push(environmentDisposable);
        }

        // If no listeners were set up, return undefined
        if (disposables.length === 0) {
            Logger.debug(
                '🐍 ⚠️ No compatible event listeners available in Python extension API',
            );
            return undefined;
        }

        // Return a combined disposable
        return {
            dispose: () => {
                disposables.forEach((d) => d.dispose());
            },
        };
    } catch (error) {
        Logger.warn(
            `🐍 ❌ Failed to set up Python environment change listeners: ${error}`,
        );
        return undefined;
    }
}
