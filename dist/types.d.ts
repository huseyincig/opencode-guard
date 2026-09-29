/**
 * opencode-guardian: Core Type Definitions
 */
export type Severity = "error" | "warn" | "off";
export interface GuardRuleConfig {
    severity?: Severity;
    customPhrases?: string[];
    exceptions?: string[];
    [key: string]: unknown;
}
export interface GuardConfig {
    enabled?: boolean;
    debug?: boolean;
    rules?: {
        "discipline/no-evasion"?: Severity | GuardRuleConfig;
        "quality/no-shortcuts"?: Severity | GuardRuleConfig;
        "integrity/no-stubs"?: Severity | GuardRuleConfig;
        "safety/no-truncation"?: Severity | GuardRuleConfig;
        "testing/no-cheat"?: Severity | GuardRuleConfig;
        "security/no-secrets"?: Severity | GuardRuleConfig;
        "manifest/no-ghost-deps"?: Severity | GuardRuleConfig;
        "runtime/circuit-breaker"?: Severity | GuardRuleConfig;
        [ruleName: string]: Severity | GuardRuleConfig | undefined;
    };
}
export interface MessagePart {
    type: string;
    text?: string;
    synthetic?: boolean;
    state?: {
        status?: string;
        input?: Record<string, unknown>;
        output?: unknown;
        error?: unknown;
        raw?: unknown;
        patch?: string;
        patchText?: string;
    };
    [key: string]: unknown;
}
export interface SessionMessage {
    info: {
        id: string;
        role: "user" | "assistant" | "system" | string;
        sessionID?: string;
        agent?: string;
        [key: string]: unknown;
    };
    parts: MessagePart[];
}
export interface TurnInspectionContext {
    sessionID: string;
    directory: string;
    messages: SessionMessage[];
    currentTurn: SessionMessage[];
    isSubagent?: boolean;
    ruleConfig: GuardRuleConfig;
}
export interface RuleFinding {
    ruleId: string;
    pattern: string;
    messageSnippet: string;
    description: string;
}
export interface RuleResult {
    ruleId: string;
    decision: "pass" | "block";
    findings: RuleFinding[];
    remediationPrompt?: string;
}
export interface GuardRule {
    id: string;
    description: string;
    inspect: (context: TurnInspectionContext) => Promise<RuleResult> | RuleResult;
}
