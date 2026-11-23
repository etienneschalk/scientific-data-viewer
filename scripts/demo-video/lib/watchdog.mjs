// Watchdog of a demo recording, in its own detached process: when the
// recorder exits (even killed with SIGKILL) or runs past its time limit, kill
// every process whose command line names the run folder (the offscreen VS Code
// and its helpers), so nothing is left running.
//
//   node watchdog.mjs <recorder pid> <limit seconds>   (env SDV_DEMO_RUN_DIR)
//
// The run folder comes from the environment, not the command line, so that
// `pkill -f <run folder>` does not match the watchdog itself.
import { execFileSync } from 'node:child_process';

const [recorderPid, limitS] = process.argv.slice(2).map(Number);
const runDir = process.env.SDV_DEMO_RUN_DIR;
const t0 = Date.now();

const alive = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
};

setInterval(() => {
    const recorderGone = !alive(recorderPid);
    const late = (Date.now() - t0) / 1000 > limitS;
    if (!recorderGone && !late) {
        return;
    }
    if (late && !recorderGone) {
        console.error(`demo-video watchdog: still recording after ${limitS} s, stopping`);
        try {
            process.kill(recorderPid, 'SIGTERM');
        } catch {
            // gone meanwhile
        }
    }
    try {
        execFileSync('pkill', ['-KILL', '-f', '--', runDir]);
    } catch {
        // nothing matched
    }
    process.exit(0);
}, 1000);
