import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePreflight } from "../dist/preflight.js";
import { isDestructiveCommand } from "../dist/evidence.js";
import { destructiveOperationsRule } from "../dist/rules/destructive-operations.js";
const tick = String.fromCharCode(96);

function inspect(request, command) {
  const currentTurn = [
    { info: { id: "human", role: "user" }, parts: [{ type: "text", text: request }] },
    { info: { id: "assistant", role: "assistant" }, parts: [
      { type: "tool", tool: "bash", state: { status: "completed", input: { command } } },
    ] },
  ];
  return destructiveOperationsRule.inspect({
    sessionID: "security-gap", directory: process.cwd(), messages: currentTurn,
    currentTurn, ruleConfig: {},
  });
}

test("backtick command substitution is recognized without executing any input", () => {
  const risky = [
    tick + "rm -rf fixture" + tick,
    "echo " + tick + "rm -rf fixture" + tick,
    'echo "' + tick + 'rm -rf fixture' + tick + '"',
    "echo " + tick + "git clean -fd" + tick,
    "echo " + tick + "find fixture -delete" + tick,
    "echo " + tick + "echo $(rm -rf fixture)" + tick,
  ];
  for (const command of risky) {
    assert.equal(isDestructiveCommand(command), true, command);
    assert.equal(evaluatePreflight("bash", { command }), "destructive-command", command);
    assert.equal(inspect("Inspect fixture, do not delete.", command).decision, "block", command);
  }
});

test("inert quoted, escaped and incomplete backticks do not cause false alarms", () => {
  const safe = [
    "echo '" + tick + "rm -rf fixture" + tick + "'",
    "grep '" + tick + "rm -rf fixture" + tick + "' README.md",
    "echo \\" + tick + "rm -rf fixture\\" + tick,
    "echo 'some " + tick + "find fixture -delete" + tick + " example'",
    "echo " + tick + "printf safe" + tick,
    "echo '" + tick + "rm -rf fixture" + tick,
  ];
  for (const command of safe) {
    assert.equal(isDestructiveCommand(command), false, command);
    assert.equal(evaluatePreflight("bash", { command }), undefined, command);
  }
});

test("simple file removal checks authorization without flagging harmless text", () => {
  for (const command of ["rm src/private.ts", "rm -f src/private.ts", "sudo rm src/private.ts"]) {
    assert.equal(inspect("Delete only src/obsolete.ts.", command).decision, "block", command);
    assert.equal(evaluatePreflight("bash", { command }), "destructive-command", command);
  }
  assert.equal(inspect("Delete src/obsolete.ts.", "rm src/obsolete.ts").decision, "pass");
  assert.equal(inspect("Please run rm src/obsolete.ts", "rm src/obsolete.ts").decision, "pass");
  assert.equal(inspect("Delete src/obsolete.ts.", "rm src/obsolete.ts src/private.ts").decision, "block");
  for (const command of [
    "echo 'rm src/private.ts'", "grep 'rm src/private.ts' README.md",
    "rm --help", "npm test",
  ]) {
    assert.equal(evaluatePreflight("bash", { command }), undefined, command);
  }
});
