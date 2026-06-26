import { Logger } from './Logger';

export interface PerformanceMark {
    label: string;
    elapsedMs: number;
    sinceStartMs: number;
}

/**
 * Lightweight stage timer for profiling extension and webview load paths.
 */
export class PerformanceTimer {
    private readonly startMs: number;
    private lastMarkMs: number;
    private readonly marks: PerformanceMark[] = [];
    private readonly traceId: string;

    constructor(traceId: string) {
        this.traceId = traceId;
        this.startMs = Date.now();
        this.lastMarkMs = this.startMs;
    }

    mark(label: string): void {
        const now = Date.now();
        const mark: PerformanceMark = {
            label,
            elapsedMs: now - this.lastMarkMs,
            sinceStartMs: now - this.startMs,
        };
        this.marks.push(mark);
        this.lastMarkMs = now;
        Logger.info(
            `⏱️ [${this.traceId}] ${label}: +${mark.elapsedMs}ms (total ${mark.sinceStartMs}ms)`,
        );
    }

    finish(summaryLabel = 'complete'): PerformanceMark[] {
        this.mark(summaryLabel);
        const totalMs = Date.now() - this.startMs;
        Logger.info(
            `⏱️ [${this.traceId}] finished in ${totalMs}ms (${this.marks.length} marks)`,
        );
        return [...this.marks];
    }

    getMarks(): PerformanceMark[] {
        return [...this.marks];
    }
}
