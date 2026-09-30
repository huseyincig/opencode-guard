import type { Plugin as OpenCodeV1ServerPlugin } from "@opencode-ai/plugin";
import type { Plugin as OpenCodeV2 } from "@opencode/plugin";
import type { SessionMessage } from "./types.js";
export * from "./types.js";
export * from "./engine.js";
export * from "./rules/no-evasion.js";
export * from "./rules/no-shortcuts.js";
export * from "./rules/no-stubs.js";
export * from "./rules/no-truncation.js";
export * from "./rules/no-cheat.js";
export * from "./rules/no-secrets.js";
export * from "./rules/no-ghost-deps.js";
export * from "./rules/circuit-breaker.js";
export * from "./rules/no-apology.js";
export * from "./prose.js";
/**
 * Converts OpenCode v2 session.context() records into the stable internal
 * message shape consumed by the rules and engine.
 */
export declare function normalizeV2Messages(messages: readonly unknown[]): SessionMessage[];
/**
 * OpenCode Dual-Mode Plugin Definition.
 */
export declare const OpencodeGuardian: {
    id: string;
    server: OpenCodeV1ServerPlugin;
    setup: (context: OpenCodeV2.Context) => Promise<OpenCodeV2.Cleanup | void> | OpenCodeV2.Cleanup | void;
};
export declare const OpencodeGuard: {
    id: string;
    server: OpenCodeV1ServerPlugin;
    setup: (context: OpenCodeV2.Context) => Promise<OpenCodeV2.Cleanup | void> | OpenCodeV2.Cleanup | void;
};
export default OpencodeGuardian;
