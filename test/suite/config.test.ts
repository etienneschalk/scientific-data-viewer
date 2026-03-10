import * as assert from 'assert';
import {
    getGlobalTimeControls,
    getGlobalDimensionSlices,
    getGroupTimeControls,
    getGroupDimensionSlices,
} from '../../src/common/config';

suite('Config Test Suite', () => {
    test('getGlobalTimeControls returns a boolean', () => {
        const value = getGlobalTimeControls();
        assert.strictEqual(typeof value, 'boolean');
    });

    test('getGlobalDimensionSlices returns a boolean', () => {
        const value = getGlobalDimensionSlices();
        assert.strictEqual(typeof value, 'boolean');
    });

    test('getGroupTimeControls returns a boolean', () => {
        const value = getGroupTimeControls();
        assert.strictEqual(typeof value, 'boolean');
    });

    test('getGroupDimensionSlices returns a boolean', () => {
        const value = getGroupDimensionSlices();
        assert.strictEqual(typeof value, 'boolean');
    });
});
