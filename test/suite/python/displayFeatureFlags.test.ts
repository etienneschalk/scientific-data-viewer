import * as assert from 'assert';
import { buildGetDataInfoCliArgs } from '../../../src/python/DataProcessor';

const baseOptions = {
    smallVariableBytes: 1000,
    smallValueDisplayMaxLen: 500,
    orderGroupsAlphabetically: true,
    showXarrayEncodingAttributes: true,
    netcdfEngineOrder: ['netcdf4', 'h5netcdf', 'scipy'],
    showInheritedCoordinates: true,
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
            '--netcdf-engine-order',
            'netcdf4,h5netcdf,scipy',
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
        assert.ok(!args.includes('--no-show-inherited-coordinates'));
    });

    test('buildGetDataInfoCliArgs passes a custom netcdf engine order', () => {
        const args = buildGetDataInfoCliArgs('/data/test.nc', {
            ...baseOptions,
            netcdfEngineOrder: ['h5netcdf', 'netcdf4', 'scipy'],
        });

        const orderIndex = args.indexOf('--netcdf-engine-order');
        assert.ok(orderIndex >= 0);
        assert.strictEqual(args[orderIndex + 1], 'h5netcdf,netcdf4,scipy');
    });

    test('buildGetDataInfoCliArgs adds --no-show-inherited-coordinates when off', () => {
        const args = buildGetDataInfoCliArgs('/data/test.nc', {
            ...baseOptions,
            showInheritedCoordinates: false,
        });

        assert.ok(args.includes('--no-show-inherited-coordinates'));
    });

    test('buildGetDataInfoCliArgs still passes convert-bands-to-variables', () => {
        const args = buildGetDataInfoCliArgs('/data/raster.tif', {
            ...baseOptions,
            convertBandsToVariables: true,
        });

        assert.ok(args.includes('--convert-bands-to-variables'));
        assert.ok(!args.includes('--open-as-kerchunk'));
    });

    test('buildGetDataInfoCliArgs adds --open-as-kerchunk when requested', () => {
        const args = buildGetDataInfoCliArgs('/data/refs.json', {
            ...baseOptions,
            openAsKerchunk: true,
        });

        assert.ok(args.includes('--open-as-kerchunk'));
    });
});
