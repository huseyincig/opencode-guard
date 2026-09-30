import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GuardEngine } from "../dist/engine.js";
import { noEvasionRule } from "../dist/rules/no-evasion.js";
import { noShortcutsRule } from "../dist/rules/no-shortcuts.js";
import { noStubsRule } from "../dist/rules/no-stubs.js";
import { noTruncationRule } from "../dist/rules/no-truncation.js";
import { noCheatRule } from "../dist/rules/no-cheat.js";
import { noSecretsRule } from "../dist/rules/no-secrets.js";
import { noGhostDepsRule, clearDeclaredDepsCache } from "../dist/rules/no-ghost-deps.js";
import { circuitBreakerRule } from "../dist/rules/circuit-breaker.js";
import { noApologyRule } from "../dist/rules/no-apology.js";

// --- 1. discipline/no-evasion ---
test("discipline/no-evasion rule detects dismissal phrases", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "text",
            text: "I finished the feature. The test failure is unrelated to this change.",
          },
        ],
      },
    ],
  };

  const result = noEvasionRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.findings[0].pattern, "unrelated to this change");
  assert.equal(result.ruleId, "discipline/no-evasion");
});

// --- 2. quality/no-shortcuts ---
test("quality/no-shortcuts rule detects hedging and shortcuts", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [{ type: "text", text: "This basic implementation is good enough for now." }],
      },
    ],
  };

  const result = noShortcutsRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.ruleId, "quality/no-shortcuts");
  assert.ok(result.findings.length >= 2);
});

// --- 3. integrity/no-stubs ---
test("integrity/no-stubs rule detects throw NotImplementedError", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                content: "function calculate() {\n  throw new NotImplementedError('todo');\n}",
              },
            },
          },
        ],
      },
    ],
  };

  const result = noStubsRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.ruleId, "integrity/no-stubs");
  assert.equal(result.findings[0].pattern, "throw NotImplementedError");
  assert.ok(result.remediationPrompt.includes("Incomplete or stubbed implementation"));
});

test("integrity/no-stubs rule passes complete implementation", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                content: "function add(a, b) {\n  return a + b;\n}",
              },
            },
          },
        ],
      },
    ],
  };

  const result = noStubsRule.inspect(context);
  assert.equal(result.decision, "pass");
});

// --- 4. safety/no-truncation ---
test("safety/no-truncation rule detects lazy code placeholders", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                content: "class App {\n  // ... existing code unchanged ...\n  newMethod() {}\n}",
              },
            },
          },
        ],
      },
    ],
  };

  const result = noTruncationRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.ruleId, "safety/no-truncation");
  assert.ok(result.remediationPrompt.includes("Lazy code truncation placeholder detected"));
});

test("safety/no-truncation rule passes untruncated code", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                content: "class App {\n  oldMethod() {}\n  newMethod() {}\n}",
              },
            },
          },
        ],
      },
    ],
  };

  const result = noTruncationRule.inspect(context);
  assert.equal(result.decision, "pass");
});

// --- 5. testing/no-cheat ---
test("testing/no-cheat rule detects it.skip in test files", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/calculator.test.ts",
                content: "describe('calc', () => {\n  it.skip('handles division', () => {});\n});",
              },
            },
          },
        ],
      },
    ],
  };

  const result = noCheatRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.ruleId, "testing/no-cheat");
  assert.equal(result.findings[0].pattern, "test.skip() / it.skip() (JS/TS)");
  assert.ok(result.remediationPrompt.includes("Test integrity violation detected"));
});

test("testing/no-cheat rule detects commented-out expect/assert in test files", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "tests/auth.spec.js",
                content: "test('login', () => {\n  // expect(user).toBeDefined();\n});",
              },
            },
          },
        ],
      },
    ],
  };

  const result = noCheatRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.findings[0].pattern, "commented-out assertion (expect / assert)");
});

