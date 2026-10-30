import * as assert from 'assert';
import { formatLoadTime } from '../../../src/shared/time';

suite('formatLoadTime', () => {
    const iso = '2026-01-01T12:34:56.789Z';

    test('UTC keeps the ISO string', () => {
        assert.strictEqual(formatLoadTime(iso, false), iso);
    });

    test('local time is ISO 8601 with the UTC offset of the time zone', () => {
        const formatted = formatLoadTime(iso, true);
        assert.match(
            formatted,
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
        );
        // Same instant once parsed back.
        assert.strictEqual(
            new Date(formatted).getTime(),
            new Date(iso).getTime(),
        );
    });
});
