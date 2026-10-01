export class SessionStateStore {
    sessions = new Map();
    beginTurn(sessionID, turnKey) {
        const existing = this.sessions.get(sessionID);
        if (!existing || existing.turnKey !== turnKey) {
            const next = {
                turnKey,
                remediationCount: 0,
                fingerprints: new Set(),
            };
            this.sessions.set(sessionID, next);
            return next;
        }
        return existing;
    }
    canRemediate(sessionID, turnKey, fingerprint, budget) {
        const state = this.beginTurn(sessionID, turnKey);
        if (state.remediationCount >= budget)
            return false;
        if (state.fingerprints.has(fingerprint))
            return false;
        return true;
    }
    recordRemediation(sessionID, turnKey, fingerprint) {
        const state = this.beginTurn(sessionID, turnKey);
        state.remediationCount += 1;
        state.fingerprints.add(fingerprint);
    }
    forget(sessionID) {
        this.sessions.delete(sessionID);
    }
}
