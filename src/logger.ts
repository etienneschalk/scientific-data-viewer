import * as vscode from 'vscode';

class Logger {
    private static outputChannel: vscode.OutputChannel | undefined;

    public static initialize(): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('Scientific Data Viewer');
        }
    }

    public static log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
        this.initialize();
        
        const timestamp = new Date().toISOString();
        const levelPrefix = `[${level.toUpperCase()}]`;
        const logMessage = `${timestamp} ${levelPrefix} ${message}`;
        
        // Log to VS Code output channel
        this.outputChannel?.appendLine(logMessage);
        
        // Also log to console for development
        switch (level) {
            case 'error':
                console.error(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'debug':
                console.debug(logMessage);
                break;
            default:
                console.log(logMessage);
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

export { Logger };
