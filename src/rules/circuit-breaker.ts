import type { GuardRule, RuleFinding, RuleResult, TurnInspectionContext } from "../types.js";

function stringifyError(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    if ("message" in err && typeof (err as any).message === "string") {
      return (err as any).message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function extractToolErrors(context: TurnInspectionContext): string[] {
  const errors: string[] = [];

  for (const msg of context.currentTurn) {
    for (const part of msg.parts) {
      if (part.type !== "tool") continue;
      const state = part.state as
        | {
            status?: string;
            error?: unknown;
            output?: unknown;
            exitCode?: unknown;
            metadata?: { exit?: unknown; output?: unknown };
          }
        | undefined;
      if (!state) continue;

      let failed = false;
      let rawText = "";

      if (state.status === "error") {
        // Tool-level exception (invalid input, thrown error).
        failed = true;
        rawText = stringifyError(state.error);
      } else if (state.status === "completed") {
        // Command ran but the process itself failed (non-zero exit).
        const exitValue = state.metadata?.exit ?? state.exitCode;
        const exitNum =
          typeof exitValue === "number"
            ? exitValue
            : typeof exitValue === "string" && exitValue.trim() !== ""
              ? Number(exitValue)
              : Number.NaN;

        const outputText =
          typeof state.output === "string"
            ? state.output
            : typeof state.metadata?.output === "string"
              ? state.metadata.output
              : "";

        const exitMatch = /\[exit code:\s*(-?\d+)\]/i.exec(outputText);
        const outputExit = exitMatch ? Number(exitMatch[1]) : Number.NaN;

        if ((!Number.isNaN(exitNum) && exitNum !== 0) || (!Number.isNaN(outputExit) && outputExit !== 0)) {
          failed = true;
          rawText = outputText || stringifyError(state.error);
        }
      }

      if (!failed) continue;

      const errorText = rawText.trim();
      if (errorText.length > 10 && errorText !== "[object Object]") {
        const signature = errorText.replace(/\s+/g, " ").slice(0, 200);
        errors.push(signature);
      }
    }
  }

  return errors;
}

export const circuitBreakerRule: GuardRule = {
  id: "runtime/circuit-breaker",
  description: "Detects infinite error loops and trips the breaker when the agent repeats identical failures.",
  inspect: (context: TurnInspectionContext): RuleResult => {
    const errors = extractToolErrors(context);
    if (errors.length < 3) {
      return { ruleId: "runtime/circuit-breaker", decision: "pass", findings: [] };
    }

    const counts = new Map<string, number>();
    for (const err of errors) {
      counts.set(err, (counts.get(err) ?? 0) + 1);
    }

    const findings: RuleFinding[] = [];
    for (const [errSignature, count] of counts.entries()) {
      if (count >= 3) {
        findings.push({
          ruleId: "runtime/circuit-breaker",
          pattern: "Repeated error loop",
          messageSnippet: errSignature,
          description: `Identical error encountered ${count} times in the current turn: "${errSignature}"`,
        });
      }
    }

    if (findings.length === 0) {
      return {
        ruleId: "runtime/circuit-breaker",
        decision: "pass",
        findings: [],
      };
    }

    const list = findings.map((f) => `  - ${f.description}`).join("\n");
    const remediationPrompt =
      `Circuit breaker tripped! Repetitive error loop detected:\n${list}\n\n` +
      `You have hit the exact same failure 3 or more times without progress. ` +
      `Stop repeating the same failing command. Please step back, reconsider your hypothesis, ` +
      `investigate the underlying root cause, or ask the user for clarification.`;

    return {
      ruleId: "runtime/circuit-breaker",
      decision: "block",
      findings,
      remediationPrompt,
    };
  },
};
