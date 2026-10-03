export declare function newerStableVersion(current: string, latest: string): boolean;
export interface UpdateCheckOptions {
    installedVersion?: string;
    cachePath?: string;
    now?: number;
    fetcher?: typeof fetch;
    allowDevelopment?: boolean;
}
export declare function checkGuardianUpdate(options?: UpdateCheckOptions): Promise<{ current: string; latest: string; } | undefined>;
export declare function announceGuardianUpdate(show: (current: string, latest: string) => Promise<unknown> | unknown, options?: UpdateCheckOptions): Promise<void>;
