#!/usr/bin/env node
// Run end-to-end QA suites inside a real VS Code (see scripts/qa/README.md).
//
//   node scripts/qa/e2e/runner.cjs <run-name> [--settings <file.json>] [suite files...]
//
// Without suite files, every scripts/qa/e2e/suite/*.test.cjs runs. Results go
// to <SDV_QA_OUT>/e2e/runs/<run-name>/ (results.json, extension.log).
// Env: SDV_QA_OUT (default <repo>/.qa), SDV_PYTHON, SDV_KERCHUNK_PYTHON,
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
    for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--settings') settingsFile = rest[++i];
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
    return { runName, settingsFile, files };
}

/** Interpreter without xarray, for the "environment not ready" scenarios. */
function ensureThrowawayVenv() {
    const venv = path.join(E, 'throwaway-venv');
    if (fs.existsSync(path.join(venv, 'bin', 'python'))) return;
    const uv = spawnSync('uv', ['venv', '-q', venv], { stdio: 'inherit' });
    if (uv.status !== 0) spawnSync('python3', ['-m', 'venv', venv], { stdio: 'inherit' });
}

async function main() {
    const { runName, settingsFile, files } = parseArgs(process.argv.slice(2));
    const runDir = path.join(E, 'runs', runName);
    fs.rmSync(runDir, { recursive: true, force: true });
    const userData = path.join(runDir, 'userdata');
    fs.mkdirSync(path.join(userData, 'User'), { recursive: true });
    fs.mkdirSync(path.join(E, 'ws'), { recursive: true });
    ensureThrowawayVenv();
    const settings = {
        'scientificDataViewer.python.overridePythonInterpreter': UV_PY,
        'security.workspace.trust.enabled': false,
        'workbench.startupEditor': 'none',
        'extensions.autoUpdate': false,
        'telemetry.telemetryLevel': 'off',
        ...(settingsFile ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {}),
    };
    fs.writeFileSync(path.join(userData, 'User', 'settings.json'), JSON.stringify(settings, null, 2));
    const extensionRoot = process.env.EXT_ROOT || REPO;
    try {
        await runTests({
            version: process.env.SDV_VSCODE_VERSION || '1.144.0',
            cachePath: path.join(REPO, '.vscode-test'),
            extensionDevelopmentPath: extensionRoot,
            extensionTestsPath: path.join(__dirname, 'suite', 'index.cjs'),
            launchArgs: [
                path.join(E, 'ws'),
                '--disable-extensions',
                '--no-sandbox',
                '--disable-gpu',
                '--user-data-dir',
                userData,
                '--extensions-dir',
                path.join(runDir, 'exts'),
            ],
            extensionTestsEnv: {
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
