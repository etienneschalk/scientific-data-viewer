import * as assert from 'assert';
import {
    generateMarkdownReport,
    runHealthcheck,
} from '../../../src/common/HealthcheckManager';
import {
    CORE_PACKAGES,
    EXTENDED_PACKAGES,
    PLOT_PACKAGES,
} from '../../../src/python/ExtensionVirtualEnvironmentManager';

suite('Healthcheck Test Suite', () => {
    function fakePythonManager(availability: Record<string, boolean> | null): {
        manager: any;
        checks: string[][];
    } {
        const checks: string[][] = [];
        const manager = {
            pythonPath: availability ? '/usr/bin/python3' : null,
            getCurrentEnvironmentInfo: () => ({
                initialized: true,
                ready: availability !== null && availability.xarray === true,
                source: availability ? 'system' : null,
                path: availability ? '/usr/bin/python3' : null,
            }),
            checkPackagesAvailability: async (
                _pythonPath: string,
                packages: string[],
            ) => {
                checks.push(packages);
                return availability;
            },
        };
        return { manager, checks };
    }

    const fakeEnvManager = {
        ready: false,
        UV_INSTALLATION_URL: 'https://example.invalid/uv',
        isUvAvailable: async () => true,
    } as any;

    test('checks the packages once, for dependencies and formats', async () => {
        const all = [...CORE_PACKAGES, ...PLOT_PACKAGES, ...EXTENDED_PACKAGES];
        const availability = Object.fromEntries(
            all.map((pkg) => [pkg, pkg !== 'cfgrib']),
        );
        const { manager, checks } = fakePythonManager(availability);

        const report = await runHealthcheck(manager, fakeEnvManager);

        assert.strictEqual(checks.length, 1);
        assert.deepStrictEqual(checks[0], all);
        assert.strictEqual(report.components.dependencies.status, 'warning');
        assert.match(report.components.dependencies.message, /cfgrib/);
        assert.strictEqual(
            report.components.supportedFormats.status,
            'warning',
        );
        assert.match(
            report.components.supportedFormats.details ?? '',
            /cfgrib/,
        );
        assert.strictEqual(
            report.components.pythonEnvironment.status,
            'healthy',
        );
    });

    test('no interpreter: error report with the expected sections', async () => {
        const { manager, checks } = fakePythonManager(null);

        const report = await runHealthcheck(manager, fakeEnvManager);
        const markdown = generateMarkdownReport(report, manager);

        assert.strictEqual(checks.length, 0);
        assert.strictEqual(report.overallStatus, 'error');
        assert.strictEqual(report.components.pythonEnvironment.status, 'error');
        for (const heading of [
            'Healthcheck Report',
            '## ℹ️ System Information',
            '## 🐍 Environment Information',
            '## 🔧 Component Status',
            '## ❌ Errors Found',
            'Error History',
            '## 💡 Recommendations',
            '## ⚙️ Configuration Details',
        ]) {
            assert.ok(markdown.includes(heading), `missing: ${heading}`);
        }
    });
});
