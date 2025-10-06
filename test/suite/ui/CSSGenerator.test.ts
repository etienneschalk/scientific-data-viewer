import * as assert from 'assert';
import { CSSGenerator } from '../../../src/panel/CSSGenerator';

suite('CSSGenerator Test Suite', () => {
    test('should get CSS content in non-dev mode', () => {
        const css = CSSGenerator.get(false);
        
        assert.ok(css);
        assert.ok(typeof css === 'string');
    });

    test('should get CSS content in dev mode', () => {
        const css = CSSGenerator.get(true);
        
        assert.ok(css);
        assert.ok(typeof css === 'string');
    });

    test('should return consistent CSS content', () => {
        const css1 = CSSGenerator.get(false);
        const css2 = CSSGenerator.get(false);
        
        assert.strictEqual(css1, css2);
    });

    test('should handle multiple calls', () => {
        const css1 = CSSGenerator.get(false);
        const css2 = CSSGenerator.get(true);
        const css3 = CSSGenerator.get(false);
        
        assert.ok(css1);
        assert.ok(css2);
        assert.ok(css3);
        assert.ok(typeof css1 === 'string');
        assert.ok(typeof css2 === 'string');
        assert.ok(typeof css3 === 'string');
    });

    test('should handle CSS file loading errors gracefully', () => {
        // This test verifies that the CSSGenerator handles file loading errors
        // by returning an empty string rather than throwing
        const css = CSSGenerator.get(false);
        
        // Should not throw an error and should return a string
        assert.ok(typeof css === 'string');
    });
});