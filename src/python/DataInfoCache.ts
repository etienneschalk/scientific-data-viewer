import { DataInfoPythonResponse } from '../types';
import { Logger } from '../common/Logger';

export interface DataInfoCacheConfig {
    convertBandsToVariables: boolean;
    lazyReprLoading: boolean;
    smallVariableBytes: number;
    smallValueDisplayMaxLen: number;
}

interface CacheEntry {
    data: DataInfoPythonResponse;
}

function formatPayloadSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (bytes >= 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
}

function estimatePayloadBytes(data: DataInfoPythonResponse): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
}

/**
 * LRU cache for getDataInfo results keyed by file path, mtime, and config.
 */
export class DataInfoCache {
    private static readonly cache = new Map<string, CacheEntry>();

    static buildConfigKey(config: DataInfoCacheConfig): string {
        return JSON.stringify(config);
    }

    private static cacheKey(
        filePath: string,
        mtimeMs: number,
        configKey: string,
    ): string {
        return `${filePath}\0${mtimeMs}\0${configKey}`;
    }

    static get(
        filePath: string,
        mtimeMs: number,
        configKey: string,
        maxEntries: number,
    ): DataInfoPythonResponse | undefined {
        if (maxEntries <= 0) {
            return undefined;
        }

        const key = this.cacheKey(filePath, mtimeMs, configKey);
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }

        // LRU: refresh insertion order
        this.cache.delete(key);
        this.cache.set(key, entry);
        Logger.debug(`[DataInfoCache] hit for ${filePath} (mtime=${mtimeMs})`);
        return entry.data;
    }

    static set(
        filePath: string,
        mtimeMs: number,
        configKey: string,
        data: DataInfoPythonResponse,
        maxEntries: number,
    ): void {
        if (maxEntries <= 0) {
            return;
        }

        const key = this.cacheKey(filePath, mtimeMs, configKey);
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else {
            while (this.cache.size >= maxEntries) {
                const oldestKey = this.cache.keys().next().value;
                if (!oldestKey) {
                    break;
                }
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, { data });

        const payloadBytes = estimatePayloadBytes(data);
        Logger.info(
            `[DataInfoCache] stored ${filePath} (${formatPayloadSize(payloadBytes)}, mtime=${mtimeMs}, entries=${this.cache.size}/${maxEntries})`,
        );
    }

    static clear(): void {
        this.cache.clear();
        Logger.debug('[DataInfoCache] cleared');
    }
}
