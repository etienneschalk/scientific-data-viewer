import * as assert from 'assert';
import {
    getGlobalTimeControls,
    getGlobalDimensionSlices,
    getGroupTimeControls,
    getGroupDimensionSlices,
    getSmallVariableBytes,
    getSmallValueDisplayMaxLen,
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

    test('getSmallVariableBytes returns a number', () => {
        const value = getSmallVariableBytes();
        assert.strictEqual(typeof value, 'number');
    });

    test('getSmallValueDisplayMaxLen returns a number', () => {
        const value = getSmallValueDisplayMaxLen();
        assert.strictEqual(typeof value, 'number');
    });
});
