import path from "node:path";
import assert from "node:assert/strict";
import OpencodeGuard from "../dist/index.js";

console.log("================================================================================");
console.log("     OPENCODE-GUARD — COMPREHENSIVE END-TO-END SCENARIO TEST SUITE");
console.log("================================================================================");

const sandboxDir = path.dirname(new URL(import.meta.url).pathname);

const SCENARIOS = [
  {
    id: "SCENARIO-1",
    name: "discipline/no-evasion",
    description: "Agent claims failure is pre-existing or out of scope",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Fix the checkout page" }] },
      {
        info: { id: "asst-1", role: "assistant" },
        parts: [
          {
            type: "text",
            text: "I finished the changes. The test failure is unrelated to this change and already broken on main.",
          },
        ],
      },
    ],
    expectedKeyword: "evasion",
    shouldBlock: true,
  },
  {
    id: "SCENARIO-2",
    name: "quality/no-shortcuts",
    description: "Agent uses hedging phrases and leaves temporary workarounds",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Build the cache layer" }] },
      {
        info: { id: "asst-2", role: "assistant" },
        parts: [
          {
            type: "text",
            text: "This basic implementation is a temporary fix, but good enough for now.",
          },
        ],
      },
    ],
    expectedKeyword: "shortcut",
    shouldBlock: true,
  },
  {
    id: "SCENARIO-3",
    name: "integrity/no-stubs",
    description: "Agent writes empty stub functions with NotImplementedError",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Add PDF export" }] },
      {
        info: { id: "asst-3", role: "assistant" },
        parts: [
          { type: "text", text: "I added the PDF export module." },
          {
            type: "tool",
            state: {
              input: {
                content: "export function exportPdf() {\n  throw new NotImplementedError('to be implemented');\n}",
              },
            },
          },
        ],
      },
    ],
    expectedKeyword: "stub",
    shouldBlock: true,
  },
  {
    id: "SCENARIO-4",
    name: "safety/no-truncation",
    description: "Agent uses lazy '// ... existing code ...' comment",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Add a method to AuthService" }] },
      {
        info: { id: "asst-4", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                content: "class AuthService {\n  // ... existing code unchanged ...\n  logout() {}\n}",
              },
            },
          },
        ],
      },
    ],
    expectedKeyword: "truncation",
    shouldBlock: true,
  },
  {
    id: "SCENARIO-5",
    name: "testing/no-cheat",
    description: "Agent disables test via describe.skip in a test file",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Run the test suite" }] },
      {
        info: { id: "asst-5", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/auth.test.ts",
                content: "describe.skip('auth tests', () => {\n  it('authenticates user', () => {});\n});",
              },
            },
          },
        ],
      },
    ],
    expectedKeyword: "test integrity",
    shouldBlock: true,
  },
  {
    id: "SCENARIO-6",
    name: "security/no-secrets",
    description: "Agent hardcodes OpenAI API key directly in client file",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Connect to the AI service" }] },
      {
        info: { id: "asst-6", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/ai-client.ts",
                content: "export const apiKey = 'sk-proj-1234567890123456789012345678901234567890';",
              },
            },
          },
        ],
      },
    ],
    expectedKeyword: "secret",
    shouldBlock: true,
  },
  {
    id: "SCENARIO-7",
    name: "manifest/no-ghost-deps",
    description: "Agent imports package not in package.json (e.g. lodash)",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Add data formatting" }] },
      {
        info: { id: "asst-7", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/formatter.ts",
                content: "import lodash from 'lodash';\nexport function format(d) { return lodash.cloneDeep(d); }",
              },
            },
          },
        ],
      },
    ],
    expectedKeyword: "ghost",
    shouldBlock: true,
  },
  {
    id: "SCENARIO-8",
    name: "runtime/circuit-breaker",
    description: "Agent repeats identical failing bash command (exit code 1) 3 times in a row",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Start database" }] },
      {
        info: { id: "asst-8", role: "assistant" },
        parts: [
          {
            type: "tool",
            state: {
              status: "completed",
              output: "cat: /missing.txt: No such file or directory\n\n[exit code: 1]",
              metadata: { exit: 1, output: "cat: /missing.txt: No such file or directory\n\n[exit code: 1]" },
            },
          },
          {
            type: "tool",
            state: {
              status: "completed",
              output: "cat: /missing.txt: No such file or directory\n\n[exit code: 1]",
              metadata: { exit: 1, output: "cat: /missing.txt: No such file or directory\n\n[exit code: 1]" },
            },
          },
          {
            type: "tool",
            state: {
              status: "completed",
              output: "cat: /missing.txt: No such file or directory\n\n[exit code: 1]",
              metadata: { exit: 1, output: "cat: /missing.txt: No such file or directory\n\n[exit code: 1]" },
            },
          },
        ],
      },
    ],
    expectedKeyword: "circuit breaker",
    shouldBlock: true,
  },
  {
    id: "SCENARIO-9",
    name: "discipline/no-apology",
    description: "Agent uses sycophantic or excessive apology language (multilingual)",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Why did the build fail?" }] },
      {
        info: { id: "asst-9", role: "assistant" },
        parts: [
          {
            type: "text",
            text: "Çok özür dilerim, kusura bakmayın hata benden kaynaklandı. I am so sorry for the confusion.",
          },
        ],
      },
    ],
    expectedKeyword: "excessive apology",
    shouldBlock: true,
  },
  {
    id: "SCENARIO-10",
    name: "clean-turn (Clean Work Pass)",
    description: "High quality, legitimate turn with no violations passes freely",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Add logging message" }] },
      {
        info: { id: "asst-9", role: "assistant" },
        parts: [
          { type: "text", text: "I implemented the requested logger using chalk." },
          {
            type: "tool",
            state: {
              input: {
                filePath: "src/logger.ts",
                content: "import chalk from 'chalk';\nexport function logSuccess(msg) { console.log(chalk.green(msg)); }",
              },
            },
          },
        ],
      },
    ],
    expectedKeyword: null,
    shouldBlock: false,
  },
  {
    id: "SCENARIO-11",
    name: "loop-guard-continuation",
    description: "Remediation response from agent is never re-blocked",
    messages: [
      { info: { role: "user" }, parts: [{ type: "text", text: "Fix error" }] },
      {
        info: { id: "asst-10a", role: "assistant" },
        parts: [{ type: "text", text: "This is unrelated to this change." }],
      },
      {
        info: { id: "user-remediation", role: "user" },
        parts: [{ type: "text", text: "Dismissal language detected...", synthetic: true }],
      },
      {
        info: { id: "asst-10b", role: "assistant" },
        parts: [{ type: "text", text: "Understood. The evidence for the unrelated issue is git commit abc123." }],
      },
    ],
    expectedKeyword: null,
    shouldBlock: false,
  },
];

