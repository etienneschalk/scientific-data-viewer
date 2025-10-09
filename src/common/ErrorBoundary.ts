/**
 * Error boundary system for centralized error handling
 */

import * as vscode from 'vscode';
import { Logger } from './Logger';
import { ErrorContext, ErrorHandler } from '../types';
import { getDisplayName } from './vscodeutils';

export class ErrorBoundary {
    private static instance: ErrorBoundary;
    private errorHandlers: Map<any, ErrorHandler> = new Map();
    private globalErrorHandler?: ErrorHandler;
    private errorHistory: Array<{
        error: Error;
        context: ErrorContext;
        timestamp: Date;
    }> = [];
    private maxHistorySize = 100;

    private constructor() {
        this.setupGlobalErrorHandling();
    }

    static getInstance(): ErrorBoundary {
        if (!ErrorBoundary.instance) {
            ErrorBoundary.instance = new ErrorBoundary();
        }
        return ErrorBoundary.instance;
    }

    private setupGlobalErrorHandling(): void {
        // Handle uncaught errors
        process.on('uncaughtException', (error) => {
            this.handleError(error, {
                component: this,
                operation: 'uncaughtException',
            });
        });
    }

    registerHandler(component: any, handler: ErrorHandler): void {
        this.errorHandlers.set(component, handler);
        Logger.debug(`🩹 Error handler registered for component: ${component}`);
    }

    registerGlobalHandler(handler: ErrorHandler): void {
        this.globalErrorHandler = handler;
        Logger.debug('🩹 Global error handler registered');
    }

    handleError(error: Error, context: ErrorContext): void {
        // Add to error history
        this.addToHistory(error, context);

        // Log the error
        Logger.error(
            `🩹 Error in ${context.component}.${context.operation}: ${error.message}`
        );

        // Try component-specific handler first
        const componentHandler = this.errorHandlers.get(context.component);
        if (componentHandler) {
            try {
                componentHandler(error, context);
                return;
            } catch (handlerError) {
                Logger.error(
                    `🩹 Error in component handler for ${context.component}: ${handlerError}`
                );
            }
        }

        // Fall back to global handler
        if (this.globalErrorHandler) {
            try {
                this.globalErrorHandler(error, context);
                return;
            } catch (globalHandlerError) {
                Logger.error(`Error in global handler: ${globalHandlerError}`);
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
                'Report Issue'
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
        context: ErrorContext
    ): string {
        // Map technical errors to user-friendly messages
        if (error.message.includes('Python environment not ready')) {
            return 'Python environment is not ready. Please configure Python interpreter.';
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

    clearErrorHistory(): void {
        this.errorHistory = [];
    }

    getErrorCount(component?: any): number {
        if (component) {
            return this.errorHistory.filter(
                (entry) => entry.context.component === component
            ).length;
        }
        return this.errorHistory.length;
    }

    // Wrapper for async operations
    async wrapAsync<T>(
        operation: () => Promise<T>,
        context: ErrorContext
    ): Promise<T | null> {
        try {
            return await operation();
        } catch (error) {
            this.handleError(
                error instanceof Error ? error : new Error(String(error)),
                context
            );
            return null;
        }
    }

    // Wrapper for sync operations
    wrapSync<T>(operation: () => T, context: ErrorContext): T | null {
        try {
            return operation();
        } catch (error) {
            this.handleError(
                error instanceof Error ? error : new Error(String(error)),
                context
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
