import type { GuardRule, RuleFinding, RuleResult, TurnInspectionContext } from "../types.js";
import { sanitizeProseForInspection } from "../prose.js";
import { extractLikelyShellMutation } from "../tool-input.js";

export const DEFAULT_HEDGING_PATTERNS = [
  // Deferred work
  "for now",
  "revisit later",
  "revisit this",
  "come back to this",
  "should be replaced",
  "should be updated",
  "should be revisited",
  "will need to be",
  // Quality shortcuts
  "good enough",
  "acceptable solution",
  "simple enough",
  "simple approach",
  "basic implementation",
  "simplified version",
  "quick and dirty",
  "not ideal",
  // Version hedging
  "first version",
  "initial version",
  // Placeholder/mock
  "placeholder",
  "hardcoded",
  "hard-coded",
  "workaround",
  "temporary fix",
  "temporary solution",
  "temporary",
];

export const DEFAULT_CODE_MARKERS = ["TODO", "FIXME", "HACK", "XXX"];

export const DEFAULT_CODE_MARKER_REGEXES: { marker: string; regex: RegExp }[] =
  DEFAULT_CODE_MARKERS.map((marker) => ({
    marker,
    regex: new RegExp(`\\b${marker}\\b`),
  }));

export const DEFAULT_EXCEPTIONS = [
  "temporarydirectory",
  "tempdirectory",
  "tempdir",
  "tmpdir",
];

function extractAddedPatchLines(patch: unknown): string {
  if (typeof patch !== "string") return "";
  return patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

function extractSnippet(text: string, matchIndex: number, matchLen: number): string {
  const maxPerSide = 80;
  const start = Math.max(0, matchIndex - maxPerSide);
  const end = Math.min(text.length, matchIndex + matchLen + maxPerSide);

  let snippet = text.slice(start, end).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < text.length) snippet = `${snippet}…`;
  return snippet;
}

/**
 * Checks if match at [pos, pos + len) is enclosed within any known exception substring.
 */
function isWithinException(text: string, pos: number, len: number, exceptions: string[]): boolean {
  const lowerText = text.toLowerCase();
  for (const exc of exceptions) {
    if (!exc) continue;
    let fromIdx = 0;
    while (true) {
      const excIdx = lowerText.indexOf(exc, fromIdx);
      if (excIdx === -1) break;
      const excEnd = excIdx + exc.length;
      if (excIdx <= pos && pos + len <= excEnd) {
        return true;
      }
      fromIdx = excIdx + 1;
    }
  }
  return false;
}

export const noShortcutsRule: GuardRule = {
  id: "quality/no-shortcuts",
  description: "Detects hedging language, shortcut phrases, or deferred work patterns in code and responses.",
  inspect: (context: TurnInspectionContext): RuleResult => {
    const patterns = [
      ...DEFAULT_HEDGING_PATTERNS,
      ...(context.ruleConfig.customPhrases ?? []).filter((phrase) => phrase.trim().length > 0),
    ];
    const exceptions = [
      ...DEFAULT_EXCEPTIONS,
      ...(context.ruleConfig.exceptions
        ?.map((e) => e.trim().toLowerCase())
        .filter(Boolean) ?? []),
    ];

    const findings: RuleFinding[] = [];
    const seen = new Set<string>();

    const checkText = (text: string, source: string) => {
      if (!text || typeof text !== "string") return;
      const lowerText = text.toLowerCase();

      // Check case-insensitive hedging patterns with localized exception boundary checking
      for (const pattern of patterns) {
        const lowerPattern = pattern.toLowerCase();
        if (seen.has(lowerPattern)) continue;

        let searchFrom = 0;
        while (true) {
          const idx = lowerText.indexOf(lowerPattern, searchFrom);
          if (idx === -1) break;

          // Only skip this match if it lies inside a legitimate exception (e.g. TemporaryDirectory)
          if (!isWithinException(text, idx, pattern.length, exceptions)) {
            seen.add(lowerPattern);
            const snippet = extractSnippet(text, idx, pattern.length);
            findings.push({
              ruleId: "quality/no-shortcuts",
              pattern,
              messageSnippet: snippet,
              description: `Shortcut/hedging detected in ${source}: "${pattern}" → "${snippet}"`,
            });
            break;
          }
          searchFrom = idx + 1;
        }
      }

      // Check case-sensitive code markers (TODO, FIXME, etc.)
      for (const { marker, regex } of DEFAULT_CODE_MARKER_REGEXES) {
        if (seen.has(marker)) continue;

        const match = regex.exec(text);
        if (match) {
          seen.add(marker);
          const snippet = extractSnippet(text, match.index, marker.length);
          findings.push({
            ruleId: "quality/no-shortcuts",
            pattern: marker,
            messageSnippet: snippet,
            description: `Code marker detected in ${source}: "${marker}" → "${snippet}"`,
          });
        }
      }
    };

    for (const msg of context.currentTurn) {
      if (msg.info.role !== "assistant") continue;

      for (const part of msg.parts) {
        if (part.type === "text" && part.text) {
          checkText(sanitizeProseForInspection(part.text), "assistant response");
        }

        if (part.type === "tool" && part.state?.input) {
          const input = part.state.input;
          if (typeof input.content === "string") {
            checkText(input.content, "file write content");
          }
          if (typeof input.new_string === "string") {
            checkText(input.new_string, "file edit");
          }
          if (typeof input.newString === "string") {
            checkText(input.newString, "file edit");
          }
          const patchText = extractAddedPatchLines(input.patchText ?? input.patch);
          if (patchText) {
            checkText(patchText, "patch added lines");
          }
          const shellMutation = extractLikelyShellMutation(input);
          if (shellMutation) {
            checkText(shellMutation, "shell file mutation");
          }
        }
      }
    }

    if (findings.length === 0) {
      return {
        ruleId: "quality/no-shortcuts",
        decision: "pass",
        findings: [],
      };
    }

    const list = findings.map((f) => `  - "${f.pattern}" → ${f.messageSnippet}`).join("\n");
    const remediationPrompt =
      `Shortcut/assumption language detected in this turn:\n${list}\n\n` +
      `Before stopping, explicitly report to the user each shortcut or assumption. ` +
      `For each: (1) what exactly you did and where, (2) why you chose this approach, ` +
      `(3) what a complete solution looks like. Be specific — the user needs to make ` +
      `an informed judgement call.\n\n` +
      `No explanation is needed if the flagged expression is itself a preventative ` +
      `measure against the thing it names (e.g. code that detects a placeholder and ` +
      `throws, a test asserting no TODO remains, a guard rejecting hardcoded values). ` +
      `In that case, briefly note it and stop.`;

    return {
      ruleId: "quality/no-shortcuts",
      decision: "block",
      findings,
      remediationPrompt,
    };
  },
};
