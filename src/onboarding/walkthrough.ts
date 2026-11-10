import * as vscode from 'vscode';
import { Logger } from '../common/Logger';
import {
    getOverridePythonInterpreter,
    getOverridePythonInterpreterConfigFullKey,
    getUseExtensionOwnEnvironment,
    getUseExtensionOwnEnvironmentConfigFullKey,
    updateUseExtensionOwnEnvironment,
} from '../common/config';
import { getPythonExtension } from '../python/officialPythonExtensionApiUtils';

/** The part of vscode.Extension used here (a fake in tests). */
export interface ActivatableExtension {
    activate(): Thenable<unknown>;
}

/** Walkthrough id in package.json contributes.walkthroughs. */
export const WALKTHROUGH_ID = 'gettingStarted';

/** Full id expected by workbench.action.openWalkthrough. */
export function getWalkthroughFullId(extensionId: string): string {
    return `${extensionId}#${WALKTHROUGH_ID}`;
}

export const PYTHON_SET_INTERPRETER = 'python.setInterpreter';

/** The interpreter settings read and written by selectPythonInterpreter. */
export interface InterpreterSettings {
    getOverridePythonInterpreter(): string;
    getUseExtensionOwnEnvironment(): boolean;
    updateUseExtensionOwnEnvironment(value: boolean): Promise<void>;
}

const CONFIG_INTERPRETER_SETTINGS: InterpreterSettings = {
    getOverridePythonInterpreter,
    getUseExtensionOwnEnvironment,
    updateUseExtensionOwnEnvironment,
};

/**
 * "Use My Own Interpreter" button of the walkthrough: Python: Select
 * Interpreter when the Python extension is installed, otherwise the
 * overridePythonInterpreter setting.
 *
 * The interpreter is chosen by priority (PythonManager.selectInterpreter):
 * overridePythonInterpreter, then the extension's own environment when
 * useExtensionOwnEnvironment is on, then the Python extension. So a choice in
 * Python: Select Interpreter would have no effect while either of the first
 * two is set: an override is shown in its setting instead, and the own
 * environment is turned off (it is kept on disk).
 */
export async function selectPythonInterpreter(
    settings: InterpreterSettings = CONFIG_INTERPRETER_SETTINGS,
    findPythonExtension: () =>
        ActivatableExtension | undefined = getPythonExtension,
): Promise<void> {
    const override = settings.getOverridePythonInterpreter();
    if (override) {
        Logger.info(
            `🎓 overridePythonInterpreter is set (${override}), opening it`,
        );
        await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            getOverridePythonInterpreterConfigFullKey(),
        );
        vscode.window.showInformationMessage(
            `The interpreter set in this setting is used: ${override}. Change it here, or clear it to use the interpreter selected with "Python: Select Interpreter".`,
        );
        return;
    }
    if (settings.getUseExtensionOwnEnvironment()) {
        Logger.info('🎓 Turning off useExtensionOwnEnvironment');
        await settings.updateUseExtensionOwnEnvironment(false);
        if (settings.getUseExtensionOwnEnvironment()) {
            vscode.window.showWarningMessage(
                `${getUseExtensionOwnEnvironmentConfigFullKey()} is on in the workspace settings, which take precedence: turn it off there to use your own interpreter.`,
            );
        } else {
            vscode.window.showInformationMessage(
                `The extension's own Python environment is no longer used (${getUseExtensionOwnEnvironmentConfigFullKey()} turned off). It is kept: turn the setting on again to use it.`,
            );
        }
    }
    // Looked up at each click: the Python extension may have been installed
    // since VS Code started. Its commands are only registered once it is
    // activated, so they cannot tell whether it is installed.
    const pythonExtension = findPythonExtension();
    if (pythonExtension) {
        try {
            await pythonExtension.activate();
            Logger.info('🎓 Opening Python: Select Interpreter');
            await vscode.commands.executeCommand(PYTHON_SET_INTERPRETER);
            return;
        } catch (error) {
            Logger.error(
                `🎓 ❌ Could not open Python: Select Interpreter: ${error}`,
            );
        }
    }
    Logger.info(
        '🎓 Python extension not found or not working, opening the overridePythonInterpreter setting',
    );
    await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        getOverridePythonInterpreterConfigFullKey(),
    );
    vscode.window.showInformationMessage(
        pythonExtension
            ? 'The Python extension could not open "Python: Select Interpreter" (see the logs): set the path of a Python interpreter that has xarray in this setting.'
            : 'The Python extension is not installed: set the path of a Python interpreter that has xarray in this setting, or install the Python extension and click "Use My Own Interpreter" again.',
    );
}

/** Open the Getting Started walkthrough of this extension. */
export async function openWalkthrough(extensionId: string): Promise<void> {
    await vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        getWalkthroughFullId(extensionId),
        false,
    );
}
