import * as assert from 'assert';
import {
    readWebviewAsset,
    WEBVIEW_SCRIPT,
    WEBVIEW_STYLESHEET,
} from '../../../src/panel/WebviewAssets';

suite('WebviewAssets Test Suite', () => {
    test('reads the stylesheet', () => {
        const css = readWebviewAsset(WEBVIEW_STYLESHEET, false);
        assert.ok(css.includes('.variable-summary'));
    });

    test('reads the webview script', () => {
        const js = readWebviewAsset(WEBVIEW_SCRIPT, false);
        assert.ok(js.includes('captureWebviewContent'));
    });

    test('returns the cached content outside dev mode', () => {
        assert.strictEqual(
            readWebviewAsset(WEBVIEW_STYLESHEET, false),
            readWebviewAsset(WEBVIEW_STYLESHEET, false),
        );
    });

    test('dev mode re-reads the same file', () => {
        assert.strictEqual(
            readWebviewAsset(WEBVIEW_STYLESHEET, true),
            readWebviewAsset(WEBVIEW_STYLESHEET, false),
        );
    });

    test('returns an empty string for a missing asset', () => {
        assert.strictEqual(
            readWebviewAsset(['src', 'panel', 'webview', 'missing.css'], false),
            '',
        );
    });
});