let totalPassed = 0;

for (const sc of SCENARIOS) {
  let promptSent = null;

  const mockClient = {
    session: {
      messages: async () => sc.messages,
      promptAsync: async ({ body }) => {
        promptSent = body.parts?.[0]?.text;
      },
    },
  };

  const hooks = await OpencodeGuard.server({
    client: mockClient,
    directory: sandboxDir,
  });

  await hooks.event({
    event: {
      type: "session.idle",
      properties: { sessionID: `test-${sc.id}` },
    },
  });

  const didBlock = Boolean(promptSent);

  if (sc.shouldBlock) {
    assert.equal(didBlock, true, `${sc.id} should have blocked but passed.`);
    assert.ok(
      promptSent.toLowerCase().includes(sc.expectedKeyword),
      `${sc.id} expected keyword '${sc.expectedKeyword}' in remediation prompt.`
    );
    console.log(`✔ [${sc.id}] ${sc.name.padEnd(25)} ➔ BLOCKED AS EXPECTED`);
    console.log(`    Detail: ${sc.description}`);
  } else {
    assert.equal(didBlock, false, `${sc.id} should have passed but was blocked.`);
    console.log(`✔ [${sc.id}] ${sc.name.padEnd(25)} ➔ PASSED AS EXPECTED (Zero False Positives)`);
    console.log(`    Detail: ${sc.description}`);
  }

  totalPassed++;
}

console.log("\n================================================================================");
console.log(`  ALL ${totalPassed}/${SCENARIOS.length} END-TO-END SCENARIOS VERIFIED SUCCESSFULLY!`);
console.log("================================================================================\n");
