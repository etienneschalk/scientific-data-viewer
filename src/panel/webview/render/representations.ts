import { joinId } from '../../../shared/ids';
import { formatLoadTime } from '../../../shared/time';
import { escapeHtml } from '../util';

function byId(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing element #${id}`);
    }
    return element;
}

/**
 * xarray's `_repr_html_` output is inserted as HTML on purpose: xarray
 * escapes the data in it, and it only uses inline <style> and CSS-only
 * toggles (allowed by the webview CSP).
 */
export function displayHtmlRepresentation(
    htmlData: string | Record<string, string> | undefined,
    isDatatree: boolean,
): void {
    const container = byId(
        isDatatree ? 'htmlRepresentationForGroups' : 'htmlRepresentation',
    );
    if (!htmlData) {
        container.innerHTML =
            '<p class="muted-text">Failed to load HTML representation</p>';
        return;
    }
    if (typeof htmlData !== 'object') {
        container.innerHTML = htmlData;
        return;
    }
    const prefixId = 'section-html-representation-for-groups';
    container.innerHTML = Object.entries(htmlData)
        .map(
            ([groupName, value]) => /*html*/ `
    <div class="info-section" id="${joinId([prefixId, groupName])}">
        <details> <summary>${escapeHtml(groupName)}</summary>
            <div class="html-representation">
                ${value || '<p>No HTML representation available</p>'}
            </div>
        </details>
    </div>`,
        )
        .join('');
}

export function displayTextRepresentation(
    textData: string | Record<string, string> | undefined,
    isDatatree: boolean,
): void {
    const container = byId(
        isDatatree ? 'textRepresentationForGroups' : 'textRepresentation',
    );
    if (!textData) {
        if (isDatatree) {
            container.innerHTML =
                '<p class="muted-text">Failed to load text representation</p>';
        } else {
            container.textContent = 'Failed to load text representation';
        }
        return;
    }
    if (typeof textData !== 'object') {
        container.textContent = textData;
        return;
    }
    const prefixId = 'section-text-representation-for-groups';
    container.innerHTML = Object.keys(textData)
        .map((name) => {
            const preId = joinId(['groupTextRepresentation', name]);
            return /*html*/ `
    <div class="info-section" id="${joinId([prefixId, name])}">
        <details> <summary>${escapeHtml(name)}</summary>
            <div class="text-representation-container">
                <button id="${joinId(['groupTextCopyButton', name])}" data-target-id="${preId}" class="text-copy-button">Copy</button>
                <pre id="${preId}"></pre>
            </div>
        </details>
    </div>`;
        })
        .join('');
    // Fill in order (ids could collide after joinId sanitisation)
    const pres = container.querySelectorAll(
        '.text-representation-container pre',
    );
    Object.values(textData).forEach((value, index) => {
        const pre = pres[index];
        if (pre) {
            pre.textContent = value;
        }
    });
}

/** Backend `OpenReport`: how the file was opened (only the fields read here). */
export interface OpenReportView {
    engine?: string;
    function?: string;
    raw?: boolean;
    call?: string;
    degraded_decoders?: string[];
    fallback_reason?: string | null;
    notes?: string[];
    failed_engines?: Array<{ engine?: string; error?: string }>;
}

/** One-line decoding mode, shared by File Information and Troubleshooting. */
export function decodingModeText(report: OpenReportView | undefined): string {
    if (report?.raw) {
        return 'raw (no CF decoding)';
    }
    const degraded = report?.degraded_decoders ?? [];
    if (degraded.length > 0) {
        return `degraded (${degraded.map((name) => `${name}=False`).join(', ')})`;
    }
    return 'CF decoded';
}

/** Plain text of Troubleshooting > How this file was opened (copyable). */
export function formatOpenReport(report: OpenReportView | undefined): string {
    if (!report?.call) {
        return 'Not reported by the backend.';
    }
    const lines = [
        `Engine: ${report.engine ?? '?'} (${report.function ?? '?'})`,
        `Decoding: ${decodingModeText(report)}`,
    ];
    if (report.fallback_reason) {
        lines.push(`Time decoding turned off after: ${report.fallback_reason}`);
    }
    lines.push(
        '',
        report.call,
        '',
        'Each keyword is commented with its source. Decoders not in the call keep the engine default.',
    );
    const notes = report.notes ?? [];
    if (notes.length > 0) {
        lines.push('', 'Notes:', ...notes.map((note) => `- ${note}`));
    }
    const failed = report.failed_engines ?? [];
    if (failed.length > 0) {
        lines.push(
            '',
            'Engines that failed first:',
            ...failed.map((f) => `- ${f.engine ?? '?'}: ${f.error ?? ''}`),
        );
    }
    return lines.join('\n');
}

export function displayOpenReport(report: OpenReportView | undefined): void {
    byId('openReport').textContent = formatOpenReport(report);
}

export function displayShowVersions(versionsData: string | undefined): void {
    byId('showVersions').textContent =
        versionsData || 'Failed to load version information';
}

export function displayPythonPath(pythonPath: string | null | undefined): void {
    byId('pythonPath').textContent =
        pythonPath || 'No Python interpreter configured';
}

export function displayExtensionConfig(configData: unknown): void {
    byId('extensionConfig').textContent = configData
        ? JSON.stringify(configData, null, 2)
        : 'Failed to load extension configuration';
}

export function displayTimestamp(
    isoString: string | null | undefined,
    isLoading = false,
    useLocalTime = true,
): void {
    const timestampElement = byId('timestamp');
    const timestampText = byId('timestampText');
    if (isLoading) {
        timestampText.textContent = 'Loading...';
        timestampElement.classList.remove('hidden');
    } else if (isoString) {
        timestampText.textContent = `Loaded: ${formatLoadTime(isoString, useLocalTime)}`;
        timestampElement.classList.remove('hidden');
    } else {
        timestampElement.classList.add('hidden');
    }
}
