// Runs inside a VS Code instance started by capture-themes.mjs (as its
// "extension tests"): switches through the built-in color themes and records
// what a webview receives from VS Code for each of them (--vscode-* variables
// on <html>, theme classes and data attributes on <body>, default styles).
// CommonJS: VS Code loads extension test entry points with require().
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const THEMES = JSON.parse(process.env.SDV_THEMES);
const OUT_DIR = process.env.SDV_THEMES_DIR;

const PAGE = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head><body>
<script>
    const vscode = acquireVsCodeApi();
    // VS Code sets the theme on the document after load; give it a moment
    setTimeout(() => {
        const body = {};
        for (const attr of document.body.attributes) body[attr.name] = attr.value;
        vscode.postMessage({
            htmlStyle: document.documentElement.getAttribute('style') || '',
            body,
            defaultStyles: document.getElementById('_defaultStyles')?.textContent || '',
        });
    }, 500);
</script>
</body></html>`;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureTheme(theme) {
    await vscode.workspace
        .getConfiguration('workbench')
        .update(
            'colorTheme',
            theme.vscodeName,
            vscode.ConfigurationTarget.Global,
        );
    await sleep(1500);
    const panel = vscode.window.createWebviewPanel(
        'sdvThemeCapture',
        `Theme capture: ${theme.vscodeName}`,
        vscode.ViewColumn.One,
        { enableScripts: true },
    );
    try {
        const captured = await new Promise((resolve, reject) => {
            const timer = setTimeout(
                () =>
                    reject(
                        new Error(
                            `No answer from the webview for ${theme.vscodeName}`,
                        ),
                    ),
                20000,
            );
            panel.webview.onDidReceiveMessage((message) => {
                clearTimeout(timer);
                resolve(message);
            });
            panel.webview.html = PAGE;
        });
        const result = {
            id: theme.id,
            vscodeName: theme.vscodeName,
            vscodeVersion: vscode.version,
            ...captured,
        };
        fs.writeFileSync(
            path.join(OUT_DIR, `${theme.id}.json`),
            JSON.stringify(result, null, 4) + '\n',
        );
        console.log(`[theme-capture] ${theme.vscodeName} -> ${theme.id}.json`);
    } finally {
        panel.dispose();
    }
}

async function run() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const theme of THEMES) {
        await captureTheme(theme);
    }
}

module.exports = { run };
