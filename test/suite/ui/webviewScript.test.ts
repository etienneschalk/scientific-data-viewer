import * as assert from 'assert';
import { HTMLGenerator } from '../../../src/panel/HTMLGenerator';

// jsdom ships without type declarations in this repo.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { JSDOM } = require('jsdom');

/**
 * Runs the real webview page (HTMLGenerator output with the inlined webview
 * script) in jsdom, with a fake `acquireVsCodeApi` that records the requests
 * the script posts to the extension.
 */
class WebviewHarness {
    readonly dom: any;
    readonly posted: any[] = [];

    constructor() {
        const html = HTMLGenerator.generateMainHTML(false, null, 1);
        const posted = this.posted;
        this.dom = new JSDOM(html, {
            runScripts: 'dangerously',
            pretendToBeVisual: true,
            beforeParse(window: any) {
                window.acquireVsCodeApi = () => ({
                    postMessage: (message: any) => posted.push(message),
                    getState: () => undefined,
                    setState: () => undefined,
                });
                window.scrollTo = () => undefined;
            },
        });
    }

    /** Resolves once the page's DOMContentLoaded handlers have run. */
    ready(): Promise<void> {
        return new Promise((resolve) => {
            if (this.document.readyState !== 'loading') {
                resolve();
            } else {
                this.document.addEventListener('DOMContentLoaded', () =>
                    setTimeout(resolve, 0),
                );
            }
        });
    }

    get window(): any {
        return this.dom.window;
    }

    get document(): any {
        return this.dom.window.document;
    }

    emit(event: string, payload: unknown): void {
        this.window.dispatchEvent(
            new this.window.MessageEvent('message', {
                data: { type: 'event', event, payload },
            }),
        );
    }

    respond(requestId: string, payload: unknown, success = true): void {
        this.window.dispatchEvent(
            new this.window.MessageEvent('message', {
                data: {
                    type: 'response',
                    requestId,
                    success,
                    payload,
                    error: success ? undefined : String(payload),
                },
            }),
        );
    }

    loadData(dataInfo: any, extensionConfig: any = {}): void {
        this.emit('dataLoaded', {
            data: {
                currentFile: 'C:\\data\\sample.nc',
                dataInfo,
                lastLoadTime: '2026-01-01T00:00:00.000Z',
            },
            python: { pythonPath: '/usr/bin/python3' },
            extension: { extensionConfig },
        });
    }

    click(element: any): void {
        assert.ok(element, 'element to click must exist');
        element.dispatchEvent(
            new this.window.MouseEvent('click', { bubbles: true }),
        );
    }

    setValue(element: any, value: string, eventType = 'change'): void {
        assert.ok(element, 'element to set must exist');
        element.value = value;
        element.dispatchEvent(
            new this.window.Event(eventType, { bubbles: true }),
        );
    }

    /** Posted requests, cloned out of the jsdom realm (like postMessage does). */
    requests(command: string): any[] {
        return this.posted
            .filter((m) => m.type === 'request' && m.command === command)
            .map((m) => JSON.parse(JSON.stringify(m)));
    }

    plotControls(variable: string): any {
        return Array.from(
            this.document.querySelectorAll('.variable-plot-controls'),
        ).find((el: any) => el.dataset.variable === variable);
    }

    /** Plot section of a group: Plot group, Settings, summary. */
    groupPlotSection(group: string): any {
        return Array.from(
            this.document.querySelectorAll('.group-plot-section'),
        ).find((el: any) => el.dataset.group === group);
    }

    /** Settings button of a variable's or a group's Plot section. */
    openSettings(host: any): any {
        assert.ok(host, 'plot section must exist');
        this.click(host.querySelector('[data-action="open-settings"]'));
        return this.editor();
    }

    /** The open plot settings editor, if any. */
    editor(): any {
        return this.document.querySelector('.plot-editor');
    }

    /** Control of a plot parameter in the open editor (`colWrap-auto`...). */
    setting(key: string): any {
        return this.document.getElementById(`plot-setting-${key}`);
    }

    /** Start box of a dimension slice in the open editor. */
    slice(dim: string, part = ''): any {
        // Same id rule as joinId: characters outside [a-zA-Z0-9_] become '-'
        const safe = dim.replace(/[^a-zA-Z0-9_]/g, '-');
        return this.document.getElementById(
            `plot-slice-${safe}${part ? `-${part}` : ''}`,
        );
    }

    /** Titles of the editor's tabs, without their count badge. */
    tabTitles(): string[] {
        return Array.from(
            this.editor().querySelectorAll('.plot-editor-tab'),
            (tab: any) => tab.childNodes[0].textContent,
        );
    }

    selectTab(title: string): void {
        const tab = Array.from(
            this.editor().querySelectorAll('.plot-editor-tab'),
        ).find((t: any) => t.childNodes[0].textContent === title);
        this.click(tab);
    }

    /** Reset button of a block of the editor: `slices` or `params`. */
    resetBlock(part: 'slices' | 'params'): void {
        this.click(
            this.editor().querySelector(
                `[data-action="editor-reset"][data-part="${part}"]`,
            ),
        );
    }

    /** Click Create Plot of a variable; the payload of the request it posts. */
    createPlot(variable: string): any {
        this.click(
            this.plotControls(variable).querySelector(
                '[data-action="create-plot"]',
            ),
        );
        return this.requests('createPlot').pop().payload;
    }

    /** Chips of a summary: [name, value, level]. */
    chips(host: any): string[][] {
        return Array.from(
            host.querySelectorAll('.plot-settings-summary .settings-chip'),
            (chip: any) => [
                chip.querySelector('.settings-chip-name').textContent,
                chip.querySelector('code').textContent,
                chip.querySelector('.settings-chip-source').textContent,
            ],
        );
    }

    close(): void {
        this.window.close();
    }
}

const EVIL = '<img src=x onerror="window.__pwned=1">';

function sampleDataInfo(): any {
    return {
        format: 'NetCDF',
        format_info: { display_name: 'NetCDF', available_engines: ['netcdf4'] },
        used_engine: 'netcdf4',
        fileSize: 2048,
        dimensions_flattened: {
            '/': { time: 3, lat: 2 },
            [`/g${EVIL}`]: { [`d${EVIL}`]: 4 },
        },
        coordinates_flattened: {
            '/': [
                {
                    name: 'time',
                    dtype: 'datetime64[ns]',
                    shape: [3],
                    dimensions: ['time'],
                    attributes: {},
                },
            ],
            [`/g${EVIL}`]: [
                {
                    name: `c${EVIL}`,
                    dtype: 'int64',
                    shape: [4],
                    dimensions: [`d${EVIL}`],
                    attributes: {},
                },
            ],
        },
        variables_flattened: {
            '/': [
                {
                    name: 'temperature',
                    dtype: 'float32',
                    shape: [3, 2],
                    dimensions: ['time', 'lat'],
                    size_bytes: 24,
                    attributes: {
                        units: 'K',
                        scale: 0.5,
                        count: 3,
                        valid: true,
                        missing: null,
                        range: [1, 2],
                        limits: [0.1, 'nan', 'inf'],
                        grid: [
                            [1, 2],
                            [3, '-inf'],
                        ],
                        nested: { a: { b: 1 } },
                    },
                    encoding: {
                        dtype: 'float32',
                        chunks: [3, 2],
                        zlib: true,
                    },
                },
            ],
            [`/g${EVIL}`]: [
                {
                    name: `v${EVIL}`,
                    dtype: 'float64',
                    shape: [4],
                    dimensions: [`d${EVIL}`],
                    attributes: { [`k${EVIL}`]: EVIL },
                },
            ],
        },
        attributes_flattened: {
            '/': { title: EVIL, version: 2, flag: false, list: [1, 'a'] },
            [`/g${EVIL}`]: {},
        },
        encoding_flattened: {
            '/': { source: 'C:\\data\\sample.nc', unlimited_dims: [] },
            [`/g${EVIL}`]: { [`e${EVIL}`]: EVIL },
        },
        datetime_variables: {
            '/': [
                {
                    name: 'time',
                    min: '2020-01-01T00:00:00',
                    max: '2020-01-03T00:00:00',
                },
            ],
        },
        xarray_html_repr: '<div class="xr-wrap">repr</div>',
        xarray_text_repr: '<xarray.Dataset>',
        xarray_html_repr_flattened: {
            '/': '<div>root</div>',
            [`/g${EVIL}`]: '',
        },
        xarray_text_repr_flattened: { '/': 'root text', [`/g${EVIL}`]: EVIL },
        xarray_show_versions: 'versions',
    };
}

