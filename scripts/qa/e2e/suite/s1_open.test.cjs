const h = require('./helpers.cjs');
const { vscode, path, SAMPLE, ADV } = h;

const S = (f) => path.join(SAMPLE, f);
const A = (f) => path.join(ADV, f);

const viaEditor = [
    [S('sample_data.nc'), 'netcdfEditor', 'ok'],
    [S('sample_data.nc4'), 'netcdfEditor', 'ok'],
    [S('sample_data.netcdf'), 'netcdfEditor', 'ok'],
    [S('sample_data_multiple_groups.nc'), 'netcdfEditor', 'ok'],
    [S('sample_netcdf_gzip.nc'), 'netcdfEditor', 'ok'],
    [S('sample data with spaces.nc'), 'netcdfEditor', 'ok'],
    [S('sample_data.cdf'), 'cdfEditor', 'ok'],
    [S('sample_data.h5'), 'hdf5Editor', 'ok'],
    [S('sample_data.hdf5'), 'hdf5Editor', 'ok'],
    [S('sample_zarr_arborescence.zarr'), 'zarrEditor', 'ok'],
    [S('sample_zarr_v3_sharded.zarr'), 'zarrEditor', 'ok'],
    [S('sample_zarr_inherited_coords.zarr'), 'zarrEditor', 'ok'],
    [S('sample_data.grib'), 'gribEditor', 'ok'],
    [S('sample_data.grib2'), 'gribEditor', 'ok'],
    [S('sample_data.grb'), 'gribEditor', 'ok'],
    [S('sample_data.grb2'), 'gribEditor', 'ok'],
    [S('sample_data.tif'), 'geotiffEditor', 'ok'],
    [S('sample_data.tiff'), 'geotiffEditor', 'ok'],
    [S('sample_data.geotiff'), 'geotiffEditor', 'ok'],
    [S('sample_data_cog.tif'), 'geotiffEditor', 'ok'],
    [S('sample_multiband.tif'), 'geotiffEditor', 'ok'],
    [S('sample_data.jp2'), 'jp2Editor', 'ok'],
    [S('sample_data.jpeg2000'), 'jp2Editor', 'ok'],
    // broken
    [S('broken_file.nc'), 'netcdfEditor', 'error'],
    [S('broken_file.nc4'), 'netcdfEditor', 'error'],
    [S('broken_file.h5'), 'hdf5Editor', 'error'],
    [S('broken_file.grib'), 'gribEditor', 'error'],
    [S('broken_file.tif'), 'geotiffEditor', 'error'],
    [S('broken_file.jp2'), 'jp2Editor', 'error'],
    [S('broken_file.zarr'), 'zarrEditor', 'error'],
    // adversarial
    [A('empty.nc'), 'netcdfEditor', 'error'],
    [A('truncated.nc'), 'netcdfEditor', 'error'],
    [A('text_as.nc'), 'netcdfEditor', 'error'],
    [A('dangling_link.nc'), 'netcdfEditor', 'error'],
    [A('dir_named.nc'), 'netcdfEditor', 'error'],
    [A('symlink_to_zoo.nc'), 'netcdfEditor', 'ok'],
    [A('has#hash.nc'), 'netcdfEditor', 'ok'],
    [A('has%25percent.nc'), 'netcdfEditor', 'ok'],
    [A('has?question.nc'), 'netcdfEditor', 'ok'],
    [A("quote'single\".nc"), 'netcdfEditor', 'ok'],
    [A('semi;colon $(touch PWNED).nc'), 'netcdfEditor', 'ok'],
    [A('-starts-with-dash.nc'), 'netcdfEditor', 'ok'],
    [A('ünïcødé 名前.nc'), 'netcdfEditor', 'ok'],
    [A('UPPER.NC'), 'netcdfEditor', 'ok'],
    [A('netcdf3_classic.nc'), 'netcdfEditor', 'ok'],
    [A('xss_names.nc'), 'netcdfEditor', 'ok'],
    [A('xss_groups.nc'), 'netcdfEditor', 'ok'],
    [A('vlen_enum.nc'), 'netcdfEditor', 'ok'],
    [A('complex.nc'), 'netcdfEditor', 'ok'],
    [A('pure_hdf5.h5'), 'hdf5Editor', '?'],
    [A('empty.zarr'), 'zarrEditor', 'error'],
    [A('v2store.zarr'), 'zarrEditor', 'ok'],
    [A('v3store.zarr'), 'zarrEditor', 'ok'],
    [A('double.nc.zarr'), 'zarrEditor', '?'],
    [A('scene.tif'), 'geotiffEditor', '?'],
    [A('no_crs.tif'), 'geotiffEditor', '?'],
    [A('nodata_float.tif'), 'geotiffEditor', 'ok'],
];

