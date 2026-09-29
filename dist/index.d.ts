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
 * OpenCode Dual-Mode Plugin Definition
 */
export declare const OpencodeGuard: {
    id: string;
    /**
     * OpenCode v1 Host Handler
     */
    server: ({ client, directory }: {
        client: any;
        directory: string;
    }) => Promise<{
        event: ({ event }: {
            event: any;
        }) => Promise<void>;
    }>;
    /**
     * OpenCode v2 Host Handler
     */
    setup: (context: any) => Promise<void>;
};
export default OpencodeGuard;
