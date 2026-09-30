/**
 * Returns shell source only when the command appears to mutate file contents.
 * This covers common heredoc/redirection and in-place scripting paths without
 * treating ordinary read-only shell commands as file writes.
 */
export function extractLikelyShellMutation(
  input: Record<string, unknown>
): string {
  const command =
    typeof input.command === "string"
      ? input.command
      : typeof input.cmd === "string"
        ? input.cmd
        : typeof input.script === "string"
          ? input.script
          : "";

  if (!command) return "";

  const mutatesFile =
    /(?:^|[;&|]\s*|\n)\s*(?:cat|printf|echo)\b[\s\S]*?(?<!\d)>{1,2}\s*(?!&)(?!\/dev\/null\b)\S+/im.test(
      command
    ) ||
    /\btee(?:\s+-a)?\s+(?!\/dev\/null\b)\S+/i.test(command) ||
    /\bsed\b[^\n;]*\s-i(?:\s|['"]|$)/i.test(command) ||
    /\bperl\b[^\n;]*\s-(?:pi|ip)\b/i.test(command) ||
    /\b(?:python(?:3)?|node)\b[\s\S]*(?:writeFile(?:Sync)?|appendFile(?:Sync)?|write_text|write_bytes|open\s*\([^)]*,\s*["'][wax])/i.test(
      command
    );

  return mutatesFile ? command : "";
}
