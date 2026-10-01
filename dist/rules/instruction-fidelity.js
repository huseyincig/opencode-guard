import { currentHumanMessage, isExploratoryPrompt } from "../task-contract.js";
import { sanitizeProseForInspection } from "../prose.js";
const ACTION = /\b(?:implement|fix|change|modify|build|develop|resume|continue|write|create|add|update|complete|do|start)\b|\b(?:yap|yapın|uygula|uygulayın|düzelt|düzeltin|geliştir|geliştirin|devam\s+et|başla|başlayın|ekle|ekleyin|oluştur|tamamla|tamamlayın|yaz|yazın)\b/iu;
const NEGATED_ACTION = /\b(?:do\s+not|don't|dont|never)\s+(?:implement|fix|change|build|develop|resume|continue|write|create|add|update|complete|do|start)\b|\b(?:yapma|yapmayın|uygulama|uygulamayın|düzeltme|düzeltmeyin|geliştirme|geliştirmeyin)\b/iu;
const PREVIOUS_DECISION = /\b(?:previously|earlier|before|last\s+time|already)\b[^.!?]{0,120}\b(?:pause|paused|suspend(?:ed)?|defer(?:red)?|postpone(?:d)?|cancel(?:ed)?|on\s+hold)\b|\b(?:önceden|daha\s+önce|eskiden)\b[^.!?]{0,120}\b(?:askıya\s+al|erteled|durdur|iptal|vazgeç)\w*/iu;
const REFUSAL = /\b(?:so|therefore|hence|thus|because|as\s+a\s+result)\b[^.!?]{0,100}\b(?:won't|will\s+not|cannot|can't|not\s+going\s+to|skip(?:ping)?)\b|\b(?:bu\s+yüzden|dolayısıyla|o\s+nedenle|bu\s+sebeple)\b[^.!?]{0,120}\b(?:yapmıyorum|yapmayacağım|uygulamıyorum|atlıyorum|devam\s+etmiyorum|yapamam)\b/iu;
/** The rule needs both an explicit current action and an explicit refusal. */
export const instructionFidelityRule = {
    id: "task/instruction-fidelity",
    description: "Detects refusing the current explicit task solely because of a historical user decision.",
    inspect(context) {
        const user = currentHumanMessage(context.currentTurn);
        const instruction = user?.parts
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text ?? "")
            .join("\n") ?? "";
        const assistant = context.currentTurn
            .findLast((message) => message.info.role === "assistant")?.parts
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => part.text ?? "")
            .join("\n") ?? "";
        const prose = sanitizeProseForInspection(assistant);
        if (!ACTION.test(instruction) ||
            isExploratoryPrompt(instruction) ||
            NEGATED_ACTION.test(instruction) ||
            !PREVIOUS_DECISION.test(prose) ||
            !REFUSAL.test(prose)) {
            return { ruleId: this.id, decision: "pass", findings: [] };
        }
        const finding = {
            ruleId: this.id,
            pattern: "past decision overrides current instruction",
            messageSnippet: prose.slice(0, 200),
            description: "The assistant explicitly declined the current requested action on the basis of an earlier user decision. The latest explicit instruction must be considered; an actual conflict should be explained rather than silently changing scope.",
            confidence: "high",
        };
        return {
            ruleId: this.id,
            decision: "block",
            findings: [finding],
            remediationPrompt: "Re-evaluate the current explicit user request. Do not treat an earlier pause or deferral as a permanent prohibition. Perform the requested work if otherwise permitted; if a genuine conflict prevents it, identify the conflicting instruction precisely and ask the user rather than silently declining.",
        };
    },
};
