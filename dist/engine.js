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
export const REMEDIATION_MARKER = "[opencode-guardian remediation]";
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
const DEFAULT_CONFIG = {
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
export function loadConfig(directory) {
    const candidatePaths = [
        directory ? path.resolve(directory, "opencode-guardian.json") : null,
        directory ? path.resolve(directory, ".opencode/opencode-guardian.json") : null,
        path.resolve(os.homedir(), ".config/opencode/opencode-guardian.json"),
        directory ? path.resolve(directory, "opencode-guard.json") : null,
        directory ? path.resolve(directory, ".opencode/opencode-guard.json") : null,
        path.resolve(os.homedir(), ".config/opencode/opencode-guard.json"),
    ].filter(Boolean);
    for (const configPath of candidatePaths) {
        if (!fs.existsSync(configPath))
            continue;
        try {
            const raw = fs.readFileSync(configPath, "utf8");
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error("configuration root must be a JSON object");
            }
            return parsed;
        }
        catch (error) {
            console.error(`[opencode-guardian] Invalid config at ${configPath}; trying fallback:`, error);
        }
    }
    return DEFAULT_CONFIG;
}
function isGuardianRemediationMessage(message) {
    if (message.info.role !== "user")
        return false;
    return Boolean(message.parts?.some((part) => part.synthetic === true ||
        (part.type === "text" &&
            typeof part.text === "string" &&
            part.text.trimStart().startsWith(REMEDIATION_MARKER))));
}
export function extractCurrentTurn(messages) {
    const firstAgent = messages.find((m) => typeof m.info?.agent === "string" && m.info.agent.length > 0)?.info.agent;
    const isSubagent = Boolean(firstAgent && firstAgent !== "orchestrator");
    const lastUserMessage = messages.findLast((m) => m.info.role === "user");
    const isRemediationResponse = Boolean(lastUserMessage && isGuardianRemediationMessage(lastUserMessage));
    const lastHumanUserIndex = messages.findLastIndex((m) => m.info.role === "user" && !isGuardianRemediationMessage(m));
    const currentTurn = lastHumanUserIndex < 0 ? messages : messages.slice(lastHumanUserIndex);
    return {
        isSubagent,
        isRemediationResponse,
        currentTurn,
    };
}
function sanitizeRuleConfig(setting) {
    if (!setting || typeof setting !== "object" || Array.isArray(setting)) {
        return {};
    }
    const config = { ...setting };
    if (config.severity !== undefined &&
        !["error", "warn", "off"].includes(config.severity)) {
        delete config.severity;
    }
    if (config.customPhrases !== undefined) {
        config.customPhrases = Array.isArray(config.customPhrases)
            ? config.customPhrases.filter((value) => typeof value === "string" && value.trim().length > 0)
            : undefined;
    }
    if (config.exceptions !== undefined) {
        config.exceptions = Array.isArray(config.exceptions)
            ? config.exceptions.filter((value) => typeof value === "string" && value.trim().length > 0)
            : undefined;
    }
    return config;
}
export class GuardEngine {
    config;
    rules = new Map();
    inspectedMessages = new Map();
    constructor(config) {
        this.config = config ?? { enabled: true };
        for (const rule of Object.values(BUILTIN_RULES)) {
            this.registerRule(rule);
        }
    }
    registerRule(rule) {
        this.rules.set(rule.id, rule);
    }
    forgetSession(sessionID) {
        this.inspectedMessages.delete(sessionID);
    }
    async inspect(sessionID, directory, messages) {
        if (this.config.enabled === false || messages.length === 0) {
            return { decision: "pass", results: [] };
        }
        const lastAssistant = messages.findLast((m) => m.info.role === "assistant");
        const messageID = lastAssistant?.info.id;
        if (!messageID || this.inspectedMessages.get(sessionID) === messageID) {
            return { decision: "pass", results: [] };
        }
        const { isSubagent, isRemediationResponse, currentTurn } = extractCurrentTurn(messages);
        if (isRemediationResponse) {
            this.inspectedMessages.set(sessionID, messageID);
            return { decision: "pass", results: [] };
        }
        const results = [];
        const blockingPrompts = [];
        for (const [ruleId, rule] of this.rules.entries()) {
            const ruleSetting = this.config.rules?.[ruleId];
            const ruleConfig = sanitizeRuleConfig(typeof ruleSetting === "object" ? ruleSetting : {});
            const severity = typeof ruleSetting === "string" ? ruleSetting : ruleConfig.severity;
            if (severity === "off")
                continue;
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
            if (severity !== "warn" &&
                res.decision === "block" &&
                res.remediationPrompt) {
                blockingPrompts.push(res.remediationPrompt);
            }
        }
        this.inspectedMessages.set(sessionID, messageID);
        if (blockingPrompts.length > 0) {
            return {
                decision: "block",
                results,
                combinedRemediationPrompt: `${REMEDIATION_MARKER}\n${blockingPrompts.join("\n\n---\n\n")}`,
            };
        }
        return {
            decision: "pass",
            results,
        };
    }
}
