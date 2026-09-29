import type { GuardRule } from "../types.js";
/**
 * Patterns that indicate weakened or cheated tests.
 */
export declare const TEST_CHEAT_PATTERNS: {
    regex: RegExp;
    name: string;
}[];
export declare const noCheatRule: GuardRule;
