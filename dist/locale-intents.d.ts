/**
 * Multilingual signals only; never a safety-policy decision by themselves.
 * Tasks, permissions, and verification outcomes are evaluated through the
 * same language-neutral contract/evidence engine regardless of locale.
 *
 * The terms here intentionally target explicit, high-confidence instructions.
 * An unknown dialect, paraphrase, or ambiguous request returns no new duty;
 * the original user request is still passed to the agent unmodified.
 */
export type VerificationKind = "test" | "build" | "typecheck" | "lint" | "audit";
/** Examples, code and quoted commands do not create new task duties. */
export declare function sanitizeUserInstruction(text: string): string;
export interface InternationalTaskSignals {
    locale: string;
    iterativeReview: boolean;
    requiresSourceReview: boolean;
    requiredVerifications: VerificationKind[];
    explicitAction: boolean;
    /** These are indicators, not a verified interpretation of arbitrary prose. */
    evidence: readonly string[];
}
/**
 * The output is locale-neutral; only the extraction of explicit signals is
 * localized. Unknown or conflicted wording does not create a mandatory task.
 */
export declare function extractInternationalSignals(input: string): InternationalTaskSignals | undefined;
export interface InternationalNegations {
    iteration: boolean;
    action: boolean;
    test: boolean;
}
export declare function extractInternationalNegations(input: string): InternationalNegations;
export declare const SUPPORTED_SIGNAL_LOCALES: readonly string[];
export type AgentReportState = "completed" | "blocked" | "unknown";
export declare function classifyInternationalAgentReport(input: string): AgentReportState;
export declare function detectInternationalHistoricalRefusal(userInstruction: string, assistantResponse: string): string | undefined;
