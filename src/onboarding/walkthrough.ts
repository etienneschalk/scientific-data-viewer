import * as vscode from 'vscode';
import { Logger } from '../common/Logger';
import { SDV_EXTENSION_ID } from '../common/config';

/** Walkthrough id in package.json contributes.walkthroughs. */
export const WALKTHROUGH_ID = 'gettingStarted';

/** Full id expected by workbench.action.openWalkthrough. */
export function getWalkthroughFullId(extensionId: string): string {
    return `${extensionId}#${WALKTHROUGH_ID}`;
}

const PYTHON_SET_INTERPRETER = 'python.setInterpreter';

/**
 * "Use my own interpreter" step: Python: Select Interpreter when the Python
 * extension is installed, otherwise the overridePythonInterpreter setting.
 */
export async function selectPythonInterpreter(): Promise<void> {
    const commands = await vscode.commands.getCommands(true);
    if (commands.includes(PYTHON_SET_INTERPRETER)) {
        Logger.info('🎓 Opening Python: Select Interpreter');
        await vscode.commands.executeCommand(PYTHON_SET_INTERPRETER);
        return;
    }
    Logger.info(
        '🎓 Python extension not found, opening the overridePythonInterpreter setting',
    );
    await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        `${SDV_EXTENSION_ID}.python.overridePythonInterpreter`,
    );
    vscode.window.showInformationMessage(
        'The Python extension is not installed: set the path of a Python interpreter that has xarray in this setting, or install the Python extension and use "Python: Select Interpreter".',
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