/** The sample, with a variable that has ancillary flags (Flags fieldset). */
function flagDataInfo(): any {
    const data = sampleDataInfo();
    data.variables_flattened['/'][0].attributes.ancillary_variables = 'quality';
    return data;
}

/** Groups `/`, `/a` and `/a/b`, one variable each. */
function treeDataInfo(): any {
    const variable = (name: string, dimensions: string[]) => ({
        name,
        dtype: 'float32',
        shape: dimensions.map(() => 4),
        dimensions,
        attributes: {},
    });
    return {
        format: 'NetCDF',
        dimensions_flattened: {
            '/': { time: 4 },
            '/a': { time: 4, lat: 4 },
            '/a/b': { time: 4, lat: 4, lon: 4 },
        },
        coordinates_flattened: { '/': [], '/a': [], '/a/b': [] },
        variables_flattened: {
            '/': [variable('top', ['time'])],
            '/a': [variable('mid', ['time', 'lat'])],
            '/a/b': [variable('deep', ['time', 'lat', 'lon'])],
        },
        attributes_flattened: { '/': {}, '/a': {}, '/a/b': {} },
    };
}

/** [value, label] of the options of a select. */
function options(select: any): string[][] {
    return Array.from(
        select.querySelectorAll('option'),
        (o: { value: string; textContent: string }) => [o.value, o.textContent],
    );
}

