const path = require('path');
const { REPO } = require('../paths.cjs');
const Mocha = require(path.join(REPO, 'node_modules', 'mocha'));

exports.run = async function run() {
    const mocha = new Mocha({ ui: 'bdd', color: false, timeout: 180000 });
    for (const f of (process.env.SDV_E2E_FILES || '').split(',').filter(Boolean)) {
        mocha.addFile(f);
    }
    return new Promise((resolve, reject) => {
        mocha.run((failures) => {
            require('./helpers.cjs').flushLogs();
            failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve();
        });
    });
};