// --- 6. security/no-secrets ---
test("security/no-secrets rule detects hardcoded OpenAI and GitHub tokens", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/client.ts",
                content: "const token = 'ghp_111122223333444455556666777788889999';\nconst aiKey = 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789ABCD';",
              },
            },
          },
        ],
      },
    ],
  };

  const result = noSecretsRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.ruleId, "security/no-secrets");
  assert.equal(result.findings.length, 2);
  assert.ok(result.remediationPrompt.includes("Hardcoded secret or credential detected"));
});

test("security/no-secrets rule ignores .env.example files", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: ".env.example",
                content: "GITHUB_TOKEN=ghp_111122223333444455556666777788889999",
              },
            },
          },
        ],
      },
    ],
  };

  const result = noSecretsRule.inspect(context);
  assert.equal(result.decision, "pass");
});

// --- 7. manifest/no-ghost-deps ---
test("manifest/no-ghost-deps rule detects unlisted imports", () => {
  const context = {
    sessionID: "test-sess",
    directory: process.cwd(),
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/feature.ts",
                content: "import lodash from 'lodash';\nimport fs from 'node:fs';\nimport { GuardEngine } from './engine.js';",
              },
            },
          },
        ],
      },
    ],
  };

  const result = noGhostDepsRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.ruleId, "manifest/no-ghost-deps");
  assert.equal(result.findings[0].pattern, "lodash");
  assert.ok(result.remediationPrompt.includes("Ghost/undeclared dependency detected"));
});

// --- 8. runtime/circuit-breaker ---
test("runtime/circuit-breaker rule detects 3 identical tool errors", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          { type: "tool", state: { status: "error", error: "FATAL: Connection refused on port 5432" } },
          { type: "tool", state: { status: "error", error: "FATAL: Connection refused on port 5432" } },
          { type: "tool", state: { status: "error", error: "FATAL: Connection refused on port 5432" } },
        ],
      },
    ],
  };

  const result = circuitBreakerRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.ruleId, "runtime/circuit-breaker");
  assert.equal(result.findings[0].pattern, "Repeated error loop");
  assert.ok(result.remediationPrompt.includes("Circuit breaker tripped"));
});

// --- GuardEngine Full Integration ---
test("GuardEngine lifecycle and synthetic prompt loop guard", async () => {
  const engine = new GuardEngine({
    enabled: true,
  });

  const sessionID = "sess-123";
  const messages = [
    {
      info: { id: "u-1", role: "user" },
      parts: [{ type: "text", text: "Fix the bug" }],
    },
    {
      info: { id: "a-1", role: "assistant" },
      parts: [
        {
          type: "text",
          text: "I did not fix this because it is already broken on main.",
        },
      ],
    },
  ];

  // First inspection -> must BLOCK
  const result1 = await engine.inspect(sessionID, "/tmp", messages);
  assert.equal(result1.decision, "block");

  // Synthetic remediation prompt sent by detector
  const messagesAfterRemediation = [
    ...messages,
    {
      info: { id: "u-2", role: "user" },
      parts: [{ type: "text", text: result1.combinedRemediationPrompt, synthetic: true }],
    },
    {
      info: { id: "a-2", role: "assistant" },
      parts: [
        {
          type: "text",
          text: "Here is the evidence for already broken on main: commit abc1234.",
        },
      ],
    },
  ];

  // Second inspection -> must PASS to prevent infinite loop!
  const result2 = await engine.inspect(sessionID, "/tmp", messagesAfterRemediation);
  assert.equal(result2.decision, "pass");
});

test("quality/no-shortcuts localized exception boundary checking", () => {
  // Case A: TemporaryDirectory alone should pass
  const contextA = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [{ type: "text", text: "I created a TemporaryDirectory to store test fixtures." }],
      },
    ],
  };
  assert.equal(noShortcutsRule.inspect(contextA).decision, "pass");

  // Case B: TemporaryDirectory mentioned BUT text also contains a shortcut phrase -> must BLOCK
  const contextB = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "text",
            text: "Using TemporaryDirectory for tests, this temporary fix is good enough for now.",
          },
        ],
      },
    ],
  };
  const resB = noShortcutsRule.inspect(contextB);
  assert.equal(resB.decision, "block");
  assert.ok(resB.findings.some((f) => f.pattern === "good enough"));
});

