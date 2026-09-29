import type { GuardRule, RuleFinding, RuleResult, TurnInspectionContext } from "../types.js";

export const SECRET_PATTERNS: { regex: RegExp; name: string }[] = [
  {
    regex: /\b(?:sk-proj-|sk-)[a-zA-Z0-9_-]{32,}\b/,
    name: "OpenAI API Key (sk-...)",
  },
  {
    regex: /\bghp_[a-zA-Z0-9]{36}\b/,
    name: "GitHub Personal Access Token (ghp_...)",
  },
  {
    regex: /\bgithub_pat_[a-zA-Z0-9_]{50,}\b/,
    name: "GitHub Fine-Grained Token (github_pat_...)",
  },
  {
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    name: "AWS Access Key ID (AKIA...)",
  },
  {
    regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}\b/,
    name: "Slack API Token (xoxb-...)",
  },
  {
    regex: /-----BEGIN\s+(?:RSA\s+|OPENSSH\s+|EC\s+|DSA\s+|PGP\s+)?PRIVATE\s+KEY-----/,
    name: "Private Key Header (PEM/SSH)",
  },
  {
    regex: /\b(?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^:\s'"]+:([^@\s'"]+)@[a-zA-Z0-9.-]+(?::[0-9]+)?\/[a-zA-Z0-9_.-]+/,
    name: "Database Connection String with Password",
  },
  {
    regex: /\beyJ[a-zA-Z0-9_-]{15,}\.eyJ[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{15,}\b/,
    name: "JSON Web Token (JWT)",
  },
];

function isSafeFile(filePath?: string): boolean {
  if (!filePath) return false;
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".example") ||
    lower.endsWith(".template") ||
    lower.endsWith(".sample") ||
    lower.includes(".env.example")
  );
}

function extractFilePathFromPatch(patch: unknown): string | undefined {
  if (typeof patch !== "string") return undefined;
  const match = patch.match(/\+\+\+\s+(?:b\/)?([^\s\t\n]+)/);
  if (match) return match[1];
  return undefined;
}

function extractAddedLines(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return "********";
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export const noSecretsRule: GuardRule = {
  id: "security/no-secrets",
  description: "Detects hardcoded secrets, API keys, credentials, and connection strings in code modifications.",
  inspect: (context: TurnInspectionContext): RuleResult => {
    const findings: RuleFinding[] = [];
    const seen = new Set<string>();

    const checkCode = (code: string, filePath?: string) => {
      if (!code || typeof code !== "string") return;
      if (isSafeFile(filePath)) return;

      for (const pattern of SECRET_PATTERNS) {
        if (seen.has(pattern.name)) continue;

        const match = pattern.regex.exec(code);
        if (match) {
          const secretValue = match[0];
          const capturedPassword = match[1];

          // Ignore variable interpolations, env references, and placeholders
          if (
            capturedPassword &&
            (capturedPassword.includes("${") ||
              capturedPassword.startsWith("$") ||
              capturedPassword.includes("<") ||
              capturedPassword.includes("process.env"))
          ) {
            continue;
          }

          if (
            secretValue.includes("${") ||
            secretValue.includes("process.env") ||
            secretValue.includes("<YOUR_") ||
            secretValue.includes("<PASSWORD>") ||
            secretValue.includes("test") ||
            secretValue.includes("dummy") ||
            secretValue.includes("EXAMPLE") ||
            secretValue.includes("sample")
          ) {
            continue;
          }

          seen.add(pattern.name);
          const masked = maskSecret(secretValue);
          findings.push({
            ruleId: "security/no-secrets",
            pattern: pattern.name,
            messageSnippet: masked,
            description: `Potential hardcoded secret detected in ${filePath ?? "file"}: ${pattern.name} (${masked})`,
          });
        }
      }
    };

    for (const msg of context.currentTurn) {
      if (msg.info.role !== "assistant") continue;

      for (const part of msg.parts) {
        if (part.type === "tool" && part.state?.input) {
          const input = part.state.input;
          const patchRaw = input.patchText ?? input.patch;
          const targetFile =
            (input.path as string) ??
            (input.targetFile as string) ??
            (input.filePath as string) ??
            (input.file as string) ??
            extractFilePathFromPatch(patchRaw);

          if (typeof input.content === "string") {
            checkCode(input.content, targetFile);
          }
          if (typeof input.new_string === "string") {
            checkCode(input.new_string, targetFile);
          }
          if (typeof input.newString === "string") {
            checkCode(input.newString, targetFile);
          }
          const patchText = extractAddedLines(patchRaw);
          if (patchText) {
            checkCode(patchText, targetFile);
          }
        }
      }
    }

    if (findings.length === 0) {
      return {
        ruleId: "security/no-secrets",
        decision: "pass",
        findings: [],
      };
    }

    const list = findings.map((f) => `  - [${f.pattern}] → ${f.messageSnippet}`).join("\n");
    const remediationPrompt =
      `Hardcoded secret or credential detected in this turn:\n${list}\n\n` +
      `Never hardcode raw API keys, private tokens, or database credentials directly in source files. ` +
      `Please remove the credentials from code and use environment variables (e.g. process.env, .env) instead.`;

    return {
      ruleId: "security/no-secrets",
      decision: "block",
      findings,
      remediationPrompt,
    };
  },
};
