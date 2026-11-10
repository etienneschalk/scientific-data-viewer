#!/usr/bin/env node
// Run end-to-end QA suites inside a real VS Code (see scripts/qa/README.md).
//
//   node scripts/qa/e2e/runner.cjs <run-name> [--settings <file.json>] [options] [suite files...]
//
// Without suite files, every scripts/qa/e2e/suite/*.test.cjs runs. Results go
// to <SDV_QA_OUT>/e2e/runs/<run-name>/ (results.json, extension.log).
//
// Options for the "fresh installation" runs of the Getting Started walkthrough
// (scripts/qa/e2e/walkthrough.cjs):
//   --fresh                 no overridePythonInterpreter preset: the extension
//                           looks for Python like on a new machine
//   --with-extensions       do not pass --disable-extensions (needed to install
//                           or use another extension, e.g. the Python extension)
//   --install-extension ID  install an extension in the run's profile before
//                           VS Code starts (repeatable; network); exit 4 if it fails
//   --hide-uv               the extension host's PATH has no folder with uv
// Env: SDV_QA_OUT (default <repo>/artefacts/qa), SDV_PYTHON, SDV_KERCHUNK_PYTHON,
// SDV_NO_KERCHUNK_PYTHON (default SDV_PYTHON),
// SDV_VSCODE_VERSION (default 1.144.0), EXT_ROOT (extension folder to test).
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { REPO, E, UV_PY } = require('./paths.cjs');
const { runTests } = require(path.join(REPO, 'node_modules', '@vscode/test-electron'));

function parseArgs(argv) {
    const [runName, ...rest] = argv;
    let settingsFile = null;
    const files = [];
    const options = { fresh: false, withExtensions: false, install: [], hideUv: false };
    for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--settings') settingsFile = rest[++i];
        else if (rest[i] === '--fresh') options.fresh = true;
        else if (rest[i] === '--with-extensions') options.withExtensions = true;
        else if (rest[i] === '--install-extension') options.install.push(rest[++i]);
        else if (rest[i] === '--hide-uv') options.hideUv = true;
        else files.push(path.resolve(rest[i]));
    }
    if (!runName) {
        console.error('usage: runner.cjs <run-name> [--settings file.json] [suite files...]');
        process.exit(2);
    }
    if (files.length === 0) {
        const dir = path.join(__dirname, 'suite');
        files.push(...fs.readdirSync(dir).filter((f) => f.endsWith('.test.cjs')).sort().map((f) => path.join(dir, f)));
    }
    return { runName, settingsFile, files, options };
}

/** Interpreter without xarray, for the "environment not ready" scenarios. */
function ensureThrowawayVenv() {
    const venv = path.join(E, 'throwaway-venv');
    if (fs.existsSync(path.join(venv, 'bin', 'python'))) return;
    const uv = spawnSync('uv', ['venv', '-q', venv], { stdio: 'inherit' });
    if (uv.status !== 0) spawnSync('python3', ['-m', 'venv', venv], { stdio: 'inherit' });
}

/** PATH without the folders that hold a `uv` executable. */
function pathWithoutUv() {
    return (process.env.PATH || '')
        .split(path.delimiter)
        .filter((dir) => dir && !fs.existsSync(path.join(dir, 'uv')) && !fs.existsSync(path.join(dir, 'uv.exe')))
        .join(path.delimiter);
}

/** Install extensions in the run's profile with the CLI of the test VS Code. */
async function installExtensions(ids, version, userData, extensionsDir) {
    if (ids.length === 0) return;
    const { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } = require(
        path.join(REPO, 'node_modules', '@vscode/test-electron'),
    );
    const executable = await downloadAndUnzipVSCode({ version, cachePath: path.join(REPO, '.vscode-test') });
    const cli = resolveCliPathFromVSCodeExecutablePath(executable);
    for (const id of ids) {
        const r = spawnSync(
            cli,
            ['--user-data-dir', userData, '--extensions-dir', extensionsDir, '--install-extension', id],
            { encoding: 'utf8', timeout: 300000 },
        );
        process.stdout.write(r.stdout || '');
        process.stderr.write(r.stderr || '');
        if (r.status !== 0) {
            console.error(`RUNNER: could not install ${id} (network?)`);
            process.exit(4);
        }
    }
}

async function main() {
    const { runName, settingsFile, files, options } = parseArgs(process.argv.slice(2));
    const version = process.env.SDV_VSCODE_VERSION || '1.144.0';
    const runDir = path.join(E, 'runs', runName);
    fs.rmSync(runDir, { recursive: true, force: true });
    const userData = path.join(runDir, 'userdata');
    fs.mkdirSync(path.join(userData, 'User'), { recursive: true });
    fs.mkdirSync(path.join(E, 'ws'), { recursive: true });
    ensureThrowawayVenv();
    const settings = {
        ...(options.fresh ? {} : { 'scientificDataViewer.python.overridePythonInterpreter': UV_PY }),
        'security.workspace.trust.enabled': false,
        'workbench.startupEditor': 'none',
        'extensions.autoUpdate': false,
        'telemetry.telemetryLevel': 'off',
        ...(settingsFile ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {}),
    };
    fs.writeFileSync(path.join(userData, 'User', 'settings.json'), JSON.stringify(settings, null, 2));
    const extensionRoot = process.env.EXT_ROOT || REPO;
    const extensionsDir = path.join(runDir, 'exts');
    await installExtensions(options.install, version, userData, extensionsDir);
    try {
        await runTests({
            version,
            cachePath: path.join(REPO, '.vscode-test'),
            extensionDevelopmentPath: extensionRoot,
            extensionTestsPath: path.join(__dirname, 'suite', 'index.cjs'),
            launchArgs: [
                path.join(E, 'ws'),
                ...(options.withExtensions ? [] : ['--disable-extensions']),
                '--no-sandbox',
                '--disable-gpu',
                '--user-data-dir',
                userData,
                '--extensions-dir',
                extensionsDir,
            ],
            extensionTestsEnv: {
                ...(options.hideUv ? { PATH: pathWithoutUv() } : {}),
                SDV_E2E_FRESH: options.fresh ? '1' : '',
                SDV_E2E_FILES: files.join(','),
                SDV_E2E_RUN_DIR: runDir,
                SDV_E2E_EXT_ROOT: extensionRoot,
            },
        });
        console.log('RUNNER: all passed');
    } catch (err) {
        console.error('RUNNER: failures', err && err.message);
        process.exit(1);
    }
}
main();
