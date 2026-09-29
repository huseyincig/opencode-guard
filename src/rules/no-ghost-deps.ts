import fs from "node:fs";
import path from "node:path";
import type { GuardRule, RuleFinding, RuleResult, TurnInspectionContext } from "../types.js";

const NODE_BUILTINS = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "sea",
  "sqlite",
  "stream",
  "string_decoder",
  "test",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);

function getPackageName(importPath: string): string {
  if (importPath.startsWith("node:")) return "";
  if (importPath.startsWith(".") || importPath.startsWith("/") || importPath.startsWith("~")) {
    return "";
  }

  if (importPath.startsWith("@")) {
    const parts = importPath.split("/");
    return parts.slice(0, 2).join("/");
  }

  return importPath.split("/")[0];
}

const DEPS_CACHE = new Map<string, { timestamp: number; deps: Set<string> | null }>();
const CACHE_TTL_MS = 5000;

export function clearDeclaredDepsCache(): void {
  DEPS_CACHE.clear();
}

function loadDeclaredDependencies(directory: string): Set<string> | null {
  const resolvedDir = path.resolve(directory);
  const cached = DEPS_CACHE.get(resolvedDir);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.deps;
  }

  let curr = resolvedDir;
  let foundAny = false;
  const deps = new Set<string>();

  for (let i = 0; i < 4; i++) {
    const pkgPath = path.join(curr, "package.json");
    try {
      if (fs.existsSync(pkgPath)) {
        const raw = fs.readFileSync(pkgPath, "utf8");
        const pkg = JSON.parse(raw);
        for (const k of [
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}),
          ...Object.keys(pkg.peerDependencies ?? {}),
          ...Object.keys(pkg.optionalDependencies ?? {}),
        ]) {
          deps.add(k);
        }
        foundAny = true;
      }
    } catch {
      // If invalid JSON or cannot read, skip check
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }

  const result = foundAny ? deps : null;
  DEPS_CACHE.set(resolvedDir, { timestamp: now, deps: result });
  return result;
}

const IMPORT_REGEXES = [
  /\bimport\s+(?:[\w*\s{},]+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+[\w*\s{},]+from\s+["']([^"']+)["']/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function extractImports(code: string): string[] {
  const imports: string[] = [];
  for (const regex of IMPORT_REGEXES) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      if (match[1]) imports.push(match[1]);
    }
  }
  return imports;
}

function extractAddedLines(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

function extractFilePathFromPatch(patch: unknown): string | undefined {
  if (typeof patch !== "string") return undefined;
  const match = patch.match(/\+\+\+\s+(?:b\/)?([^\s\t\n]+)/);
  return match ? match[1] : undefined;
}

function resolveTargetFile(input: Record<string, unknown>): string | undefined {
  const patch = input.patchText ?? input.patch;
  return (
    (input.path as string) ??
    (input.targetFile as string) ??
    (input.filePath as string) ??
    (input.file as string) ??
    extractFilePathFromPatch(patch)
  );
}

/**
 * Resolves the declared-dependency set for a given tool part.
 * Prefers the package that OWNS the target file (walking up from its directory),
 * falling back to the session directory only when the path is relative or unknown.
 * This prevents false positives when editing a file that belongs to a different
 * package than the session root.
 */
function resolveDeclaredDeps(
  targetFile: string | undefined,
  sessionDirectory: string
): Set<string> | null {
  if (targetFile) {
    // Relative paths must resolve against the SESSION directory, never process.cwd().
    const abs = path.isAbsolute(targetFile)
      ? targetFile
      : path.resolve(sessionDirectory, targetFile);
    const fromFile = loadDeclaredDependencies(path.dirname(abs));
    if (fromFile) return fromFile;
  }
  return loadDeclaredDependencies(sessionDirectory);
}

export const noGhostDepsRule: GuardRule = {
  id: "manifest/no-ghost-deps",
  description: "Detects imported third-party packages that are not declared in package.json.",
  inspect: (context: TurnInspectionContext): RuleResult => {
    const findings: RuleFinding[] = [];
    const seen = new Set<string>();

    const checkCode = (code: string, source: string, declaredDeps: Set<string> | null) => {
      if (!declaredDeps) return;
      const importPaths = extractImports(code);
      for (const importPath of importPaths) {
        const pkgName = getPackageName(importPath);
        if (!pkgName) continue;
        if (NODE_BUILTINS.has(pkgName)) continue;
        if (declaredDeps.has(pkgName)) continue;
        if (seen.has(pkgName)) continue;

        seen.add(pkgName);
        findings.push({
          ruleId: "manifest/no-ghost-deps",
          pattern: pkgName,
          messageSnippet: importPath,
          description: `Undeclared dependency '${pkgName}' imported in ${source} but missing from package.json`,
        });
      }
    };

    for (const msg of context.currentTurn) {
      if (msg.info.role !== "assistant") continue;

      for (const part of msg.parts) {
        if (part.type === "tool" && part.state?.input) {
          const input = part.state.input as Record<string, unknown>;
          const declaredDeps = resolveDeclaredDeps(resolveTargetFile(input), context.directory);
          if (typeof input.content === "string") {
            checkCode(input.content, "file content", declaredDeps);
          }
          if (typeof input.new_string === "string") {
            checkCode(input.new_string, "file edit", declaredDeps);
          }
          if (typeof input.newString === "string") {
            checkCode(input.newString, "file edit", declaredDeps);
          }
          const patchText = extractAddedLines(input.patchText ?? input.patch);
          if (patchText) {
            checkCode(patchText, "patch added lines", declaredDeps);
          }
        }
      }
    }

    if (findings.length === 0) {
      return {
        ruleId: "manifest/no-ghost-deps",
        decision: "pass",
        findings: [],
      };
    }

    const list = findings.map((f) => `  - "${f.pattern}" (import: ${f.messageSnippet})`).join("\n");
    const remediationPrompt =
      `Ghost/undeclared dependency detected in this turn:\n${list}\n\n` +
      `The imported packages are not listed in package.json. ` +
      `Please either install and add them to dependencies, or use the standard library / existing modules instead.`;

    return {
      ruleId: "manifest/no-ghost-deps",
      decision: "block",
      findings,
      remediationPrompt,
    };
  },
};