test("testing/no-cheat does not false-positive on regular comments in non-test files", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/auth/service.ts",
                content: "// assert that session is still valid\nif (!session) return false;",
              },
            },
          },
        ],
      },
    ],
  };
  const res = noCheatRule.inspect(context);
  assert.equal(res.decision, "pass");
});

test("testing/no-cheat resolves target file from patch header +++ b/...", () => {
  const patchContent =
    "--- a/tests/unit.test.ts\n" +
    "+++ b/tests/unit.test.ts\n" +
    "@@ -10,3 +10,4 @@\n" +
    "+  it.skip('broken test', () => {});\n";

  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                patch: patchContent,
              },
            },
          },
        ],
      },
    ],
  };
  const res = noCheatRule.inspect(context);
  assert.equal(res.decision, "block");
  assert.equal(res.ruleId, "testing/no-cheat");
});

test("security/no-secrets ignores template variables and env references", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/db.ts",
                content: "const uri = `postgres://user:${process.env.DB_PASSWORD}@localhost:5432/app`;",
              },
            },
          },
        ],
      },
    ],
  };
  const res = noSecretsRule.inspect(context);
  assert.equal(res.decision, "pass");
});

test("runtime/circuit-breaker correctly serializes object errors", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          { type: "tool", state: { status: "error", error: { message: "SQLSTATE[HY000]: General error: 2006 MySQL server has gone away" } } },
          { type: "tool", state: { status: "error", error: { message: "SQLSTATE[HY000]: General error: 2006 MySQL server has gone away" } } },
          { type: "tool", state: { status: "error", error: { message: "SQLSTATE[HY000]: General error: 2006 MySQL server has gone away" } } },
        ],
      },
    ],
  };
  const res = circuitBreakerRule.inspect(context);
  assert.equal(res.decision, "block");
  assert.equal(res.ruleId, "runtime/circuit-breaker");
});

test("runtime/circuit-breaker detects 3 identical non-zero exit commands (bash completed state)", () => {
  const bashPart = () => ({
    type: "tool",
    state: {
      status: "completed",
      output: "cat: /missing.txt: No such file or directory\n\n[exit code: 1]",
      metadata: { exit: 1, output: "cat: /missing.txt: No such file or directory\n\n[exit code: 1]" },
    },
  });

  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      { info: { id: "msg-1", role: "assistant" }, parts: [bashPart(), bashPart(), bashPart()] },
    ],
  };

  const res = circuitBreakerRule.inspect(context);
  assert.equal(res.decision, "block");
  assert.equal(res.ruleId, "runtime/circuit-breaker");
  assert.ok(res.remediationPrompt.includes("Circuit breaker tripped"));
});

test("runtime/circuit-breaker ignores successful commands with exit 0", () => {
  const okPart = () => ({
    type: "tool",
    state: {
      status: "completed",
      output: "all good\n\n[exit code: 0]",
      metadata: { exit: 0, output: "all good\n\n[exit code: 0]" },
    },
  });

  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      { info: { id: "msg-1", role: "assistant" }, parts: [okPart(), okPart(), okPart()] },
    ],
  };

  assert.equal(circuitBreakerRule.inspect(context).decision, "pass");
});

test("GuardEngine severity warn does not block", async () => {
  const engine = new GuardEngine({
    enabled: true,
    rules: {
      "quality/no-shortcuts": "warn",
    },
  });

  const sessionID = "sess-warn";
  const messages = [
    {
      info: { id: "u-1", role: "user" },
      parts: [{ type: "text", text: "Do work" }],
    },
    {
      info: { id: "a-1", role: "assistant" },
      parts: [{ type: "text", text: "This is good enough for now." }],
    },
  ];

  const result = await engine.inspect(sessionID, "/tmp", messages);
  assert.equal(result.decision, "pass");
});

