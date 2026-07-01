import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
    getGlobalTimeControls,
    getGlobalDimensionSlices,
    getGroupTimeControls,
    getGroupDimensionSlices,
    getSmallVariableBytes,
    getSmallValueDisplayMaxLen,
    getNestedAttributesView,
    getExtensionConfigForWebview,
    getOutlineEnabled,
    getOrderGroupsAlphabetically,
    getShowXarrayEncodingAttributes,
} from '../../src/common/config';

function getPackageJsonDefaults(): Record<string, { default?: unknown }> {
    const packageJsonPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'package.json',
    );
    const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf8'),
    ) as {
        contributes: { configuration: { properties: Record<string, unknown> } };
    };
    return packageJson.contributes.configuration.properties as Record<
        string,
        { default?: unknown }
    >;
}

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
        assert.strictEqual(typeof config.outlineEnabled, 'boolean');
        assert.strictEqual(typeof config.orderGroupsAlphabetically, 'boolean');
        assert.strictEqual(
            typeof config.showXarrayEncodingAttributes,
            'boolean',
        );
        assert.strictEqual(typeof config.plotTimeoutMs, 'number');
    });

    test('display feature config getters return booleans', () => {
        assert.strictEqual(typeof getOrderGroupsAlphabetically(), 'boolean');
        assert.strictEqual(typeof getShowXarrayEncodingAttributes(), 'boolean');
    });

    test('getOutlineEnabled returns a boolean', () => {
        assert.strictEqual(typeof getOutlineEnabled(), 'boolean');
    });

    test('package.json declares outlineEnabled default true', () => {
        const properties = getPackageJsonDefaults();
        assert.strictEqual(
            properties['scientificDataViewer.outlineEnabled'].default,
            true,
        );
        assert.strictEqual(
            properties['scientificDataViewer.orderGroupsAlphabetically']
                .default,
            true,
        );
        assert.strictEqual(
            properties['scientificDataViewer.showXarrayEncodingAttributes']
                .default,
            true,
        );
    });
});
