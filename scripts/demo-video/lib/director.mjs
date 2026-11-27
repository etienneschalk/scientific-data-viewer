// Drive a real VS Code like a user does (mouse paths, clicks, shortcuts,
// typing, smooth scrolling) over CDP, film it (Page.startScreencast), and log
// what the montage needs: cursor positions, clicks, shortcuts, captions,
// zooms and fast-forwards (events.jsonl, in screenshot pixels).
//
// Two frames are reachable: the workbench ('main') and the viewer's webview
// ('viewer': an out-of-process iframe whose inner #active-frame holds the
// viewer page). A locator is { frame, css, text?, nth? }.
import fs from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MODIFIERS = { Alt: 1, Control: 2, Meta: 4, Shift: 8 };
const SPECIAL_KEYS = {
    Enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
    Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    Tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
    Backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    Control: { key: 'Control', code: 'ControlLeft', keyCode: 17 },
    Shift: { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
    Alt: { key: 'Alt', code: 'AltLeft', keyCode: 18 },
    Meta: { key: 'Meta', code: 'MetaLeft', keyCode: 91 },
};

function keyDefinition(name, shift) {
    if (SPECIAL_KEYS[name]) {
        return SPECIAL_KEYS[name];
    }
    if (/^[a-zA-Z]$/.test(name)) {
        const upper = name.toUpperCase();
        return { key: shift ? upper : upper.toLowerCase(), code: `Key${upper}`, keyCode: upper.charCodeAt(0) };
    }
    if (/^[0-9]$/.test(name)) {
        return { key: name, code: `Digit${name}`, keyCode: name.charCodeAt(0) };
    }
    if (name === ' ') {
        return { key: ' ', code: 'Space', keyCode: 32 };
    }
    return null;
}

/** Ease in and out, 0..1 -> 0..1. */
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/**
 * Find an element in `doc` (runs in the page): `css` matches, `text` (if any)
 * is in its text content (whitespace collapsed), or `exact` is all of it, it
 * has a size; the `nth` of those.
 */
function findElement(doc, spec) {
    let elements = [...doc.querySelectorAll(spec.css)];
    const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (spec.text) {
        elements = elements.filter((el) => text(el).includes(spec.text));
    }
    if (spec.exact) {
        elements = elements.filter((el) => text(el) === spec.exact);
    }
    if (spec.attr) {
        elements = elements.filter((el) => Object.entries(spec.attr).every(([k, v]) => el.getAttribute(k) === v));
    }
    elements = elements.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    });
    return elements[spec.nth ?? 0] ?? null;
}

export class Director {
    /**
     * @param cdp      Cdp connected to the browser
     * @param session  session of the workbench page
     * @param outDir   recording folder (frames/, frames.jsonl, events.jsonl)
     */
    constructor({ cdp, session, outDir, log }) {
        this.cdp = cdp;
        this.session = session;
        this.outDir = outDir;
        this.log = log ?? (() => {});
        this.dpr = 1;
        this.mouse = { x: 400, y: 300 };
        this.iframes = new Map();
        this.recording = false;
        fs.mkdirSync(path.join(outDir, 'frames'), { recursive: true });
        this.events = fs.createWriteStream(path.join(outDir, 'events.jsonl'));
        this.frameLog = fs.createWriteStream(path.join(outDir, 'frames.jsonl'));
        this.frameCount = 0;
        cdp.onEvent((message) => {
            if (message.method === 'Target.attachedToTarget' && message.params.targetInfo.type === 'iframe') {
                this.iframes.set(message.params.sessionId, message.params.targetInfo);
            } else if (message.method === 'Target.detachedFromTarget') {
                this.iframes.delete(message.params.sessionId);
            } else if (message.method === 'Page.screencastFrame' && message.sessionId === this.session) {
                this.onFrame(message.params);
            }
        });
    }

