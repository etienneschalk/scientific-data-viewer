import * as vscode from 'vscode';
import { Logger } from './logger';
import { DataProcessor } from './dataProcessor';
import { DataViewerPanel } from './dataViewerPanel';

export class ScientificDataEditorProvider
    implements vscode.CustomReadonlyEditorProvider
{
    constructor(
        private readonly webviewOptions: vscode.WebviewOptions,
        private readonly dataProcessor: DataProcessor
    ) {}

    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        Logger.info(`🚚 📖 Opening custom document for: ${uri.fsPath}`);

        // Create a custom document that represents the file
        return {
            uri: uri,
            dispose: () => {
                Logger.info(
                    `🚚 📕 Disposed custom document for: ${uri.fsPath}`
                );
            },
        };
    }

    public async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        Logger.info(
            `🚚 🧩 Resolving custom editor for: ${document.uri.fsPath}`
        );

        // Wait for Python initialization to complete before creating the panel
        // This prevents the race condition where file opening happens before Python validation
        try {
            await this.dataProcessor.pythonManagerInstance.waitForInitialization();
            Logger.info(
                `🚚 👍 Python initialization complete, creating data viewer panel for: ${document.uri.fsPath}`
            );
        } catch (error) {
            Logger.warn(
                `🚚 ⚠️ Python initialization failed, but proceeding with panel creation: ${error}`
            );
        }

        // Reuse the provided webviewPanel instead of creating a new one
        // This eliminates the flickering issue
        // No need to createOrReveal since VSCode is handling itself the uniqueness
        // of the opened tab.
        DataViewerPanel.createFromWebviewPanel(
            document.uri,
            webviewPanel,
            this.webviewOptions
        );
    }
}

