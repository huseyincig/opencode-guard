import fs from "node:fs";
import path from "node:path";
import { extractLikelyShellMutation } from "../tool-input.js";
const NODE_BUILTINS = new Set([
    "assert", "async_hooks", "buffer", "child_process", "cluster", "console", "constants",
    "crypto", "dgram", "diagnostics_channel", "dns", "domain", "events", "fs", "http",
    "http2", "https", "inspector", "module", "net", "os", "path", "perf_hooks", "process",
    "punycode", "querystring", "readline", "repl", "sea", "sqlite", "stream",
    "string_decoder", "test", "timers", "tls", "trace_events", "tty", "url", "util", "v8",
    "vm", "wasi", "worker_threads", "zlib",
]);
function getPackageName(importPath) {
    if (importPath.startsWith("node:"))
        return "";
    if (importPath.startsWith(".") || importPath.startsWith("/") || importPath.startsWith("~"))
        return "";
    if (importPath.startsWith("@"))
        return importPath.split("/").slice(0, 2).join("/");
    return importPath.split("/")[0];
}
const DEPS_CACHE = new Map();
const CACHE_TTL_MS = 5000;
export function clearDeclaredDepsCache() {
    DEPS_CACHE.clear();
}
function dependenciesFromPackage(pkg) {
    const deps = new Set();
    for (const section of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies]) {
        if (!section || typeof section !== "object" || Array.isArray(section))
            continue;
        for (const key of Object.keys(section))
            deps.add(key);
    }
    return deps;
}
function loadDeclaredDependencies(directory) {
    const resolvedDir = path.resolve(directory);
    const cached = DEPS_CACHE.get(resolvedDir);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS)
        return cached.deps;
    let curr = resolvedDir;
    while (true) {
        const pkgPath = path.join(curr, "package.json");
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
                const result = pkg && typeof pkg === "object" && !Array.isArray(pkg)
                    ? dependenciesFromPackage(pkg)
                    : null;
                DEPS_CACHE.set(resolvedDir, { timestamp: now, deps: result });
                return result;
            }
            catch {
                DEPS_CACHE.set(resolvedDir, { timestamp: now, deps: null });
                return null;
            }
        }
        const parent = path.dirname(curr);
        if (parent === curr)
            break;
        curr = parent;
    }
    DEPS_CACHE.set(resolvedDir, { timestamp: now, deps: null });
    return null;
}
const IMPORT_REGEXES = [
    /\bimport\s+(?:[\w*\s{},]+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[\w*\s{},]+from\s+["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];
function buildCodeMask(code) {
    const mask = new Uint8Array(code.length);
    mask.fill(1);
    let i = 0;
    while (i < code.length) {
        const ch = code[i];
        const next = code[i + 1];
        if (ch === "/" && next === "/") {
            const start = i;
            i += 2;
            while (i < code.length && code[i] !== "\n")
                i++;
            mask.fill(0, start, i);
            continue;
        }
        if (ch === "/" && next === "*") {
            const start = i;
            i += 2;
            while (i < code.length && !(code[i] === "*" && code[i + 1] === "/"))
                i++;
            i = Math.min(code.length, i + 2);
            mask.fill(0, start, i);
            continue;
        }
        if (ch === "'" || ch === '"' || ch === "`") {
            const quote = ch;
            const start = i;
            i++;
            while (i < code.length) {
                if (code[i] === "\\") {
                    i += 2;
                    continue;
                }
                if (code[i] === quote) {
                    i++;
                    break;
                }
                i++;
            }
            mask.fill(0, start, Math.min(i, code.length));
            continue;
        }
        i++;
    }
    return mask;
}
function extractImports(code) {
    const imports = [];
    const codeMask = buildCodeMask(code);
    for (const regex of IMPORT_REGEXES) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(code)) !== null) {
            if (codeMask[match.index] === 1 && match[1])
                imports.push(match[1]);
        }
    }
    return imports;
}
function extractAddedLines(text) {
    if (typeof text !== "string")
        return "";
    return text.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1)).join("\n");
}
function extractFilePathFromPatch(patch) {
    if (typeof patch !== "string")
        return undefined;
    const match = patch.match(/\+\++\s+(?:b\/)?([^\s\t\n]+)/);
    return match ? match[1] : undefined;
}
function resolveTargetFile(input) {
    const patch = input.patchText ?? input.patch;
    return (input.path ??
        input.targetFile ??
        input.filePath ??
        input.file ??
        extractFilePathFromPatch(patch));
}
function resolveDeclaredDeps(targetFile, sessionDirectory) {
    if (targetFile) {
        const abs = path.isAbsolute(targetFile) ? targetFile : path.resolve(sessionDirectory, targetFile);
        const fromFile = loadDeclaredDependencies(path.dirname(abs));
        if (fromFile)
            return fromFile;
    }
    return loadDeclaredDependencies(sessionDirectory);
}
export const noGhostDepsRule = {
    id: "manifest/no-ghost-deps",
    description: "Detects imported third-party packages that are not declared in package.json.",
    inspect: (context) => {
        const findings = [];
        const seen = new Set();
        const checkCode = (code, source, declaredDeps) => {
            if (!declaredDeps)
                return;
            for (const importPath of extractImports(code)) {
                const pkgName = getPackageName(importPath);
                if (!pkgName || NODE_BUILTINS.has(pkgName) || declaredDeps.has(pkgName) || seen.has(pkgName))
                    continue;
                seen.add(pkgName);
                findings.push({
                    ruleId: "manifest/no-ghost-deps",
                    pattern: pkgName,
                    messageSnippet: importPath,
                    description: `Undeclared dependency "${pkgName}" imported in ${source} but missing from package.json`,
                });
            }
        };
        for (const msg of context.currentTurn) {
            if (msg.info.role !== "assistant")
                continue;
            for (const part of msg.parts) {
                if (part.type !== "tool" || !part.state?.input)
                    continue;
                const input = part.state.input;
                const declaredDeps = resolveDeclaredDeps(resolveTargetFile(input), context.directory);
                if (typeof input.content === "string")
                    checkCode(input.content, "file content", declaredDeps);
                if (typeof input.new_string === "string")
                    checkCode(input.new_string, "file edit", declaredDeps);
                if (typeof input.newString === "string")
                    checkCode(input.newString, "file edit", declaredDeps);
                const patchText = extractAddedLines(input.patchText ?? input.patch);
                if (patchText)
                    checkCode(patchText, "patch added lines", declaredDeps);
                const shellMutation = extractLikelyShellMutation(input);
                if (shellMutation)
                    checkCode(shellMutation, "shell file mutation", loadDeclaredDependencies(context.directory));
            }
        }
        if (findings.length === 0) {
            return { ruleId: "manifest/no-ghost-deps", decision: "pass", findings: [] };
        }
        const list = findings.map((f) => `  - "${f.pattern}" (import: ${f.messageSnippet})`).join("\n");
        const remediationPrompt = `Ghost/undeclared dependency detected in this turn:\n${list}\n\n` +
            `The imported packages are not listed in the owning package.json. ` +
            `Please either install and add them to that package's dependencies, or use the standard library / existing modules instead.`;
        return { ruleId: "manifest/no-ghost-deps", decision: "block", findings, remediationPrompt };
    },
};
