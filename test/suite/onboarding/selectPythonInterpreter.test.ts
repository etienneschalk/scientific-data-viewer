import * as assert from 'assert';
import * as vscode from 'vscode';
import {
    InterpreterSettings,
    PYTHON_SET_INTERPRETER,
    selectPythonInterpreter,
} from '../../../src/onboarding/walkthrough';

/**
 * "Use My Own Interpreter" (Getting Started walkthrough): the interpreter
 * picked in the Python extension only counts when neither
 * overridePythonInterpreter nor useExtensionOwnEnvironment is set.
 */
suite('Onboarding: Use My Own Interpreter', () => {
    const executed: unknown[][] = [];
    const messages: string[] = [];
    const originals = {
        executeCommand: vscode.commands.executeCommand,
        showInformationMessage: vscode.window.showInformationMessage,
        showWarningMessage: vscode.window.showWarningMessage,
    };
    let pythonExtension: { activate(): Thenable<unknown> } | undefined;
    let activations = 0;
    const installedPythonExtension = () => ({
        activate: async () => {
            activations += 1;
        },
    });
    const findPythonExtension = () => pythonExtension;

    setup(() => {
        executed.length = 0;
        messages.length = 0;
        activations = 0;
        pythonExtension = installedPythonExtension();
        (vscode.commands as any).executeCommand = async (
            ...args: unknown[]
        ) => {
            executed.push(args);
        };
        (vscode.window as any).showInformationMessage = async (m: string) => {
            messages.push(`info: ${m}`);
        };
        (vscode.window as any).showWarningMessage = async (m: string) => {
            messages.push(`warning: ${m}`);
        };
    });

    teardown(() => {
        Object.assign(vscode.commands, {
            executeCommand: originals.executeCommand,
        });
        Object.assign(vscode.window, {
            showInformationMessage: originals.showInformationMessage,
            showWarningMessage: originals.showWarningMessage,
        });
    });

    function fakeSettings(
        override: string,
        useOwn: boolean,
        { workspaceForcesOwn = false } = {},
    ): InterpreterSettings & { writes: boolean[] } {
        const writes: boolean[] = [];
        return {
            writes,
            getOverridePythonInterpreter: () => override,
            getUseExtensionOwnEnvironment: () =>
                workspaceForcesOwn ? true : useOwn,
            updateUseExtensionOwnEnvironment: async (value: boolean) => {
                writes.push(value);
                useOwn = value;
            },
        };
    }

    test('opens Python: Select Interpreter when nothing takes precedence', async () => {
        const settings = fakeSettings('', false);
        await selectPythonInterpreter(settings, findPythonExtension);
        assert.deepStrictEqual(executed, [[PYTHON_SET_INTERPRETER]]);
        assert.deepStrictEqual(settings.writes, []);
    });

    test('turns off the own environment before selecting an interpreter', async () => {
        const settings = fakeSettings('', true);
        await selectPythonInterpreter(settings, findPythonExtension);
        assert.deepStrictEqual(settings.writes, [false]);
        assert.deepStrictEqual(executed, [[PYTHON_SET_INTERPRETER]]);
        assert.ok(
            messages.some((m) => m.includes('no longer used')),
            messages.join('\n'),
        );
    });

    test('warns when a workspace setting keeps the own environment on', async () => {
        const settings = fakeSettings('', true, { workspaceForcesOwn: true });
        await selectPythonInterpreter(settings, findPythonExtension);
        assert.ok(
            messages.some((m) => m.startsWith('warning:')),
            messages.join('\n'),
        );
    });

    test('shows the override setting instead, since the override always wins', async () => {
        const settings = fakeSettings('/opt/python/bin/python3', true);
        await selectPythonInterpreter(settings, findPythonExtension);
        assert.deepStrictEqual(settings.writes, []);
        assert.strictEqual(executed.length, 1);
        assert.strictEqual(executed[0][0], 'workbench.action.openSettings');
        assert.ok(
            String(executed[0][1]).endsWith('python.overridePythonInterpreter'),
        );
        assert.ok(messages.some((m) => m.includes('/opt/python/bin/python3')));
    });

    test('opens the override setting without the Python extension', async () => {
        pythonExtension = undefined;
        await selectPythonInterpreter(
            fakeSettings('', false),
            findPythonExtension,
        );
        assert.strictEqual(executed[0][0], 'workbench.action.openSettings');
    });

    test('finds a Python extension installed after the first click', async () => {
        // Install SDV, click, install the Python extension, click again: its
        // commands are not registered until it is activated, so the second
        // click must look at the installed extensions, not the commands
        pythonExtension = undefined;
        await selectPythonInterpreter(
            fakeSettings('', false),
            findPythonExtension,
        );
        assert.strictEqual(executed[0][0], 'workbench.action.openSettings');
        executed.length = 0;
        pythonExtension = installedPythonExtension();
        await selectPythonInterpreter(
            fakeSettings('', false),
            findPythonExtension,
        );
        assert.strictEqual(activations, 1);
        assert.deepStrictEqual(executed, [[PYTHON_SET_INTERPRETER]]);
    });

    test('falls back to the setting when the Python extension fails to activate', async () => {
        pythonExtension = {
            activate: async () => {
                throw new Error('activation failed');
            },
        };
        await selectPythonInterpreter(
            fakeSettings('', false),
            findPythonExtension,
        );
        assert.strictEqual(executed[0][0], 'workbench.action.openSettings');
        assert.ok(
            messages.some((m) => m.includes('could not open')),
            messages.join('\n'),
        );
    });
});
