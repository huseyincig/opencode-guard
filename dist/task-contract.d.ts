import type { SessionMessage, TurnEvidence } from "./types.js";
/** Explicit user requirements only. No LLM classification or inferred goals. */
export interface TaskContract {
    turnKey: string;
    explicitAction: boolean;
    iterativeReview: boolean;
    requiresSourceReview: boolean;
    requiredVerifications: Array<"test" | "build" | "typecheck" | "lint" | "audit">;
    requiresExplicitCompletion: boolean;
}
export declare function currentHumanMessage(messages: readonly SessionMessage[]): SessionMessage | undefined;
/** Questions about a possible workflow are not instructions to execute it. */
export declare function isExploratoryPrompt(text: string): boolean;
export declare function extractTaskContract(messages: readonly SessionMessage[]): TaskContract | undefined;
export declare function taskGuidance(contract: TaskContract): string | undefined;
export declare function latestMutationSequence(evidence: TurnEvidence): number;
export declare function hasPostMutationReview(evidence: TurnEvidence, sourceReviewRequired?: boolean): boolean;