test("GuardEngine passes isSubagent flag to inspection context", async () => {
  let capturedIsSubagent = null;

  const engine = new GuardEngine();
  engine.registerRule({
    id: "test/subagent-checker",
    description: "Checks if isSubagent is properly propagated",
    inspect: (context) => {
      capturedIsSubagent = context.isSubagent;
      return { ruleId: "test/subagent-checker", decision: "pass", findings: [] };
    },
  });

  const messages = [
    {
      info: { id: "u-1", role: "user", agent: "research" },
      parts: [{ type: "text", text: "Research the bug" }],
    },
    {
      info: { id: "a-1", role: "assistant" },
      parts: [{ type: "text", text: "I looked into the codebase." }],
    },
  ];

  await engine.inspect("sess-sub", "/tmp", messages);
  assert.equal(capturedIsSubagent, true);
});

// --- 9. discipline/no-apology ---
test("discipline/no-apology detects English apology phrases", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [{ type: "text", text: "I sincerely apologize for the mistake. I am so sorry for the confusion." }],
      },
    ],
  };

  const result = noApologyRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.ruleId, "discipline/no-apology");
  assert.ok(result.findings.some((f) => f.pattern === "English"));
  assert.ok(result.remediationPrompt.includes("Excessive apology / sycophancy language detected"));
});

test("discipline/no-apology detects Turkish apology phrases", () => {
  const context = {
    sessionID: "test-sess",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [{ type: "text", text: "Çok özür dilerim, kusura bakmayın hata benden kaynaklandı." }],
      },
    ],
  };

  const result = noApologyRule.inspect(context);
  assert.equal(result.decision, "block");
  assert.equal(result.ruleId, "discipline/no-apology");
  assert.ok(result.findings.some((f) => f.pattern === "Turkish"));
});

test("discipline/no-apology detects German, French, Spanish, and Russian apologies", () => {
  for (const [lang, phrase] of [
    ["German", "Es tut mir leid, das war mein Fehler."],
    ["French", "Je suis désolé pour cette confusion."],
    ["Spanish", "Lo siento mucho, me equivoqué."],
    ["Russian", "Извините за ошибku, сейчас всё исправлю."],
  ]) {
    const context = {
      sessionID: `test-${lang}`,
      directory: "/tmp",
      messages: [],
      ruleConfig: {},
      currentTurn: [
        {
          info: { id: "msg-1", role: "assistant" },
          parts: [{ type: "text", text: phrase }],
        },
      ],
    };
    const result = noApologyRule.inspect(context);
    assert.equal(result.decision, "block", `Expected block for ${lang}: "${phrase}"`);
    assert.equal(result.ruleId, "discipline/no-apology");
    assert.equal(result.findings[0].pattern, lang);
  }
});

test("discipline/no-apology passes clean direct technical response and non-apology usages", () => {
  for (const cleanText of [
    "Root cause identified in config.ts:42. Patch applied and verified with test suite.",
    "The user requested an apology letter generator template.",
    "Bu fonksiyon nesneyi özelleştirir ve kaydeder.",
  ]) {
    const context = {
      sessionID: "test-clean",
      directory: "/tmp",
      messages: [],
      ruleConfig: {},
      currentTurn: [
        {
          info: { id: "msg-1", role: "assistant" },
          parts: [{ type: "text", text: cleanText }],
        },
      ],
    };

    const result = noApologyRule.inspect(context);
    assert.equal(result.decision, "pass", `Expected pass for: "${cleanText}"`);
    assert.equal(result.findings.length, 0);
  }
});

test("prose rules ignore citations, backticks, blockquotes, and quoted patterns", () => {
  // 1. no-apology ignores quotes & backticks
  const apologyContext = {
    sessionID: "test-quotes-1",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "text",
            text: 'Ben bilerek *"Çok özür dilerim"* yazdım ve `I am so sorry` kalıbını test ettim.\n> "Excessive apology detected: I apologize"\nÖzür dileme konusunu inceledik.',
          },
        ],
      },
    ],
  };
  assert.equal(noApologyRule.inspect(apologyContext).decision, "pass");

  // 2. no-shortcuts ignores code markers inside inline backticks in prose
  const shortcutsContext = {
    sessionID: "test-quotes-2",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "text",
            text: "Bu kural `hardcoded`, `placeholder` ve `TODO` kelimelerini inceler ve engeller.",
          },
        ],
      },
    ],
  };
  assert.equal(noShortcutsRule.inspect(shortcutsContext).decision, "pass");

  // 3. no-evasion ignores quoted evasion phrases in prose
  const evasionContext = {
    sessionID: "test-quotes-3",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "msg-1", role: "assistant" },
        parts: [
          {
            type: "text",
            text: 'The detector caught: "unrelated to this change" and "already broken on main".',
          },
        ],
      },
    ],
  };
  assert.equal(noEvasionRule.inspect(evasionContext).decision, "pass");
});

