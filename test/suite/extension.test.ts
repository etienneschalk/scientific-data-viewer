import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-company-name.scientific-data-viewer'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('your-company-name.scientific-data-viewer');
        if (extension) {
            await extension.activate();
            assert.ok(extension.isActive);
        }
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('scientificDataViewer.openViewer'));
        assert.ok(commands.includes('scientificDataViewer.selectPythonInterpreter'));
        assert.ok(commands.includes('scientificDataViewer.refreshData'));
    });

    test('Configuration should be available', () => {
        const config = vscode.workspace.getConfiguration('scientificDataViewer');
        assert.ok(config);
        assert.ok(config.has('pythonPath'));
        assert.ok(config.has('autoRefresh'));
        assert.ok(config.has('maxFileSize'));
        assert.ok(config.has('defaultView'));
    });
});
