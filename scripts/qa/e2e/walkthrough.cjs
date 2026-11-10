#!/usr/bin/env node
// Getting Started walkthrough: every path a new user can take to a first plot,
// each in a fresh VS Code profile (scripts/qa/README.md § Walkthrough).
//
//   node scripts/qa/e2e/walkthrough.cjs [w1 w2 ...]
//
// Each scenario is one runner.cjs run (--fresh, plus its own options) of one
// file of scripts/qa/e2e/walkthrough/. Report: <SDV_QA_OUT>/e2e/walkthrough/
// REPORT.md and summary.json; each run's results.json and extension.log in
// <SDV_QA_OUT>/e2e/runs/walkthrough-<id>/.
// Exit: 0 every scenario passed, 1 a scenario failed (or hit its time limit),
// 3 none failed but some could not run (Python extension not downloadable: no
// network).
// Watchdog: a scenario stops at its first failure (mocha bail) and VS Code then
// closes; if a run still goes past its limit (SDV_WALKTHROUGH_LIMIT_S, default
// 1200 s), its process group and every process using its profile folder are
// killed, so no window is left open, and the scenario is reported TIMEOUT.
// Env: as runner.cjs; SDV_PYTHON is the "own interpreter" of the scenarios
// (Python >= 3.10 with xarray, netCDF4, matplotlib). Needs uv (W1, W2) and
// network (uv packages, Python extension).
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const { E, UV_PY } = require('./paths.cjs');

const DIR = path.join(__dirname, 'walkthrough');
const SCENARIOS = [
    {
        id: 'w1',
        title: 'Extension-managed Python (uv), sample opened first, then own interpreter',
        file: 'w1_uv.test.cjs',
        args: [],
    },
    {
        id: 'w2',
        title: 'Own interpreter without packages, Install buttons of the viewer',
        file: 'w2_install_buttons.test.cjs',
        args: [],
    },
    { id: 'w3', title: 'uv not installed, then own interpreter', file: 'w3_no_uv.test.cjs', args: ['--hide-uv'] },
    {
        id: 'w4',
        title: 'Python extension installed before VS Code starts',
        file: 'w4_python_extension.test.cjs',
        args: ['--with-extensions', '--install-extension', 'ms-python.python'],
    },
    {
        id: 'w5',
        title: 'Python extension installed while VS Code runs',
        file: 'w5_python_extension_later.test.cjs',
        args: ['--with-extensions'],
    },
];

const LIMIT_S = Number(process.env.SDV_WALKTHROUGH_LIMIT_S) || 1200;

/** Kill a run: its process group, then anything still using its profile. */
function killRun(child, runDir) {
    try {
        process.kill(-child.pid, 'SIGKILL');
    } catch {
        // already gone
    }
    try {
        // VS Code may start helpers in other process groups; they all have
        // the run's --user-data-dir / --extensions-dir on their command line
        execFileSync('pkill', ['-KILL', '-f', '--', runDir]);
    } catch {
        // pkill exits 1 when nothing matched
    }
}

/** Run one scenario in its own VS Code; resolves with its exit code. */
function runWithLimit(scenario, runName, runDir) {
    return new Promise((resolve) => {
        const child = spawn(
            process.execPath,
            [path.join(__dirname, 'runner.cjs'), runName, '--fresh', ...scenario.args, path.join(DIR, scenario.file)],
            { stdio: 'inherit', env: process.env, detached: true },
        );
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            console.error(`WALKTHROUGH: ${scenario.id} still running after ${LIMIT_S} s, closing its VS Code`);
            killRun(child, runDir);
        }, LIMIT_S * 1000);
        child.on('exit', (code) => {
            clearTimeout(timer);
            // Leave nothing behind, even when the runner exited first
            killRun(child, runDir);
            resolve({ code, timedOut });
        });
    });
}

async function runScenario(scenario) {
    const runName = `walkthrough-${scenario.id}`;
    const runDir = path.join(E, 'runs', runName);
    const t0 = Date.now();
    const r = await runWithLimit(scenario, runName, runDir);
    let results = [];
    try {
        results = JSON.parse(fs.readFileSync(path.join(runDir, 'results.json'), 'utf8'));
    } catch {
        // VS Code did not start, or no test recorded anything
    }
    const status = r.timedOut ? 'TIMEOUT' : r.code === 0 ? 'PASS' : r.code === 4 ? 'SKIP' : 'FAIL';
    return { ...scenario, status, exitCode: r.code, seconds: Math.round((Date.now() - t0) / 1000), runDir, results };
}

function report(outcomes) {
    const lines = [
        '# Getting Started walkthrough, fresh VS Code',
        '',
        `Own interpreter of the scenarios: \`${UV_PY}\``,
        '',
        '| Scenario | Path to a first plot | Result | Time |',
        '| --- | --- | --- | --- |',
        ...outcomes.map((o) => `| ${o.id.toUpperCase()} | ${o.title} | ${o.status} | ${o.seconds} s |`),
        '',
    ];
    for (const o of outcomes) {
        lines.push(`## ${o.id.toUpperCase()}: ${o.title}`, '', `${o.status} (exit ${o.exitCode}). Logs: \`${o.runDir}/extension.log\``, '');
        for (const r of o.results) {
            const { s, step, ...rest } = r;
            lines.push(`- **${step}**: \`${JSON.stringify(rest).slice(0, 600)}\``);
        }
        lines.push('');
    }
    return lines.join('\n');
}

async function main() {
    const wanted = process.argv.slice(2).map((a) => a.toLowerCase());
    const scenarios = wanted.length ? SCENARIOS.filter((s) => wanted.includes(s.id)) : SCENARIOS;
    if (scenarios.length === 0) {
        console.error(`unknown scenario; known: ${SCENARIOS.map((s) => s.id).join(' ')}`);
        process.exit(2);
    }
    const outcomes = [];
    for (const scenario of scenarios) outcomes.push(await runScenario(scenario));
    const out = path.join(E, 'walkthrough');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(outcomes, null, 2));
    fs.writeFileSync(path.join(out, 'REPORT.md'), report(outcomes));
    const count = (status) => outcomes.filter((o) => o.status === status).length;
    const failed = count('FAIL') + count('TIMEOUT');
    const summary = `${count('PASS')} passed, ${count('FAIL')} failed, ${count('TIMEOUT')} timed out, ${count('SKIP')} could not run (of ${outcomes.length})`;
    for (const o of outcomes) console.log(`${o.status}  ${o.id}  ${o.title} (${o.seconds} s)`);
    console.log(`SUMMARY: ${summary}; report: ${path.join(out, 'REPORT.md')}`);
    process.exit(failed ? 1 : count('SKIP') ? 3 : 0);
}
main();
