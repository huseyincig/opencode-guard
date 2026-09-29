import { GuardEngine, loadConfig } from "./engine.js";
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
 * Common handler to process session.idle events across v1 and v2
 */
async function handleSessionIdle(sessionID, directory, fetchMessages, sendPrompt, engine) {
    try {
        const messages = await fetchMessages();
        const result = await engine.inspect(sessionID, directory, messages);
        if (result.decision === "block" && result.combinedRemediationPrompt) {
            await sendPrompt(result.combinedRemediationPrompt);
        }
    }
    catch (error) {
        console.error("[opencode-guard] Inspection error:", error);
    }
}
/**
 * OpenCode Dual-Mode Plugin Definition
 */
export const OpencodeGuard = {
    id: "opencode-guard",
    /**
     * OpenCode v1 Host Handler
     */
    server: async ({ client, directory }) => {
        const config = loadConfig(directory);
        const engine = new GuardEngine(config);
        return {
            event: async ({ event }) => {
                if (event.type !== "session.idle")
                    return;
                const sessionID = event.properties?.sessionID ?? event.data?.sessionID;
                if (!sessionID)
                    return;
                await handleSessionIdle(sessionID, directory, async () => {
                    const res = await client.session.messages({
                        path: { id: sessionID },
                        query: { directory },
                    });
                    return (Array.isArray(res) ? res : (res?.data ?? []));
                }, async (text) => {
                    await client.session.promptAsync({
                        path: { id: sessionID },
                        query: { directory },
                        body: { parts: [{ type: "text", text, synthetic: true }] },
                    });
                }, engine);
            },
        };
    },
    /**
     * OpenCode v2 Host Handler
     */
    setup: async (context) => {
        const directory = context.location?.directory ?? process.cwd();
        const config = loadConfig(directory);
        const engine = new GuardEngine(config);
        if (context.event?.subscribe) {
            context.event.subscribe(async (event) => {
                if (event.type !== "session.idle")
                    return;
                const sessionID = event.data?.sessionID ?? event.sessionID;
                if (!sessionID)
                    return;
                await handleSessionIdle(sessionID, directory, async () => {
                    if (context.session?.messages) {
                        const res = await context.session.messages(sessionID);
                        return (res.data ?? res ?? []);
                    }
                    return [];
                }, async (text) => {
                    if (context.session?.prompt) {
                        await context.session.prompt(sessionID, {
                            parts: [{ type: "text", text, synthetic: true }],
                        });
                    }
                }, engine);
            });
        }
    },
};
export default OpencodeGuard;
