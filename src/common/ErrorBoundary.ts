/**
 * Error boundary system for centralized error handling
 */

import * as vscode from 'vscode';
import { Logger } from './Logger';
import { ErrorContext, ErrorHandler } from '../types';
import { getDisplayName } from './vscodeutils';

export class ErrorBoundary {
    private static instance: ErrorBoundary;
    private errorHandlers: Map<string, ErrorHandler> = new Map();
    private globalErrorHandler?: ErrorHandler;
    private errorHistory: Array<{
        error: Error;
        context: ErrorContext;
        timestamp: Date;
    }> = [];
    private maxHistorySize = 100;

    // No process-wide hooks (e.g. process.on('uncaughtException')): the
    // extension host is shared with other extensions, whose errors must not be
    // reported (or counted) as ours. Only errors passed to handleError /
    // wrapAsync are handled here.
    private constructor() {}

    static getInstance(): ErrorBoundary {
        if (!ErrorBoundary.instance) {
            ErrorBoundary.instance = new ErrorBoundary();
        }
        return ErrorBoundary.instance;
    }

    registerHandler(component: string, handler: ErrorHandler): void {
        this.errorHandlers.set(component, handler);
        Logger.info(`🩹 Error handler registered for component: ${component}`);
    }

    /** Remove a component's handler (call it when the component is disposed). */
    unregisterHandler(component: string): void {
        if (this.errorHandlers.delete(component)) {
            Logger.info(
                `🩹 Error handler unregistered for component: ${component}`,
            );
        }
    }

    registerGlobalHandler(handler: ErrorHandler): void {
        this.globalErrorHandler = handler;
        Logger.info('🩹 Global error handler registered');
    }

    handleError(error: Error, context: ErrorContext): void {
        // Add to error history
        this.addToHistory(error, context);

        // Log the error
        Logger.error(
            `🩹 Error in ${context.component}.${context.operation}: ${error.message}`,
        );

        // Try component-specific handler first
        const componentHandler = this.errorHandlers.get(context.component);
        if (componentHandler) {
            try {
                componentHandler(error, context);
                return;
            } catch (handlerError) {
                Logger.error(
                    `🩹 Error in component handler for ${context.component}: ${handlerError}`,
                );
            }
        }

        // Fall back to global handler
        if (this.globalErrorHandler) {
            try {
                this.globalErrorHandler(error, context);
                return;
            } catch (globalHandlerError) {
                Logger.error(
                    `🩹 Error in global handler: ${globalHandlerError}`,
                );
            }
        }

        // Default error handling
        this.defaultErrorHandler(error, context);
    }

    private addToHistory(error: Error, context: ErrorContext): void {
        this.errorHistory.push({
            error,
            context,
            timestamp: new Date(),
        });

        // Keep only the most recent errors
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }

    private defaultErrorHandler(error: Error, context: ErrorContext): void {
        // Show user-friendly error message
        const userMessage = this.getUserFriendlyMessage(error, context);

        vscode.window
            .showErrorMessage(
                `${getDisplayName()} Error: ${userMessage}`,
                'Show Details',
                'Report Issue',
            )
            .then((selection) => {
                if (selection === 'Show Details') {
                    this.showErrorDetails(error, context);
                } else if (selection === 'Report Issue') {
                    this.openIssueReport(error, context);
                }
            });
    }

    private getUserFriendlyMessage(
        error: Error,
        context: ErrorContext,
    ): string {
        // Map technical errors to user-friendly messages
        if (error.message.includes('Python environment not ready')) {
            // The message says why (no interpreter, missing packages...)
            return `${error.message}. Please configure the Python interpreter.`;
        }

        if (error.message.includes('Missing Python package')) {
            return 'Required Python packages are missing. Please install them.';
        }

        if (error.message.includes('File not found')) {
            return 'The selected file could not be found.';
        }

        if (error.message.includes('Permission denied')) {
            return 'Permission denied. Please check file permissions.';
        }

        if (error.message.includes('File too large')) {
            return 'File is too large to process. Please increase the file size limit in settings.';
        }

        // Default message
        return `An error occurred in ${context.component}: ${error.message}`;
    }

    private showErrorDetails(error: Error, context: ErrorContext): void {
        const details = `
Error Details:
Component: ${context.component}
Operation: ${context.operation}
Message: ${error.message}
Stack: ${error.stack || 'No stack trace available'}
Timestamp: ${new Date().toISOString()}
        `.trim();

        vscode.window.showInformationMessage(details);
    }

    private openIssueReport(error: Error, context: ErrorContext): void {
        const issueBody = `
**Error Details:**
- Component: ${context.component}
- Operation: ${context.operation}
- Error: ${error.message}
- Stack: \`\`\`\n${error.stack || 'No stack trace'}\n\`\`\`

**Context:**
${context.data ? `- Data: ${JSON.stringify(context.data, null, 2)}` : ''}
${context.userAction ? `- User Action: ${context.userAction}` : ''}

**Environment:**
- VSCode Version: ${vscode.version}
- Extension Version: [Please fill in]
- OS: ${process.platform}
        `.trim();

        const issueUrl = `https://github.com/etienneschalk/scientific-data-viewer/issues/new?title=Error in ${
            context.component
        }&body=${encodeURIComponent(issueBody)}`;

        vscode.env.openExternal(vscode.Uri.parse(issueUrl));
    }

    // Utility methods
    getErrorHistory(): Array<{
        error: Error;
        context: ErrorContext;
        timestamp: Date;
    }> {
        return [...this.errorHistory];
    }

    // Wrapper for async operations
    async wrapAsync<T>(
        operation: () => Promise<T>,
        context: ErrorContext,
    ): Promise<T | null> {
        try {
            return await operation();
        } catch (error) {
            this.handleError(
                error instanceof Error ? error : new Error(String(error)),
                context,
            );
            return null;
        }
    }

    // Cleanup
    dispose(): void {
        this.errorHandlers.clear();
        this.errorHistory = [];
        this.globalErrorHandler = undefined;
    }
}
