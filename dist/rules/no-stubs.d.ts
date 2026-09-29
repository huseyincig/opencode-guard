import type { GuardRule } from "../types.js";
/**
 * Patterns that indicate fake or stubbed implementations in code.
 */
export declare const STUB_PATTERNS: {
    regex: RegExp;
    name: string;
}[];
export declare const noStubsRule: GuardRule;
