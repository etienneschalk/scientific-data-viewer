import * as assert from 'assert';
import {
    getGlobalTimeControls,
    getGlobalDimensionSlices,
    getGroupTimeControls,
    getGroupDimensionSlices,
    getSmallVariableBytes,
    getSmallValueDisplayMaxLen,
    getNestedAttributesView,
    getExtensionConfigForWebview,
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

    test('getNestedAttributesView returns a boolean', () => {
        const value = getNestedAttributesView();
        assert.strictEqual(typeof value, 'boolean');
    });

    test('getExtensionConfigForWebview returns object with expected keys', () => {
        const config = getExtensionConfigForWebview();
        assert.strictEqual(typeof config, 'object');
        assert.strictEqual(typeof config.globalTimeControls, 'boolean');
        assert.strictEqual(typeof config.globalDimensionSlices, 'boolean');
        assert.strictEqual(typeof config.groupTimeControls, 'boolean');
        assert.strictEqual(typeof config.groupDimensionSlices, 'boolean');
        assert.strictEqual(typeof config.nestedAttributesView, 'boolean');
    });
});
