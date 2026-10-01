import test from "node:test";
import assert from "node:assert/strict";
import { collectTurnEvidence } from "../dist/evidence.js";
import { hasPostMutationReview } from "../dist/task-contract.js";
import { taskCompletionRule } from "../dist/rules/task-completion.js";

const human = { info: { id: "human", role: "user" }, parts: [
  { type: "text", text: "Fix every bug, then restart the full source review until no bugs remain." },
] };

function afterMutation(command, output) {
  const messages = [human, { info: { id: "assistant", role: "assistant" }, parts: [
    { type: "tool", tool: "write", state: {
      status: "completed", input: { filePath: "src/item.ts", content: "export const fixed = true;" },
      metadata: { exit: 0 },
    } },
    { type: "tool", tool: "bash", state: {
      status: "completed", input: { command }, output, metadata: { exit: 0 },
    } },
    { type: "text", text: "The full review is complete." },
  ] }];
  return { messages, evidence: collectTurnEvidence(messages) };
}

test("shell text output and filename-only pipelines cannot fabricate source review", () => {
  for (const [command, output] of [
    ["echo cat", "cat"],
    ['echo "sed -n"', "sed -n"],
    ["git diff --stat | cat", " src/item.ts | 2 +--"],
    ["git diff --stat && echo cat", " src/item.ts | 2 +--\ncat"],
    ["echo 'git show HEAD:src/item.ts'", "export const fixed = true;"],
    ["echo 'rg -n fixed src/item.ts'", "src/item.ts:1:export const fixed = true;"],
    ["rg -n --column fixed src/item.ts", "src/item.ts:1:14:"],
  ]) {
    const { messages, evidence } = afterMutation(command, output);
    assert.equal(hasPostMutationReview(evidence, true), false, command);
    assert.equal(taskCompletionRule.inspect({
      sessionID: "invalid-review", directory: process.cwd(), messages,
      currentTurn: messages, evidence, ruleConfig: {},
    }).decision, "block", command);
  }
});

test("actual file reads, line-bearing searches and source diffs remain accepted", () => {
  for (const [command, output] of [
    ["cat src/item.ts", "export const fixed = true;"],
    ["cd src && cat item.ts", "export const fixed = true;"],
    ["sed -n '1,5p' src/item.ts", "export const fixed = true;"],
    ["git show HEAD:src/item.ts", "export const fixed = true;"],
    ["rg -n fixed src/item.ts", "src/item.ts:1:export const fixed = true;"],
    ["git diff src/item.ts", "diff --git a/src/item.ts b/src/item.ts\n-export const fixed = false;\n+export const fixed = true;"],
  ]) {
    assert.equal(hasPostMutationReview(afterMutation(command, output).evidence, true), true, command);
  }
});

test("Windows drive-letter paths with source lines are review evidence", () => {
  const command = "rg -n fixed src/item.ts";
  for (const output of [
    String.raw`C:\repo\src\item.ts:1:export const fixed = true;`,
    String.raw`C:\repo\src\item.ts:1:14:export const fixed = true;`,
  ]) {
    const { messages, evidence } = afterMutation(command, output);
    assert.equal(hasPostMutationReview(evidence, true), true, output);
    assert.equal(taskCompletionRule.inspect({
      sessionID: "windows-review", directory: process.cwd(), messages,
      currentTurn: messages, evidence, ruleConfig: {},
    }).decision, "pass", output);
  }
  assert.equal(hasPostMutationReview(afterMutation(command, String.raw`C:\repo\src\item.ts`).evidence, true), false);
});