test("manifest/no-ghost-deps resolves deps from the target file's own package", () => {
  clearDeclaredDepsCache();

  // Package A declares @babel/core (the exact cross-package FP seen in production).
  const pkgA = fs.mkdtempSync(path.join(os.tmpdir(), "guardpkg-a-"));
  fs.writeFileSync(
    path.join(pkgA, "package.json"),
    JSON.stringify({ name: "pkg-a", devDependencies: { "@babel/core": "^7.0.0" } })
  );
  const fileA = path.join(pkgA, "scripts", "emit.mjs");
  fs.mkdirSync(path.dirname(fileA), { recursive: true });

  // Session root is a DIFFERENT package that declares nothing.
  const pkgB = fs.mkdtempSync(path.join(os.tmpdir(), "guardpkg-b-"));
  fs.writeFileSync(path.join(pkgB, "package.json"), JSON.stringify({ name: "pkg-b", dependencies: {} }));
  const fileB = path.join(pkgB, "src", "x.ts");
  fs.mkdirSync(path.dirname(fileB), { recursive: true });

  const mkCtx = (targetFile, content) => ({
    sessionID: "ghost-ctx",
    directory: pkgB,
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "m1", role: "assistant" },
        parts: [{ type: "tool", state: { input: { filePath: targetFile, content } } }],
      },
    ],
  });

  // Owned by pkgA -> @babel/core IS declared there -> must PASS (no cross-package FP)
  assert.equal(
    noGhostDepsRule.inspect(mkCtx(fileA, 'import babel from "@babel/core";')).decision,
    "pass"
  );

  // Owned by pkgB -> lodash is NOT declared anywhere -> must BLOCK
  const blocked = noGhostDepsRule.inspect(
    mkCtx(fileB, 'import lodash from "lodash";')
  );
  assert.equal(blocked.decision, "block");
  assert.equal(blocked.findings[0].pattern, "lodash");

  fs.rmSync(pkgA, { recursive: true, force: true });
  fs.rmSync(pkgB, { recursive: true, force: true });
});

test("manifest/no-ghost-deps resolves RELATIVE target paths against the session directory", () => {
  clearDeclaredDepsCache();

  const pkg = fs.mkdtempSync(path.join(os.tmpdir(), "guardpkg-rel-"));
  fs.writeFileSync(
    path.join(pkg, "package.json"),
    JSON.stringify({ name: "pkg-rel", dependencies: { chalk: "^5.0.0" } })
  );

  // Relative path must resolve against the session dir, NOT process.cwd().
  const res = noGhostDepsRule.inspect({
    sessionID: "ghost-rel",
    directory: pkg,
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "m1", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/logger.ts",
                content: 'import chalk from "chalk";\nexport const ok = true;',
              },
            },
          },
        ],
      },
    ],
  });

  assert.equal(res.decision, "pass");
  fs.rmSync(pkg, { recursive: true, force: true });
});

test("plugin exports OpencodeGuardian with id 'opencode-guardian' and backward-compatible OpencodeGuard alias", async () => {
  const pluginMod = await import("../dist/index.js");
  assert.equal(pluginMod.OpencodeGuardian.id, "opencode-guardian");
  assert.equal(typeof pluginMod.OpencodeGuardian.server, "function");
  assert.equal(typeof pluginMod.OpencodeGuardian.setup, "function");
  assert.equal(pluginMod.default, pluginMod.OpencodeGuardian);
  assert.equal(pluginMod.OpencodeGuard, pluginMod.OpencodeGuardian);
});

