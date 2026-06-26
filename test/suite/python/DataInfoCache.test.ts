import * as assert from 'assert';
import { DataInfoCache } from '../../../src/python/DataInfoCache';
import { DataInfoPythonResponse } from '../../../src/types';

const DEFAULT_MAX_ENTRIES = 8;

suite('DataInfoCache Test Suite', () => {
    setup(() => {
        DataInfoCache.clear();
    });

    test('should store and retrieve entries by path, mtime, and config', () => {
        const response = {
            result: { format: 'NetCDF' },
        } as DataInfoPythonResponse;
        const configKey = DataInfoCache.buildConfigKey({
            convertBandsToVariables: false,
            lazyReprLoading: true,
            smallVariableBytes: 1000,
            smallValueDisplayMaxLen: 500,
        });

        DataInfoCache.set(
            '/tmp/test.nc',
            1000,
            configKey,
            response,
            DEFAULT_MAX_ENTRIES,
        );
        const cached = DataInfoCache.get(
            '/tmp/test.nc',
            1000,
            configKey,
            DEFAULT_MAX_ENTRIES,
        );

        assert.deepStrictEqual(cached, response);
    });

    test('should miss when mtime or config changes', () => {
        const response = {
            result: { format: 'NetCDF' },
        } as DataInfoPythonResponse;
        const configKey = DataInfoCache.buildConfigKey({
            convertBandsToVariables: false,
            lazyReprLoading: true,
            smallVariableBytes: 1000,
            smallValueDisplayMaxLen: 500,
        });

        DataInfoCache.set(
            '/tmp/test.nc',
            1000,
            configKey,
            response,
            DEFAULT_MAX_ENTRIES,
        );

        assert.strictEqual(
            DataInfoCache.get(
                '/tmp/test.nc',
                1001,
                configKey,
                DEFAULT_MAX_ENTRIES,
            ),
            undefined,
        );
        assert.strictEqual(
            DataInfoCache.get(
                '/tmp/other.nc',
                1000,
                configKey,
                DEFAULT_MAX_ENTRIES,
            ),
            undefined,
        );
        assert.strictEqual(
            DataInfoCache.get(
                '/tmp/test.nc',
                1000,
                DataInfoCache.buildConfigKey({
                    convertBandsToVariables: true,
                    lazyReprLoading: true,
                    smallVariableBytes: 1000,
                    smallValueDisplayMaxLen: 500,
                }),
                DEFAULT_MAX_ENTRIES,
            ),
            undefined,
        );
    });

    test('should evict oldest entry when max size is exceeded', () => {
        const configKey = DataInfoCache.buildConfigKey({
            convertBandsToVariables: false,
            lazyReprLoading: true,
            smallVariableBytes: 1000,
            smallValueDisplayMaxLen: 500,
        });

        for (let i = 0; i < 9; i++) {
            DataInfoCache.set(
                `/tmp/file${i}.nc`,
                1000,
                configKey,
                { result: { format: `NetCDF-${i}` } } as DataInfoPythonResponse,
                DEFAULT_MAX_ENTRIES,
            );
        }

        assert.strictEqual(
            DataInfoCache.get(
                '/tmp/file0.nc',
                1000,
                configKey,
                DEFAULT_MAX_ENTRIES,
            ),
            undefined,
        );
        assert.ok(
            DataInfoCache.get(
                '/tmp/file8.nc',
                1000,
                configKey,
                DEFAULT_MAX_ENTRIES,
            ),
        );
    });

    test('should not store or return entries when maxEntries is 0', () => {
        const response = {
            result: { format: 'NetCDF' },
        } as DataInfoPythonResponse;
        const configKey = DataInfoCache.buildConfigKey({
            convertBandsToVariables: false,
            lazyReprLoading: true,
            smallVariableBytes: 1000,
            smallValueDisplayMaxLen: 500,
        });

        DataInfoCache.set('/tmp/test.nc', 1000, configKey, response, 0);

        assert.strictEqual(
            DataInfoCache.get('/tmp/test.nc', 1000, configKey, 0),
            undefined,
        );
    });

    test('should invalidate all entries for a file path', () => {
        const configKey = DataInfoCache.buildConfigKey({
            convertBandsToVariables: false,
            lazyReprLoading: true,
            smallVariableBytes: 1000,
            smallValueDisplayMaxLen: 500,
        });
        const response = {
            result: { format: 'NetCDF' },
        } as DataInfoPythonResponse;

        DataInfoCache.set('/tmp/test.nc', 1000, configKey, response, 8);
        DataInfoCache.set('/tmp/test.nc', 2000, configKey, response, 8);
        DataInfoCache.set('/tmp/other.nc', 1000, configKey, response, 8);

        DataInfoCache.invalidateFile('/tmp/test.nc');

        assert.strictEqual(
            DataInfoCache.get('/tmp/test.nc', 1000, configKey, 8),
            undefined,
        );
        assert.strictEqual(
            DataInfoCache.get('/tmp/test.nc', 2000, configKey, 8),
            undefined,
        );
        assert.ok(DataInfoCache.get('/tmp/other.nc', 1000, configKey, 8));
    });
});
