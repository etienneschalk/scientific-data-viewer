import * as vscode from 'vscode';
import { getDisplayName } from './vscodeutils';
import { threadId } from 'worker_threads';

export class Logger {
    private static outputChannel?: vscode.OutputChannel;

    /** Thread label in log lines ("T0" in the extension host's main thread). */
    private static readonly threadLabel = `T${threadId}`;

    public static initialize(): void {
        if (!this.outputChannel) {
            this.outputChannel =
                vscode.window.createOutputChannel(getDisplayName());
        }
    }

    public static log(
        message: string,
        level: 'info' | 'warn' | 'error' | 'debug' = 'info',
    ): void {
        this.initialize();

        const timestamp = new Date().toISOString();
        const levelPrefix = `[${level.toUpperCase().padStart(8, ' ')}]`;
        const logMessage = `${timestamp} ${levelPrefix} [${this.threadLabel}] ${message}`;

        // Log to VS Code output channel (if available and not disposed)
        try {
            this.outputChannel?.appendLine(logMessage);
        } catch (error) {
            // Ignore errors if the channel has been disposed
            if (
                error instanceof Error &&
                !error.message.includes('Channel has been closed')
            ) {
                console.warn('Logger output channel error:', error);
            }
        }

        // When running under the test runner (CI), write only to stderr once so logs
        // are visible in the test output without duplication (console.* would also
        // be forwarded and duplicate INFO and above).
        if (process.env.SCIENTIFIC_DATA_VIEWER_VERBOSE_LOGS === '1') {
            try {
                process.stderr.write(logMessage + '\n');
            } catch {
                // ignore if stderr is not writable
            }
            return;
        }

        // Log to console for development (if available)
        if (
            typeof console !== 'undefined' &&
            console &&
            typeof console.log === 'function'
        ) {
            switch (level) {
                case 'error':
                    if (typeof console.error === 'function') {
                        console.error(logMessage);
                    }
                    break;
                case 'warn':
                    if (typeof console.warn === 'function') {
                        console.warn(logMessage);
                    }
                    break;
                case 'debug':
                    if (typeof console.debug === 'function') {
                        console.debug(logMessage);
                    }
                    break;
                default:
                    if (typeof console.log === 'function') {
                        console.log(logMessage);
                    }
            }
        }
    }

    public static info(message: string): void {
        this.log(message, 'info');
    }

    public static warn(message: string): void {
        this.log(message, 'warn');
    }

    public static error(message: string): void {
        this.log(message, 'error');
    }

    public static debug(message: string): void {
        this.log(message, 'debug');
    }

    public static show(): void {
        this.initialize();
        this.outputChannel?.show();
    }

    public static dispose(): void {
        this.outputChannel?.dispose();
        this.outputChannel = undefined;
    }
}
