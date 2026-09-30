function stringifyError(err) {
    if (!err)
        return "";
    if (typeof err === "string")
        return err;
    if (typeof err === "object") {
        if ("message" in err && typeof err.message === "string") {
            return err.message;
        }
        try {
            return JSON.stringify(err);
        }
        catch {
            return String(err);
        }
    }
    return String(err);
}
function stableStringify(value) {
    const seen = new WeakSet();
    const normalize = (input) => {
        if (input === null || typeof input !== "object")
            return input;
        if (seen.has(input))
            return "[Circular]";
        seen.add(input);
        if (Array.isArray(input))
            return input.map(normalize);
        return Object.fromEntries(Object.entries(input)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, entry]) => [key, normalize(entry)]));
    };
    try {
        return JSON.stringify(normalize(value));
    }
    catch {
        return String(value);
    }
}
function extractToolFailures(context) {
    const failures = [];
    for (const msg of context.currentTurn) {
        for (const part of msg.parts) {
            if (part.type !== "tool")
                continue;
            const state = part.state;
            if (!state)
                continue;
            let failed = false;
            let rawText = "";
            if (state.status === "error") {
                failed = true;
                rawText = stringifyError(state.error);
            }
            else if (state.status === "completed") {
                const exitValue = state.metadata?.exit ?? state.exitCode;
                const exitNum = typeof exitValue === "number"
                    ? exitValue
                    : typeof exitValue === "string" && exitValue.trim() !== ""
                        ? Number(exitValue)
                        : Number.NaN;
                const outputText = typeof state.output === "string"
                    ? state.output
                    : typeof state.metadata?.output === "string"
                        ? state.metadata.output
                        : "";
                const exitMatch = /\[exit code:\s*(-?\d+)\]/i.exec(outputText);
                const outputExit = exitMatch ? Number(exitMatch[1]) : Number.NaN;
                if ((!Number.isNaN(exitNum) && exitNum !== 0) ||
                    (!Number.isNaN(outputExit) && outputExit !== 0)) {
                    failed = true;
                    rawText = outputText || stringifyError(state.error);
                }
            }
            if (!failed)
                continue;
            const errorText = rawText.trim();
            if (errorText.length <= 10 || errorText === "[object Object]")
                continue;
            const toolName = typeof part.tool === "string"
                ? part.tool
                : typeof part.name === "string"
                    ? part.name
                    : "tool";
            const signature = `${toolName}:${stableStringify(state.input ?? {})}`;
            failures.push({
                signature,
                errorText: errorText.replace(/\s+/g, " ").slice(0, 200),
            });
        }
    }
    return failures;
}
export const circuitBreakerRule = {
    id: "runtime/circuit-breaker",
    description: "Detects infinite error loops and trips the breaker when the agent repeats the same failing tool invocation.",
    inspect: (context) => {
        const failures = extractToolFailures(context);
        if (failures.length < 3) {
            return { ruleId: "runtime/circuit-breaker", decision: "pass", findings: [] };
        }
        const counts = new Map();
        for (const failure of failures) {
            const current = counts.get(failure.signature);
            counts.set(failure.signature, {
                count: (current?.count ?? 0) + 1,
                errorText: current?.errorText ?? failure.errorText,
            });
        }
        const findings = [];
        for (const [signature, { count, errorText }] of counts.entries()) {
            if (count < 3)
                continue;
            findings.push({
                ruleId: "runtime/circuit-breaker",
                pattern: "Repeated error loop",
                messageSnippet: errorText,
                description: `Same failing tool invocation repeated ${count} times without progress: "${signature.slice(0, 160)}"`,
            });
        }
        if (findings.length === 0) {
            return { ruleId: "runtime/circuit-breaker", decision: "pass", findings: [] };
        }
        const list = findings.map((f) => `  - ${f.description}\n    Last error: ${f.messageSnippet}`).join("\n");
        const remediationPrompt = `Circuit breaker tripped! Repetitive error loop detected:\n${list}\n\n` +
            `You repeated the same failing tool invocation 3 or more times without progress. ` +
            `Stop repeating it, reconsider the hypothesis, investigate the root cause, or ask the user for missing information.`;
        return { ruleId: "runtime/circuit-breaker", decision: "block", findings, remediationPrompt };
    },
};
