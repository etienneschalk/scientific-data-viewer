import * as assert from 'assert';
import { PerformanceTimer } from '../../../src/common/PerformanceTimer';

suite('PerformanceTimer Test Suite', () => {
    test('should record marks with elapsed and cumulative times', () => {
        const timer = new PerformanceTimer('test-trace');
        timer.mark('first');
        timer.mark('second');
        const marks = timer.finish('done');

        assert.strictEqual(marks.length, 3);
        assert.strictEqual(marks[0].label, 'first');
        assert.strictEqual(marks[1].label, 'second');
        assert.strictEqual(marks[2].label, 'done');
        assert.ok(marks[0].elapsedMs >= 0);
        assert.ok(marks[2].sinceStartMs >= marks[1].sinceStartMs);
    });

    test('getMarks returns a copy of recorded marks', () => {
        const timer = new PerformanceTimer('copy-test');
        timer.mark('only');
        const marks = timer.getMarks();

        assert.strictEqual(marks.length, 1);
        marks.push({
            label: 'mutated',
            elapsedMs: 0,
            sinceStartMs: 0,
        });
        assert.strictEqual(timer.getMarks().length, 1);
    });
});