suite('Webview script (jsdom)', () => {
    let harness: WebviewHarness;

    setup(async () => {
        harness = new WebviewHarness();
        await harness.ready();
    });

    teardown(() => {
        harness.close();
    });

    test('renders file-derived names as text, never as markup', () => {
        harness.loadData(sampleDataInfo(), { nestedAttributesView: false });

        const doc = harness.document;
        assert.strictEqual(
            doc.querySelectorAll('#content img').length,
            0,
            'no element may be created from data',
        );
        assert.strictEqual(harness.window.__pwned, undefined);
        const text = doc.getElementById('group-info-container').textContent;
        assert.ok(text.includes(`Group: /g${EVIL}`));
        assert.ok(text.includes(`v${EVIL}`));
        assert.ok(text.includes(`c${EVIL}`));
        assert.ok(text.includes(`d${EVIL}`));
        assert.ok(
            harness.plotControls(`/g${EVIL}/v${EVIL}`),
            'data-variable keeps the raw full path',
        );
        // Settings editor and summary of a hostile group and dimension
        harness.openSettings(harness.plotControls(`/g${EVIL}/v${EVIL}`));
        assert.deepStrictEqual(harness.tabTitles(), [
            'This variable',
            `Group /g${EVIL}`,
            'Whole file',
        ]);
        harness.setValue(harness.slice(`d${EVIL}`), '1', 'input');
        assert.deepStrictEqual(
            harness.chips(harness.plotControls(`/g${EVIL}/v${EVIL}`)),
            [[`d${EVIL}`, '1', 'variable']],
        );
        assert.strictEqual(doc.querySelectorAll('#content img').length, 0);
        assert.strictEqual(harness.window.__pwned, undefined);
        assert.strictEqual(
            doc.querySelectorAll('[onerror], [onclick]').length,
            0,
        );
    });

    test('load time is shown in local time by default, in UTC when disabled', () => {
        const text = () =>
            harness.document.getElementById('timestampText').textContent;

        harness.loadData(sampleDataInfo());
        assert.match(
            text(),
            /^Loaded: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
        );

        harness.loadData(sampleDataInfo(), { showLoadTimeInLocalTime: false });
        assert.strictEqual(text(), 'Loaded: 2026-01-01T00:00:00.000Z');
    });

    test('renders non-string attribute values as JSON text, numeric arrays like numpy', () => {
        harness.loadData(sampleDataInfo(), { nestedAttributesView: false });

        const text = harness.document.getElementById(
            'group-info-container',
        ).textContent;
        for (const expected of [
            'scale : 0.5',
            'count : 3',
            'valid : true',
            'missing : null',
            'range : [1, 2]',
            'limits : [0.1, nan, inf]',
            'grid : [[1, 2], [3, -inf]]',
            'nested : {"a":{"b":1}}',
            'version : 2',
            'flag : false',
            'list : [1,"a"]',
        ]) {
            assert.ok(
                text.replace(/\s+/g, ' ').includes(expected),
                `missing "${expected}"`,
            );
        }
    });

    test('renders nested attributes as a tree', () => {
        harness.loadData(sampleDataInfo(), { nestedAttributesView: true });

        const root = harness.document.getElementById(
            'data-group___-___attributes',
        );
        assert.ok(root.querySelector('details.attributes-tree-node'));
        assert.ok(root.textContent.includes(EVIL));
        // The colon sits in the name column, as in the flat rows
        const names = root.querySelectorAll(
            '.attribute-item > .attribute-name',
        );
        assert.ok(names.length > 0);
        for (const name of names) {
            assert.ok(name.textContent.endsWith(' : '), name.textContent);
        }
        assert.strictEqual(
            harness.document.querySelectorAll('#content img').length,
            0,
        );
    });

    test('variable card: Attributes, Xarray Encoding and Plot sections', () => {
        harness.loadData(sampleDataInfo(), { nestedAttributesView: false });

        const doc = harness.document;
        const card = doc.getElementById(
            'data-group___-___variable___temperature',
        );
        assert.strictEqual(card.tagName, 'DETAILS');
        assert.strictEqual(card.open, false, 'cards start collapsed');
        const sections = Array.from(
            card.querySelectorAll(
                ':scope > .variable-details-content > details.variable-section',
            ),
        ) as any[];
        assert.deepStrictEqual(
            sections.map((section) => [
                section.querySelector('.variable-section-title').textContent,
                section.querySelector('.count-badge')?.textContent,
                section.open,
            ]),
            [
                ['Attributes', '9', true],
                ['Xarray Encoding', '3', false],
                ['Plot', undefined, true],
            ],
        );
        const [attributes, encoding, plot] = sections;
        assert.ok(!attributes.textContent.includes('dtype'));
        assert.ok(
            doc.getElementById(
                'data-group___-___variable___temperature___encoding-entry___dtype',
            ),
            'encoding entry ids match the outline',
        );
        assert.ok(
            encoding.textContent
                .replace(/\s+/g, ' ')
                .includes('chunks : [3, 2]'),
        );
        assert.strictEqual(plot, harness.plotControls('/temperature'));
        assert.ok(
            !doc
                .getElementById('group-info-container')
                .textContent.includes('__xarray_encoding'),
        );

        // A coordinate without attributes or encoding has no section
        const time = doc.getElementById('data-group___-___coordinate___time');
        assert.strictEqual(time.querySelectorAll('details').length, 0);
        assert.ok(
            time
                .querySelector('.variable-summary')
                .classList.contains('not-clickable'),
        );
    });

    test('variable card: Flags section lists the CF meanings', () => {
        const info = sampleDataInfo();
        const flagVariable = (name: string, flags: unknown) => ({
            name,
            dtype: 'uint8',
            shape: [3, 2],
            dimensions: ['time', 'lat'],
            size_bytes: 6,
            attributes: {},
            flags,
        });
        info.variables_flattened['/'].push(
            flagVariable('land_cover', {
                kind: 'values',
                flags: [
                    {
                        meaning: 'tree_cover',
                        value: '50',
                        mask: null,
                        bits: null,
                        color: '#006400',
                    },
                    {
                        meaning: `water${EVIL}`,
                        value: '210',
                        mask: null,
                        bits: null,
                        // Not a color: never written in a style attribute
                        color: 'red;background-image:url(x)',
                    },
                ],
                colors_source: 'flag_colors',
                problems: [],
                notes: [`flag_colors note${EVIL}`],
            }),
            flagVariable('wqsf', {
                kind: 'masks',
                flags: [
                    {
                        meaning: 'cloud',
                        value: null,
                        mask: '9223372036854775808',
                        bits: 'bit 63',
                        color: null,
                    },
                ],
                colors_source: null,
                problems: [],
                notes: [],
            }),
            flagVariable('qc', {
                kind: 'mixed',
                flags: [
                    {
                        meaning: 'good',
                        value: '3',
                        mask: '4',
                        bits: 'bit 2',
                        color: null,
                    },
                ],
                colors_source: null,
                problems: [`good: value 3 has bits outside its mask 4${EVIL}`],
                notes: [],
            }),
        );
        harness.loadData(info);
        const doc = harness.document;
        const section = (name: string) =>
            doc.getElementById(`data-group___-___variable___${name}___flags`);
        const rows = (name: string) =>
            Array.from(section(name).querySelectorAll('tbody tr')).map(
                (row: any) =>
                    Array.from(row.querySelectorAll('td')).map((td: any) =>
                        td.textContent.trim(),
                    ),
            );

        const landCover = section('land_cover');
        assert.strictEqual(landCover.open, true);
        assert.strictEqual(
            landCover.querySelector('.count-badge').textContent,
            '2',
        );
        assert.deepStrictEqual(rows('land_cover'), [
            ['50', 'tree_cover'],
            ['210', `water${EVIL}`],
        ]);
        const swatches = landCover.querySelectorAll('.flag-swatch');
        assert.strictEqual(swatches.length, 1, 'unsafe color dropped');
        assert.strictEqual(
            (swatches[0] as any).style.backgroundColor,
            'rgb(0, 100, 0)',
        );
        assert.ok(landCover.textContent.includes('colors from flag_colors'));
        assert.ok(landCover.textContent.includes(`flag_colors note${EVIL}`));

        // Masks: the uint64 mask is shown exactly, with its bit
        assert.deepStrictEqual(rows('wqsf'), [
            ['9223372036854775808', 'bit 63', 'cloud'],
        ]);
        // Mixed: mask, bits and value; problems say the plot uses numbers
        assert.deepStrictEqual(rows('qc'), [['4', 'bit 2', '3', 'good']]);
        assert.ok(
            section('qc')
                .querySelector('.flags-problems')
                .textContent.includes('Not used for plots'),
        );
        // A variable without flags has no Flags section
        assert.strictEqual(section('temperature'), null);
        assert.strictEqual(doc.querySelectorAll('#content img').length, 0);
        assert.strictEqual(harness.window.__pwned, undefined);
    });

    test('variable row: size of 0 bytes (empty dimension) shows "Empty"', () => {
        const data = sampleDataInfo();
        data.dimensions_flattened['/'].obs = 0;
        data.coordinates_flattened['/'].push({
            name: 'obs',
            dtype: 'int32',
            shape: [0],
            dimensions: ['obs'],
            size_bytes: 0,
            attributes: {},
        });
        data.variables_flattened['/'].push({
            name: 'measurement',
            dtype: 'float32',
            shape: [0],
            dimensions: ['obs'],
            size_bytes: 0,
            attributes: {},
        });
        harness.loadData(data, { nestedAttributesView: false });

        const doc = harness.document;
        const size = (id: string) =>
            doc.querySelector(`[id="${id}"] > .variable-summary > .size`)
                ?.textContent;
        assert.strictEqual(
            size('data-group___-___variable___measurement'),
            'Empty',
        );
        assert.strictEqual(size('data-group___-___coordinate___obs'), 'Empty');
        assert.strictEqual(
            size('data-group___-___variable___temperature'),
            '24 B',
        );
        // Every row keeps its five columns
        for (const summary of Array.from(
            doc.querySelectorAll('.variable-summary'),
        ) as any[]) {
            assert.strictEqual(
                summary.querySelectorAll(':scope > span').length,
                5,
                summary.textContent,
            );
        }
    });

    test('group xarray encoding is a collapsed section of its own', () => {
        harness.loadData(sampleDataInfo(), { nestedAttributesView: false });

        const doc = harness.document;
        const section = doc.getElementById('data-group___-___encoding');
        assert.strictEqual(section.tagName, 'DETAILS');
        assert.strictEqual(section.open, false);
        assert.strictEqual(
            section.querySelector('.count-badge').textContent,
            '2',
        );
        assert.ok(
            section.textContent
                .replace(/\s+/g, ' ')
                .includes('source : C:\\data\\sample.nc'),
        );
        assert.ok(
            !doc
                .getElementById('data-group___-___attributes')
                .textContent.includes('source'),
        );
    });

    test('group card: header with counts, then its sections', () => {
        harness.loadData(sampleDataInfo(), { nestedAttributesView: false });

        const doc = harness.document;
        const [card, other] = Array.from(
            doc.querySelectorAll('details.group-card'),
        ) as any[];
        assert.strictEqual(card.parentElement.id, 'data-group___-');
        assert.strictEqual(card.open, true, 'first group open');
        assert.strictEqual(
            card.querySelector('.group-card-meta').textContent,
            '2 dimensions · 1 coordinate · 1 variable',
        );
        const sections = Array.from(
            card.querySelectorAll(':scope > .group-card-body > .group-section'),
        ) as any[];
        assert.deepStrictEqual(
            sections.map((section) => [
                section.id,
                section.querySelector('h4').textContent,
                section.open,
            ]),
            [
                ['data-group___-___plot', 'Plot', true],
                ['data-group___-___dimensions', 'Dimensions', true],
                ['data-group___-___coordinates', 'Coordinates', true],
                ['data-group___-___variables', 'Variables', true],
                ['data-group___-___attributes', 'Attributes', true],
                ['data-group___-___encoding', 'Xarray Encoding', false],
            ],
        );
        assert.ok(sections[0].classList.contains('group-plot-section'));
        assert.strictEqual(sections[0].dataset.group, '/');
        assert.strictEqual(sections[0].dataset.settingsScope, 'g:/');
        assert.strictEqual(other.open, false, 'other groups start collapsed');
    });

    test('a plot opens its collapsed variable card and Plot section', () => {
        harness.loadData(sampleDataInfo());
        const controls = harness.plotControls('/temperature');
        const card = controls.closest('details.variable-details');
        controls.open = false;
        assert.strictEqual(card.open, false);

        harness.click(controls.querySelector('[data-action="create-plot"]'));

        assert.strictEqual(card.open, true);
        assert.strictEqual(controls.open, true);
        // Encoding keeps the state the user chose
        assert.strictEqual(
            card.querySelector('[id$="___encoding"]').open,
            false,
        );
    });

    test('escapes error messages and uses no inline handlers', () => {
        harness.emit('error', {
            message: `Cannot open ${EVIL}\nsecond line`,
            details: EVIL,
            errorType: EVIL,
        });

        const errorDiv = harness.document.getElementById('error');
        assert.ok(!errorDiv.classList.contains('hidden'));
        assert.strictEqual(errorDiv.querySelectorAll('img').length, 0);
        assert.ok(errorDiv.textContent.includes(`Cannot open ${EVIL}`));
        assert.ok(errorDiv.innerHTML.includes('<br>'), 'newlines become <br>');
        assert.strictEqual(
            harness.document.querySelectorAll('[onclick]').length,
            0,
        );
        assert.ok(
            errorDiv.textContent.includes('.kerchunk.json'),
            'supported formats list is current',
        );
        assert.ok(
            errorDiv.textContent.includes('.zarr.zip'),
            'zipped Zarr is in the supported formats list',
        );
    });

    test('troubleshooting links post allowed commands', () => {
        harness.emit('error', { message: 'boom' });

        harness.click(
            harness.document.querySelector('[data-action="show-settings"]'),
        );
        harness.click(
            harness.document.querySelector(
                '[data-action="install-packages"][data-packages="netCDF4,h5netcdf,scipy"]',
            ),
        );
        harness.click(
            harness.document.querySelector(
                '[data-action="install-packages"][data-packages="kerchunk"]',
            ),
        );
        harness.click(
            harness.document.querySelector('[data-action="show-logs"]'),
        );

        const commands = harness
            .requests('executeCommand')
            .map((r) => r.payload);
        assert.deepStrictEqual(commands, [
            { command: 'scientificDataViewer.showSettings' },
            {
                command: 'scientificDataViewer.python.installPackages',
                args: [['netCDF4', 'h5netcdf', 'scipy']],
            },
            {
                command: 'scientificDataViewer.python.installPackages',
                args: [['kerchunk']],
            },
            { command: 'scientificDataViewer.showLogs' },
        ]);
    });

    test('File Information shows the decoding mode; Reopen raw posts setRawMode', () => {
        const report = {
            engine: 'netcdf4',
            function: 'xarray.open_datatree',
            raw: false,
            call: "xarray.open_datatree(\n    'a.nc',\n    engine='netcdf4',\n    decode_times=False,  # time fallback\n)",
            kwargs: [],
            degraded_decoders: ['decode_times', 'decode_timedelta'],
            fallback_reason: `ValueError: unable to decode time units ${EVIL}`,
            notes: [`note ${EVIL}`],
            failed_engines: [{ engine: 'h5netcdf', error: 'OSError: x' }],
        };
        harness.loadData({ ...sampleDataInfo(), open_report: report });

        const doc = harness.document;
        const fileInfo = doc.getElementById('fileInfo').textContent;
        assert.ok(
            fileInfo.includes(
                'Decoding: degraded (decode_times=False, decode_timedelta=False)',
            ),
            fileInfo,
        );
        const openReport = doc.getElementById('openReport').textContent;
        assert.ok(
            openReport.includes('Engine: netcdf4 (xarray.open_datatree)'),
        );
        assert.ok(openReport.includes('decode_times=False,  # time fallback'));
        assert.ok(openReport.includes(`- note ${EVIL}`));
        assert.ok(openReport.includes('- h5netcdf: OSError: x'));
        assert.ok(
            openReport.includes(
                `Time decoding turned off after: ValueError: unable to decode time units ${EVIL}`,
            ),
        );
        assert.strictEqual(doc.querySelectorAll('#content img').length, 0);

        harness.click(doc.querySelector('[data-action="set-raw-mode"]'));
        assert.deepStrictEqual(
            harness.requests('setRawMode').map((r) => r.payload),
            [{ raw: true }],
        );

        harness.loadData({
            ...sampleDataInfo(),
            open_report: { ...report, raw: true, degraded_decoders: [] },
        });
        assert.ok(
            doc
                .getElementById('fileInfo')
                .textContent.includes('Decoding: raw (no CF decoding)'),
        );
        const reopenDecoded = doc.querySelector('[data-action="set-raw-mode"]');
        assert.strictEqual(reopenDecoded.textContent, 'Reopen decoded');
        harness.click(reopenDecoded);
        assert.deepStrictEqual(
            harness.requests('setRawMode').map((r) => r.payload),
            [{ raw: true }, { raw: false }],
        );
    });

    test('does not throw on data without groups', () => {
        harness.loadData({ format: 'NetCDF' });

        const doc = harness.document;
        assert.ok(doc.getElementById('error').classList.contains('hidden'));
        assert.ok(
            doc
                .getElementById('group-info-container')
                .textContent.includes('No data available'),
        );
        assert.ok(!doc.getElementById('content').classList.contains('hidden'));
    });

    test('createPlot sends the settings of every level: the nearest one wins', () => {
        harness.loadData(sampleDataInfo());
        // Whole file: the Settings of the group "/"
        harness.openSettings(harness.groupPlotSection('/'));
        assert.deepStrictEqual(harness.tabTitles(), ['Whole file']);
        harness.setValue(harness.setting('bins'), '20');
        harness.setValue(harness.setting('cmap'), 'viridis');
        harness.setValue(harness.setting('aspect'), '-1');
        harness.setValue(harness.setting('xincrease'), 'false');
        harness.setValue(harness.slice('time'), '0:2', 'input');
        // This variable: overrides cmap and aspect (the wrong file value is
        // then not used), adds col_wrap
        harness.openSettings(harness.plotControls('/temperature'));
        assert.deepStrictEqual(harness.tabTitles(), [
            'This variable',
            'Whole file',
        ]);
        harness.setValue(harness.setting('cmap'), 'magma');
        harness.setValue(harness.setting('colWrap'), '3');
        harness.setValue(harness.setting('aspect'), '1.5');

        const { operationId, ...payload } = harness.createPlot('/temperature');
        assert.ok(String(operationId).startsWith('plot-'));
        assert.deepStrictEqual(payload, {
            variable: '/temperature',
            dimensionSlices: { time: '0:2' },
            colWrap: 3,
            xincrease: false,
            yincrease: true,
            robust: false,
            addColorbar: true,
            useFlags: true,
            addLegend: true,
            bins: 20,
            aspect: 1.5,
            cmap: 'magma',
        });
    });

    test('the settings editor is built when opened, one at a time', () => {
        harness.loadData(sampleDataInfo());
        const doc = harness.document;
        assert.strictEqual(harness.editor(), null, 'no editor after loading');
        assert.strictEqual(
            doc.querySelectorAll('.plot-field').length,
            0,
            'no plot control is built in advance',
        );
        const variable = harness.plotControls('/temperature');
        const button = variable.querySelector('.plot-settings-button');
        harness.openSettings(variable);
        assert.ok(variable.contains(harness.editor()));
        assert.strictEqual(button.getAttribute('aria-expanded'), 'true');

        // Another Settings button closes the first editor
        const group = harness.groupPlotSection('/');
        harness.openSettings(group);
        assert.strictEqual(doc.querySelectorAll('.plot-editor').length, 1);
        assert.ok(group.contains(harness.editor()));
        assert.strictEqual(button.getAttribute('aria-expanded'), 'false');

        // The same button again, Close and Escape close it
        harness.openSettings(group);
        assert.strictEqual(harness.editor(), null);
        harness.openSettings(group);
        harness.click(
            harness
                .editor()
                .querySelector(
                    '.plot-editor-footer [data-action="editor-close"]',
                ),
        );
        assert.strictEqual(harness.editor(), null);
        harness.openSettings(variable);
        harness.setting('cmap').dispatchEvent(
            new harness.window.KeyboardEvent('keydown', {
                key: 'Escape',
                bubbles: true,
            }),
        );
        assert.strictEqual(harness.editor(), null);
        assert.strictEqual(doc.activeElement, button);
    });

    test('Enter in a field stores it and plots', () => {
        harness.loadData(sampleDataInfo());
        harness.openSettings(harness.plotControls('/temperature'));
        const cmap = harness.setting('cmap');
        cmap.value = 'magma';
        cmap.dispatchEvent(
            new harness.window.KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
            }),
        );
        const [request] = harness.requests('createPlot');
        assert.strictEqual(request.payload.cmap, 'magma');
        assert.strictEqual(request.payload.variable, '/temperature');
    });

    test('groups: settings flow from the file to the groups and their subgroups', () => {
        harness.loadData(treeDataInfo());
        const deep = harness.plotControls('/a/b/deep');
        harness.openSettings(deep);
        assert.deepStrictEqual(harness.tabTitles(), [
            'This variable',
            'Group /a/b',
            'Group /a',
            'Whole file',
        ]);
        // Each level lists its own dimensions (a group: its subgroups' too)
        const dims = () =>
            Array.from(
                harness.editor().querySelectorAll('.dimension-slice-row'),
                (row: any) => row.dataset.dimension,
            );
        assert.deepStrictEqual(dims(), ['lat', 'lon', 'time']);
        harness.selectTab('Whole file');
        assert.deepStrictEqual(dims(), ['lat', 'lon', 'time']);
        harness.setValue(harness.slice('time'), '0', 'input');
        harness.setValue(harness.setting('cmap'), 'viridis');
        harness.selectTab('Group /a');
        assert.strictEqual(
            harness.setting('cmap').getAttribute('placeholder'),
            'viridis (file)',
        );
        harness.setValue(harness.slice('lat'), '1:3', 'input');
        harness.setValue(harness.setting('cmap'), 'magma');

        const top = harness.createPlot('/top');
        assert.deepStrictEqual(top.dimensionSlices, { time: 0 });
        assert.strictEqual(top.cmap, 'viridis');
        // Slices are merged dimension by dimension
        const mid = harness.createPlot('/a/mid');
        assert.deepStrictEqual(mid.dimensionSlices, { lat: '1:3', time: 0 });
        assert.strictEqual(mid.cmap, 'magma');
        const deepRequest = harness.createPlot('/a/b/deep');
        assert.deepStrictEqual(deepRequest.dimensionSlices, {
            lat: '1:3',
            time: 0,
        });
        assert.strictEqual(deepRequest.cmap, 'magma');

        // The tab of each level counts what it sets
        assert.deepStrictEqual(
            Array.from(
                harness.editor().querySelectorAll('.plot-editor-tab'),
                (tab: any) =>
                    tab.querySelector('.count-badge')?.textContent ?? '',
            ),
            ['', '', '2', '2'],
        );
    });

    test('summaries name each setting and its level; a click opens it', () => {
        harness.loadData(sampleDataInfo());
        const variable = harness.plotControls('/temperature');
        const group = harness.groupPlotSection('/');
        assert.strictEqual(
            variable.querySelector('.plot-settings-summary').textContent,
            'Settings: all automatic',
        );
        harness.openSettings(group);
        harness.setValue(harness.setting('cmap'), 'magma');
        harness.setValue(harness.slice('time'), '1', 'input');
        harness.setValue(harness.slice(`d${EVIL}`), '0', 'input');
        harness.openSettings(variable);
        harness.setValue(harness.setting('vmax'), '10');

        // A variable lists only the slices of its own dimensions
        assert.deepStrictEqual(harness.chips(variable), [
            ['time', '1', 'file'],
            ['vmax', '10', 'variable'],
            ['cmap', 'magma', 'file'],
        ]);
        assert.deepStrictEqual(harness.chips(group), [
            [`d${EVIL}`, '0', 'file'],
            ['time', '1', 'file'],
            ['cmap', 'magma', 'file'],
        ]);
        assert.strictEqual(harness.window.__pwned, undefined);
        // Set at the level of the summary: outlined
        const here = Array.from(
            variable.querySelectorAll('.settings-chip'),
            (chip: any) => chip.classList.contains('settings-chip--here'),
        );
        assert.deepStrictEqual(here, [false, true, false]);

        // A chip opens the editor of its host, on its level and field
        harness.click(
            harness.editor().querySelector('[data-action="editor-close"]'),
        );
        harness.click(variable.querySelectorAll('.settings-chip')[2]);
        assert.ok(variable.contains(harness.editor()));
        assert.strictEqual(
            harness.editor().querySelector('[aria-selected="true"]')
                .childNodes[0].textContent,
            'Whole file',
        );
        assert.strictEqual(
            harness.document.activeElement,
            harness.setting('cmap'),
        );
        harness.click(variable.querySelectorAll('.settings-chip')[0]);
        assert.strictEqual(
            harness.document.activeElement,
            harness.slice('time'),
        );
    });

    test('settings are kept through Refresh, the editor is closed', () => {
        harness.loadData(sampleDataInfo());
        harness.openSettings(harness.groupPlotSection('/'));
        harness.setValue(harness.setting('cmap'), 'magma');
        harness.loadData(sampleDataInfo());
        assert.strictEqual(harness.editor(), null);
        assert.deepStrictEqual(
            harness.chips(harness.plotControls('/temperature')),
            [['cmap', 'magma', 'file']],
        );
        assert.strictEqual(harness.createPlot('/temperature').cmap, 'magma');
    });

    test('flags: the Flags fieldset only where flags apply; false asks for plain numbers', () => {
        harness.loadData(sampleDataInfo());
        harness.openSettings(harness.plotControls('/temperature'));
        assert.strictEqual(harness.setting('useFlags'), null, 'no flags here');

        harness.loadData(flagDataInfo());
        harness.openSettings(harness.plotControls('/temperature'));
        harness.setValue(harness.setting('useFlags'), 'false');
        assert.strictEqual(harness.createPlot('/temperature').useFlags, false);
    });

    test('norm: linear by default, log sent, the variable over the file, seaborn hint', () => {
        harness.loadData(sampleDataInfo());
        harness.openSettings(harness.groupPlotSection('/'));
        const norm = () => harness.setting('norm');
        assert.deepStrictEqual(options(norm()), [
            ['', 'linear'],
            ['log', 'log'],
        ]);
        // In the Color fieldset, after cmap
        const field = norm().closest('.plot-field');
        assert.strictEqual(field.previousElementSibling.dataset.field, 'cmap');
        assert.match(
            harness.setting('cmap').getAttribute('placeholder'),
            /seaborn:rocket/,
        );
        assert.strictEqual(harness.createPlot('/temperature').norm, undefined);

        harness.setValue(norm(), 'log');
        assert.ok(field.classList.contains('plot-field--changed'));
        assert.strictEqual(harness.createPlot('/temperature').norm, 'log');

        // The variable's select shows what it falls back to
        harness.openSettings(harness.plotControls('/temperature'));
        assert.strictEqual(norm().options[0].textContent, 'log (file)');
        harness.selectTab('Whole file');
        harness.setValue(norm(), '');
        harness.selectTab('This variable');
        assert.strictEqual(norm().options[0].textContent, 'linear');
        harness.setValue(norm(), 'log');
        assert.strictEqual(harness.createPlot('/temperature').norm, 'log');
        assert.strictEqual(
            harness.createPlot(`/g${EVIL}/v${EVIL}`).norm,
            undefined,
            'other variables keep the file value',
        );
        harness.resetBlock('params');
        assert.strictEqual(norm().value, '');
        assert.ok(
            !norm()
                .closest('.plot-field')
                .classList.contains('plot-field--changed'),
        );
    });

    test('Flags controls: selection, combination and hidden flags, the variable over the file', () => {
        harness.loadData(flagDataInfo());
        harness.openSettings(harness.groupPlotSection('/'));
        const combine = harness.setting('flagCombine');
        assert.deepStrictEqual(options(combine), [
            ['', 'per flag'],
            ['any', 'any'],
            ['all', 'all'],
            ['none', 'none'],
        ]);
        harness.setValue(
            harness.setting('flagSelect'),
            ' cloud, cloud shadow ',
        );
        harness.setValue(combine, 'any');
        harness.setValue(harness.setting('hideFlags'), 'land');
        assert.ok(
            combine
                .closest('.plot-field')
                .classList.contains('plot-field--changed'),
        );
        harness.openSettings(harness.plotControls('/temperature'));
        assert.strictEqual(
            harness.setting('flagCombine').options[0].textContent,
            'any (file)',
        );
        harness.setValue(harness.setting('flagCombine'), 'none');
        const request = harness.createPlot('/temperature');
        assert.strictEqual(request.flagSelect, 'cloud, cloud shadow');
        assert.strictEqual(request.flagCombine, 'none');
        assert.strictEqual(request.hideFlags, 'land');
    });

    test('no time range controls, even for datetime variables', () => {
        harness.loadData(sampleDataInfo());
        const doc = harness.document;
        assert.strictEqual(
            doc.querySelectorAll('.time-controls-section, [data-time]').length,
            0,
        );
    });

    suite('dimension slices: start / stop / step boxes and slider', () => {
        // Field of `time` (size 3, indices 0..2) at the whole file level
        const field = () => ({
            start: harness.slice('time'),
            stop: harness.slice('time', 'stop'),
            step: harness.slice('time', 'step'),
            from: harness.slice('time', 'from'),
            to: harness.slice('time', 'to'),
        });
        const boxes = () =>
            ['start', 'stop', 'step'].map(
                (part) => (field() as any)[part].value,
            );
        const handles = () => [field().from.value, field().to.value];
        const sentSlices = () => {
            harness.click(
                harness
                    .plotControls('/temperature')
                    .querySelector('[data-action="create-plot"]'),
            );
            const requests = harness.requests('createPlot');
            return requests[requests.length - 1].payload.dimensionSlices;
        };

        setup(() => {
            harness.loadData(sampleDataInfo());
            harness.openSettings(harness.groupPlotSection('/'));
        });

        test('a typed or pasted slice is spread over the boxes', () => {
            harness.setValue(field().start, '0:3:2', 'input');
            assert.deepStrictEqual(boxes(), ['0', '3', '2']);
            assert.strictEqual(harness.document.activeElement, field().step);
            assert.deepStrictEqual(sentSlices(), { time: '0:3:2' });
        });

        test('start alone is an index; boxes move the slider', () => {
            harness.setValue(field().start, '1', 'input');
            assert.deepStrictEqual(handles(), ['1', '1']);
            assert.deepStrictEqual(sentSlices(), { time: 1 });

            harness.setValue(field().stop, '3', 'input');
            assert.deepStrictEqual(handles(), ['1', '2'], 'stop is excluded');
            harness.setValue(field().start, '-2', 'input');
            assert.deepStrictEqual(
                handles(),
                ['1', '2'],
                'counted from the end',
            );
        });

        test('moving one handle rewrites only its own box', () => {
            harness.setValue(field().to, '1', 'input');
            assert.deepStrictEqual(boxes(), ['', '2', ''], 'start untouched');

            // A box keeps its text while its index does not change
            harness.setValue(field().start, '-3', 'input');
            harness.setValue(field().to, '2', 'input');
            assert.deepStrictEqual(boxes(), ['-3', '3', '']);
            harness.setValue(field().from, '1', 'input');
            assert.deepStrictEqual(boxes(), ['1', '3', ''], 'stop untouched');

            // Crossing swaps the roles: both boxes change
            harness.setValue(field().to, '0', 'input');
            assert.deepStrictEqual(
                boxes(),
                ['', '2', ''],
                'start 0 is left empty',
            );
        });

        test('handles together select an index, even with a step', () => {
            harness.setValue(field().start, '0:3:2', 'input');
            assert.deepStrictEqual(handles(), ['0', '2']);

            harness.setValue(field().to, '0', 'input');
            assert.deepStrictEqual(boxes(), ['0', '', '2'], 'stop emptied');
            const row = field().start.closest('.dimension-slice-row');
            assert.ok(row.classList.contains('slice-step-ignored'));
            assert.deepStrictEqual(sentSlices(), { time: 0 });

            // Apart again: a range, the step counts again
            harness.setValue(field().to, '2', 'input');
            assert.deepStrictEqual(boxes(), ['0', '3', '2']);
            assert.ok(!row.classList.contains('slice-step-ignored'));
            assert.deepStrictEqual(sentSlices(), { time: '0:3:2' });
        });

        test('back to both ends: no selection', () => {
            harness.setValue(field().to, '1', 'input');
            harness.setValue(field().to, '2', 'input');
            assert.deepStrictEqual(boxes(), ['', '', '']);
            assert.strictEqual(sentSlices(), undefined, 'dropped when empty');
        });

        test('an open slice typed after a start keeps its Python meaning', () => {
            harness.setValue(field().start, '1::2', 'input');
            assert.deepStrictEqual(boxes(), ['1', '3', '2'], '"to the end"');
            assert.deepStrictEqual(handles(), ['1', '2']);

            harness.setValue(field().start, '1:', 'input');
            const stop = field().stop;
            assert.strictEqual(harness.document.activeElement, stop);
            assert.deepStrictEqual(
                [stop.selectionStart, stop.selectionEnd],
                [0, 1],
                'the filled stop is selected, so typing replaces it',
            );
        });

        test('negative values, reversed step and empty selection', () => {
            harness.setValue(field().start, '-1', 'input');
            assert.deepStrictEqual(
                handles(),
                ['2', '2'],
                'counted from the end',
            );
            harness.setValue(field().start, '-3:-1', 'input');
            assert.deepStrictEqual(handles(), ['0', '1']);

            harness.setValue(field().step, '-1', 'input');
            assert.ok(field().from.disabled && field().to.disabled);
            harness.setValue(field().step, '', 'input');
            assert.ok(!field().from.disabled);

            harness.setValue(field().start, '2:1', 'input');
            assert.strictEqual(field().stop.validity.valid, false);
            harness.setValue(field().stop, '3', 'input');
            assert.strictEqual(field().stop.validity.valid, true);
        });

        test('Reset clears the boxes and the slider', () => {
            harness.setValue(field().start, '1:2', 'input');
            harness.resetBlock('slices');
            assert.deepStrictEqual(boxes(), ['', '', '']);
            assert.deepStrictEqual(handles(), ['0', '2']);
        });
    });

    test('each Reset button clears its own block of the level shown', () => {
        harness.loadData(sampleDataInfo());
        harness.openSettings(harness.groupPlotSection('/'));
        harness.setValue(harness.setting('bins'), '20');
        harness.setValue(harness.setting('robust'), 'true');
        harness.click(harness.setting('colWrap-auto'));
        assert.strictEqual(harness.setting('colWrap').disabled, true);
        harness.setValue(harness.slice('lat'), '0:1', 'input');

        harness.resetBlock('slices');
        assert.strictEqual(harness.slice('lat').value, '');
        assert.strictEqual(harness.setting('bins').value, '20');

        harness.resetBlock('params');
        assert.strictEqual(harness.setting('bins').value, '');
        assert.strictEqual(harness.setting('robust').value, '');
        assert.strictEqual(harness.setting('colWrap-auto').checked, false);
        assert.strictEqual(harness.setting('colWrap').disabled, false);
        const request = harness.createPlot('/temperature');
        assert.strictEqual(request.dimensionSlices, undefined);
        assert.strictEqual(request.bins, undefined);
        assert.strictEqual(request.robust, false, 'back to its default');
    });

    test('Reset is not undone by the change event of a box removed while focused', () => {
        harness.loadData(sampleDataInfo());
        harness.openSettings(harness.groupPlotSection('/'));
        harness.setValue(harness.setting('cmap'), 'magma', 'input');
        const cmap = harness.setting('cmap');
        cmap.focus();
        // Chrome fires `change` on a focused input as the editor replaces it
        const editor = harness.editor();
        const proto = harness.window.Element.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(
            proto,
            'innerHTML',
        ) as {
            get: (this: unknown) => string;
            set: (this: unknown, value: string) => void;
        };
        Object.defineProperty(editor, 'innerHTML', {
            configurable: true,
            get() {
                return descriptor.get.call(this);
            },
            set(value: string) {
                cmap.dispatchEvent(
                    new harness.window.Event('change', { bubbles: true }),
                );
                descriptor.set.call(this, value);
            },
        });
        harness.resetBlock('params');
        assert.strictEqual(harness.createPlot('/temperature').cmap, undefined);
        assert.deepStrictEqual(
            harness.chips(harness.groupPlotSection('/')),
            [],
        );
    });

    test('fields set at the level shown are outlined; the others show what they fall back to', () => {
        harness.loadData(sampleDataInfo());
        harness.openSettings(harness.groupPlotSection('/'));
        const doc = harness.document;
        const changed = (element: any) =>
            element
                .closest('.plot-field')
                .classList.contains('plot-field--changed');
        assert.strictEqual(
            doc.querySelectorAll('.plot-field--changed').length,
            0,
        );

        harness.setValue(harness.slice('lat'), '0:1', 'input');
        harness.setValue(harness.setting('bins'), '20', 'input');
        harness.setValue(harness.setting('robust'), 'true');
        harness.setValue(harness.setting('xincrease'), 'false');
        harness.setValue(harness.setting('xincrease'), '');
        assert.ok(changed(harness.slice('lat')), 'slice');
        assert.ok(changed(harness.setting('bins')), 'number');
        assert.ok(changed(harness.setting('robust')), 'true / false');
        assert.ok(!changed(harness.setting('xincrease')), 'back to empty');
        assert.ok(!changed(harness.setting('cmap')), 'untouched');

        // Every box of the slice emptied
        harness.setValue(harness.slice('lat'), '', 'input');
        assert.ok(changed(harness.slice('lat')), 'the stop box is still set');
        harness.setValue(harness.slice('lat', 'stop'), '', 'input');
        assert.ok(!changed(harness.slice('lat')), 'all boxes empty');

        // At the variable level, nothing is set: the file values are in grey
        harness.setValue(harness.slice('time'), '1', 'input');
        harness.openSettings(harness.plotControls('/temperature'));
        assert.strictEqual(
            doc.querySelectorAll('.plot-field--changed').length,
            0,
        );
        assert.strictEqual(
            harness.setting('bins').getAttribute('placeholder'),
            '20 (file)',
        );
        assert.strictEqual(
            harness.setting('robust').options[0].textContent,
            'true (file)',
        );
        assert.strictEqual(
            harness.setting('xincrease').options[0].textContent,
            'true (default)',
        );
        assert.match(
            harness
                .slice('time')
                .closest('.dimension-slice-row')
                .querySelector('.plot-field-hint').textContent,
            /^size 3 · 1 \(file\)$/,
        );
        // Opened again, the file level shows what it sets
        harness.openSettings(harness.groupPlotSection('/'));
        assert.strictEqual(harness.setting('bins').value, '20');
        assert.ok(changed(harness.setting('bins')));
        assert.deepStrictEqual(
            ['start', 'stop', 'step', 'from', 'to'].map(
                (part) =>
                    harness.slice('time', part === 'start' ? '' : part).value,
            ),
            ['1', '', '', '1', '1'],
            'boxes and slider rebuilt from the stored text',
        );
    });

    test('the plot shows its layout: set by the user or automatic', async () => {
        harness.loadData(sampleDataInfo());
        const controls = harness.plotControls('/temperature');
        const layoutLine = controls.querySelector('.plot-layout');
        assert.ok(layoutLine.classList.contains('hidden'));

        harness.click(controls.querySelector('[data-action="create-plot"]'));
        const [request] = harness.requests('createPlot');
        harness.respond(request.id, {
            plotData: 'iVBORw0KGgo=',
            appliedSlices: { lat: '0:1' },
            layout: {
                kind: 'image',
                choices: [
                    { role: 'col', value: 'time', source: 'auto' },
                    { role: 'col_wrap', value: 2, source: 'user' },
                ],
                squeezed: ['band'],
                notes: [`row=${EVIL} ignored`],
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.ok(!layoutLine.classList.contains('hidden'));
        assert.strictEqual(
            layoutLine.querySelector('.plot-layout-kind').textContent,
            'image',
        );
        const items = Array.from(
            layoutLine.querySelectorAll('.plot-layout-item'),
        ).map((item: any) => [
            item.textContent,
            item.classList.contains('plot-layout-item--user'),
        ]);
        assert.deepStrictEqual(items, [
            ['lat 0:1', true],
            ['band 0', false],
            ['col time', false],
            ['col_wrap 2', true],
        ]);
        // The legend shows the `•` that styles.css adds after the user items
        assert.strictEqual(
            layoutLine.querySelector('.plot-layout-legend .plot-layout-marker')
                .textContent,
            '•',
        );
        assert.strictEqual(
            layoutLine.querySelector('.plot-layout-notes li').textContent,
            `row=${EVIL} ignored`,
        );
        assert.strictEqual(layoutLine.querySelector('img'), null);

        harness.click(controls.querySelector('[data-action="reset-plot"]'));
        assert.ok(layoutLine.classList.contains('hidden'));
        assert.strictEqual(layoutLine.innerHTML, '');
    });

    test('displays the plot and saves it under a relative path', () => {
        harness.loadData(sampleDataInfo());
        const controls = harness.plotControls(`/g${EVIL}/v${EVIL}`);
        harness.click(controls.querySelector('[data-action="create-plot"]'));
        const [request] = harness.requests('createPlot');
        harness.respond(request.id, { plotData: 'iVBORw0KGgo=' });

        return new Promise<void>((resolve) => setTimeout(resolve, 0)).then(
            () => {
                const img = controls.querySelector('img');
                assert.ok(img, 'plot image displayed');
                assert.strictEqual(img.alt, `Plot for /g${EVIL}/v${EVIL}`);

                harness.click(
                    controls.querySelector('[data-action="save-plot"]'),
                );
                const [save] = harness.requests('savePlot');
                assert.strictEqual(save.payload.plotData, 'iVBORw0KGgo=');
                assert.match(
                    save.payload.fileName,
                    /^sdv-plots\/sample\.nc\/g_img src=x onerror=_window\.__pwned=1__\/v_img src=x onerror=_window\.__pwned=1___[0-9T-]+\.png$/,
                );
            },
        );
    });

    test('refresh has no request timeout', () => {
        // They wait on a long backend run or on a dialog: a 60 s timeout
        // showed "Request timeout" while the work then completed.
        harness.loadData(sampleDataInfo());
        const delays: number[] = [];
        const original = harness.window.setTimeout;
        harness.window.setTimeout = (
            fn: any,
            delay?: number,
            ...rest: any[]
        ) => {
            delays.push(delay ?? 0);
            return original(fn, delay, ...rest);
        };
        try {
            harness.click(harness.document.getElementById('refreshButton'));
            assert.strictEqual(harness.requests('refresh').length, 1);
            assert.ok(
                !delays.some((delay) => delay >= 60000),
                `no request timeout armed, got delays ${delays.join(', ')}`,
            );
        } finally {
            harness.window.setTimeout = original;
        }
    });

    test('plot timeout aborts the backend and shows the error', async function () {
        this.timeout(5000);
        harness.loadData(sampleDataInfo(), { plotTimeoutMs: 1000 });
        const controls = harness.plotControls('/temperature');
        harness.click(controls.querySelector('[data-action="create-plot"]'));
        const [request] = harness.requests('createPlot');

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const [abort] = harness.requests('abortPlot');
        assert.ok(abort, 'abortPlot sent on timeout');
        assert.strictEqual(
            abort.payload.operationId,
            request.payload.operationId,
        );
        assert.ok(
            controls
                .querySelector('.plot-error')
                .textContent.includes('Plot request timeout'),
        );
        // A late response for the timed-out request is ignored
        harness.respond(request.id, { plotData: 'iVBORw0KGgo=' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(controls.querySelector('img'), null);
    });

    test('a true / false setting: its default, the file value, then the variable value', () => {
        harness.loadData(sampleDataInfo());
        assert.strictEqual(
            harness.createPlot('/temperature').addColorbar,
            true,
            'default',
        );
        harness.openSettings(harness.groupPlotSection('/'));
        assert.deepStrictEqual(options(harness.setting('addColorbar')), [
            ['', 'true (default)'],
            ['true', 'true'],
            ['false', 'false'],
        ]);
        harness.setValue(harness.setting('addColorbar'), 'false');
        assert.strictEqual(
            harness.createPlot('/temperature').addColorbar,
            false,
            'file value',
        );

        harness.openSettings(harness.plotControls('/temperature'));
        assert.strictEqual(
            harness.setting('addColorbar').options[0].textContent,
            'false (file)',
        );
        harness.setValue(harness.setting('addColorbar'), 'true');
        assert.strictEqual(
            harness.createPlot('/temperature').addColorbar,
            true,
            'variable value',
        );
        harness.resetBlock('params');
        assert.strictEqual(
            harness.createPlot('/temperature').addColorbar,
            false,
            'back to the file value',
        );
    });

    test('a number typed wrong is outlined and blocks the plot with a message', async () => {
        harness.loadData(sampleDataInfo());
        harness.openSettings(harness.groupPlotSection('/'));
        harness.setValue(harness.setting('vmin'), '1,5', 'input');
        harness.setValue(harness.setting('size'), '-3', 'input');
        const vmin = harness.setting('vmin');
        assert.strictEqual(vmin.getAttribute('aria-invalid'), 'true');
        assert.match(vmin.title, /use a dot as decimal separator/);
        assert.strictEqual(
            harness.setting('size').getAttribute('aria-invalid'),
            'true',
        );

        const controls = harness.plotControls('/temperature');
        harness.click(controls.querySelector('[data-action="create-plot"]'));
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(harness.requests('createPlot').length, 0);
        const message = controls.querySelector('.plot-error').textContent;
        assert.match(message, /nothing was plotted/);
        assert.match(message, /Whole file: vmin: "1,5" is not a number/);
        assert.match(message, /Whole file: size: must be greater than 0/);

        // A wrong value that a nearer level overrides does not count
        harness.openSettings(controls);
        harness.setValue(harness.setting('vmin'), '0.5');
        harness.setValue(harness.setting('size'), '4');
        assert.strictEqual(harness.createPlot('/temperature').vmin, 0.5);

        // Opened again, the wrong text is still there, outlined
        harness.openSettings(harness.groupPlotSection('/'));
        assert.strictEqual(harness.setting('vmin').value, '1,5');
        assert.strictEqual(
            harness.setting('vmin').getAttribute('aria-invalid'),
            'true',
        );
        harness.resetBlock('params');
        assert.strictEqual(
            harness.setting('vmin').getAttribute('aria-invalid'),
            null,
        );
        harness.setValue(harness.setting('vmin'), '-1e-7', 'input');
        harness.openSettings(controls);
        harness.resetBlock('params');
        assert.strictEqual(harness.createPlot('/temperature').vmin, -1e-7);
    });

    test('Plot All does not start a second plot of a variable already plotting', async () => {
        harness.loadData(sampleDataInfo());
        const controls = harness.plotControls('/temperature');
        harness.click(controls.querySelector('[data-action="create-plot"]'));
        const [first] = harness.requests('createPlot');

        harness.click(harness.document.getElementById('createAllPlotsButton'));
        await new Promise((resolve) => setTimeout(resolve, 0));

        const forTemperature = harness
            .requests('createPlot')
            .filter((r: any) => r.payload.variable === '/temperature');
        assert.strictEqual(forTemperature.length, 1);
        // Its Cancel still reaches the only running process
        harness.click(controls.querySelector('[data-action="cancel-plot"]'));
        const [abort] = harness.requests('abortPlot');
        assert.strictEqual(
            abort.payload.operationId,
            first.payload.operationId,
        );
        harness.respond(first.id, { plotData: 'iVBORfake' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(
            controls.querySelector('.plot-error').textContent,
            'Plot cancelled.',
        );
        assert.strictEqual(controls.querySelector('img'), null);
    });

    test('Cancel stops the plot of one variable', async () => {
        harness.loadData(sampleDataInfo());
        const controls = harness.plotControls('/temperature');
        const create = controls.querySelector('[data-action="create-plot"]');
        const cancel = controls.querySelector('[data-action="cancel-plot"]');
        assert.ok(cancel.classList.contains('hidden'), 'hidden when idle');

        harness.click(create);
        assert.ok(!cancel.classList.contains('hidden'), 'shown while running');
        assert.strictEqual(create.disabled, true);
        const [request] = harness.requests('createPlot');

        harness.click(cancel);

        const [abort] = harness.requests('abortPlot');
        assert.ok(abort, 'abortPlot sent');
        assert.strictEqual(
            abort.payload.operationId,
            request.payload.operationId,
        );
        assert.ok(cancel.classList.contains('hidden'));
        assert.strictEqual(create.disabled, false);
        const message = controls.querySelector('.plot-error');
        assert.strictEqual(message.textContent, 'Plot cancelled.');
        assert.ok(!message.classList.contains('error'));
        // The aborted request's error (or a late plot) does not replace it
        harness.respond(request.id, 'Process was aborted', false);
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(message.textContent, 'Plot cancelled.');
        assert.strictEqual(controls.querySelector('img'), null);
    });

    test('Cancel All marks every running plot as cancelled', async () => {
        harness.loadData(sampleDataInfo());
        const controls = harness.plotControls('/temperature');
        harness.click(controls.querySelector('[data-action="create-plot"]'));
        const [request] = harness.requests('createPlot');

        harness.click(harness.document.getElementById('cancelAllPlotsButton'));

        const [abort] = harness.requests('abortPlot');
        assert.strictEqual(
            abort.payload.operationId,
            request.payload.operationId,
        );
        assert.strictEqual(
            controls.querySelector('.plot-error').textContent,
            'Plot cancelled.',
        );
        assert.ok(
            controls
                .querySelector('[data-action="cancel-plot"]')
                .classList.contains('hidden'),
        );
        harness.respond(request.id, { plotData: 'iVBORw0KGgo=' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(controls.querySelector('img'), null);
    });

    test('Plot group plots the variables of its group only', async () => {
        harness.loadData(sampleDataInfo());
        const groupButton = (group: string) =>
            harness
                .groupPlotSection(group)
                .querySelector('[data-action="plot-group"]');
        harness.click(groupButton(`/g${EVIL}`));
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.deepStrictEqual(
            harness.requests('createPlot').map((r: any) => r.payload.variable),
            [`/g${EVIL}/v${EVIL}`],
        );
        // While it runs, Plot all and every Plot group are disabled
        assert.strictEqual(groupButton('/').disabled, true);
        assert.strictEqual(
            harness.document.getElementById('createAllPlotsButton').disabled,
            true,
        );
        assert.ok(
            !harness.document
                .getElementById('cancelAllPlotsButton')
                .classList.contains('hidden'),
        );
        const [request] = harness.requests('createPlot');
        harness.respond(request.id, { plotData: 'iVBORw0KGgo=' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        const [notification] = harness.requests('showNotification');
        assert.match(
            notification.payload.message,
            /^Plot group \/g.*: 1 successful$/,
        );
        harness.respond(notification.id, undefined);
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(groupButton('/').disabled, false);
    });

    test('a plot says when its settings changed after it was made', async () => {
        harness.loadData(sampleDataInfo());
        const controls = harness.plotControls('/temperature');
        const note = controls.querySelector('.plot-stale-note');
        harness.createPlot('/temperature');
        const [request] = harness.requests('createPlot');
        harness.respond(request.id, { plotData: 'iVBORw0KGgo=' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.ok(note.classList.contains('hidden'));

        harness.openSettings(harness.groupPlotSection('/'));
        harness.setValue(harness.setting('cmap'), 'magma');
        assert.ok(!note.classList.contains('hidden'), 'file setting changed');
        harness.setValue(harness.setting('cmap'), '');
        assert.ok(note.classList.contains('hidden'), 'back as plotted');
        harness.setValue(harness.slice(`d${EVIL}`), '1', 'input');
        assert.ok(
            !note.classList.contains('hidden'),
            'sent to every variable, even without that dimension',
        );
        harness.click(controls.querySelector('[data-action="reset-plot"]'));
        assert.ok(note.classList.contains('hidden'), 'no plot, no note');
    });

    test('an item under the plot opens the settings on its field', async () => {
        harness.loadData(sampleDataInfo());
        const controls = harness.plotControls('/temperature');
        harness.openSettings(harness.groupPlotSection('/'));
        harness.setValue(harness.setting('colWrap'), '2');
        harness.createPlot('/temperature');
        const [request] = harness.requests('createPlot');
        harness.respond(request.id, {
            plotData: 'iVBORw0KGgo=',
            layout: {
                kind: 'image',
                choices: [
                    { role: 'col', value: 'time', source: 'auto' },
                    { role: 'col_wrap', value: 2, source: 'user' },
                    { role: '__proto__', value: 1, source: 'auto' },
                ],
                squeezed: [],
                notes: [],
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        const [col, colWrap, odd] = Array.from(
            controls.querySelectorAll('.plot-layout-item'),
        ) as any[];
        assert.strictEqual(odd.dataset.focusParam, undefined);

        // Automatic: the variable's own level
        harness.click(col);
        assert.ok(controls.contains(harness.editor()));
        assert.strictEqual(
            harness.editor().querySelector('[aria-selected="true"]')
                .childNodes[0].textContent,
            'This variable',
        );
        assert.strictEqual(
            harness.document.activeElement,
            harness.setting('facetCol'),
        );
        // Set by you: the level that sets it
        harness.click(colWrap);
        assert.strictEqual(
            harness.editor().querySelector('[aria-selected="true"]')
                .childNodes[0].textContent,
            'Whole file',
        );
        assert.strictEqual(
            harness.document.activeElement,
            harness.setting('colWrap'),
        );
    });

    test('export keeps cards, sections and the settings summaries, not the editor', async () => {
        harness.loadData(sampleDataInfo(), { nestedAttributesView: false });
        const doc = harness.document;
        // Cards and sections: variable open, its attributes closed, encoding open
        const card = doc.getElementById(
            'data-group___-___variable___temperature',
        );
        card.open = true;
        card.querySelector('[id$="___attributes"]').open = false;
        card.querySelector('[id$="___encoding"]').open = true;
        // Settings of the file; the editor is left open
        harness.openSettings(harness.groupPlotSection('/'));
        harness.setValue(harness.slice('time'), '1:3:2', 'input');
        harness.click(harness.setting('colWrap-auto'));
        harness.click(doc.getElementById('exportWebviewButton'));
        const exported = harness.requests('exportWebview')[0].payload
            .htmlContent as string;
        assert.ok(harness.editor(), 'the live editor stays open');

        const offline = new JSDOM(exported, { runScripts: 'dangerously' });
        await new Promise((resolve) =>
            offline.window.addEventListener('load', resolve),
        );
        try {
            const off = offline.window.document;
            assert.ok(off.getElementById('degraded-mode-indicator'));
            const offCard = off.getElementById(card.id);
            assert.deepStrictEqual(
                [
                    offCard.open,
                    offCard.querySelector('[id$="___attributes"]').open,
                    offCard.querySelector('[id$="___encoding"]').open,
                ],
                [true, false, true],
            );
            assert.strictEqual(off.querySelectorAll('.plot-editor').length, 0);
            assert.strictEqual(off.querySelectorAll('input, select').length, 0);
            const group = Array.from(
                off.querySelectorAll('.group-plot-section'),
            ).find((section: any) => section.dataset.group === '/') as any;
            assert.deepStrictEqual(harness.chips(group), [
                ['time', '1:3:2', 'file'],
                ['col_wrap', 'auto', 'file'],
            ]);
            assert.strictEqual(
                group.querySelector('.plot-controls-row').style.display,
                'none',
                'Plot group and Settings hidden in a browser',
            );
            assert.strictEqual(
                group
                    .querySelector('.plot-settings-button')
                    .getAttribute('aria-expanded'),
                'false',
            );
            assert.strictEqual(
                off.getElementById('createAllPlotsButton').style.display,
                'none',
            );
            // A chip does nothing in a browser
            group
                .querySelector('.settings-chip')
                .dispatchEvent(
                    new offline.window.MouseEvent('click', { bubbles: true }),
                );
            assert.strictEqual(off.querySelectorAll('.plot-editor').length, 0);
        } finally {
            offline.window.close();
        }
    });
});
