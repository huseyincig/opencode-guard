interface SessionState {
  turnKey: string;
  remediationCount: number;
  fingerprints: Set<string>;
}

export class SessionStateStore {
  private readonly sessions = new Map<string, SessionState>();

  beginTurn(sessionID: string, turnKey: string): SessionState {
    const existing = this.sessions.get(sessionID);
    if (!existing || existing.turnKey !== turnKey) {
      const next: SessionState = {
        turnKey,
        remediationCount: 0,
        fingerprints: new Set<string>(),
      };
      this.sessions.set(sessionID, next);
      return next;
    }
    return existing;
  }

  canRemediate(
    sessionID: string,
    turnKey: string,
    fingerprint: string,
    budget: number
  ): boolean {
    const state = this.beginTurn(sessionID, turnKey);
    if (state.remediationCount >= budget) return false;
    if (state.fingerprints.has(fingerprint)) return false;
    return true;
  }

  recordRemediation(
    sessionID: string,
    turnKey: string,
    fingerprint: string
  ): void {
    const state = this.beginTurn(sessionID, turnKey);
    state.remediationCount += 1;
    state.fingerprints.add(fingerprint);
  }

  forget(sessionID: string): void {
    this.sessions.delete(sessionID);
  }
}
