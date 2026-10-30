// Run every webview scenario file (or those named) one after another.
//   node scripts/qa/webview/run-all.mjs [cancel controls render]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const names = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['render', 'controls', 'cancel'];
const failed = [];
for (const name of names) {
    console.log(`\n===== ${name} =====`);
    const { status } = spawnSync(process.execPath, [path.join(HERE, `${name}.mjs`)], { stdio: 'inherit' });
    if (status !== 0) failed.push(name);
}
console.log(failed.length ? `\nFAILED: ${failed.join(', ')}` : '\nall scenario files passed');
process.exitCode = failed.length ? 1 : 0;
