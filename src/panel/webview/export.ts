import { messageBus } from './bus';
import { displayGlobalError } from './errors';

/**
 * Copy the live values of every form control into the clone (as attributes,
 * which is what outerHTML serialises) and make them read-only, so the
 * exported HTML shows the state at export time.
 */
function applyExportStateToClone(clone: Element): void {
    const cloneById = new Map<string, Element>();
    clone.querySelectorAll('input[id], select[id]').forEach((el) => {
        cloneById.set(el.id, el);
    });
    document
        .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
            '#content input[id], #content select[id]',
        )
        .forEach((live) => {
            const el = cloneById.get(live.id);
            if (!el) {
                return;
            }
            if (el instanceof HTMLSelectElement) {
                Array.from(el.options).forEach((opt) => {
                    if (opt.value === live.value) {
                        opt.setAttribute('selected', 'selected');
                    } else {
                        opt.removeAttribute('selected');
                    }
                });
                el.setAttribute('disabled', 'disabled');
            } else if (
                live instanceof HTMLInputElement &&
                live.type === 'checkbox'
            ) {
                if (live.checked) {
                    el.setAttribute('checked', 'checked');
                } else {
                    el.removeAttribute('checked');
                }
                el.setAttribute('disabled', 'disabled');
            } else {
                el.setAttribute('value', live.value);
                // readonly does not apply to sliders: they would still move
                const frozen = live.type === 'range' ? 'disabled' : 'readonly';
                el.setAttribute(frozen, frozen);
            }
        });
}

/** Serialised page as currently shown (the host inlines assets and theme). */
export function captureWebviewContent(): string | null {
    try {
        const clone = document.documentElement.cloneNode(true) as Element;
        applyExportStateToClone(clone);
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
    try {
        const result: any = await messageBus.exportWebview(
            captureWebviewContent(),
        );
        if (result && result.success === false) {
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
