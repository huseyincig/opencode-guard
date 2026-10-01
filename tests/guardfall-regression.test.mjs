import test from "node:test";
import assert from "node:assert/strict";
import * as evidence from "../dist/evidence.js";
const { collectTurnEvidence, isDestructiveCommand } = evidence;
const isOpaqueShellExecution = evidence.isOpaqueShellExecution ?? (() => false);
import { destructiveOperationsRule } from "../dist/rules/destructive-operations.js";
import { GuardEngine } from "../dist/engine.js";
import { latestMutationSequence } from "../dist/task-contract.js";

function context(command, request = "Inspect the project without deleting files.") {
  const currentTurn = [
    { info: { id: "user", role: "user" }, parts: [{ type: "text", text: request }] },
    { info: { id: "assistant", role: "assistant" }, parts: [{
      type: "tool", tool: "bash", state: {
        status: "completed", input: { command }, metadata: { exit: 0 },
      },
    }] },
  ];
  return {
    sessionID: "guardfall", directory: process.cwd(), messages: currentTurn,
    currentTurn, ruleConfig: {}, evidence: collectTurnEvidence(currentTurn),
  };
}

const dangerous = [
  ["quote removal", "r''m -rf sandbox/marker"],
  ["double quote removal", 'r""m -rf sandbox/marker'],
  ["quoted git subcommand", "git c''lean -fd"],
  ["IFS git arguments", "git${IFS}clean${IFS}-fd"],
  ["escaped command name", "r\\m -rf sandbox/marker"],
  ["IFS expansion", "rm$IFS-rf$IFS./sandbox/marker"],
  ["braced IFS expansion", "rm${IFS}-rf${IFS}./sandbox/marker"],
  ["literal command substitution", "$(printf rm) -rf sandbox/marker"],
  ["nested substitution in double quotes", 'echo "$(rm -rf sandbox/marker)"'],
  ["literal shell script argument", "sh -c 'rm -rf sandbox/marker'"],
  ["find delete", "find sandbox/marker -delete"],
  ["find exec removal", "find sandbox -exec rm -rf {} +"],
];

test("GuardFall literal destructive forms are recognized without execution", () => {
  for (const [name, command] of dangerous) {
    assert.equal(isDestructiveCommand(command), true, name);
    const ctx = context(command);
    assert.ok(ctx.evidence.records.some((record) => record.kind === "destructive-operation"), name);
    const result = destructiveOperationsRule.inspect(ctx);
    assert.equal(result.decision, "block", name);
    assert.equal(result.findings.length, 1, name);
  }
});

test("GuardFall file-deleting shell forms invalidate stale verification", () => {
  for (const [name, command] of dangerous) {
    const ctx = context(command);
    ctx.currentTurn[1].parts.unshift({
      type: "tool", tool: "bash", state: {
        status: "completed", input: { command: "npm test" }, metadata: { exit: 0 },
      },
    });
    ctx.evidence = collectTurnEvidence(ctx.currentTurn);
    const testRecord = ctx.evidence.records.find((record) => record.kind === "test");
    assert.ok(testRecord, name);
    assert.ok(ctx.evidence.fileMutations.length > 0, name);
    assert.ok(latestMutationSequence(ctx.evidence) > testRecord.sequence, name);
  }
});

test("opaque decoded pipelines are warned about, not mislabeled as proven deletion", () => {
  for (const command of [
    "printf YWJj | base64 -d | sh",
    "printf YWJj | base64 --decode | bash",
  ]) {
    assert.equal(isOpaqueShellExecution(command), true, command);
    assert.equal(isDestructiveCommand(command), false, command);
    const ctx = context(command);
    const result = destructiveOperationsRule.inspect(ctx);
    assert.equal(result.decision, "block", command);
    assert.equal(result.findings[0].pattern, "opaque shell execution", command);
    assert.equal(result.findings[0].confidence, "medium", command);
    assert.equal(ctx.evidence.fileMutations.length, 0, command);
  }
});

test("legitimate read-only commands and descriptions do not raise GuardFall findings", () => {
  for (const command of [
    "echo 'rm -rf sandbox/marker'",
    "echo 'text; r''m -rf sandbox/marker'",
    "echo 'safe; find sandbox/marker -delete'",
    "echo 'printf YWJj | base64 -d | sh'",
    "echo 'safe; git clean -fd'",
    "echo 'safe; git reset --hard HEAD'",
    "echo '$(printf rm) -rf sandbox/marker'",
    "printf 'rm -rf sandbox/marker\\n'",
    "grep 'rm -rf' README.md",
    "git clean -nfd",
    "git diff --stat",
    "find sandbox -print",
    "printf YWJj | base64 -d",
    "printf YWJj | shasum",
  ]) {
    assert.equal(isDestructiveCommand(command), false, command);
    assert.equal(isOpaqueShellExecution(command), false, command);
    const ctx = context(command);
    assert.equal(destructiveOperationsRule.inspect(ctx).decision, "pass", command);
    assert.equal(ctx.evidence.fileMutations.length, 0, command);
  }
});

test("no broad user consent is inferred for obfuscated deletion", () => {
  const ctx = context("r''m -rf sandbox/marker", "Delete only src/obsolete.ts.");
  assert.equal(destructiveOperationsRule.inspect(ctx).decision, "block");
});

test("an exact literal find deletion request remains authorized", () => {
  const command = "find sandbox/marker -delete";
  assert.equal(destructiveOperationsRule.inspect(context(command, command)).decision, "pass");
  assert.equal(destructiveOperationsRule.inspect(context(command, "Delete sandbox/other.")).decision, "block");
});

test("destructive and opaque activity remains advisory at default warn severity", async () => {
  const engine = new GuardEngine();
  for (const command of ["r''m -rf sandbox/marker", "printf YWJj | base64 -d | sh"]) {
    const ctx = context(command);
    const result = await engine.inspect(command, process.cwd(), ctx.currentTurn);
    assert.equal(result.decision, "pass", command);
    assert.equal(result.combinedRemediationPrompt, undefined, command);
    assert.equal(result.results.find((finding) => finding.ruleId === "safety/destructive-operations")?.decision, "block", command);
  }
});
