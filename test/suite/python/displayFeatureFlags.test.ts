import * as assert from 'assert';
import { buildGetDataInfoCliArgs } from '../../../src/python/DataProcessor';

const baseOptions = {
    smallVariableBytes: 1000,
    smallValueDisplayMaxLen: 500,
    orderGroupsAlphabetically: true,
    showXarrayEncodingAttributes: true,
};

suite('Display feature flags CLI args', () => {
    test('buildGetDataInfoCliArgs omits disable flags when both features are on', () => {
        const args = buildGetDataInfoCliArgs('/data/test.nc', baseOptions);

        assert.deepStrictEqual(args, [
            'info',
            '/data/test.nc',
            '--small-variable-bytes',
            '1000',
            '--small-value-display-max-len',
            '500',
        ]);
    });

    test('buildGetDataInfoCliArgs adds --no-order-groups-alphabetically when ordering is off', () => {
        const args = buildGetDataInfoCliArgs('/data/test.nc', {
            ...baseOptions,
            orderGroupsAlphabetically: false,
        });

        assert.ok(args.includes('--no-order-groups-alphabetically'));
        assert.ok(!args.includes('--no-show-xarray-encoding-attributes'));
    });

    test('buildGetDataInfoCliArgs adds --no-show-xarray-encoding-attributes when encoding display is off', () => {
        const args = buildGetDataInfoCliArgs('/data/test.nc', {
            ...baseOptions,
            showXarrayEncodingAttributes: false,
        });

        assert.ok(args.includes('--no-show-xarray-encoding-attributes'));
        assert.ok(!args.includes('--no-order-groups-alphabetically'));
    });

    test('buildGetDataInfoCliArgs can disable both display feature flags', () => {
        const args = buildGetDataInfoCliArgs('/data/test.nc', {
            ...baseOptions,
            orderGroupsAlphabetically: false,
            showXarrayEncodingAttributes: false,
        });

        assert.ok(args.includes('--no-order-groups-alphabetically'));
        assert.ok(args.includes('--no-show-xarray-encoding-attributes'));
    });

    test('buildGetDataInfoCliArgs still passes convert-bands-to-variables', () => {
        const args = buildGetDataInfoCliArgs('/data/raster.tif', {
            ...baseOptions,
            convertBandsToVariables: true,
        });

        assert.ok(args.includes('--convert-bands-to-variables'));
    });
});
