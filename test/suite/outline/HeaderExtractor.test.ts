import * as assert from 'assert';
import { HeaderExtractor } from '../../../src/outline/HeaderExtractor';
import { DataInfoResult, HeaderItem } from '../../../src/types';

/** Minimal DataInfoResult with the fields the outline reads. */
function makeDataInfo(fields: Record<string, unknown>): DataInfoResult {
    return {
        fileSize: 0,
        xarray_html_repr: '',
        xarray_text_repr: '',
        xarray_show_versions: '',
        used_engine: 'netcdf4',
        format_info: {
            extension: 'nc',
            display_name: 'NetCDF',
            available_engines: [],
            missing_packages: [],
        },
        dimensions_flattened: {},
        coordinates_flattened: {},
        variables_flattened: {},
        attributes_flattened: {},
        xarray_html_repr_flattened: {},
        xarray_text_repr_flattened: {},
        ...fields,
    } as unknown as DataInfoResult;
}

/** Find a header by id anywhere in the tree. */
function findById(headers: HeaderItem[], id: string): HeaderItem | undefined {
    for (const header of headers) {
        if (header.id === id) {
            return header;
        }
        const found = findById(header.children, id);
        if (found) {
            return found;
        }
    }
    return undefined;
}

suite('HeaderExtractor Test Suite', () => {
    test('should create HeaderExtractor instance', () => {
        // HeaderExtractor is a static class, so we just test that it exists
        assert.ok(HeaderExtractor);
    });

    test('should create dynamic data viewer headers', () => {
        const dataInfo = makeDataInfo({
            dimensions_flattened: {
                group1: {
                    time: 100,
                },
            },
            coordinates_flattened: {
                group1: [
                    {
                        name: 'time',
                        dtype: 'float32',
                        shape: [100],
                        dimensions: ['time'],
                        size_bytes: 400,
                        attributes: {},
                    },
                ],
            },
            variables_flattened: {
                group1: [
                    {
                        name: 'temperature',
                        dtype: 'float32',
                        shape: [100],
                        dimensions: ['time'],
                        size_bytes: 400,
                        attributes: {},
                    },
                ],
            },
            attributes_flattened: {
                group1: {
                    title: 'Test Dataset',
                },
            },
            xarray_html_repr_flattened: {
                group1: '<div>Group 1 HTML</div>',
            },
            xarray_text_repr_flattened: {
                group1: 'Group 1 text',
            },
        });

        const headers =
            HeaderExtractor.createDynamicDataViewerHeaders(dataInfo);

        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        assert.ok(headers.length > 0);

        // Should have group information
        const dataGroupsHeader = headers.find((h) => h.label === 'Data Groups');
        assert.ok(dataGroupsHeader);
        assert.ok(dataGroupsHeader.children.length > 0);
    });

    test('should order outline groups from dimensions_flattened', () => {
        const dataInfo = makeDataInfo({
            dimensions_flattened: {
                '/': { x: 1 },
                '/sector_a': { x: 1 },
                '/sector_b': { x: 1 },
            },
            coordinates_flattened: {
                '/': [],
                '/sector_a': [],
                '/sector_b': [],
            },
            variables_flattened: {
                '/': [],
                '/sector_a': [],
                '/sector_b': [],
            },
            attributes_flattened: {
                '/': {},
                '/sector_a': {},
                '/sector_b': {},
            },
            // Different key order than dimensions_flattened (stale/wrong source).
            xarray_html_repr_flattened: {
                '/sector_b': '<div>b</div>',
                '/': '<div>root</div>',
                '/sector_a': '<div>a</div>',
            },
            xarray_text_repr_flattened: {
                '/sector_b': 'b',
                '/': 'root',
                '/sector_a': 'a',
            },
        });

        const headers =
            HeaderExtractor.createDynamicDataViewerHeaders(dataInfo);

        const dataGroupsHeader = headers.find((h) => h.label === 'Data Groups');
        assert.ok(dataGroupsHeader);
        assert.deepStrictEqual(
            dataGroupsHeader.children.map((c) => c.label),
            ['/', '/sector_a', '/sector_b'],
        );

        const htmlReprHeader = headers.find(
            (h) => h.label === 'Xarray HTML Representation (for each group)',
        );
        assert.ok(htmlReprHeader);
        assert.deepStrictEqual(
            htmlReprHeader.children.map((c) => c.label),
            ['/', '/sector_a', '/sector_b'],
        );
    });

    test('should handle null data info', () => {
        const headers =
            HeaderExtractor.createDynamicDataViewerHeaders(undefined);

        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        // Should return base headers
        assert.ok(headers.length > 0);
    });

    test('should handle undefined data info', () => {
        const headers =
            HeaderExtractor.createDynamicDataViewerHeaders(undefined);

        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        // Should return base headers
        assert.ok(headers.length > 0);
    });

    test('should handle empty data info for dynamic headers', () => {
        const dataInfo = makeDataInfo({
            dimensions_flattened: {},
            coordinates_flattened: {},
            variables_flattened: {},
            attributes_flattened: {},
            xarray_html_repr_flattened: {},
            xarray_text_repr_flattened: {},
        });

        const headers =
            HeaderExtractor.createDynamicDataViewerHeaders(dataInfo);

        assert.ok(headers);
        assert.ok(Array.isArray(headers));
        // Should still return base headers even with empty data
        assert.ok(headers.length > 0);
    });
    suite('group attribute ids match the webview', () => {
        const dataInfo = makeDataInfo({
            dimensions_flattened: { '/': { x: 1 } },
            coordinates_flattened: { '/': [] },
            variables_flattened: { '/': [] },
            attributes_flattened: {
                '/': {
                    title: 'Test',
                    'zarr.conventions': { version: '1', spec: { url: 'u' } },
                    flags: [1, 2],
                },
            },
        });

        test('nested attributes view uses attributes/attr ids, recursively', () => {
            const headers = HeaderExtractor.createDynamicDataViewerHeaders(
                dataInfo,
                { nestedAttributesView: true },
            );
            const section = findById(
                headers,
                HeaderExtractor.joinId(['data-group', '/', 'attributes']),
            );
            assert.ok(section);
            assert.deepStrictEqual(
                section.children.map((c) => c.id),
                [
                    'data-group___-___attributes___attr___title',
                    'data-group___-___attributes___attr___zarr-conventions',
                    'data-group___-___attributes___attr___flags',
                ],
            );
            const nested = section.children[1];
            assert.strictEqual(nested.label, 'zarr.conventions');
            assert.deepStrictEqual(
                nested.children.map((c) => c.id),
                [
                    'data-group___-___attributes___attr___zarr-conventions___attr___version',
                    'data-group___-___attributes___attr___zarr-conventions___attr___spec',
                ],
            );
            assert.strictEqual(
                nested.children[1].children[0].id,
                'data-group___-___attributes___attr___zarr-conventions___attr___spec___attr___url',
            );
            assert.strictEqual(section.children[2].label, 'flags: [1,2]');
            assert.strictEqual(section.children[2].children.length, 0);
        });

        test('flat attributes view uses attribute ids', () => {
            const headers = HeaderExtractor.createDynamicDataViewerHeaders(
                dataInfo,
                { nestedAttributesView: false },
            );
            const section = findById(
                headers,
                HeaderExtractor.joinId(['data-group', '/', 'attributes']),
            );
            assert.ok(section);
            assert.deepStrictEqual(
                section.children.map((c) => c.id),
                [
                    'data-group___-___attribute___title',
                    'data-group___-___attribute___zarr-conventions',
                    'data-group___-___attribute___flags',
                ],
            );
            assert.ok(section.children.every((c) => c.children.length === 0));
        });

        test('defaults to the nestedAttributesView setting (true)', () => {
            const headers =
                HeaderExtractor.createDynamicDataViewerHeaders(dataInfo);
            assert.ok(
                findById(headers, 'data-group___-___attributes___attr___title'),
            );
        });
    });
});
