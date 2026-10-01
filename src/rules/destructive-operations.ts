import type {
  GuardRule,
  RuleFinding,
  RuleResult,
  TurnInspectionContext,
} from "../types.js";
import { isDestructiveCommand } from "../evidence.js";

function latestHumanRequest(context: TurnInspectionContext): string {
  const user = context.currentTurn.findLast(
    (message) =>
      message.info.role === "user" &&
      !message.parts.some((part) => part.synthetic === true)
  );
  if (!user) return "";
  return user.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .toLowerCase();
}

function explicitlyAuthorized(request: string, command: string): boolean {
  if (!request) return false;

  const negative =
    /\b(?:do\s+not|don't|dont|never|avoid|without)\s+(?:delete|remove|destroy|drop|wipe|reset|force\s+push|clean|unpublish)\b|\b(?:silme|silmeyin|silmeden|kaldırma|kaldırmayın|yok\s+etme|sıfırlama|resetleme|zorla\s+push\s+yapma)\b/iu;
  if (negative.test(request)) return false;

  if (/\bgit\s+push\b/i.test(command)) {
    return /\b(?:force\s+push|zorla\s+push|--force|force-with-lease)\b/iu.test(
      request
    );
  }

  if (/\bgit\s+reset\s+--hard\b/i.test(command)) {
    return /\b(?:hard\s+reset|reset(?:le|leyin)?|sıfırla|sıfırlayın)\b/iu.test(
      request
    );
  }

  if (/\bgit\s+clean\b/i.test(command)) {
    // An explicit git-clean request authorizes normal untracked-file cleanup,
    // but does not implicitly authorize deleting ignored files (-x / -X).
    if (
      // Do not let authorization for git clean cover another command chained
      // into the same shell invocation.
      /[;&|\n]/.test(command) ||
      !/\bgit\s+clean\b/i.test(request) ||
      /\b(?:do\s+not|don't|dont|never|avoid|without)\s+(?:run\s+|execute\s+|use\s+)?git\s+clean\b/i.test(request) ||
      /\bgit\s+clean\b[^.!?\n]{0,30}\b(?:yapma|yapmayın|çalıştırma|çalıştırmayın|istemiyorum)\b/iu.test(request)
    ) {
      return false;
    }

    const ignoredFiles = /(?:^|\s)-[a-z]*[xX][a-z]*(?=\s|$)|--(?:exclude-standard|ignored)(?=\s|$)/.test(
      command
    );
    return (
      !ignoredFiles ||
      /(?:^|\s)-[a-z]*[xX][a-z]*(?=\s|$)|\b(?:ignored\s+files?|gitignored\s+files?|yok\s+sayılan\s+dosyalar|ignore\s+edilen\s+dosyalar)\b/iu.test(
        request
      )
    );
  }

  if (/(?:^|[;&|]\s*)(?:sudo\s+)?rm\b/i.test(command)) {
    const deleteRequested =
      /\b(?:delete|remove|wipe|sil|silin|sileyim|kaldır|kaldırın)\b/iu.test(
        request
      );
    if (!deleteRequested) return false;

    const broadTarget =
      /(?:^|\s)(?:\.{1,2}\/?|\/|~\/?|\*|\.\/\*|\.\.\/\*)\s*(?:$|[;&|])/i.test(
        command
      );
    if (!broadTarget) return true;

    return (
      /\brm\s+-rf\s+\.\/?(?:\s|$)/i.test(request) ||
      /\b(?:delete|remove|wipe|destroy)\s+(?:the\s+)?(?:entire|whole)\s+(?:project|repo|repository|directory|folder|workspace)\b/iu.test(request) ||
      /\b(?:entire|whole)\s+(?:project|repo|repository|directory|folder|workspace)\b[^.!?]*\b(?:delete|remove|wipe|destroy)\b/iu.test(request) ||
      /\b(?:tüm|bütün|komple)\s+(?:projeyi|depoyu|klasörü|dizini|çalışma\s+alanını)\s+(?:sil|silin|sıfırla|sıfırlayın)\b/iu.test(request) ||
      /\b(?:projenin|deponun|klasörün|dizinin)\s+tamamını\s+(?:sil|silin)\b/iu.test(request)
    );
  }

  if (/\b(?:drop\s+(?:database|schema|table)|truncate\s+table)\b/i.test(command)) {
    return /\b(?:drop|truncate|delete|remove|sil|kaldır)\b/iu.test(request);
  }

  if (/\bterraform\s+destroy\b/i.test(command)) {
    return /\b(?:terraform\s+destroy|destroy\s+(?:the\s+)?(?:stack|infra|infrastructure)|altyapıyı\s+(?:sil|yok\s+et))\b/iu.test(
      request
    );
  }

  if (/\bkubectl\s+delete\s+(?:namespace|ns)\b/i.test(command)) {
    return /\b(?:delete|remove|sil|kaldır)\b[\s\S]*\b(?:namespace|ns|namespace'i|namespace'ı)\b/iu.test(
      request
    );
  }

  if (/\bnpm\s+unpublish\b/i.test(command)) {
    return /\b(?:unpublish|yayından\s+kaldır)\b/iu.test(request);
  }

  if (/\bgh\s+repo\s+delete\b/i.test(command)) {
    return /\b(?:delete|remove|sil|kaldır)\b[\s\S]*\b(?:repo|repository|depo)\b/iu.test(
      request
    );
  }

  if (/\bdocker\s+system\s+prune\b/i.test(command)) {
    return /\b(?:docker\s+(?:system\s+)?prune|docker\s+temizle)\b/iu.test(
      request
    );
  }

  return false;
}

export const destructiveOperationsRule: GuardRule = {
  id: "safety/destructive-operations",
  description:
    "Flags destructive shell/repository/infrastructure operations unless the user explicitly requested that destructive action.",
  inspect: (context: TurnInspectionContext): RuleResult => {
    const findings: RuleFinding[] = [];
    const request = latestHumanRequest(context);

    for (const message of context.currentTurn) {
      if (message.info.role !== "assistant") continue;
      for (const part of message.parts) {
        if (part.type !== "tool" || !part.state?.input) continue;
        const input = part.state.input;
        const command =
          typeof input.command === "string"
            ? input.command
            : typeof input.cmd === "string"
              ? input.cmd
              : typeof input.script === "string"
                ? input.script
                : "";

        if (!command || !isDestructiveCommand(command)) continue;
        if (explicitlyAuthorized(request, command)) continue;

        findings.push({
          ruleId: "safety/destructive-operations",
          pattern: "destructive command",
          messageSnippet: command.replace(/\s+/g, " ").slice(0, 240),
          description:
            "Destructive operation was attempted without matching explicit user authorization in the current turn",
          confidence: "high",
        });
      }
    }

    if (findings.length === 0) {
      return {
        ruleId: "safety/destructive-operations",
        decision: "pass",
        findings: [],
      };
    }

    const list = findings
      .map((finding) => `  - ${finding.messageSnippet}`)
      .join("\n");

    return {
      ruleId: "safety/destructive-operations",
      decision: "block",
      findings,
      remediationPrompt:
        `Destructive operation detected without explicit user authorization:\n${list}\n\n` +
        `Do not perform destructive repository, filesystem, package-registry, database, or infrastructure actions unless the user clearly requested that action. Prefer a non-destructive inspection or ask for confirmation.`,
    };
  },
};
