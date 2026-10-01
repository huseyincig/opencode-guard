import type { GuardRule } from "../types.js";
/**
 * Completion is checked against concrete, ordered tool evidence rather than
 * treating a well-written final message as proof. Ambiguous evidence remains
 * advisory, and a documented blocker never triggers an automatic loop.
 */
export declare const taskCompletionRule: GuardRule;
