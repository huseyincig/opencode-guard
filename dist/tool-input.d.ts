/**
 * Returns shell source only when the command appears to mutate file contents.
 * This covers common heredoc/redirection and in-place scripting paths without
 * treating ordinary read-only shell commands as file writes.
 */
export declare function extractLikelyShellMutation(input: Record<string, unknown>): string;
