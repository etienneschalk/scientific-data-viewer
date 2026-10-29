import * as assert from 'assert';
import { HTMLGenerator } from '../../../src/panel/HTMLGenerator';

// jsdom ships without type declarations in this repo.
// eslint-disable-next-line @typescript-eslint/no-var-requires
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

    test('renders non-string attribute values as JSON text', () => {
        harness.loadData(sampleDataInfo(), { nestedAttributesView: false });

        const text = harness.document.getElementById(
            'group-info-container',
        ).textContent;
        for (const expected of [
            'scale : 0.5',
            'count : 3',
            'valid : true',
            'missing : null',
            'range : [1,2]',
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
                ['Attributes', '7', true],
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
                .includes('chunks : [3,2]'),
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
                [
                    'data-group___-___group-plot-controls',
                    'Group Plot Controls',
                    true,
                ],
                ['data-group___-___dimensions', 'Dimensions', true],
                ['data-group___-___coordinates', 'Coordinates', true],
                ['data-group___-___variables', 'Variables', true],
                ['data-group___-___attributes', 'Attributes', true],
                ['data-group___-___encoding', 'Xarray Encoding', false],
            ],
        );
        assert.ok(
            sections[0].classList.contains('group-plot-controls-section'),
        );
        assert.strictEqual(sections[0].dataset.group, '/');
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
            { command: 'scientificDataViewer.showLogs' },
        ]);
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

    test('createPlot sends named fields with group overrides', () => {
        harness.loadData(sampleDataInfo());
        const doc = harness.document;

        // Global controls
        harness.setValue(doc.getElementById('datetimeVariableSelect'), 'time');
        harness.setValue(doc.getElementById('plotBinsInput'), '20');
        harness.setValue(doc.getElementById('plotCmapInput'), 'viridis');
        harness.setValue(doc.getElementById('plotAspectInput'), '-1');
        doc.getElementById('xIncreaseCheckbox').checked = false;
        harness.setValue(doc.getElementById('dim-slice-time'), '0:2');
        // Group "/" controls: override cmap and col_wrap, leave bins empty
        const safeId = 'group-plot___-';
        harness.setValue(
            doc.getElementById(`group-plot-cmap-${safeId}`),
            'magma',
        );
        harness.setValue(
            doc.getElementById(`group-plot-col-wrap-${safeId}`),
            '3',
        );
        harness.setValue(
            doc.getElementById(`group-plot-aspect-${safeId}`),
            '1.5',
        );

        harness.click(
            harness
                .plotControls('/temperature')
                .querySelector('[data-action="create-plot"]'),
        );

        const [request] = harness.requests('createPlot');
        assert.ok(request, 'createPlot request posted');
        const { operationId, ...payload } = request.payload;
        assert.ok(String(operationId).startsWith('plot-'));
        assert.deepStrictEqual(payload, {
            variable: '/temperature',
            datetimeVariableName: 'time',
            startDatetime: '2020-01-01T00:00:00',
            endDatetime: '2020-01-03T00:00:00',
            dimensionSlices: { time: '0:2' },
            colWrap: 3,
            xincrease: false,
            yincrease: true,
            robust: false,
            addColorbar: true,
            addLegend: true,
            bins: 20,
            aspect: 1.5,
            cmap: 'magma',
        });
    });

    test('group time text inputs and variable select drive the filter', () => {
        harness.loadData(sampleDataInfo());
        const doc = harness.document;
        const safeId = 'group-plot___-';

        const select = doc.getElementById(`group-datetime-select-${safeId}`);
        harness.setValue(select, 'time');
        assert.strictEqual(
            doc.getElementById(`group-start-datetime-${safeId}`).value,
            '2020-01-01T00:00',
            'group select prefills the range',
        );
        harness.setValue(
            doc.getElementById(`group-end-datetime-text-${safeId}`),
            '2020-01-02 12:00:00',
            'input',
        );

        harness.click(
            harness
                .plotControls('/temperature')
                .querySelector('[data-action="create-plot"]'),
        );
        const [request] = harness.requests('createPlot');
        assert.strictEqual(request.payload.datetimeVariableName, 'time');
        assert.strictEqual(request.payload.endDatetime, '2020-01-02T12:00:00');
    });

    test('refresh does not keep a stale datetime variable', () => {
        harness.loadData(sampleDataInfo());
        harness.setValue(
            harness.document.getElementById('datetimeVariableSelect'),
            'time',
        );

        const withoutTime = sampleDataInfo();
        withoutTime.datetime_variables = {};
        harness.loadData(withoutTime);

        harness.click(
            harness
                .plotControls('/temperature')
                .querySelector('[data-action="create-plot"]'),
        );
        const [request] = harness.requests('createPlot');
        assert.strictEqual(request.payload.datetimeVariableName, undefined);
    });

    test('each Reset button clears its own block', () => {
        harness.loadData(sampleDataInfo());
        const doc = harness.document;
        harness.setValue(doc.getElementById('plotBinsInput'), '20');
        doc.getElementById('robustCheckbox').checked = true;
        doc.getElementById('plotColWrapAutoCheckbox').checked = true;
        harness.setValue(doc.getElementById('dim-slice-lat'), '0:1');

        harness.click(doc.getElementById('clearDimensionSlicesButton'));

        assert.strictEqual(doc.getElementById('dim-slice-lat').value, '');
        assert.strictEqual(doc.getElementById('plotBinsInput').value, '20');

        harness.click(doc.getElementById('clearPlotParametersButton'));

        assert.strictEqual(doc.getElementById('plotBinsInput').value, '');
        assert.strictEqual(doc.getElementById('robustCheckbox').checked, false);
        assert.strictEqual(
            doc.getElementById('plotColWrapAutoCheckbox').checked,
            false,
        );
        assert.strictEqual(
            doc.getElementById('xIncreaseCheckbox').checked,
            true,
        );
    });

    test('displays the plot and saves it under a relative path', () => {
        harness.loadData(sampleDataInfo());
        const controls = harness.plotControls(`/g${EVIL}/v${EVIL}`);
        harness.click(controls.querySelector('[data-action="create-plot"]'));
        const [request] = harness.requests('createPlot');
        harness.respond(request.id, 'iVBORw0KGgo=');

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
        harness.respond(request.id, 'iVBORw0KGgo=');
        await new Promise((resolve) => setTimeout(resolve, 0));
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
        harness.respond(request.id, 'iVBORw0KGgo=');
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.strictEqual(controls.querySelector('img'), null);
    });

    test('export capture keeps control values', async () => {
        harness.loadData(sampleDataInfo());
        const doc = harness.document;
        harness.setValue(doc.getElementById('plotBinsInput'), '42');
        doc.getElementById('robustCheckbox').checked = true;
        harness.click(doc.getElementById('exportWebviewButton'));

        const [request] = harness.requests('exportWebview');
        const exported = request.payload.htmlContent as string;
        assert.match(exported, /id="plotBinsInput"[^>]*value="42"/);
        assert.match(exported, /id="robustCheckbox"[^>]*checked="checked"/);

        // Opened in a browser, the export runs in degraded mode and keeps the values
        const offline = new JSDOM(exported, { runScripts: 'dangerously' });
        await new Promise((resolve) =>
            offline.window.addEventListener('load', resolve),
        );
        try {
            const offlineDoc = offline.window.document;
            assert.ok(offlineDoc.getElementById('degraded-mode-indicator'));
            assert.strictEqual(
                offlineDoc.getElementById('plotBinsInput').value,
                '42',
            );
            assert.strictEqual(
                offlineDoc.getElementById('refreshButton').style.display,
                'none',
            );
        } finally {
            offline.window.close();
        }
    });
});
