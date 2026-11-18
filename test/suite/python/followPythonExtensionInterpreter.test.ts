import * as assert from 'assert';
import * as vscode from 'vscode';
import { followPythonExtensionInterpreter } from '../../../src/python/officialPythonExtensionApiUtils';

/**
 * The interpreter of the Python extension is followed even when the Python
 * extension is installed after this extension started (Getting Started
 * walkthrough: install SDV, then the Python extension).
 */
suite('Python extension installed while VS Code runs', () => {
    let installed: boolean;
    let refreshes: number;
    let listenersSetUp: number;
    let listenersDisposed: number;
    let changed: vscode.EventEmitter<void>;
    let follower: vscode.Disposable;

    const start = () =>
        followPythonExtensionInterpreter(
            async () => {
                refreshes += 1;
            },
            () => (installed ? {} : undefined),
            async () => {
                listenersSetUp += 1;
                return {
                    dispose: () => {
                        listenersDisposed += 1;
                    },
                };
            },
            changed.event,
        );

    /** Let the promise chains of the follower settle. */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    setup(() => {
        installed = false;
        refreshes = 0;
        listenersSetUp = 0;
        listenersDisposed = 0;
        changed = new vscode.EventEmitter<void>();
    });

    teardown(() => {
        follower?.dispose();
        changed.dispose();
    });

    test('sets up the listener at once when the Python extension is there', async () => {
        installed = true;
        follower = start();
        await settle();
        assert.strictEqual(listenersSetUp, 1);
        assert.strictEqual(refreshes, 0);
    });

    test('sets up the listener and refreshes when the Python extension is installed later', async () => {
        follower = start();
        await settle();
        assert.strictEqual(listenersSetUp, 0);

        installed = true;
        changed.fire();
        await settle();
        assert.strictEqual(listenersSetUp, 1);
        assert.strictEqual(refreshes, 1);

        // Another extension installed: nothing to do
        changed.fire();
        await settle();
        assert.strictEqual(listenersSetUp, 1);
        assert.strictEqual(refreshes, 1);
    });

    test('drops the listener and refreshes when the Python extension goes away', async () => {
        installed = true;
        follower = start();
        await settle();

        installed = false;
        changed.fire();
        await settle();
        assert.strictEqual(listenersDisposed, 1);
        assert.strictEqual(refreshes, 1);

        // Installed again: a new listener
        installed = true;
        changed.fire();
        await settle();
        assert.strictEqual(listenersSetUp, 2);
        assert.strictEqual(refreshes, 2);
    });

    test('dispose stops following', async () => {
        follower = start();
        follower.dispose();
        installed = true;
        changed.fire();
        await settle();
        assert.strictEqual(listenersSetUp, 0);
        assert.strictEqual(refreshes, 0);
    });
});
