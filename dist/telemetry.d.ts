export type GuardianEventKind = "runtime-started" | "preflight-allowed" | "preflight-blocked" | "post-warning" | "post-remediation" | "inspection-error";
export type PreflightState = "active" | "disabled" | "unavailable";
export interface GuardianEvent {
    at: string;
    kind: GuardianEventKind;
    runtime?: "v1" | "v2";
    preflight?: PreflightState;
    session?: string;
    tool?: string;
    rules?: string[];
}
export type GuardianStatus = {
    preflight: PreflightState | "unknown";
    inspected: number;
    blocked: number;
    warnings: number;
    remediations: number;
    errors: number;
    truncated: boolean;
    lastEvent?: string;
};
export declare function guardianStateDirectory(directory?: string): string;
export declare function guardianEventPath(directory?: string): string;
export declare function sessionFingerprint(value?: string): string | undefined;
export declare function recordGuardianEvent(event: Omit<GuardianEvent, "at">, directoryArg?: string): void;
/** Reads at most the newest 2 MiB: counters describe this bounded event window. */
export declare function readGuardianStatus(directoryOrMaxBytes?: string | number, maxBytesArg?: number): GuardianStatus;