test("root index.js and server.js re-export plugin cleanly", async () => {
  const rootIndex = await import("../index.js");
  const rootServer = await import("../server.js");
  assert.equal(rootIndex.OpencodeGuardian.id, "opencode-guardian");
  assert.equal(rootIndex.default.id, "opencode-guardian");
  assert.equal(rootServer.OpencodeGuardian.id, "opencode-guardian");
  assert.equal(rootServer.default.id, "opencode-guardian");
});

test("loadConfig supports opencode-guardian.json and falls back to opencode-guard.json", async () => {
  const { loadConfig } = await import("../dist/engine.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-cfg-"));

  // 1. When opencode-guardian.json exists
  fs.writeFileSync(
    path.join(tmpDir, "opencode-guardian.json"),
    JSON.stringify({ enabled: true, rules: { "testing/no-cheat": "off" } })
  );
  let cfg = loadConfig(tmpDir);
  assert.equal(cfg.rules["testing/no-cheat"], "off");

  // 2. When only opencode-guard.json exists (backward compat)
  fs.unlinkSync(path.join(tmpDir, "opencode-guardian.json"));
  fs.writeFileSync(
    path.join(tmpDir, "opencode-guard.json"),
    JSON.stringify({ enabled: true, rules: { "testing/no-cheat": "warn" } })
  );
  cfg = loadConfig(tmpDir);
  assert.equal(cfg.rules["testing/no-cheat"], "warn");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("GuardEngine honors object severity off", async () => {
  const engine = new GuardEngine({
    enabled: true,
    rules: {
      "discipline/no-evasion": { severity: "off" },
      "discipline/no-apology": "off",
      "quality/no-shortcuts": "off",
      "integrity/no-stubs": "off",
      "safety/no-truncation": "off",
      "testing/no-cheat": "off",
      "security/no-secrets": "off",
      "manifest/no-ghost-deps": "off",
      "runtime/circuit-breaker": "off",
    },
  });

  const result = await engine.inspect("severity-off", "/tmp", [
    { info: { id: "u-off", role: "user" }, parts: [{ type: "text", text: "check" }] },
    { info: { id: "a-off", role: "assistant" }, parts: [{ type: "text", text: "This is unrelated to this change." }] },
  ]);

  assert.equal(result.decision, "pass");
});

test("quality/no-shortcuts ignores empty configured exceptions without hanging", () => {
  const context = {
    sessionID: "empty-exception",
    directory: "/tmp",
    messages: [],
    ruleConfig: { exceptions: [""] },
    currentTurn: [
      {
        info: { id: "a-empty", role: "assistant" },
        parts: [{ type: "text", text: "This temporary fix is good enough for now." }],
      },
    ],
  };
  assert.equal(noShortcutsRule.inspect(context).decision, "block");
});

test("security/no-secrets does not bypass real-looking secrets containing test/sample words", () => {
  const cases = [
    "const key = 'sk-aaaaaaaaaaaaaaaaatestbbbbbbbbbbbbbbbbbbbbbbbb';",
    "const db = 'postgres://admin:SuperSecretPassword@db.example.com/testdb';",
  ];

  for (const content of cases) {
    const context = {
      sessionID: "secret-substring",
      directory: "/tmp",
      messages: [],
      ruleConfig: {},
      currentTurn: [
        {
          info: { id: "a-secret-substring", role: "assistant" },
          parts: [{ type: "tool", state: { input: { path: "src/config.ts", content } } }],
        },
      ],
    };
    assert.equal(noSecretsRule.inspect(context).decision, "block");
  }
});

test("manifest/no-ghost-deps stops at the nearest package boundary", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-monorepo-"));
  const child = path.join(root, "packages", "child");
  fs.mkdirSync(path.join(child, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { lodash: "1.0.0" } }));
  fs.writeFileSync(path.join(child, "package.json"), JSON.stringify({ name: "child", dependencies: {} }));
  clearDeclaredDepsCache();

  const context = {
    sessionID: "monorepo",
    directory: child,
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "a-monorepo", role: "assistant" },
        parts: [{ type: "tool", state: { input: { path: path.join(child, "src", "x.js"), content: 'import lodash from "lodash";' } } }],
      },
    ],
  };

  assert.equal(noGhostDepsRule.inspect(context).decision, "block");
});

