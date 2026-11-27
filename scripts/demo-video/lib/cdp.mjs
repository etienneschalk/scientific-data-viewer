// Chrome DevTools Protocol client over the WebSocket built into Node 22, for
// the demo video recorder. Every request has a time limit, so a stuck VS Code
// fails the recording instead of hanging it.

export class Cdp {
    /** Connect to a browser-level DevTools WebSocket URL. */
    static async connect(url, { timeoutMs = 30000 } = {}) {
        const socket = new WebSocket(url);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`CDP: no connection to ${url}`)), timeoutMs);
            socket.addEventListener(
                'open',
                () => {
                    clearTimeout(timer);
                    resolve();
                },
                { once: true },
            );
            socket.addEventListener(
                'error',
                () => {
                    clearTimeout(timer);
                    reject(new Error(`CDP: cannot connect to ${url}`));
                },
                { once: true },
            );
        });
        return new Cdp(socket);
    }

    constructor(socket) {
        this.socket = socket;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Set();
        this.closed = false;
        socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.id && this.pending.has(message.id)) {
                const { resolve, reject, timer, method } = this.pending.get(message.id);
                this.pending.delete(message.id);
                clearTimeout(timer);
                if (message.error) {
                    reject(new Error(`CDP ${method}: ${message.error.message}`));
                } else {
                    resolve(message.result);
                }
            } else if (message.method) {
                for (const listener of [...this.listeners]) {
                    listener(message);
                }
            }
        });
        socket.addEventListener('close', () => {
            this.closed = true;
            for (const { reject, timer, method } of this.pending.values()) {
                clearTimeout(timer);
                reject(new Error(`CDP ${method}: connection closed`));
            }
            this.pending.clear();
        });
    }

    send(method, params = {}, sessionId = undefined, timeoutMs = 30000) {
        if (this.closed) {
            return Promise.reject(new Error(`CDP ${method}: connection closed`));
        }
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP ${method}: no answer after ${timeoutMs} ms`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer, method });
            this.socket.send(JSON.stringify({ id, method, params, sessionId }));
        });
    }

    /** Call `listener(message)` for every event; returns the unsubscribe function. */
    onEvent(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    waitForEvent(method, { sessionId, predicate = () => true, timeoutMs = 30000 } = {}) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                off();
                reject(new Error(`CDP: no ${method} event after ${timeoutMs} ms`));
            }, timeoutMs);
            const off = this.onEvent((message) => {
                if (
                    message.method === method &&
                    (sessionId === undefined || message.sessionId === sessionId) &&
                    predicate(message.params)
                ) {
                    clearTimeout(timer);
                    off();
                    resolve(message.params);
                }
            });
        });
    }

    close() {
        this.closed = true;
        try {
            this.socket.close();
        } catch {
            // already closed
        }
    }
}
