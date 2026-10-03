import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Guardian, {
  guardianEventPath, readGuardianStatus, recordGuardianEvent,
  sessionFingerprint,
} from "../dist/index.js";

function isolated(t) {
  const original = process.env.OPENCODE_GUARDIAN_STATE_DIR;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-events-test-"));
  process.env.OPENCODE_GUARDIAN_STATE_DIR = dir;
  t.after(() => {
    if (original === undefined) delete process.env.OPENCODE_GUARDIAN_STATE_DIR;
    else process.env.OPENCODE_GUARDIAN_STATE_DIR = original;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}
function setupConfig(t, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-telemetry-config-"));
  fs.writeFileSync(path.join(dir, "opencode-guardian.json"), JSON.stringify(config));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const client = { session: {
  async messages() { return { data: [] }; },
  async promptAsync() {},
} };

test("JSONL events are restrictive, command-free, and have correct bounded counters", (t) => {
  isolated(t);
  assert.equal(readGuardianStatus().preflight, "unknown");
  recordGuardianEvent({ kind: "runtime-started", runtime: "v1", preflight: "active" });
  recordGuardianEvent({ kind: "preflight-allowed", tool: "bash", session: sessionFingerprint("private-session") });
  recordGuardianEvent({ kind: "preflight-blocked", tool: "bash", rules: ["destructive-command"] });
  recordGuardianEvent({ kind: "post-warning", rules: ["integrity/no-silent-failure"] });
  recordGuardianEvent({ kind: "post-remediation", rules: ["integrity/no-silent-failure"] });
  const file = guardianEventPath();
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
  const raw = fs.readFileSync(file, "utf8");
  assert.ok(!raw.includes("private-session"));
  assert.equal(raw.trim().split("\n").length, 5);
  assert.deepEqual(
    (({preflight, inspected, blocked, warnings, remediations, errors, truncated}) => ({preflight, inspected, blocked, warnings, remediations, errors, truncated}))(readGuardianStatus()),
    { preflight: "active", inspected: 2, blocked: 1, warnings: 1, remediations: 1, errors: 0, truncated: false },
  );
  assert.equal(readGuardianStatus(180).truncated, true);
});

test("V1 strict preflight writes checks and blocked reasons without command text", async (t) => {
  isolated(t);
  const directory = setupConfig(t, { enabled: true, preflight: { enabled: true } });
  const hooks = await Guardian.server({ directory, client });
  await hooks["tool.execute.before"]({ tool: "bash", sessionID: "secret-session" }, { args: { command: "npm test" } });
  await assert.rejects(hooks["tool.execute.before"]({ tool: "bash", sessionID: "secret-session" }, {
    args: { command: "rm -rf /ultra-private-file" },
  }), (error) => error.reason === "destructive-command");
  assert.deepEqual([readGuardianStatus().inspected, readGuardianStatus().blocked], [2, 1]);
  const log = fs.readFileSync(guardianEventPath(), "utf8");
  assert.ok(!log.includes("ultra-private-file") && !log.includes("secret-session"));
});

test("V1 default preflight is disabled and is not misrepresented as active", async (t) => {
  isolated(t);
  const hooks = await Guardian.server({ directory: setupConfig(t, { enabled: true }), client });
  assert.equal(hooks["tool.execute.before"], undefined);
  assert.equal(readGuardianStatus().preflight, "disabled");
});

test("V2 strict preflight records actual pre-execution decisions", async (t) => {
  isolated(t);
  const directory = setupConfig(t, { enabled: true, preflight: { enabled: true } });
  let before;
  const controller = { context: {
    location: { directory },
    event: { subscribe({ signal }) { return (async function* () {
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
    })(); } },
    session: { async context() { return []; }, async synthetic() {}, },
    tool: { async hook(name, fn) { assert.equal(name, "execute.before"); before = fn; return { dispose() {} }; } },
  } };
  const cleanup = await Guardian.setup(controller.context);
  try {
    assert.equal(readGuardianStatus().preflight, "active");
    await before({ tool: "bash", input: { command: "npm test" }, sessionID: "s" });
    assert.throws(() => before({ tool: "bash", input: { command: "git clean -fd" }, sessionID: "s" }),
      (error) => error.reason === "destructive-command");
    assert.equal(readGuardianStatus().blocked, 1);
  } finally {
    await cleanup();
  }
});