test("manifest/no-ghost-deps detects dynamic imports but ignores comments and string examples", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-imports-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: {} }));

  clearDeclaredDepsCache();
  const dynamicContext = {
    sessionID: "dynamic-import",
    directory: root,
    messages: [],
    ruleConfig: {},
    currentTurn: [
      {
        info: { id: "a-dynamic", role: "assistant" },
        parts: [{ type: "tool", state: { input: { path: path.join(root, "src.js"), content: 'const mod = await import("lodash");' } } }],
      },
    ],
  };
  assert.equal(noGhostDepsRule.inspect(dynamicContext).decision, "block");

  clearDeclaredDepsCache();
  const docsContext = {
    ...dynamicContext,
    sessionID: "docs-import",
    currentTurn: [
      {
        info: { id: "a-docs", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                path: path.join(root, "docs.js"),
                content: '// docs: import lodash from "lodash";\nconst example = \'require("axios")\';',
              },
            },
          },
        ],
      },
    ],
  };
  assert.equal(noGhostDepsRule.inspect(docsContext).decision, "pass");
});

test("testing/no-cheat recognizes Windows and root-level Python test paths", () => {
  for (const filePath of ["C:\\repo\\tests\\foo.py", "/repo/test_auth.py"]) {
    const context = {
      sessionID: "test-paths",
      directory: "/tmp",
      messages: [],
      ruleConfig: {},
      currentTurn: [
        {
          info: { id: `a-${filePath}`, role: "assistant" },
          parts: [{ type: "tool", state: { input: { path: filePath, content: '@pytest.mark.skip(reason="broken")' } } }],
        },
      ],
    };
    assert.equal(noCheatRule.inspect(context).decision, "block");
  }
});

test("file-mutation rules inspect shell heredoc writes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-shell-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: {} }));
  clearDeclaredDepsCache();

  const command =
    "cat > src/unsafe.js <<'EOF'\n" +
    'import lodash from "lodash";\n' +
    'const key = "sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";\n' +
    'function f(){ throw new NotImplementedError("todo") }\n' +
    '// TODO: temporary fix\n' +
    '// ... existing code unchanged ...\n' +
    'it.skip("x",()=>{});\n' +
    "EOF";

  const currentTurn = [
    {
      info: { id: "a-shell", role: "assistant" },
      parts: [{ type: "tool", state: { input: { command } } }],
    },
  ];
  const base = {
    sessionID: "shell-write",
    directory: root,
    messages: [],
    ruleConfig: {},
    currentTurn,
  };

  for (const rule of [noShortcutsRule, noStubsRule, noTruncationRule, noCheatRule, noSecretsRule, noGhostDepsRule]) {
    assert.equal(rule.inspect(base).decision, "block", rule.id);
  }
});

test("GuardEngine does not blindly skip the next unrelated idle after a block", async () => {
  const engine = new GuardEngine();
  const first = await engine.inspect("no-blind-skip", "/tmp", [
    { info: { id: "u-1-skip", role: "user" }, parts: [{ type: "text", text: "do it" }] },
    { info: { id: "a-1-skip", role: "assistant" }, parts: [{ type: "text", text: "This is unrelated to this change." }] },
  ]);
  assert.equal(first.decision, "block");

  const second = await engine.inspect("no-blind-skip", "/tmp", [
    { info: { id: "u-2-skip", role: "user" }, parts: [{ type: "text", text: "next" }] },
    {
      info: { id: "a-2-skip", role: "assistant" },
      parts: [
        {
          type: "tool",
          state: {
            input: {
              path: "src/key.ts",
              content: 'const key = "sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";',
            },
          },
        },
      ],
    },
  ]);
  assert.equal(second.decision, "block");
  assert.ok(second.results.some((result) => result.ruleId === "security/no-secrets" && result.decision === "block"));
});

