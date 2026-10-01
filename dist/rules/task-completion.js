import { sanitizeProseForInspection } from "../prose.js";
import { extractTaskContract, hasPostMutationReview, latestMutationSequence, } from "../task-contract.js";
function latestAssistantProse(context) {
    const last = context.currentTurn.findLast((message) => message.info.role === "assistant");
    if (!last)
        return "";
    return sanitizeProseForInspection(last.parts
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text ?? "")
        .join("\n"));
}
const CLOSING = /\b(?:completed?|finished|all\s+done|task\s+done|that's\s+it|no\s+(?:more|further)\s+(?:issues?|errors?|bugs?)|nothing\s+(?:else|left)\s+to\s+fix)\b|\b(?:tamamlandı|tamamladım|iş\s+bitti|denetim\s+bitti|inceleme\s+tamamlandı|hata\s+kalmadı|sorun\s+kalmadı|başka\s+hata\s+yok)\b/iu;
const CLEAR_BLOCKER = /\b(?:blocked|cannot\s+(?:proceed|continue|verify|run)|unable\s+to\s+(?:proceed|continue|verify|run)|need\s+(?:your\s+)?(?:permission|access|input)|not\s+(?:yet\s+)?(?:complete|done|finished)|unfinished)\b|\b(?:engellendi|ilerleyemiyorum|doğrulayamıyorum|çalıştıramıyorum|tamamlanmadı|izin\s+gerekiyor|erişim\s+gerekiyor|devam\s+edemiyorum)\b/iu;
/**
 * Completion is checked against concrete, ordered tool evidence rather than
 * treating a well-written final message as proof. Ambiguous evidence remains
 * advisory, and a documented blocker never triggers an automatic loop.
 */
export const taskCompletionRule = {
    id: "task/completion-gate",
    description: "Checks explicit iterative-review and verification requirements before accepting completion.",
    inspect(context) {
        const contract = extractTaskContract(context.currentTurn);
        const evidence = context.evidence;
        const prose = latestAssistantProse(context);
        const findings = [];
        const blocking = [];
        if (!contract?.requiresExplicitCompletion || !evidence || !prose) {
            return { ruleId: this.id, decision: "pass", findings };
        }
        // Transparent incomplete work and real blockers should be reported to the
        // user instead of being turned into synthetic retries.
        if (CLEAR_BLOCKER.test(prose)) {
            return { ruleId: this.id, decision: "pass", findings };
        }
        const lastMutation = latestMutationSequence(evidence);
        if (contract.iterativeReview &&
            lastMutation >= 0 &&
            !hasPostMutationReview(evidence, contract.requiresSourceReview)) {
            const finding = {
                ruleId: this.id,
                pattern: "iteration ended after a change without a new review",
                messageSnippet: prose.slice(0, 160),
                description: contract.requiresSourceReview
                    ? "The user explicitly required another source review after fixing a finding, but no successful post-change source inspection was observed."
                    : "The user explicitly required another review after fixing a finding, but no successful post-change review or verification was observed.",
                confidence: "high",
                evidence: ["successful change detected", "no subsequent successful required review/check"],
            };
            findings.push(finding);
            blocking.push(finding);
        }
        if (CLOSING.test(prose)) {
            for (const kind of contract.requiredVerifications) {
                const relevant = evidence.records
                    .filter((record) => record.kind === kind && record.sequence >= lastMutation)
                    .sort((left, right) => right.sequence - left.sequence)[0];
                if (relevant?.status === "success")
                    continue;
                const finding = {
                    ruleId: this.id,
                    pattern: `${kind} verification not confirmed`,
                    messageSnippet: prose.slice(0, 160),
                    description: relevant?.status === "failure"
                        ? `The task is reported as complete although the latest requested ${kind} check failed.`
                        : `The user requested ${kind} verification, but a successful result after the last change is not visible.`,
                    confidence: relevant?.status === "failure" ? "high" : "medium",
                };
                findings.push(finding);
                if (relevant?.status === "failure")
                    blocking.push(finding);
            }
        }
        return {
            ruleId: this.id,
            decision: blocking.length ? "block" : "pass",
            findings,
            remediationPrompt: blocking.length
                ? "The current user explicitly requested continued work. Perform another substantive review after the latest change, and run any explicitly requested checks before claiming completion. If blocked, explain the concrete blocker and remaining work instead of repeating a failing command."
                : undefined,
        };
    },
};
