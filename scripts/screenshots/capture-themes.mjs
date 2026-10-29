#!/usr/bin/env node
// Record the theme variables VS Code gives a webview, for take-screenshots.mjs.
//
// Starts a real VS Code (downloaded and cached in .vscode-test/ by
// @vscode/test-electron, like `npm test`) with a throw-away extension that
// switches through the built-in color themes, and writes one JSON file per
// theme to scripts/screenshots/themes/. Re-run when VS Code changes its
// default themes. Needs a display (Linux: DISPLAY or xvfb-run).
//
// Usage: node scripts/screenshots/capture-themes.mjs [--vscode-version 1.105.0]
import { runTests } from '@vscode/test-electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { THEMES, THEMES_DIR } from './themes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIR = path.join(HERE, 'theme-capture-extension');

const { values } = parseArgs({
    options: { 'vscode-version': { type: 'string' } },
});

// Set by the VS Code integrated terminal; it would start VS Code as plain Node
delete process.env.ELECTRON_RUN_AS_NODE;

try {
    await runTests({
        version: values['vscode-version'],
        extensionDevelopmentPath: EXTENSION_DIR,
        extensionTestsPath: path.join(EXTENSION_DIR, 'index.js'),
        launchArgs: ['--disable-extensions', '--no-sandbox', '--disable-gpu'],
        extensionTestsEnv: {
            SDV_THEMES: JSON.stringify(THEMES),
            SDV_THEMES_DIR: THEMES_DIR,
        },
    });
    console.log(`Themes written to ${path.relative(process.cwd(), THEMES_DIR)}`);
} catch (error) {
    console.error('Theme capture failed:', error);
    process.exit(1);
}
