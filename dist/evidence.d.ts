import type { EvidenceKind, EvidenceRecord, SessionMessage, TurnEvidence } from "./types.js";
export declare function normalizeErrorFingerprint(errorText: string): string;
export declare function isVerificationFailureMask(command: string): boolean;
export declare function gitCleanInvocation(command: string): string | undefined;
export declare function isDestructiveCommand(command: string): boolean;
export declare function collectTurnEvidence(currentTurn: SessionMessage[]): TurnEvidence;
export declare function latestEvidence(evidence: TurnEvidence | undefined, kind: EvidenceKind): EvidenceRecord | undefined;
export declare function hasSuccessfulEvidence(evidence: TurnEvidence | undefined, kind: EvidenceKind): boolean;
export declare function hasSuccessfulVerification(evidence: TurnEvidence | undefined): boolean;
