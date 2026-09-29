import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { noEvasionRule } from "./rules/no-evasion.js";
import { noShortcutsRule } from "./rules/no-shortcuts.js";
import { noStubsRule } from "./rules/no-stubs.js";
import { noTruncationRule } from "./rules/no-truncation.js";
import { noCheatRule } from "./rules/no-cheat.js";
import { noSecretsRule } from "./rules/no-secrets.js";
import { noGhostDepsRule } from "./rules/no-ghost-deps.js";
import { circuitBreakerRule } from "./rules/circuit-breaker.js";
import { noApologyRule } from "./rules/no-apology.js";
export const BUILTIN_RULES = {
    "discipline/no-evasion": noEvasionRule,
    "discipline/no-apology": noApologyRule,
    "quality/no-shortcuts": noShortcutsRule,
    "integrity/no-stubs": noStubsRule,
    "safety/no-truncation": noTruncationRule,
    "testing/no-cheat": noCheatRule,
    "security/no-secrets": noSecretsRule,
    "manifest/no-ghost-deps": noGhostDepsRule,
    "runtime/circuit-breaker": circuitBreakerRule,
};
export function loadConfig(directory) {
    const candidatePaths = [
        directory ? path.resolve(directory, "opencode-guard.json") : null,
        directory ? path.resolve(directory, ".opencode/opencode-guard.json") : null,
        path.resolve(os.homedir(), ".config/opencode/opencode-guard.json"),
    ].filter(Boolean);
    for (const configPath of candidatePaths) {
        try {
            if (fs.existsSync(configPath)) {
                const raw = fs.readFileSync(configPath, "utf8");
                return JSON.parse(raw);
            }
        }
        catch {
            // Ignore parse errors and fallback
        }
    }
    // Default configuration: all builtin rules enabled as "error"
    return {
        enabled: true,
        rules: {
            "discipline/no-evasion": "error",
            "discipline/no-apology": "error",
            "quality/no-shortcuts": "error",
            "integrity/no-stubs": "error",
            "safety/no-truncation": "error",
            "testing/no-cheat": "error",
            "security/no-secrets": "error",
            "manifest/no-ghost-deps": "error",
            "runtime/circuit-breaker": "error",
        },
    };
}
export function extractCurrentTurn(messages) {
    // Check if session belongs to a subagent
    const isSubagent = messages.length > 0 &&
        Boolean(messages[0].info?.agent) &&
        messages[0].info.agent !== "orchestrator";
    // Check if the last user message was a detector synthetic remediation prompt
    const lastUserMessage = messages.findLast((m) => m.info.role === "user");
    const isRemediationResponse = Boolean(lastUserMessage?.parts?.some((p) => p.synthetic === true));
    // Find index of last real human user message
    const lastHumanUserIndex = messages.findLastIndex((m) => m.info.role === "user" && !m.parts?.some((p) => p.synthetic === true));
    const currentTurn = lastHumanUserIndex < 0 ? messages : messages.slice(lastHumanUserIndex);
    return {
        isSubagent,
        isRemediationResponse,
        currentTurn,
    };
}
export class GuardEngine {
    config;
    rules = new Map();
    skipNextIdle = new Set();
    inspectedMessages = new Map();
    constructor(config) {
        this.config = config ?? { enabled: true };
        for (const [id, rule] of Object.entries(BUILTIN_RULES)) {
            this.registerRule(rule);
        }
    }
    registerRule(rule) {
        this.rules.set(rule.id, rule);
    }
    async inspect(sessionID, directory, messages) {
        if (this.config.enabled === false) {
            return { decision: "pass", results: [] };
        }
        if (messages.length === 0) {
            return { decision: "pass", results: [] };
        }
        // Loop guard: skip if next idle is flagged
        if (this.skipNextIdle.delete(sessionID)) {
            return { decision: "pass", results: [] };
        }
        // Dedup: check last assistant message id
        const lastAssistant = messages.findLast((m) => m.info.role === "assistant");
        const messageID = lastAssistant?.info.id;
        if (!messageID || this.inspectedMessages.get(sessionID) === messageID) {
            return { decision: "pass", results: [] };
        }
        this.inspectedMessages.set(sessionID, messageID);
        // Extract turn with false-positive lifecycle guards
        const { isSubagent, isRemediationResponse, currentTurn } = extractCurrentTurn(messages);
        if (isRemediationResponse) {
            return { decision: "pass", results: [] };
        }
        const results = [];
        const blockingPrompts = [];
        for (const [ruleId, rule] of this.rules.entries()) {
            const ruleSetting = this.config.rules?.[ruleId];
            if (ruleSetting === "off")
                continue;
            const ruleConfig = typeof ruleSetting === "object" ? ruleSetting : {};
            const context = {
                sessionID,
                directory,
                messages,
                currentTurn,
                isSubagent,
                ruleConfig,
            };
            const res = await rule.inspect(context);
            results.push(res);
            const isWarn = ruleSetting === "warn" || ruleConfig.severity === "warn";
            if (!isWarn && res.decision === "block" && res.remediationPrompt) {
                blockingPrompts.push(res.remediationPrompt);
            }
        }
        if (blockingPrompts.length > 0) {
            this.skipNextIdle.add(sessionID);
            return {
                decision: "block",
                results,
                combinedRemediationPrompt: blockingPrompts.join("\n\n---\n\n"),
            };
        }
        return {
            decision: "pass",
            results,
        };
    }
}
