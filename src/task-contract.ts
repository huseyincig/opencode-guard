import type { SessionMessage, TurnEvidence } from "./types.js";

/** Explicit user requirements only. No LLM classification or inferred goals. */
export interface TaskContract {
  turnKey: string;
  explicitAction: boolean;
  iterativeReview: boolean;
  requiresSourceReview: boolean;
  requiredVerifications: Array<"test" | "build" | "typecheck" | "lint" | "audit">;
  requiresExplicitCompletion: boolean;
}

function userText(message: SessionMessage): string {
  return message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n");
}

export function currentHumanMessage(
  messages: readonly SessionMessage[]
): SessionMessage | undefined {
  return messages.findLast(
    (message) =>
      message.info.role === "user" &&
      !message.parts.some((part) => part.synthetic === true) &&
      !userText(message).trimStart().startsWith("[opencode-guardian remediation]")
  );
}

const ITERATION =
  /(?:\b(?:repeat|restart|rerun|re-run|again|until|every\s+(?:time|round)|each\s+(?:time|round))\b|\b(?:tekrar|yeniden|baştan|her\s+(?:turda|tura|seferinde|hata|bir\s+hata)|hata\s+kalmayana|bulmayana|sıfır\s+hata)\b)/iu;
const REVIEW =
  /(?:\b(?:audit|review|inspect|debug|scan|check|test|pass|iteration|issue|bug|error|defect|fix)\b|\b(?:denetim|incele|kontrol|debug|test|tur|hata|sorun|düzelt|bulgu)\b)/iu;
const CONTINUE =
  /(?:\b(?:until|restart|repeat|rerun|re-run|again|each\s+(?:time|round)|every\s+(?:time|round))\b|\b(?:tekrar|yeniden|baştan|her\s+(?:turda|tura|seferinde|hata)|kalmayana|bulmayana)\b)/iu;
