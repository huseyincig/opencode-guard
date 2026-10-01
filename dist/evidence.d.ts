import type { EvidenceKind, EvidenceRecord, SessionMessage, TurnEvidence } from "./types.js";
export { isOpaqueShellExecution } from "./shell-risk.js";
export declare function normalizeErrorFingerprint(errorText: string): string;
export declare function isVerificationFailureMask(command: string): boolean;
export declare function gitCleanInvocation(command: string): string | undefined;
/**
 * Detect literal destructive shell actions, including common shell rewrites.
 * Post-execution classification cannot serve as a pre-execution safety gate.
 */
export declare function isDestructiveCommand(command: string, depth?: number): boolean;
/** Recognize actual literal rm invocations, not quoted examples or help output.
 * Separate from recursive-force classification to preserve existing evidence kinds. */
export declare function isSimpleFileRemoval(command: string, depth?: number): boolean;
export declare function collectTurnEvidence(currentTurn: SessionMessage[]): TurnEvidence;
export declare function latestEvidence(evidence: TurnEvidence | undefined, kind: EvidenceKind): EvidenceRecord | undefined;
export declare function hasSuccessfulEvidence(evidence: TurnEvidence | undefined, kind: EvidenceKind): boolean;
export declare function hasSuccessfulVerification(evidence: TurnEvidence | undefined): boolean;
