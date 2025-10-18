import * as assert from 'assert';
import * as vscode from 'vscode';
import { Logger } from '../../src/common/Logger';

suite('Logger Test Suite', () => {
    let originalOutputChannel: vscode.OutputChannel | undefined;

    suiteSetup(() => {
        // Store original output channel if it exists
        originalOutputChannel = (Logger as any).outputChannel;
    });

    teardown(() => {
        // Clean up after each test
        try {
            Logger.dispose();
        } catch (error) {
            // Ignore disposal errors in tests
        }
    });

    suiteTeardown(() => {
        // Restore original output channel
        if (originalOutputChannel) {
            (Logger as any).outputChannel = originalOutputChannel;
        } else {
            Logger.dispose();
        }
    });

    test('should initialize logger', () => {
        Logger.initialize();
        assert.ok((Logger as any).outputChannel);
    });

    test('should create output channel with correct name', () => {
        Logger.initialize();
        const outputChannel = (Logger as any).outputChannel;
        assert.ok(outputChannel);
        // Note: We can't easily test the channel name without mocking vscode.window.createOutputChannel
    });

    test('should log info message', () => {
        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.info('Test info message');
        assert.ok(capturedMessage.includes('Test info message'));
        assert.ok(capturedMessage.includes('[    INFO]'));
    });

    test('should log warn message', () => {
        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.warn('Test warn message');
        assert.ok(capturedMessage.includes('Test warn message'));
        assert.ok(capturedMessage.includes('[    WARN]'));
    });

    test('should log error message', () => {
        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.error('Test error message');
        assert.ok(capturedMessage.includes('Test error message'));
        assert.ok(capturedMessage.includes('[   ERROR]'));
    });

    test('should log debug message', () => {
        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.debug('Test debug message');
        assert.ok(capturedMessage.includes('Test debug message'));
        assert.ok(capturedMessage.includes('[   DEBUG]'));
    });

    test('should log with custom level', () => {
        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.log('Test custom message', 'info');
        assert.ok(capturedMessage.includes('Test custom message'));
        assert.ok(capturedMessage.includes('[    INFO]'));
    });

    test('should include timestamp in log messages', () => {
        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.info('Test timestamp message');
        // Check that the message contains a timestamp (ISO format)
        const timestampRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
        assert.ok(timestampRegex.test(capturedMessage));
    });

    test('should handle multiple log calls', () => {
        // Mock the output channel to capture messages
        const capturedMessages: string[] = [];
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessages.push(message);
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.info('Message 1');
        Logger.info('Message 2');
        Logger.warn('Message 3');

        assert.strictEqual(capturedMessages.length, 3);
        assert.ok(capturedMessages[0].includes('Message 1'));
        assert.ok(capturedMessages[1].includes('Message 2'));
        assert.ok(capturedMessages[2].includes('Message 3'));
    });

    test('should handle empty message', () => {
        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.info('');
        assert.ok(capturedMessage.includes('[    INFO]'));
    });

    test('should handle special characters in message', () => {
        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        const specialMessage =
            'Test message with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
        Logger.info(specialMessage);
        assert.ok(capturedMessage.includes(specialMessage));
    });

    test('should handle multiline message', () => {
        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        const multilineMessage = 'Line 1\nLine 2\nLine 3';
        Logger.info(multilineMessage);
        assert.ok(capturedMessage.includes('Line 1'));
        assert.ok(capturedMessage.includes('Line 2'));
        assert.ok(capturedMessage.includes('Line 3'));
    });

    test('should show output channel', () => {
        Logger.initialize();

        // Mock the show method
        let showCalled = false;
        const mockOutputChannel = {
            show: () => {
                showCalled = true;
            },
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.show();
        assert.ok(showCalled);
    });

    test('should dispose output channel', () => {
        Logger.initialize();

        // Mock the dispose method
        let disposeCalled = false;
        const mockOutputChannel = {
            dispose: () => {
                disposeCalled = true;
            },
        };
        (Logger as any).outputChannel = mockOutputChannel;

        Logger.dispose();
        assert.ok(disposeCalled);
        assert.strictEqual((Logger as any).outputChannel, undefined);
    });

    test('should handle dispose when no output channel exists', () => {
        // Ensure no output channel exists
        (Logger as any).outputChannel = undefined;

        // Should not throw an error
        assert.doesNotThrow(() => {
            Logger.dispose();
        });
    });

    test('should handle show when not initialized', () => {
        // Ensure no output channel exists
        (Logger as any).outputChannel = undefined;

        // Should not throw an error and should initialize
        assert.doesNotThrow(() => {
            Logger.show();
        });
        assert.ok((Logger as any).outputChannel);
    });

    test('should handle log when not initialized', () => {
        // Ensure no output channel exists
        (Logger as any).outputChannel = undefined;

        // Mock the output channel to capture messages
        let capturedMessage = '';
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessage = message;
            },
            show: () => {},
            dispose: () => {},
        };

        // Mock vscode.window.createOutputChannel
        const originalCreateOutputChannel = (vscode as any).window
            .createOutputChannel;
        (vscode as any).window.createOutputChannel = () => mockOutputChannel;

        try {
            Logger.info('Test message');
            assert.ok(capturedMessage.includes('Test message'));
            assert.ok((Logger as any).outputChannel);
        } finally {
            (vscode as any).window.createOutputChannel =
                originalCreateOutputChannel;
        }
    });

    test('should handle different log levels correctly', () => {
        const testCases = [
            { method: Logger.info.bind(Logger), level: 'info' },
            { method: Logger.warn.bind(Logger), level: 'warn' },
            { method: Logger.error.bind(Logger), level: 'error' },
            { method: Logger.debug.bind(Logger), level: 'debug' },
        ];

        testCases.forEach(({ method, level }) => {
            // Mock the output channel to capture messages
            let capturedMessage = '';
            const mockOutputChannel = {
                appendLine: (message: string) => {
                    capturedMessage = message;
                },
                show: () => {},
                dispose: () => {},
            };
            (Logger as any).outputChannel = mockOutputChannel;

            method(`Test ${level} message`);
            assert.ok(capturedMessage.includes(`Test ${level} message`));
            assert.ok(
                capturedMessage.includes(
                    `[${level.toUpperCase().padStart(8, ' ')}]`,
                ),
            );
        });
    });

    test('should handle concurrent log calls', async () => {
        // Mock the output channel to capture messages
        const capturedMessages: string[] = [];
        const mockOutputChannel = {
            appendLine: (message: string) => {
                capturedMessages.push(message);
            },
            show: () => {},
            dispose: () => {},
        };
        (Logger as any).outputChannel = mockOutputChannel;

        // Create multiple concurrent log calls
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(
                Promise.resolve(Logger.info(`Concurrent message ${i}`)),
            );
        }

        await Promise.all(promises);

        assert.strictEqual(capturedMessages.length, 10);
        for (let i = 0; i < 10; i++) {
            assert.ok(
                capturedMessages.some((msg) =>
                    msg.includes(`Concurrent message ${i}`),
                ),
            );
        }
    });
});
