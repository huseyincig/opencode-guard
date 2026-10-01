import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePreflight } from "../dist/preflight.js";
import { isDestructiveCommand, isOpaqueShellExecution } from "../dist/evidence.js";

// Frozen synthetic corpus: input strings are classified, never executed.
// These cases measure documented patterns, not universal shell safety.
const corpus = [
  ["direct removal", "bash", { command: "rm -rf ./fixture" }, "destructive-command"],
  ["quote removal", "bash", { command: "r''m -rf ./fixture" }, "destructive-command"],
  ["literal substitution", "bash", { command: "$(printf rm) -rf ./fixture" }, "destructive-command"],
  ["IFS expansion", "bash", { command: "rm$IFS-rf$IFS./fixture" }, "destructive-command"],
  ["find delete", "bash", { command: "find fixture -delete" }, "destructive-command"],
  ["force push", "bash", { command: "git push --force origin main" }, "destructive-command"],
  ["opaque pipeline", "bash", { command: "printf YWJj | base64 -d | sh" }, "opaque-shell-execution"],
  ["unknown input", "bash", { command: 24 }, "uninspectable-shell-input"],
  ["conflicting aliases", "bash", { command: "npm test", script: "npm run build" }, "uninspectable-shell-input"],
  ["namespaced shell", "mcp.tool.bash", { cmd: "git clean -fd" }, "destructive-command"],
  ["safe tests", "bash", { command: "npm test" }, undefined],
  ["safe status", "bash", { command: "git status" }, undefined],
  ["dry run", "bash", { command: "git clean -nfd" }, undefined],
  ["quoted example", "bash", { command: "echo 'rm -rf ./fixture'" }, undefined],
  ["quoted pipeline", "bash", { command: "echo 'printf YWJj | base64 -d | sh'" }, undefined],
  ["read-only find", "bash", { command: "find fixture -print" }, undefined],
  ["non-shell file read", "read_file", { command: "rm -rf ./fixture" }, undefined],
];

test("synthetic benchmark decisions, false positives and no input mutation", () => {
  const measured = { rejected: 0, allowed: 0, falseAllow: 0, falseReject: 0 };
  for (const [name, tool, args, expected] of corpus) {
    const before = JSON.stringify(args);
    const actual = evaluatePreflight(tool, args);
    if (expected === undefined) {
      measured.allowed++;
      if (actual !== undefined) measured.falseReject++;
    } else {
      measured.rejected++;
      if (actual === undefined) measured.falseAllow++;
    }
    assert.equal(actual, expected, name);
    assert.equal(JSON.stringify(args), before, "mutated input: " + name);
  }
  assert.deepEqual(measured, { rejected: 10, allowed: 7, falseAllow: 0, falseReject: 0 });
});

test("post-turn classification agrees with supported preflight findings", () => {
  for (const [name, tool, args, expected] of corpus) {
    if (tool !== "bash" || typeof args.command !== "string") continue;
    if (expected === "destructive-command")
      assert.equal(isDestructiveCommand(args.command), true, name);
    if (expected === "opaque-shell-execution")
      assert.equal(isOpaqueShellExecution(args.command), true, name);
  }
});