const NEGATED_LOOP =
  /(?:\b(?:do\s+not|don't|dont|never|without|stop)\s+(?:repeat|restart|rerun|re-run|again)\b|\b(?:tekrarlama|tekrarlamayın|tekrar\s+başlama|yeniden\s+başlama|baştan\s+başlama)\b)/iu;

/** Questions about a possible workflow are not instructions to execute it. */
export function isExploratoryPrompt(text: string): boolean {
  return /^\s*(?:should\s+we|would\s+we|could\s+we|what\s+if|do\s+you\s+think\s+we\s+should|sence|acaba|ne\s+olur\s+eğer)\b/iu.test(text);
}

const SOURCE_REVIEW =
  /(?:\b(?:full|entire|whole|from\s+scratch|restart)\b[^.!?]{0,70}\b(?:review|inspect|scan|audit|source|code)\b|(?:\b(?:review|inspect|scan)\b|\b(?:incele|denet|tara)\p{L}*)[^.!?]{0,70}\b(?:again|from\s+the\s+start|baştan|yeniden|tekrar)\b|\b(?:baştan|yeniden|tüm|bütün|satır\s+satır)\b[^.!?]{0,70}\b(?:incele|denet|tara|kod)\w*)/iu;

const ACTION_REQUEST =
  /\b(?:implement|fix|change|modify|build|develop|resume|continue|write|create|add|update|complete|run|execute|start)\b|\b(?:yap|yapın|uygula|uygulayın|düzelt|düzeltin|geliştir|geliştirin|devam\s+et|başla|başlayın|ekle|ekleyin|oluştur|tamamla|tamamlayın|yaz|yazın|çalıştır|çalıştırın)\b/iu;

const VERIFICATION_REQUESTS: Array<{
  kind: TaskContract["requiredVerifications"][number];
  expression: RegExp;
}> = [
  { kind: "test", expression: /(?:\b(?:run|execute|rerun|re-run)\s+(?:the\s+|all\s+)?tests?\b|\b(?:testleri?|testleri\s+)?(?:çalıştır|çalıştırın|koştur|koşturun)\b)/iu },
  { kind: "build", expression: /(?:\b(?:run|execute)\s+(?:the\s+)?build\b|\b(?:build|derleme)(?:i|ı|yi|yı)?\s+(?:çalıştır|çalıştırın|yap|yapın)\b)/iu },
  { kind: "typecheck", expression: /(?:\b(?:run|execute)\s+(?:the\s+)?typecheck\b|\btypecheck\s+(?:çalıştır|çalıştırın|yap|yapın)\b)/iu },
  { kind: "lint", expression: /(?:\b(?:run|execute)\s+(?:the\s+)?lint\b|\blint\s+(?:çalıştır|çalıştırın|yap|yapın)\b)/iu },
  { kind: "audit", expression: /(?:\b(?:run|execute)\s+(?:the\s+)?(?:security\s+)?audit\b|\b(?:npm\s+audit|güvenlik\s+denetimi)\s+(?:çalıştır|çalıştırın|yap|yapın)\b)/iu },
];

function explicitVerifications(text: string): TaskContract["requiredVerifications"] {
  return VERIFICATION_REQUESTS
    .filter(({ kind, expression }) => {
      if (!expression.test(text)) return false;
      const target = kind === "test" ? "tests?" : kind;
      const denied = new RegExp(
        `\\b(?:do\\s+not|don't|dont|without|never)\\s+(?:run|execute)\\s+(?:the\\s+)?${target}\\b|\\b${kind === "test" ? "testleri?" : kind}\\s+(?:çalıştırma|çalıştırmayın|yapma|yapmayın)\\b`,
        "iu"
      );
      return !denied.test(text);
    })
    .map(({ kind }) => kind);
}

export function extractTaskContract(
  messages: readonly SessionMessage[]
): TaskContract | undefined {
  const human = currentHumanMessage(messages);
  if (!human) return undefined;
  const text = userText(human).trim();
  if (!text) return undefined;
  const exploratory = isExploratoryPrompt(text);
  const iterativeReview =
    !exploratory &&
    !NEGATED_LOOP.test(text) &&
    ITERATION.test(text) &&
    REVIEW.test(text) &&
    CONTINUE.test(text);
  const requiredVerifications = exploratory ? [] : explicitVerifications(text);
  return {
    turnKey: human.info.id ?? "no-human-user",
    explicitAction: (!exploratory && ACTION_REQUEST.test(text)) || iterativeReview,
    iterativeReview,
    requiresSourceReview: iterativeReview && SOURCE_REVIEW.test(text),
    requiredVerifications,
    requiresExplicitCompletion: iterativeReview || requiredVerifications.length > 0,
  };
}

export function taskGuidance(contract: TaskContract): string | undefined {
  if (!contract.explicitAction && !contract.requiresExplicitCompletion) return undefined;
  const instructions = [
    "[OpenCode Guardian task contract]",
    "Treat the latest explicit human instructions as the active task. Do not override them with earlier user decisions or assumptions.",
  ];
  if (contract.iterativeReview) {
    instructions.push(
      "The user explicitly requested repeated review/debugging. After fixing a finding, perform another review pass of the requested scope; do not claim completion after the first fix. Stop when a subsequent full pass finds no new issues, or report a concrete blocker and remaining work. Do not repeat identical failed actions without progress."
    );
  }
  if (contract.requiresSourceReview) {
    instructions.push(
      "This request calls for another source inspection after changes; a passing test command alone is not evidence of a new source review."
    );
  }
  if (contract.requiredVerifications.length > 0) {
    instructions.push(
      `The user explicitly requested verification: ${contract.requiredVerifications.join(", ")}. Run it after the last relevant change, or state clearly what could not be run and why. Do not claim a passing result without tool evidence.`
    );
  }
  return instructions.join("\n");
}

export function latestMutationSequence(evidence: TurnEvidence): number {
  return evidence.fileMutations
    .filter((record) => record.status !== "failure")
    .reduce((latest, record) => Math.max(latest, record.sequence), -1);
}

export function hasPostMutationReview(
  evidence: TurnEvidence,
  sourceReviewRequired = false
): boolean {
  const lastMutation = latestMutationSequence(evidence);
  if (lastMutation < 0) return false;
  return evidence.records.some((record) => {
    if (record.sequence <= lastMutation || record.status !== "success") return false;
    if (!sourceReviewRequired && ["test", "build", "typecheck", "lint", "audit"].includes(record.kind)) {
      return true;
    }
    if (record.kind !== "generic" || !record.output?.trim()) return false;
    const tool = record.toolName.toLowerCase();
    const command = record.command ?? "";
    return /(?:^|[.:-])(?:read|grep|glob|search|find)(?:$|[.:-])/.test(tool) ||
      /\b(?:rg|grep|git\s+diff|git\s+show|git\s+status|find|cat)\b/.test(command);
  });
}
