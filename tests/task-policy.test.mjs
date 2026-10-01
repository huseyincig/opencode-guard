import test from "node:test";
import assert from "node:assert/strict";
import { extractTaskContract } from "../dist/task-contract.js";
import { collectTurnEvidence } from "../dist/evidence.js";
import { evaluateTaskPolicy } from "../dist/task-policy.js";

function messages(user, parts) {
  return [
    { info: { id: "user", role: "user" }, parts: [{ type: "text", text: user }] },
    { info: { id: "agent", role: "assistant" }, parts },
  ];
}

const write = { type: "tool", tool: "write", state: {
  status: "completed", input: { filePath: "src/index.ts", content: "export const ok = true;" },
  metadata: { exit: 0 },
} };
const successfulRead = { type: "tool", tool: "read", state: {
  status: "completed", input: { filePath: "src/index.ts" },
  output: "export const ok = true;", metadata: { exit: 0 },
} };
const goodTests = { type: "tool", tool: "bash", state: {
  status: "completed", input: { command: "npm test" },
  output: "150 passed", metadata: { exit: 0 },
} };
const failedTests = { type: "tool", tool: "bash", state: {
  status: "completed", input: { command: "npm test" },
  output: "1 failed", metadata: { exit: 1 },
} };

function evaluate(user, parts) {
  const history = messages(user, parts);
  return evaluateTaskPolicy(extractTaskContract(history), collectTurnEvidence(history));
}

test("the same normalized policy works for Turkish, Spanish, Chinese and Arabic tasks", () => {
  const prompts = [
    "Her hata bulduğunda düzelt ve incelemeyi baştan başlat.",
    "Cada vez que encuentres un error, corrígelo y vuelve a revisar todo desde el principio hasta que no queden errores.",
    "每发现一个错误就修复，然后从头重新检查，直到没有错误。",
    "كلما وجدت خطأ أصلحه ثم أعد المراجعة من البداية حتى لا تبقى أخطاء.",
  ];
  for (const prompt of prompts) {
    const missed = evaluate(prompt, [write]);
    assert.equal(missed.review, "missing", prompt);
    assert.equal(missed.reviewProvesFullCoverage, false);
    const reviewed = evaluate(prompt, [write, successfulRead]);
    assert.equal(reviewed.review, "observed", prompt);
    assert.equal(reviewed.reviewProvesFullCoverage, false);
  }
});

test("policy requires an actual source check when that is what the user requested", () => {
  const sourceLoop = "Fix every bug and restart the full source review until no bugs remain.";
  assert.equal(evaluate(sourceLoop, [write, goodTests]).review, "missing");
  assert.equal(evaluate(sourceLoop, [write, goodTests, successfulRead]).review, "observed");
});

test("policy accepts a fresh successful test-only loop without inventing full source coverage", () => {
  const testLoop = "Fix failures and rerun tests until clean.";
  const result = evaluate(testLoop, [write, goodTests]);
  assert.equal(result.review, "observed");
  assert.equal(result.reviewProvesFullCoverage, false);
});

test("policy differentiates failed, stale and unknown verification evidence", () => {
  const request = "Fix the implementation and run tests.";
  assert.equal(evaluate(request, [write, failedTests]).verifications[0].status, "failed");
  assert.equal(evaluate(request, [goodTests, write]).verifications[0].status, "unknown");
  assert.equal(evaluate(request, [write]).verifications[0].status, "unknown");
  assert.equal(evaluate(request, [write, goodTests]).verifications[0].status, "passed");
});

test("an unknown verification outcome is not silently accepted as success", () => {
  const task = "Run tests.";
  const outcomeUnknown = { ...goodTests, state: { ...goodTests.state, metadata: {} } };
  const result = evaluate(task, [outcomeUnknown]);
  assert.equal(result.verifications[0].status, "unknown");
});
