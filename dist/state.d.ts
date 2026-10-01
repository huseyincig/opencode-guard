interface SessionState {
    turnKey: string;
    remediationCount: number;
    fingerprints: Set<string>;
}
export declare class SessionStateStore {
    private readonly sessions;
    beginTurn(sessionID: string, turnKey: string): SessionState;
    canRemediate(sessionID: string, turnKey: string, fingerprint: string, budget: number): boolean;
    recordRemediation(sessionID: string, turnKey: string, fingerprint: string): void;
    forget(sessionID: string): void;
}
export {};