test("GuardEngine retries the same message after a transient rule exception", async () => {
  const engine = new GuardEngine({
    enabled: true,
    rules: {
      "discipline/no-evasion": "off",
      "discipline/no-apology": "off",
      "quality/no-shortcuts": "off",
      "integrity/no-stubs": "off",
      "safety/no-truncation": "off",
      "testing/no-cheat": "off",
      "security/no-secrets": "off",
      "manifest/no-ghost-deps": "off",
      "runtime/circuit-breaker": "off",
    },
  });
  let calls = 0;
  engine.registerRule({
    id: "custom/throws-once",
    description: "test",
    inspect() {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      return {
        ruleId: "custom/throws-once",
        decision: "block",
        findings: [{ ruleId: "custom/throws-once", pattern: "x", messageSnippet: "x", description: "x" }],
        remediationPrompt: "fix",
      };
    },
  });

  const messages = [
    { info: { id: "u-retry", role: "user" }, parts: [{ type: "text", text: "run" }] },
    { info: { id: "a-retry", role: "assistant" }, parts: [{ type: "text", text: "done" }] },
  ];

  await assert.rejects(() => engine.inspect("retry-session", "/tmp", messages), /transient/);
  const second = await engine.inspect("retry-session", "/tmp", messages);
  assert.equal(calls, 2);
  assert.equal(second.decision, "block");
});

test("runtime/circuit-breaker keys repetition by tool invocation, not only error text", () => {
  const part = (command, error) => ({
    type: "tool",
    tool: "bash",
    state: { status: "error", input: { command }, error },
  });

  const base = {
    sessionID: "breaker-signature",
    directory: "/tmp",
    messages: [],
    ruleConfig: {},
  };

  const differentCommands = {
    ...base,
    currentTurn: [
      {
        info: { id: "a-different", role: "assistant" },
        parts: [
          part("cat a", "No such file or directory"),
          part("cat b", "No such file or directory"),
          part("cat c", "No such file or directory"),
        ],
      },
    ],
  };
  assert.equal(circuitBreakerRule.inspect(differentCommands).decision, "pass");

  const sameCommand = {
    ...base,
    currentTurn: [
      {
        info: { id: "a-same", role: "assistant" },
        parts: [
          part("curl example", "attempt 1: connection refused"),
          part("curl example", "attempt 2: connection refused"),
          part("curl example", "attempt 3: connection refused"),
        ],
      },
    ],
  };
  assert.equal(circuitBreakerRule.inspect(sameCommand).decision, "block");
});

test("OpenCode v2 setup consumes the async event stream and sends synthetic remediation", async () => {
  const { OpencodeGuardian } = await import("../dist/index.js");
  let subscribeOptions;
  let contextCalls = 0;
  let remediation = "";

  const remediated = new Promise((resolve) => {
    const context = {
      location: { directory: process.cwd() },
      event: {
        subscribe(options) {
          subscribeOptions = options;
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: "session.idle", data: { sessionID: "v2-session" } };
            },
          };
        },
      },
      session: {
        async context({ sessionID }) {
          contextCalls += 1;
          assert.equal(sessionID, "v2-session");
          return [
            { id: "v2-user", type: "user", time: { created: 1 }, text: "fix it" },
            {
              id: "v2-assistant",
              type: "assistant",
              time: { created: 2 },
              agent: "orchestrator",
              model: { providerID: "test", modelID: "test" },
              content: [{ type: "text", text: "This is unrelated to this change." }],
            },
          ];
        },
        async synthetic(input) {
          remediation = input.text;
          resolve();
          return {};
        },
      },
    };

    Promise.resolve(OpencodeGuardian.setup(context)).then((cleanup) => {
      remediated.finally(() => cleanup?.());
    });
  });

  await Promise.race([
    remediated,
    new Promise((_, reject) => setTimeout(() => reject(new Error("v2 remediation timeout")), 1000)),
  ]);

  assert.ok(subscribeOptions?.signal instanceof AbortSignal);
  assert.equal(contextCalls, 1);
  assert.ok(remediation.startsWith("[opencode-guardian remediation]"));
});
