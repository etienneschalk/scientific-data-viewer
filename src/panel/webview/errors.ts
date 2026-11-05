import { ICONS } from '../../shared/icons';
import { messageBus } from './bus';
import { escapeHtml, escapeHtmlMultiline, SUPPORTED_EXTENSIONS } from './util';

/** The only commands the host lets the webview run (`executeCommand`). */
const COMMAND_SHOW_LOGS = 'scientificDataViewer.showLogs';
const COMMAND_INSTALL_PACKAGES = 'scientificDataViewer.python.installPackages';
const COMMAND_SHOW_SETTINGS = 'scientificDataViewer.showSettings';

/** Link handled by the delegated `data-action` click listener (no inline onclick: CSP). */
function installLink(packages: string[], text: string): string {
    return /*html*/ `<a href="#" class="small-button-link" data-action="install-packages" data-packages="${escapeHtml(packages.join(','))}">${ICONS.install} ${escapeHtml(text)}</a>`;
}

function renderTroubleshootingSteps(): string {
    return /*html*/ `
        <h4>${ICONS.lightbulb} General Troubleshooting Steps</h4>
        <ol>
            <li>If this is the first time you are using the extension, please consult the <a href="https://github.com/etienneschalk/scientific-data-viewer/wiki/Getting-Started" target="_blank" class="external-link">Getting Started ${ICONS.linkExternal}</a> guide</li>
            <li>If the file is indicated as too large, you can increase the Max File Size in the <a href="#" class="small-button-link" data-action="show-settings">${ICONS.settings} Extension Settings</a></li>
            <li>Make sure that the file format is supported (${escapeHtml(SUPPORTED_EXTENSIONS.join(', '))})</li>
            <li>Make sure Python is installed and accessible</li>
            <li>
                Make sure that the Python extension is installed and enabled.
                Please go to the Extensions pane and search for <code>ms-python.python</code>
                to verify that the official Python extension is both installed and enabled.
                <ul class="troubleshooting-sublist">
                    <li>For VSCode users: <a href="https://marketplace.visualstudio.com/items?itemName=ms-python.python" target="_blank" class="external-link">Python extension (VSCode Marketplace) ${ICONS.linkExternal}</a></li>
                    <li>For Cursor users: <a href="https://open-vsx.org/extension/ms-python/python" target="_blank" class="external-link">Python extension (Open VSX Registry) ${ICONS.linkExternal}</a></li>
                </ul>
            </li>
            <li>Select the Python Interpreter: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → "Python: Select Interpreter"</li>
            <li>If the python environment is not ready, install required package: ${installLink(['xarray'], 'Install xarray')}</li>
            <li>If you cannot create plots, install required package: ${installLink(['matplotlib'], 'Install matplotlib')}</li>
            <li>Install additional packages for format
                <ul class="troubleshooting-sublist">
                    <li>NetCDF: ${installLink(['netCDF4', 'h5netcdf', 'scipy'], 'Install netCDF4, h5netcdf and scipy')}</li>
                    <li>Zarr: ${installLink(['zarr'], 'Install zarr')}</li>
                    <li>GRIB: ${installLink(['cfgrib'], 'Install cfgrib')}</li>
                    <li>GeoTIFF: ${installLink(['rioxarray'], 'Install rioxarray')}</li>
                    <li>JPEG-2000: ${installLink(['rioxarray'], 'Install rioxarray')}</li>
                    <li>CDF (NASA): ${installLink(['cdflib'], 'Install cdflib')}</li>
                </ul>
            </li>
            <li>Refresh the Python environment: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → "Scientific Data Viewer: Refresh Python Environment"</li>
            <li>Finally, try to close and reopen the file to reload the page</li>
            <li><a href="#" class="small-button-link" data-action="show-logs">${ICONS.output} Check VSCode Output panel</a> for more details (choose "Scientific Data Viewer" from the dropdown)</li>
            <li>If you need more help, please report the issue on the <a href="https://github.com/etienneschalk/scientific-data-viewer/issues" target="_blank" class="external-link">Scientific Data Viewer GitHub repository ${ICONS.linkExternal}</a></li>
        </ol>
    `;
}

/** Show the error panel. Message, details and type are text (escaped). */
export function displayGlobalError(
    message: string,
    details?: string,
    errorType?: string,
): void {
    const errorDiv = document.getElementById('error');
    if (!errorDiv) {
        return;
    }
    errorDiv.innerHTML = /*html*/ `
        <h3>${ICONS.error} Error</h3>
        <p><strong>Message:</strong> <strong>${escapeHtmlMultiline(message)}</strong></p>
        ${details ? /*html*/ `<p><strong>Details:</strong> ${escapeHtmlMultiline(details)}</p>` : ''}
        ${errorType ? /*html*/ `<p><strong>Error Type:</strong> ${escapeHtml(errorType)}</p>` : ''}
        <div class="error-help">
            ${renderTroubleshootingSteps()}
            <p class="error-help-note">
                Note: If you see this message even after you have configured the Python interpreter,
                you might need to wait a few moments for the Python environment to be initialized.
                This can happen if you opened the data viewer panel right after VSCode was opened.
            </p>
        </div>
    `;
    errorDiv.classList.remove('hidden');
    document.getElementById('loading')?.classList.add('hidden');
    document.getElementById('content')?.classList.add('hidden');
    document.getElementById('header-controls')?.classList.add('hidden');
}

export function hideGlobalError(): void {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
        errorDiv.innerHTML = '';
    }
    document.getElementById('header-controls')?.classList.remove('hidden');
}

async function runExtensionCommand(
    command: string,
    args: unknown[] | undefined,
    fallbackMessage: (error: Error) => string,
): Promise<void> {
    if (messageBus.isDegradedMode) {
        return;
    }
    try {
        await messageBus.executeCommand(command, args);
    } catch (error) {
        console.error(`❌ Failed to execute ${command}:`, error);
        displayGlobalError(fallbackMessage(error as Error));
    }
}

export function executeShowLogsCommand(): Promise<void> {
    return runExtensionCommand(
        COMMAND_SHOW_LOGS,
        undefined,
        () =>
            'Failed to open extension logs. Please use Command Palette (Ctrl+Shift+P) → "Scientific Data Viewer: Show Extension Logs"',
    );
}

export function executeInstallPackagesCommand(
    packages: string[],
): Promise<void> {
    return runExtensionCommand(
        COMMAND_INSTALL_PACKAGES,
        [packages],
        (error) =>
            `Failed to install packages: ${error.message}. Please use Command Palette (Ctrl+Shift+P) → "Scientific Data Viewer: Install Python Packages"`,
    );
}

export function executeShowSettingsCommand(): Promise<void> {
    return runExtensionCommand(
        COMMAND_SHOW_SETTINGS,
        undefined,
        () =>
            'Failed to open extension settings. Please use Command Palette (Ctrl+Shift+P) → "Scientific Data Viewer: Show Settings"',
    );
}
