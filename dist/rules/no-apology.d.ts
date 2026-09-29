import type { GuardRule } from "../types.js";
export interface ApologyPattern {
    name: string;
    regex: RegExp;
}
/**
 * Universal multi-lingual apology and sycophancy patterns.
 * Matches root stems and expressions across English, Turkish, German, French,
 * Spanish, Italian, Portuguese, Russian, and Dutch with zero false-positives
 * on technical nouns/verbs.
 */
export declare const MULTILINGUAL_APOLOGY_PATTERNS: ApologyPattern[];
export declare const noApologyRule: GuardRule;