    async init() {
        await this.cdp.send(
            'Target.setAutoAttach',
            { autoAttach: true, waitForDebuggerOnStart: false, flatten: true },
            this.session,
        );
        // Offscreen, the window never has the OS focus: without this, VS Code
        // ignores key presses
        await this.cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }, this.session);
        await this.cdp.send('Page.bringToFront', {}, this.session);
        this.dpr = await this.evalMain(() => window.devicePixelRatio);
        const size = await this.evalMain(() => [window.innerWidth, window.innerHeight]);
        this.viewport = { width: size[0], height: size[1] };
        this.mouse = { x: size[0] * 0.5, y: size[1] * 0.45 };
    }

    // ---- events for the montage -------------------------------------------------

    mark(type, data = {}) {
        if (this.stopped) {
            return;
        }
        this.events.write(`${JSON.stringify({ t: Date.now(), type, ...data })}\n`);
    }

    /** Lower-third caption; `step` shows as a numbered badge. Stays until the next caption. */
    caption(text, { step, sub } = {}) {
        this.mark('caption', { text, step, sub });
    }

    clearCaption() {
        this.mark('caption', { text: null });
    }

    /** Fast-forward the following footage `factor` times (1: normal speed). */
    speed(factor, label) {
        this.mark('speed', { factor, label });
    }

    /** Drop the footage from here to `uncut()`. */
    cut() {
        this.mark('cut');
    }

    uncut() {
        this.mark('uncut');
    }

    /** Move the camera to a rect (main CSS px, padded) or back to the full window (null). */
    async zoom(target, { padding = 24, durationMs = 900 } = {}) {
        let rect = null;
        if (target) {
            let r = target.css !== undefined ? await this.rect(target) : target;
            if (r.viewTop !== undefined) {
                // Only the part of a viewer element that is scrolled into view
                const top = Math.max(r.y, r.viewTop);
                const bottom = Math.min(r.y + r.height, r.viewTop + r.viewHeight);
                r = { ...r, y: top, height: Math.max(40, bottom - top) };
            }
            rect = this.toPixels({
                x: r.x - padding,
                y: r.y - padding,
                width: r.width + 2 * padding,
                height: r.height + 2 * padding,
            });
        }
        this.mark('zoom', { rect, durationMs });
    }

    toPixels(r) {
        return { x: r.x * this.dpr, y: r.y * this.dpr, width: r.width * this.dpr, height: r.height * this.dpr };
    }

    // ---- recording ------------------------------------------------------------------

    onFrame(params) {
        if (this.stopped) {
            return;
        }
        const file = `${String(this.frameCount++).padStart(6, '0')}.jpg`;
        fs.writeFileSync(path.join(this.outDir, 'frames', file), Buffer.from(params.data, 'base64'));
        this.frameLog.write(`${JSON.stringify({ file, t: params.metadata.timestamp * 1000, recv: Date.now() })}\n`);
        this.cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId }, this.session).catch(() => {});
    }

    async startRecording() {
        const { width, height } = this.viewport;
        // The screencast only sends frames when something is painted: start
        // with a screenshot so the first frame is there
        const shot = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 }, this.session);
        this.onFrame({ data: shot.data, metadata: { timestamp: Date.now() / 1000 }, sessionId: undefined });
        await this.cdp.send(
            'Page.startScreencast',
            {
                format: 'jpeg',
                quality: 92,
                maxWidth: Math.round(width * this.dpr),
                maxHeight: Math.round(height * this.dpr),
            },
            this.session,
        );
        this.recording = true;
        this.mark('start', { width: Math.round(width * this.dpr), height: Math.round(height * this.dpr) });
        this.cursorAt();
    }

    async stopRecording() {
        if (this.stopped) {
            return;
        }
        this.mark('end');
        this.stopped = true;
        this.recording = false;
        await this.cdp.send('Page.stopScreencast', {}, this.session).catch(() => {});
        await new Promise((resolve) => this.events.end(resolve));
        await new Promise((resolve) => this.frameLog.end(resolve));
    }

    async screenshot(file) {
        const shot = await this.cdp.send('Page.captureScreenshot', { format: 'png' }, this.session);
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    }

    // ---- evaluation ---------------------------------------------------------------

    async evaluateExpression(sessionId, expression) {
        const { result, exceptionDetails } = await this.cdp.send(
            'Runtime.evaluate',
            { expression, returnByValue: true, awaitPromise: true },
            sessionId,
            60000,
        );
        if (exceptionDetails) {
            throw new Error(`evaluate: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
        }
        return result.value;
    }

    /** Run `fn(...args)` in a frame (`fn` is serialized: no closures). */
    evaluate(sessionId, fn, args) {
        return this.evaluateExpression(sessionId, `(${fn.toString()})(...${JSON.stringify(args)})`);
    }

    evalMain(fn, ...args) {
        return this.evaluate(this.session, fn, args);
    }

    /** The viewer's webview: { sessionId, host }, or null when none is open. */
    async viewerFrame() {
        for (const sessionId of this.iframes.keys()) {
            try {
                const host = await this.evaluate(sessionId, () => {
                    const doc = document.getElementById('active-frame')?.contentDocument;
                    return doc && doc.getElementById('refreshButton') ? location.host : null;
                }, []);
                if (host) {
                    return { sessionId, host };
                }
            } catch {
                // frame gone or not a webview
            }
        }
        return null;
    }

    /** Run `fn(doc, win, ...args)` in the viewer page. */
    async evalViewer(fn, ...args) {
        const frame = await this.viewerFrame();
        if (!frame) {
            throw new Error('no viewer open');
        }
        return this.evaluateExpression(
            frame.sessionId,
            `(() => { const f = document.getElementById('active-frame'); const doc = f.contentDocument, win = f.contentWindow; return (${fn.toString()})(doc, win, ...${JSON.stringify(args)}); })()`,
        );
    }

    /** Rect of a locator in main CSS px, or null when not found. */
    async rect(locator, { optional = false } = {}) {
        const find = findElement.toString();
        let r;
        if (locator.frame === 'viewer') {
            const frame = await this.viewerFrame();
            if (!frame) {
                if (optional) return null;
                throw new Error(`no viewer open (looking for ${JSON.stringify(locator)})`);
            }
            const inner = await this.evaluate(
                frame.sessionId,
                (findSource, spec) => {
                    const findEl = new Function(`return (${findSource})`)();
                    const f = document.getElementById('active-frame');
                    const el = findEl(f.contentDocument, spec);
                    if (!el) return null;
                    const a = f.getBoundingClientRect();
                    const e = el.getBoundingClientRect();
                    return { x: a.x + e.x, y: a.y + e.y, width: e.width, height: e.height, viewTop: a.y, viewHeight: a.height };
                },
                [find, locator],
            );
            if (!inner) {
                if (optional) return null;
                throw new Error(`not found: ${JSON.stringify(locator)}`);
            }
            const outer = await this.evalMain((host) => {
                const f = [...document.querySelectorAll('iframe.webview')].find((el) => el.src.includes(host));
                const r = f.getBoundingClientRect();
                return { x: r.x, y: r.y };
            }, frame.host);
            r = { ...inner, x: inner.x + outer.x, y: inner.y + outer.y, viewTop: inner.viewTop + outer.y };
        } else {
            r = await this.evaluate(
                this.session,
                (findSource, spec) => {
                    const findEl = new Function(`return (${findSource})`)();
                    const el = findEl(document, spec);
                    if (!el) return null;
                    const e = el.getBoundingClientRect();
                    return { x: e.x, y: e.y, width: e.width, height: e.height };
                },
                [find, locator],
            );
            if (!r) {
                if (optional) return null;
                throw new Error(`not found: ${JSON.stringify(locator)}`);
            }
        }
        return r;
    }

    /** Wait until `check()` resolves truthy; returns its value. */
    async waitUntil(check, { timeoutMs = 30000, intervalMs = 200, what = 'condition' } = {}) {
        const t0 = Date.now();
        for (;;) {
            let value;
            try {
                value = await check();
            } catch {
                value = null;
            }
            if (value) {
                return value;
            }
            if (Date.now() - t0 > timeoutMs) {
                throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
            }
            await sleep(intervalMs);
        }
    }

    waitFor(locator, options = {}) {
        return this.waitUntil(() => this.rect(locator, { optional: true }), {
            what: JSON.stringify(locator),
            ...options,
        });
    }

    // ---- mouse ----------------------------------------------------------------------

    cursorAt() {
        this.mark('cursor', { x: this.mouse.x * this.dpr, y: this.mouse.y * this.dpr });
    }

    /** Move the mouse along a slightly curved, eased path (hover effects included). */
    async moveTo(x, y, { durationMs } = {}) {
        const from = { ...this.mouse };
        const distance = Math.hypot(x - from.x, y - from.y);
        if (distance < 1) {
            return;
        }
        const duration = durationMs ?? Math.min(1100, 350 + distance * 0.7);
        // Control point off the straight line, for a hand-made curve
        const bend = Math.min(80, distance * 0.12);
        const cx = (from.x + x) / 2 + ((y - from.y) / distance) * bend;
        const cy = (from.y + y) / 2 - ((x - from.x) / distance) * bend;
        const t0 = Date.now();
        for (;;) {
            const u = Math.min(1, (Date.now() - t0) / duration);
            const e = easeInOut(u);
            const px = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * cx + e * e * x;
            const py = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * cy + e * e * y;
            this.mouse = { x: px, y: py };
            this.cursorAt();
            await this.cdp
                .send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: px, y: py, button: 'none' }, this.session)
                .catch(() => {});
            if (u >= 1) {
                break;
            }
            await sleep(16);
        }
    }

    /** Point of a rect to aim at: its center, or `at` = { x: 0..1, y: 0..1 }. */
    static aim(r, at = { x: 0.5, y: 0.5 }) {
        return { x: r.x + r.width * at.x, y: r.y + r.height * at.y };
    }

    async hover(locator, { at, durationMs } = {}) {
        if (locator.frame === 'viewer') {
            await this.scrollIntoView(locator, { onlyIfNeeded: true });
        }
        const r = await this.waitFor(locator);
        const p = Director.aim(r, at);
        await this.moveTo(p.x, p.y, { durationMs });
        return r;
    }

    async click(locator, { at, durationMs, settleMs = 120, clickCount = 1 } = {}) {
        const r = await this.hover(locator, { at, durationMs });
        await sleep(settleMs);
        const { x, y } = this.mouse;
        for (let n = 1; n <= clickCount; n++) {
            await this.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: n }, this.session);
            this.mark('click', { x: x * this.dpr, y: y * this.dpr });
            await sleep(70);
            await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: n }, this.session);
            await sleep(60);
        }
        return r;
    }

    // ---- scrolling (viewer) -----------------------------------------------------------

    /** Smoothly scroll the viewer page so that `locator` is at `block` ('start' | 'center'). */
    async scrollIntoView(locator, { block = 'center', offset = 0, durationMs = 1000, onlyIfNeeded = false } = {}) {
        const r = await this.waitFor(locator);
        const viewTop = r.viewTop ?? 0;
        const viewHeight = r.viewHeight ?? this.viewport.height;
        const top = r.y - viewTop;
        if (onlyIfNeeded && top >= 30 && top + r.height <= viewHeight - 30) {
            return;
        }
        const delta =
            block === 'start' ? top - offset : top + r.height / 2 - viewHeight / 2 - offset;
        await this.scrollBy(delta, { durationMs });
    }

    async scrollBy(delta, { durationMs = 1000 } = {}) {
        await this.evalViewer(
            (doc, win, d, ms) =>
                new Promise((resolve) => {
                    const start = win.scrollY;
                    const max = doc.documentElement.scrollHeight - win.innerHeight;
                    const end = Math.max(0, Math.min(max, start + d));
                    const t0 = win.performance.now();
                    const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
                    const step = (now) => {
                        const u = Math.min(1, (now - t0) / ms);
                        win.scrollTo(0, start + (end - start) * ease(u));
                        if (u < 1) win.requestAnimationFrame(step);
                        else resolve(true);
                    };
                    win.requestAnimationFrame(step);
                }),
            delta,
            durationMs,
        );
    }

    // ---- keyboard ---------------------------------------------------------------------

    /** Press a shortcut like 'Control+Shift+P' (shown in the video unless show: false). */
    async press(combo, { show = true, label } = {}) {
        const parts = combo.split('+');
        const keyName = parts.pop();
        const modifiers = parts.reduce((m, p) => m | MODIFIERS[p], 0);
        if (show) {
            this.mark('keys', { label: label ?? combo.replace('Control', 'Ctrl') });
        }
        let held = 0;
        for (const p of parts) {
            held |= MODIFIERS[p];
            const k = SPECIAL_KEYS[p];
            await this.cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: held, key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode }, this.session);
            await sleep(40);
        }
        const k = keyDefinition(keyName, (modifiers & MODIFIERS.Shift) !== 0);
        const withText = k.text && modifiers === 0;
        await this.cdp.send(
            'Input.dispatchKeyEvent',
            {
                type: withText ? 'keyDown' : 'rawKeyDown',
                modifiers,
                key: k.key,
                code: k.code,
                windowsVirtualKeyCode: k.keyCode,
                ...(withText ? { text: k.text, unmodifiedText: k.text } : {}),
            },
            this.session,
        );
        await sleep(60);
        await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode }, this.session);
        for (const p of parts.reverse()) {
            held &= ~MODIFIERS[p];
            const s = SPECIAL_KEYS[p];
            await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: held, key: s.key, code: s.code, windowsVirtualKeyCode: s.keyCode }, this.session);
        }
        await sleep(120);
    }

    /** Type text at a human pace into the focused field. */
    async type(text, { delayMs = 70 } = {}) {
        for (const ch of text) {
            const k = keyDefinition(ch, ch !== ch.toLowerCase());
            if (k) {
                await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, code: k.code, windowsVirtualKeyCode: k.keyCode, text: ch, unmodifiedText: ch }, this.session);
                await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code: k.code, windowsVirtualKeyCode: k.keyCode }, this.session);
            } else {
                await this.cdp.send('Input.insertText', { text: ch }, this.session);
            }
            await sleep(delayMs * (0.6 + Math.random() * 0.8));
        }
    }

    /** Select all and type over the focused field. */
    async replaceText(text, options) {
        await this.press('Control+A', { show: false });
        await this.press('Backspace', { show: false });
        await this.type(text, options);
    }

    pause(ms) {
        return sleep(ms);
    }
}

/** Locators. */
export const main = (css, extra = {}) => ({ frame: 'main', css, ...extra });
export const viewer = (css, extra = {}) => ({ frame: 'viewer', css, ...extra });
