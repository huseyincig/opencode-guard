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
function stringifyV2ToolContent(content) {
    if (!Array.isArray(content))
        return "";
    return content
        .map((item) => {
        if (item &&
            typeof item === "object" &&
            "type" in item &&
            item.type === "text" &&
            "text" in item &&
            typeof item.text === "string") {
            return item.text;
        }
        try {
            return JSON.stringify(item);
        }
        catch {
            return String(item);
        }
    })
        .filter(Boolean)
        .join("\n");
}
function normalizeV2AssistantPart(part) {
    if (!part || typeof part !== "object")
        return null;
    const value = part;
    if (value.type === "text" && typeof value.text === "string") {
        return { type: "text", text: value.text };
    }
    if (value.type !== "tool" || !value.state || typeof value.state !== "object") {
        return null;
    }
    const state = value.state;
    const normalizedState = {
        status: typeof state.status === "string" ? state.status : undefined,
        input: state.input && typeof state.input === "object"
            ? state.input
            : undefined,
        error: state.error,
        metadata: state.metadata && typeof state.metadata === "object"
            ? state.metadata
            : undefined,
    };
    const output = typeof state.output === "string"
        ? state.output
        : stringifyV2ToolContent(state.content);
    if (output)
        normalizedState.output = output;
    return {
        type: "tool",
        tool: typeof value.name === "string" ? value.name : undefined,
        name: typeof value.name === "string" ? value.name : undefined,
        state: normalizedState,
    };
}
/**
 * Converts OpenCode v2 session.context() records into the stable internal
 * message shape consumed by the rules and engine.
 */
export function normalizeV2Messages(messages) {
    const normalized = [];
    for (const raw of messages) {
        if (!raw || typeof raw !== "object")
            continue;
        const msg = raw;
        const id = typeof msg.id === "string" ? msg.id : undefined;
        const type = typeof msg.type === "string" ? msg.type : undefined;
        if (!id || !type)
            continue;
        if (type === "user" && typeof msg.text === "string") {
            normalized.push({
                info: { id, role: "user" },
                parts: [{ type: "text", text: msg.text }],
            });
            continue;
        }
        if (type === "synthetic" && typeof msg.text === "string") {
            normalized.push({
                info: { id, role: "user" },
                parts: [{ type: "text", text: msg.text, synthetic: true }],
            });
            continue;
        }
        if (type === "system" && typeof msg.text === "string") {
            normalized.push({
                info: { id, role: "system" },
                parts: [{ type: "text", text: msg.text }],
            });
            continue;
        }
        if (type === "assistant" && Array.isArray(msg.content)) {
            const parts = msg.content
                .map(normalizeV2AssistantPart)
                .filter((part) => part !== null);
            normalized.push({
                info: {
                    id,
                    role: "assistant",
                    agent: typeof msg.agent === "string" ? msg.agent : undefined,
                },
                parts,
            });
        }
    }
    return normalized;
}
/**
 * Common handler to process session.idle events across v1 and v2.
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
        console.error("[opencode-guardian] Inspection error:", error);
    }
}
const server = async ({ client, directory }) => {
    const config = loadConfig(directory);
    const engine = new GuardEngine(config);
    return {
        event: async ({ event }) => {
            const eventData = event;
            if (eventData.type === "session.deleted") {
                const deletedSessionID = eventData.properties?.sessionID ??
                    eventData.data?.sessionID ??
                    eventData.data?.info?.id;
                if (deletedSessionID)
                    engine.forgetSession(deletedSessionID);
                return;
            }
            if (eventData.type !== "session.idle")
                return;
            const sessionID = eventData.properties?.sessionID ?? eventData.data?.sessionID;
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
                    body: { parts: [{ type: "text", text }] },
                });
            }, engine);
        },
    };
};
const setup = async (context) => {
    // OpenCode v1/transition builds may discover the v2-shaped plugin object and
    // call setup() with a partial context. Treat that as "v2 unavailable" rather
    // than emitting an initialization error into the TUI.
    if (!context ||
        typeof context !== "object" ||
        typeof context.event?.subscribe !== "function" ||
        typeof context.session?.context !== "function" ||
        typeof context.session?.synthetic !== "function") {
        return;
    }
    const controller = new AbortController();
    let events;
    try {
        const candidate = context.event.subscribe({
            signal: controller.signal,
        });
        if (!candidate ||
            typeof candidate[Symbol.asyncIterator] !==
                "function") {
            controller.abort();
            return;
        }
        events = candidate;
    }
    catch {
        controller.abort();
        return;
    }
    const directory = context.location?.directory ?? process.cwd();
    const config = loadConfig(directory);
    const engine = new GuardEngine(config);
    const eventLoop = async () => {
        try {
            for await (const event of events) {
                const eventData = event;
                if (eventData.type === "session.deleted") {
                    const deletedSessionID = eventData.data?.sessionID ?? eventData.data?.info?.id;
                    if (deletedSessionID)
                        engine.forgetSession(deletedSessionID);
                    continue;
                }
                if (eventData.type !== "session.idle")
                    continue;
                const sessionID = eventData.data?.sessionID;
                if (!sessionID)
                    continue;
                await handleSessionIdle(sessionID, directory, async () => {
                    const messages = await context.session.context({ sessionID });
                    return normalizeV2Messages(messages);
                }, async (text) => {
                    await context.session.synthetic({
                        sessionID,
                        text,
                        description: "OpenCode Guardian remediation",
                        metadata: { "opencode-guardian": true },
                        delivery: "queue",
                        resume: true,
                    });
                }, engine);
            }
        }
        catch (error) {
            if (!controller.signal.aborted) {
                console.error("[opencode-guardian] V2 event subscription error:", error);
            }
        }
    };
    void eventLoop();
    return () => {
        controller.abort();
    };
};
/**
 * OpenCode Dual-Mode Plugin Definition.
 */
export const OpencodeGuardian = {
    id: "opencode-guardian",
    server,
    setup,
};
export const OpencodeGuard = OpencodeGuardian;
export default OpencodeGuardian;
