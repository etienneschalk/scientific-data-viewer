// Themes the screenshots are taken with: VS Code's built-in defaults.
// `id` names the JSON file in themes/ and the screenshot folder.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const THEMES_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'themes',
);

export const THEMES = [
    { id: 'dark-modern', vscodeName: 'Default Dark Modern' },
    { id: 'light-modern', vscodeName: 'Default Light Modern' },
    { id: 'high-contrast', vscodeName: 'Default High Contrast' },
    { id: 'high-contrast-light', vscodeName: 'Default High Contrast Light' },
];
