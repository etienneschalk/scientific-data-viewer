import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel | undefined;

    public static initialize(): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(
                'Scientific Data Viewer'
            );
        }
    }

    public static log(
        message: string,
        level: 'info' | 'warn' | 'error' | 'debug' = 'info'
    ): void {
        this.initialize();

        const timestamp = new Date().toISOString();
        const levelPrefix = `[${level.toUpperCase().padStart(8, ' ')}]`;
        const logMessage = `${timestamp} ${levelPrefix} ${message}`;

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

        // Also log to console for development (if available)
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

