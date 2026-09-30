import { extractLikelyShellMutation } from "../tool-input.js";
/**
 * Patterns that indicate weakened or cheated tests.
 */
export const TEST_CHEAT_PATTERNS = [
    // JS / TS test skipping
    {
        regex: /\b(?:test|it|describe)\.skip\s*\(/,
        name: "test.skip() / it.skip() (JS/TS)",
    },
    {
        regex: /\b(?:xit|xtest)\s*\(/,
        name: "xit() / xtest() skipped test (JS/TS)",
    },
    {
        regex: /\b(?:test|it|describe)\.only\s*\(/,
        name: "test.only() / it.only() focus filter (JS/TS)",
    },
    {
        regex: /\btest\.todo\s*\(/,
        name: "test.todo() downgrade (JS/TS)",
    },
    // Python test skipping
    {
        regex: /@pytest\.mark\.skip(?:\s*\(.*\))?/,
        name: "@pytest.mark.skip decorator (Python)",
    },
    {
        regex: /\bpytest\.skip\s*\(/,
        name: "pytest.skip() call (Python)",
    },
    {
        regex: /@unittest\.skip(?:\s*\(.*\))?/,
        name: "@unittest.skip decorator (Python)",
    },
    // Go test skipping
    {
        regex: /\bt\.Skip(?:f|now)?\s*\(/,
        name: "t.Skip() call (Go)",
    },
    // Rust test skipping
    {
        regex: /#\[ignore(?:\s*\(.*\))?\]/,
        name: "#[ignore] test attribute (Rust)",
    },
    // Commented-out assertions (JS/TS, Python)
    {
        regex: /(?:\/\/|#)\s*(?:expect\s*\(|assert(?:\.|\s*\()|self\.assert)/,
        name: "commented-out assertion (expect / assert)",
    },
];
function isTestFilePath(filePath) {
    if (!filePath)
        return false;
    const lower = filePath.toLowerCase().replace(/\\/g, "/");
    const base = lower.split("/").pop() ?? lower;
    return (lower.includes(".test.") ||
        lower.includes(".spec.") ||
        lower.includes("_test.") ||
        lower.includes("/tests/") ||
        lower.includes("/test/") ||
        base.startsWith("test_"));
}
function hasTestContext(code) {
    return /\b(?:describe|it|test|suite)\s*\(|def\s+test_|func\s+Test|#\[test\]/.test(code);
}
function extractFilePathFromPatch(patch) {
    if (typeof patch !== "string")
        return undefined;
    const match = patch.match(/\+\+\+\s+(?:b\/)?([^\s\t\n]+)/);
    if (match)
        return match[1];
    return undefined;
}
function extractAddedLines(text) {
    if (typeof text !== "string")
        return "";
    return text
        .split("\n")
        .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
        .map((line) => line.slice(1))
        .join("\n");
}
function extractSnippet(text, matchIndex, matchLen) {
    const maxPerSide = 80;
    const start = Math.max(0, matchIndex - maxPerSide);
    const end = Math.min(text.length, matchIndex + matchLen + maxPerSide);
    let snippet = text.slice(start, end).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
    if (start > 0)
        snippet = `…${snippet}`;
    if (end < text.length)
        snippet = `${snippet}…`;
    return snippet;
}
export const noCheatRule = {
    id: "testing/no-cheat",
    description: "Prevents models from cheating tests by skipping them, focusing only on single tests, or commenting out assertions.",
    inspect: (context) => {
        const findings = [];
        const seen = new Set();
        const checkTestCode = (code, filePath) => {
            if (!code || typeof code !== "string")
                return;
            const isTestFile = isTestFilePath(filePath);
            const isTestCode = isTestFile || (!filePath && hasTestContext(code));
            for (const pattern of TEST_CHEAT_PATTERNS) {
                if (seen.has(pattern.name))
                    continue;
                // If it's a commented-out assertion, only flag if it's explicitly in a test file or test context
                if (pattern.name.includes("commented-out assertion") && !isTestCode) {
                    continue;
                }
                // For other skip/focus patterns, if filePath is known and NOT a test file, skip unless test markers exist
                if (filePath && !isTestFile && !hasTestContext(code)) {
                    continue;
                }
                const match = pattern.regex.exec(code);
                if (match) {
                    seen.add(pattern.name);
                    const snippet = extractSnippet(code, match.index, match[0].length);
                    findings.push({
                        ruleId: "testing/no-cheat",
                        pattern: pattern.name,
                        messageSnippet: snippet,
                        description: `Weakened test detected in ${filePath ?? "test file"}: "${match[0]}" → "${snippet}"`,
                    });
                }
            }
        };
        for (const msg of context.currentTurn) {
            if (msg.info.role !== "assistant")
                continue;
            for (const part of msg.parts) {
                if (part.type === "tool" && part.state?.input) {
                    const input = part.state.input;
                    const patchRaw = input.patchText ?? input.patch;
                    const targetFile = input.path ??
                        input.targetFile ??
                        input.filePath ??
                        input.file ??
                        extractFilePathFromPatch(patchRaw);
                    if (typeof input.content === "string") {
                        checkTestCode(input.content, targetFile);
                    }
                    if (typeof input.new_string === "string") {
                        checkTestCode(input.new_string, targetFile);
                    }
                    if (typeof input.newString === "string") {
                        checkTestCode(input.newString, targetFile);
                    }
                    const patchText = extractAddedLines(patchRaw);
                    if (patchText) {
                        checkTestCode(patchText, targetFile);
                    }
                    const shellMutation = extractLikelyShellMutation(input);
                    if (shellMutation) {
                        checkTestCode(shellMutation);
                    }
                }
            }
        }
        if (findings.length === 0) {
            return {
                ruleId: "testing/no-cheat",
                decision: "pass",
                findings: [],
            };
        }
        const list = findings.map((f) => `  - [${f.pattern}] → ${f.messageSnippet}`).join("\n");
        const remediationPrompt = `Test integrity violation detected in this turn:\n${list}\n\n` +
            `Do not bypass failing tests by skipping them (.skip), focusing single tests (.only), or commenting out assertions. ` +
            `Please fix the underlying code implementation so that all tests pass legitimately.`;
        return {
            ruleId: "testing/no-cheat",
            decision: "block",
            findings,
            remediationPrompt,
        };
    },
};
