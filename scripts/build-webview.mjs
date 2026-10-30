// Bundle the webview TypeScript (src/panel/webview/main.ts) into ONE classic
// script, out/webview/webview.js. A single file is required: exported HTML
// inlines it (HTMLGenerator.inlineWebviewAssets).
//
//   node scripts/build-webview.mjs          one-off build (npm run compile)
//   node scripts/build-webview.mjs --watch  rebuild on change
//   node scripts/build-webview.mjs --watch --with-tsc
//                                           also run `tsc -watch -p ./` for the
//                                           extension host (npm run watch)
import * as esbuild from 'esbuild';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8'),
);

// Shown in the webview's troubleshooting list; `.zip` is zipped Zarr.
const supportedExtensions = [
    ...packageJson.contributes.languages.flatMap(
        (language) => language.extensions ?? [],
    ),
    '.zip',
];

const options = {
    entryPoints: [join(root, 'src', 'panel', 'webview', 'main.ts')],
    outfile: join(root, 'out', 'webview', 'webview.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2021',
    charset: 'utf8',
    legalComments: 'none',
    define: {
        __SUPPORTED_EXTENSIONS__: JSON.stringify(supportedExtensions),
    },
    logLevel: 'info',
};

if (process.argv.includes('--watch')) {
    const context = await esbuild.context(options);
    await context.watch();
    if (process.argv.includes('--with-tsc')) {
        const tsc = createRequire(import.meta.url).resolve(
            'typescript/bin/tsc',
        );
        spawn(process.execPath, [tsc, '-watch', '-p', root], {
            stdio: 'inherit',
        }).on('exit', (code) => process.exit(code ?? 0));
    }
} else {
    await esbuild.build(options);
}