const viaCommand = [
    // [command, path, expected]
    ['scientificDataViewer.openViewerFolder', S('sample_ocean_grid_v3'), 'ok'],
    ['scientificDataViewer.openViewerFolder', A('plain dir with spaces'), 'ok'],
    ['scientificDataViewer.openViewerFolder', S('sample_zarr_single_group_from_dataset.zarr'), 'ok'],
    ['scientificDataViewer.openViewerFolder', S('temporal-datasets'), 'error'],
    ['scientificDataViewer.openViewer', S('sample_zarr_v3.zarr.zip'), 'ok'],
    ['scientificDataViewer.openViewer', A('root_v3.zip'), 'ok'],
    ['scientificDataViewer.openViewer', A('root_v2.zarr.zip'), 'ok'],
    ['scientificDataViewer.openViewer', A('prefixed.zip'), 'ok'],
    ['scientificDataViewer.openViewer', A('deflated_v3.zip'), '?'],
    ['scientificDataViewer.openViewer', A('two_stores.zip'), '?'],
    ['scientificDataViewer.openViewer', A('corrupt.zip'), 'error'],
    ['scientificDataViewer.openViewer', A('empty.zip'), 'error'],
    ['scientificDataViewer.openViewer', S('not_zarr.zip'), 'error'],
    ['scientificDataViewer.openViewer', S('sample_data.nc'), 'ok'],
    ['scientificDataViewer.openViewer', S('broken_file.safe'), 'error'],
];

describe('S1 open formats', function () {
    before(async () => {
        await h.setup();
    });
    afterEach(async () => {
        await h.closeAll();
    });

    for (const [file, viewType, expected] of viaEditor) {
        it(`openWith ${viewType} ${path.basename(file)}`, async function () {
            const t0 = Date.now();
            let panel;
            let err;
            try {
                panel = await h.openWith(file, viewType);
            } catch (e) {
                err = String(e);
            }
            if (!panel) {
                h.record({ s: 'S1', how: 'openWith', file, viewType, expected, noPanel: true, err });
                throw new Error('no panel created: ' + err);
            }
            const r = await h.waitLoaded(panel, 120000);
            const rec = { s: 'S1', how: 'openWith', file: path.basename(file), viewType, expected, ...r, totalMs: Date.now() - t0 };
            h.record(rec);
            if (r.hung) throw new Error('load hung');
            if (expected === 'ok' && r.hasError) throw new Error('unexpected error: ' + JSON.stringify(r.error));
            if (expected === 'error' && !r.hasError) throw new Error('expected error state, got ' + r.format);
        });
    }

    for (const [cmd, file, expected] of viaCommand) {
        it(`${cmd.split('.').pop()} ${path.basename(file)}`, async function () {
            const t0 = Date.now();
            const before = h.maxId();
            await vscode.commands.executeCommand(cmd, vscode.Uri.file(file));
            const panel = await h.waitNewPanel(before, file, 30000);
            if (!panel) {
                h.record({ s: 'S1', how: cmd, file, expected, noPanel: true });
                throw new Error('no panel');
            }
            const r = await h.waitLoaded(panel, 120000);
            h.record({ s: 'S1', how: cmd.split('.').pop(), file: path.basename(file), expected, ...r, totalMs: Date.now() - t0 });
            if (r.hung) throw new Error('load hung');
            if (expected === 'ok' && r.hasError) throw new Error('unexpected error: ' + JSON.stringify(r.error));
            if (expected === 'error' && !r.hasError) throw new Error('expected error state, got ' + r.format);
        });
    }

    it('openViewerMultiple with 3 files', async function () {
        const files = [S('sample_data.h5'), S('sample_data.cdf'), S('sample_data.tif')];
        const before = h.maxId();
        await vscode.commands.executeCommand(
            'scientificDataViewer.openViewerMultiple',
            vscode.Uri.file(files[0]),
            files.map((f) => vscode.Uri.file(f)),
        );
        const ps = [];
        for (const f of files) ps.push(await h.waitNewPanel(before, f, 30000));
        const rs = [];
        for (const p of ps) rs.push(p ? await h.waitLoaded(p) : { noPanel: true });
        h.record({ s: 'S1', how: 'openViewerMultiple', files: files.map((f) => path.basename(f)), rs: rs.map((r) => ({ hasError: r.hasError, format: r.format, ms: r.ms })) });
        if (rs.some((r) => r.noPanel || r.hasError)) throw new Error(JSON.stringify(rs));
    });

    it('openViewer twice on same file reveals instead of new tab', async function () {
        const f = S('sample_data.h5');
        const before = h.maxId();
        await vscode.commands.executeCommand('scientificDataViewer.openViewer', vscode.Uri.file(f));
        const p = await h.waitNewPanel(before, f);
        await h.waitLoaded(p);
        await vscode.commands.executeCommand('scientificDataViewer.openViewer', vscode.Uri.file(f));
        await h.sleep(1500);
        const count = h.panels().filter((x) => x.getFileUri().fsPath === f).length;
        h.record({ s: 'S1', how: 'openViewer x2', file: 'sample_data.h5', panelsForFile: count });
        if (count !== 1) throw new Error('expected 1 panel, got ' + count);
    });
});
