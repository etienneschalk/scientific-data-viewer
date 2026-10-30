import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    getGlobalDimensionSlices,
    getGroupDimensionSlices,
    getSmallVariableBytes,
    getSmallValueDisplayMaxLen,
    getNestedAttributesView,
    getExtensionConfigForWebview,
    getOutlineEnabled,
    getOrderGroupsAlphabetically,
    getShowXarrayEncodingAttributes,
    getNetcdfEngineOrder,
    getShowInheritedCoordinates,
    getShowLoadTimeInLocalTime,
    getFacetgridFigsize,
    getMaxSize,
    updateUseExtensionOwnEnvironment,
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
    test('getGlobalDimensionSlices returns a boolean', () => {
        const value = getGlobalDimensionSlices();
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
        assert.strictEqual(typeof config.globalDimensionSlices, 'boolean');
        assert.strictEqual(typeof config.groupDimensionSlices, 'boolean');
        assert.strictEqual(typeof config.nestedAttributesView, 'boolean');
        assert.strictEqual(typeof config.outlineEnabled, 'boolean');
        assert.strictEqual(typeof config.orderGroupsAlphabetically, 'boolean');
        assert.strictEqual(
            typeof config.showXarrayEncodingAttributes,
            'boolean',
        );
        assert.ok(Array.isArray(config.netcdfEngineOrder));
        assert.strictEqual(typeof config.showInheritedCoordinates, 'boolean');
        assert.strictEqual(typeof config.showLoadTimeInLocalTime, 'boolean');
        assert.strictEqual(typeof config.plotTimeoutMs, 'number');
    });

    test('display feature config getters return booleans', () => {
        assert.strictEqual(typeof getOrderGroupsAlphabetically(), 'boolean');
        assert.strictEqual(typeof getShowXarrayEncodingAttributes(), 'boolean');
        assert.ok(Array.isArray(getNetcdfEngineOrder()));
        assert.strictEqual(typeof getShowInheritedCoordinates(), 'boolean');
        assert.strictEqual(typeof getShowLoadTimeInLocalTime(), 'boolean');
        assert.ok(
            getFacetgridFigsize() === null ||
                (Array.isArray(getFacetgridFigsize()) &&
                    getFacetgridFigsize()!.length === 2),
        );
    });

    /** Run `check` with `key` set in the user settings, then restore it. */
    async function withSetting(
        key: string,
        value: unknown,
        check: () => void,
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration(
            'scientificDataViewer',
        );
        const previous = config.inspect(key)?.globalValue;
        await config.update(key, value, vscode.ConfigurationTarget.Global);
        try {
            check();
        } finally {
            await config.update(
                key,
                previous,
                vscode.ConfigurationTarget.Global,
            );
        }
    }

    test('maxFileSize of 0 or less means no limit, not "refuse every file"', async () => {
        const noLimit =
            getPackageJsonDefaults()['scientificDataViewer.maxFileSize']
                .default;
        for (const value of [0, -1]) {
            await withSetting('maxFileSize', value, () =>
                assert.strictEqual(getMaxSize(), noLimit),
            );
        }
        await withSetting('maxFileSize', 0.5, () =>
            assert.strictEqual(getMaxSize(), 0.5),
        );
    });

    test('facetgridFigsize below the 0.1 inch minimum is ignored', async () => {
        await withSetting('facetgridFigsize', [1e-9, 1e-9], () =>
            assert.strictEqual(getFacetgridFigsize(), null),
        );
        await withSetting('facetgridFigsize', [0.1, 2], () =>
            assert.deepStrictEqual(getFacetgridFigsize(), [0.1, 2]),
        );
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
        assert.deepStrictEqual(
            properties['scientificDataViewer.netcdfEngineOrder'].default,
            ['netcdf4', 'h5netcdf', 'scipy'],
        );
        assert.strictEqual(
            properties['scientificDataViewer.showInheritedCoordinates'].default,
            true,
        );
        assert.strictEqual(
            properties['scientificDataViewer.showLoadTimeInLocalTime'].default,
            true,
        );
    });
    test('useExtensionOwnEnvironment is written to user settings (works without a folder)', async () => {
        const original = vscode.workspace.getConfiguration;
        const updates: Array<[string, unknown, unknown]> = [];
        (vscode.workspace as any).getConfiguration = () => ({
            update: async (key: string, value: unknown, target: unknown) => {
                updates.push([key, value, target]);
            },
        });
        try {
            await updateUseExtensionOwnEnvironment(true);
        } finally {
            (vscode.workspace as any).getConfiguration = original;
        }
        assert.deepStrictEqual(updates, [
            [
                'python.useExtensionOwnEnvironment',
                true,
                vscode.ConfigurationTarget.Global,
            ],
        ]);
    });
});
