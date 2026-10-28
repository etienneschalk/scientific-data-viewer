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

/**
 * Interpreter selected in the official Python extension, through its public
 * API (`environments.getActiveEnvironmentPath` + `resolveEnvironment`, see
 * the @vscode/python-extension typings), falling back to the
 * `python.defaultInterpreterPath` setting.
 */
export async function getPythonInterpreterFromPythonExtension(): Promise<
    string | undefined
> {
    try {
        const environments = (await getPythonExtensionApi())?.environments;
        if (typeof environments?.getActiveEnvironmentPath === 'function') {
            // Synchronous in current versions; awaited for older ones.
            const activeEnvironmentPath =
                await environments.getActiveEnvironmentPath();
            Logger.debug(
                `🐍 🔍 Python extension API active environment path: ${JSON.stringify(
                    activeEnvironmentPath,
                )}`,
            );
            if (activeEnvironmentPath?.path) {
                return await resolveInterpreterPath(
                    environments,
                    activeEnvironmentPath,
                );
            }
        } else {
            Logger.warn('🐍 ⚠️ No compatible Python extension API found');
        }
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
 * Executable of the active environment. `EnvironmentPath.path` may be an
 * environment folder (e.g. conda), so the resolved executable is preferred.
 */
async function resolveInterpreterPath(
    environments: any,
    activeEnvironmentPath: { path: string },
): Promise<string> {
    if (typeof environments.resolveEnvironment !== 'function') {
        return activeEnvironmentPath.path;
    }
    try {
        const resolved = await environments.resolveEnvironment(
            activeEnvironmentPath,
        );
        const executablePath: string | undefined =
            resolved?.executable?.uri?.fsPath;
        const resolvedPath =
            executablePath || resolved?.path || activeEnvironmentPath.path;
        Logger.info(`🐍 ✅ Using resolved Python environment: ${resolvedPath}`);
        return resolvedPath;
    } catch (resolveError) {
        Logger.warn(
            `🐍 ⚠️ Environment resolution failed: ${resolveError}, using original path`,
        );
        return activeEnvironmentPath.path;
    }
}

/**
 * Listen to changes of the interpreter selected in the official Python
 * extension. Returns a disposable, or undefined when the API is unavailable.
 *
 * Environment discovery events (`onDidChangeEnvironments`) are deliberately
 * not followed: they fire once per environment found while the Python
 * extension scans the machine, and do not change the selected interpreter.
 */
export async function setupOfficialPythonExtensionChangeListeners(
    onDidChangeActiveEnvironmentPath: () => Promise<void>,
): Promise<vscode.Disposable | undefined> {
    try {
        const environments = (await getPythonExtensionApi())?.environments;
        if (
            typeof environments?.onDidChangeActiveEnvironmentPath !== 'function'
        ) {
            Logger.debug(
                '🐍 ⚠️ [Official Python Extension] onDidChangeActiveEnvironmentPath not available',
            );
            return undefined;
        }
        Logger.info(
            '🐍 🔧 [Official Python Extension] Setting up Python interpreter change listener for onDidChangeActiveEnvironmentPath...',
        );
        return environments.onDidChangeActiveEnvironmentPath(
            async (event: any) => {
                Logger.info(
                    `🐍 🔔 [Official Python Extension] Python interpreter changed: ${
                        event?.path || 'undefined'
                    }`,
                );
                await onDidChangeActiveEnvironmentPath();
            },
        );
    } catch (error) {
        Logger.warn(
            `🐍 ❌ Failed to set up Python environment change listeners: ${error}`,
        );
        return undefined;
    }
}
