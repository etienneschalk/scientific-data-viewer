import * as vscode from 'vscode';
import { EnvironmentInfo } from './types';
import { getDisplayName } from './common/vscodeutils';
import { CMD_HEALTHCHECK } from './common/config';

// Function to update status bar with current Python interpreter
export function updateStatusBarItem(
    envInfo: EnvironmentInfo,
    statusBarItem: vscode.StatusBarItem
) {
    statusBarItem.backgroundColor = undefined;

    let icon;
    let tooltipStatus;
    if (!envInfo.initialized) {
        // Not initialized yet: we do not know if it will work or not
        tooltipStatus = 'Not initialized yet';
        icon = '$(question)';
    } else if (envInfo.ready) {
        // Initialized and ready: we know it will work
        tooltipStatus = 'Initialized and ready (all core packages installed)';
        icon = '$(check)';
    } else {
        // Initialized but not ready: we know it will not work
        tooltipStatus = 'Initialized but not ready (missing core packages)';
        icon = '$(x)';
    }

    const source = envInfo.source ?? 'unknown';
    statusBarItem.text = `${icon} SDV ${source}`;
    statusBarItem.tooltip = `${getDisplayName()} - State

Status: 
${tooltipStatus} 

Environment Source:
${source}

Environment Python interpreter path: 
${envInfo.path ?? 'Not set'}

Click to run healthcheck
`;

    statusBarItem.command = CMD_HEALTHCHECK;
    statusBarItem.show();
}
