import type { GuardRule } from "../types.js";
/**
 * Regex patterns that detect lazy file truncation comments like:
 * "// ... existing code unchanged ..."
 * "# ... rest of code ..."
 * "<!-- ... previous content ... -->"
 */
export declare const TRUNCATION_PATTERNS: RegExp[];
export declare const noTruncationRule: GuardRule;
