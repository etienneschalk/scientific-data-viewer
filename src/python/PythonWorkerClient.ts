import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { Logger } from '../common/Logger';
import { PerformanceTimer } from '../common/PerformanceTimer';

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: PerformanceTimer;
}

/**
 * Long-lived Python worker client (JSON lines over stdin/stdout).
 */
export class PythonWorkerClient {
    private process: ChildProcess | null = null;
    private pythonPath: string | null = null;
    private stdoutBuffer = '';
    private readonly pending = new Map<string, PendingRequest>();
    private readyPromise: Promise<void> | null = null;
    private nextRequestId = 0;
    private resolveReady: (() => void) | null = null;
    private rejectReady: ((error: Error) => void) | null = null;

    async ensureStarted(pythonPath: string): Promise<void> {
        if (
            this.process &&
            !this.process.killed &&
            this.pythonPath === pythonPath
        ) {
            return;
        }

        await this.shutdown();
        this.pythonPath = pythonPath;
        this.readyPromise = this.startWorker(pythonPath);
        await this.readyPromise;
    }

    async execute(argv: string[]): Promise<unknown> {
        if (!this.pythonPath) {
            throw new Error('Python worker is not started');
        }
        await this.ensureStarted(this.pythonPath);

        const id = `req-${++this.nextRequestId}`;
        const timer = new PerformanceTimer(`python-worker:${id}`);
        timer.mark('queue');

        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject, timer });

            const payload = JSON.stringify({
                id,
                method: 'execute',
                params: { argv },
            });

            if (!this.process?.stdin?.writable) {
                this.pending.delete(id);
                reject(new Error('Python worker stdin is not writable'));
                return;
            }

            this.process.stdin.write(`${payload}\n`, (error) => {
                if (error) {
                    this.pending.delete(id);
                    reject(
                        new Error(
                            `Failed to write to Python worker: ${error.message}`,
                        ),
                    );
                }
            });
        });
    }

    async ping(): Promise<boolean> {
        if (!this.pythonPath) {
            return false;
        }
        try {
            await this.ensureStarted(this.pythonPath);
            const id = `ping-${++this.nextRequestId}`;
            await new Promise<void>((resolve, reject) => {
                this.pending.set(id, {
                    resolve: () => resolve(),
                    reject,
                    timer: new PerformanceTimer(`python-worker:${id}`),
                });
                this.process?.stdin?.write(
                    `${JSON.stringify({ id, method: 'ping' })}\n`,
                );
            });
            return true;
        } catch {
            return false;
        }
    }

    async shutdown(): Promise<void> {
        if (!this.process) {
            return;
        }

        try {
            if (this.process.stdin?.writable) {
                const id = `shutdown-${++this.nextRequestId}`;
                this.process.stdin.write(
                    `${JSON.stringify({ id, method: 'shutdown' })}\n`,
                );
            }
        } catch {
            // Ignore shutdown write errors
        }

        await new Promise<void>((resolve) => {
            const proc = this.process;
            if (!proc) {
                resolve();
                return;
            }
            const timeout = setTimeout(() => {
                proc.kill('SIGTERM');
                resolve();
            }, 2000);
            proc.once('close', () => {
                clearTimeout(timeout);
                resolve();
            });
        });

        this.process = null;
        this.readyPromise = null;
        this.stdoutBuffer = '';
        this.resolveReady = null;
        this.rejectReady = null;
        for (const [id, pending] of this.pending.entries()) {
            pending.reject(new Error('Python worker shut down'));
            this.pending.delete(id);
        }
    }

    private startWorker(pythonPath: string): Promise<void> {
        const scriptPath = path.join(
            __dirname,
            '../../../python/python_worker.py',
        );
        const timer = new PerformanceTimer('python-worker:start');

        return new Promise((resolve, reject) => {
            this.resolveReady = () => {
                timer.mark('ready');
                timer.finish('worker ready');
                resolve();
            };
            this.rejectReady = reject;

            const child = spawn(pythonPath, [scriptPath], {
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: '1',
                },
            });
            this.process = child;
            timer.mark('spawned');

            child.stdout.on('data', (chunk) => {
                this.stdoutBuffer += chunk.toString();
                this.drainStdoutBuffer();
            });

            child.stderr.on('data', (data) => {
                const text = data.toString().trim();
                if (text) {
                    Logger.debug(`🐍 [worker stderr] ${text}`);
                }
            });

            child.on('error', (error) => {
                if (this.rejectReady) {
                    this.rejectReady(
                        new Error(
                            `Python worker failed to start: ${error.message}`,
                        ),
                    );
                    this.rejectReady = null;
                    this.resolveReady = null;
                }
            });

            child.on('close', (code, signal) => {
                if (this.rejectReady) {
                    this.rejectReady(
                        new Error(
                            `Python worker exited before ready (code=${code}, signal=${signal})`,
                        ),
                    );
                    this.rejectReady = null;
                    this.resolveReady = null;
                }
                for (const [id, pending] of this.pending.entries()) {
                    pending.reject(
                        new Error(
                            `Python worker exited (code=${code}, signal=${signal})`,
                        ),
                    );
                    this.pending.delete(id);
                }
                if (this.process === child) {
                    this.process = null;
                }
            });

            setTimeout(() => {
                if (this.resolveReady) {
                    const rejectReady = this.rejectReady;
                    this.rejectReady = null;
                    this.resolveReady = null;
                    rejectReady?.(new Error('Python worker ready timeout'));
                    child.kill('SIGTERM');
                }
            }, 30000);
        });
    }

    private drainStdoutBuffer(): void {
        let newlineIndex = this.stdoutBuffer.indexOf('\n');
        while (newlineIndex >= 0) {
            const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
            this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
            if (line) {
                this.handleWorkerLine(line);
            }
            newlineIndex = this.stdoutBuffer.indexOf('\n');
        }
    }

    private handleWorkerLine(line: string): void {
        let message: Record<string, unknown>;
        try {
            message = JSON.parse(line) as Record<string, unknown>;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            Logger.warn(
                `🐍 [worker] Invalid JSON line (${message}): ${line.slice(0, 200)}`,
            );
            return;
        }

        if (message.event === 'ready') {
            if (this.resolveReady) {
                const resolveReady = this.resolveReady;
                this.resolveReady = null;
                this.rejectReady = null;
                resolveReady();
            }
            return;
        }

        const id = message.id;
        if (typeof id !== 'string') {
            return;
        }

        const pending = this.pending.get(id);
        if (!pending) {
            return;
        }

        this.pending.delete(id);
        pending.timer.mark('response');

        if (typeof message.error === 'string') {
            pending.timer.finish('error');
            pending.reject(new Error(message.error));
            return;
        }

        pending.timer.finish('ok');
        pending.resolve(message.result);
    }
}
