import { messageBus } from './bus';
import { displayGlobalError } from './errors';

/** Serialised page as currently shown (the host inlines assets and theme). */
export function captureWebviewContent(): string | null {
    try {
        const clone = document.documentElement.cloneNode(true) as Element;
        // The page holds no form control but the plot settings editor. The
        // settings summaries are the record of the settings: the editor
        // would not work in a browser
        clone.querySelectorAll('.plot-editor').forEach((editor) => {
            editor.remove();
        });
        clone
            .querySelectorAll('.plot-settings-button')
            .forEach((button) => button.setAttribute('aria-expanded', 'false'));
        return clone.outerHTML;
    } catch (error) {
        console.error('🖼️ Error capturing webview content:', error);
        return null;
    }
}

export async function handleExportWebview(): Promise<void> {
    if (messageBus.isDegradedMode) {
        return;
    }
    const htmlContent = captureWebviewContent();
    if (htmlContent === null) {
        displayGlobalError(
            'Failed to export webview content: the page could not be captured (see the developer console).',
        );
        return;
    }
    try {
        const result: any = await messageBus.exportWebview(htmlContent);
        if (result && result.success === false && !result.cancelled) {
            displayGlobalError(
                'Failed to export webview content: ' + result.error,
            );
        }
    } catch (error) {
        console.error('🖼️ Error exporting webview content:', error);
        displayGlobalError(
            'Failed to export webview content: ' + (error as Error).message,
        );
    }
}
