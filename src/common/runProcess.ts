import { spawn } from 'child_process';

/** Grace period between SIGTERM and SIGKILL when a process is stopped. */
const KILL_GRACE_MS = 1000;

export interface RunProcessOptions {
    /** Stop the process (SIGTERM, then SIGKILL) after this many milliseconds. */
    timeoutMs?: number;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    /** Called with each decoded stdout chunk. */
    onStdout?: (chunk: string) => void;
    /** Called with each decoded stderr chunk. */
    onStderr?: (chunk: string) => void;
    /** Aborting the signal stops the process (SIGTERM, then SIGKILL). */
    signal?: AbortSignal;
}

export interface RunProcessResult {
    /** Exit code, or null when the process was ended by a signal. */
    code: number | null;
    /** Signal that ended the process, if any. */
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
    /** True when the process was stopped because `timeoutMs` elapsed. */
    timedOut: boolean;
    /** True when the process was stopped through `signal`. */
    aborted: boolean;
}

/**
 * Run a command and collect its output.
 *
 * The command is spawned without a shell: each argument reaches the program
 * unmodified (no quoting needed, no `>`/`<` redirections, no injection).
 * Resolves when the process exits, whatever its exit code; rejects only when
 * the process cannot be started (e.g. ENOENT when the command is not found).
 */
export function runProcess(
    command: string,
    args: readonly string[],
    options: RunProcessOptions = {},
): Promise<RunProcessResult> {
    return new Promise((resolve, reject) => {
        if (options.signal?.aborted) {
            resolve({
                code: null,
                signal: null,
                stdout: '',
                stderr: '',
                timedOut: false,
                aborted: true,
            });
            return;
        }

        const child = spawn(command, [...args], {
            shell: false,
            cwd: options.cwd,
            env: options.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let aborted = false;
        let settled = false;
        let timeoutHandle: NodeJS.Timeout | undefined;
        let killHandle: NodeJS.Timeout | undefined;

        const stop = () => {
            if (child.exitCode !== null || child.signalCode !== null) {
                return;
            }
            child.kill('SIGTERM');
            killHandle = setTimeout(() => {
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill('SIGKILL');
                }
            }, KILL_GRACE_MS);
        };

        const onAbort = () => {
            aborted = true;
            stop();
        };

        const cleanup = () => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            if (killHandle) {
                clearTimeout(killHandle);
            }
            options.signal?.removeEventListener('abort', onAbort);
        };

        if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
            timeoutHandle = setTimeout(() => {
                timedOut = true;
                stop();
            }, options.timeoutMs);
        }
        options.signal?.addEventListener('abort', onAbort);

        child.stdout?.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stdout += chunk;
            options.onStdout?.(chunk);
        });
        child.stderr?.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stderr += chunk;
            options.onStderr?.(chunk);
        });

        child.on('error', (error) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            reject(error);
        });

        child.on('close', (code, signal) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            resolve({ code, signal, stdout, stderr, timedOut, aborted });
        });
    });
}

/**
 * Format a command for logs so it can be copy-pasted into a shell.
 * Display only: never pass the result to spawn.
 */
export function formatCommandForDisplay(
    command: string,
    args: readonly string[],
): string {
    return [command, ...args].map(quoteForDisplay).join(' ');
}

function quoteForDisplay(value: string): string {
    return /^[\w@%+:,./\\-]+$/.test(value)
        ? value
        : `"${value.replace(/"/g, '\\"')}"`;
}
