import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Guardian from "../dist/index.js";
import { destructiveOperationsRule } from "../dist/rules/destructive-operations.js";

function configDir(t, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-security-audit-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "opencode-guardian.json"), JSON.stringify(config));
  return dir;
}
function inspect(request, command) {
  const currentTurn = [
    { info: { id: "human", role: "user" }, parts: [{ type: "text", text: request }] },
    { info: { id: "agent", role: "assistant" }, parts: [
      { type: "tool", tool: "bash", state: { input: { command }, status: "completed" } },
    ] },
  ];
  return destructiveOperationsRule.inspect({
    sessionID: "audit", directory: process.cwd(), messages: currentTurn,
    currentTurn, ruleConfig: {},
  }).decision;
}

test("V2 strict preflight never silently skips incomplete or invalid host setup", async (t) => {
  const dir = configDir(t, { enabled: true, preflight: { enabled: true } });
  const partial = { location: { directory: dir }, event: {}, session: {} };
  const invalidSubscription = {
    location: { directory: dir },
    event: { subscribe() { return null; } },
    session: { async context() { return []; }, async synthetic() {} },
  };
  const throwingSubscription = {
    ...invalidSubscription, event: { subscribe() { throw new Error("unavailable"); } },
  };
  for (const context of [partial, invalidSubscription, throwingSubscription]) {
    await assert.rejects(Guardian.setup(context), /preflight.*(unavailable|subscription)/i);
  }
});

test("V2 partial transition contexts remain tolerated unless strict preflight was requested", async (t) => {
  const dir = configDir(t, { enabled: true, preflight: { enabled: false } });
  assert.equal(await Guardian.setup({ location: { directory: dir }, event: {}, session: {} }), undefined);
  assert.equal(await Guardian.setup({ location: { directory: dir }, event: { subscribe() { return null; } }, session: {
    async context() { return []; }, async synthetic() {},
  } }), undefined);
});

test("a question or explanation request cannot authorize deletion of the mentioned target", () => {
  const questions = [
    "Should I delete src/cache?",
    "Can you explain how to delete src/cache?",
    "What happens if I delete src/cache?",
    "How can I remove src/cache?",
    "src/cache dosyasını silmeli miyim?",
    "src/cache dosyasını nasıl silerim?",
  ];
  for (const request of questions) {
    assert.equal(inspect(request, "rm src/cache"), "block", request);
    assert.equal(inspect(request, "rm -rf src/cache"), "block", request);
  }
});

test("explicit scoped deletion requests still pass post-turn authorization", () => {
  for (const request of ["Delete src/cache.", "Remove src/cache.", "src/cache dosyasını sil."]) {
    assert.equal(inspect(request, "rm src/cache"), "pass", request);
    assert.equal(inspect(request, "rm -rf src/cache"), "pass", request);
  }
  assert.equal(inspect("Can you delete src/cache?", "rm src/cache"), "pass");
  assert.equal(inspect("Please delete src/cache and explain the result.", "rm src/cache"), "pass");
  assert.equal(inspect("Delete src/cache.", "rm src/private"), "block");
});
