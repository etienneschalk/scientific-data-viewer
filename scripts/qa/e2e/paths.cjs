// Paths shared by the end-to-end runner and the suites (see scripts/qa/README.md).
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const QA = path.resolve(process.env.SDV_QA_OUT || path.join(REPO, '.qa'));

/** The extension's own uv environment, as created by "Use Extension Own Environment". */
const EXTENSION_ENV_PY = path.join(
    os.homedir(),
    '.config/Code/User/globalStorage/eschalk0.scientific-data-viewer/python-environment/bin/python',
);
const VENV_PY = path.join(REPO, '.venv/bin/python');
const UV_PY =
    process.env.SDV_PYTHON ||
    (fs.existsSync(EXTENSION_ENV_PY) ? EXTENSION_ENV_PY : VENV_PY);

module.exports = {
    REPO,
    SAMPLE: path.join(REPO, 'sample-data'),
    QA,
    ADV: path.join(QA, 'fixtures'),
    E: path.join(QA, 'e2e'),
    UV_PY,
    // Interpreter with kerchunk installed (Kerchunk suites)
    VENV_PY: process.env.SDV_KERCHUNK_PYTHON || VENV_PY,
};
