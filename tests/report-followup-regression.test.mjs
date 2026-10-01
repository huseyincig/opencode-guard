import test from "node:test";
import assert from "node:assert/strict";
import { collectTurnEvidence } from "../dist/evidence.js";
import { extractTaskContract, hasPostMutationReview } from "../dist/task-contract.js";
import { sanitizeUserInstruction } from "../dist/locale-intents.js";
import { taskCompletionRule } from "../dist/rules/task-completion.js";

const repeatedReview = "Fix every bug, then restart the full source review until no bugs remain.";

function human(text = repeatedReview) {
  return { info: { id: "human", role: "user" }, parts: [{ type: "text", text }] };
}

function action(tool, output = "export const fixed = true;", status = "completed") {
  return {
    type: "tool", tool, state: {
      status,
      input: { filePath: "src/item.ts" }, output,
      metadata: { exit: status === "completed" ? 0 : 1 },
    },
  };
}

function turn(tool, output, status = "completed") {
  return [human(), { info: { id: "agent", role: "assistant" }, parts: [
    { type: "tool", tool: "write", state: {
      status: "completed", input: { filePath: "src/item.ts", content: "export const fixed = true;" },
      metadata: { exit: 0 },
    } },
    action(tool, output, status),
    { type: "text", text: "The review is complete." },
  ] }];
}

test("successful read_file and view_file are post-change source-review evidence", () => {
  for (const tool of ["read_file", "view_file", "file.read", "read-file", "file:view"]) {
    const messages = turn(tool, "export const fixed = true;");
    const evidence = collectTurnEvidence(messages);
    assert.equal(hasPostMutationReview(evidence, true), true, tool);
    const completion = taskCompletionRule.inspect({
      sessionID: "review-" + tool, directory: process.cwd(),
      messages, currentTurn: messages, evidence, ruleConfig: {},
    });
    assert.equal(completion.decision, "pass", tool);
  }
});

test("file_search with only file names is not proof of source reinspection", () => {
  const messages = turn("file_search", "src/item.ts\nsrc/other.ts");
  const evidence = collectTurnEvidence(messages);
  assert.equal(hasPostMutationReview(evidence, true), false);
  assert.equal(taskCompletionRule.inspect({
    sessionID: "review-search", directory: process.cwd(),
    messages, currentTurn: messages, evidence, ruleConfig: {},
  }).decision, "block");
});

test("failed, empty and pre-change reads do not prove a fresh review", () => {
  for (const [output, status] of [["", "completed"], ["permission denied", "error"]]) {
    const evidence = collectTurnEvidence(turn("read_file", output, status));
    assert.equal(hasPostMutationReview(evidence, true), false);
  }
  const messages = [human(), { info: { id: "agent", role: "assistant" }, parts: [
    action("read_file", "const oldVersion = true;"),
    { type: "tool", tool: "write", state: {
      status: "completed", input: { filePath: "src/item.ts", content: "const newVersion = true;" },
      metadata: { exit: 0 },
    } },
  ] }];
  assert.equal(hasPostMutationReview(collectTurnEvidence(messages), true), false);
});

test("quoted examples longer than 300 characters do not become user instructions", () => {
  const request = "Cada vez que encuentres un error, corrígelo y vuelve a revisar todo desde el principio hasta que no queden errores.";
  for (const [open, close] of [["\"", "\""], ["“", "”"], ["«", "»"], ["「", "」"], ["『", "』"]]) {
    const example = `${open}${"example ".repeat(60)}${request}${close}`;
    assert.equal(sanitizeUserInstruction(example).trim(), "", open);
    assert.equal(extractTaskContract([human("Explain this example: " + example)]).iterativeReview, false, open);
  }
});

test("quoted examples do not hide an explicit unquoted instruction that follows", () => {
  const quoted = `“${"example ".repeat(60)}${repeatedReview}”`;
  const task = extractTaskContract([human("Explain: " + quoted + "\n" + repeatedReview)]);
  assert.equal(task.iterativeReview, true);
});

test("name-only globs, finds, searches and git diff stats are not source-review evidence", () => {
  for (const [tool, input, output] of [
    ["glob", { pattern: "src/**/*.ts" }, "src/index.ts\nsrc/item.ts"],
    ["find", { pattern: "src/*" }, "src/index.ts\nsrc/item.ts"],
    ["file_search", { query: "feature" }, "src/index.ts\nsrc/item.ts"],
    ["bash", { command: "git diff --stat" }, " src/item.ts | 5 +++--"],
    ["bash", { command: "rg -n not_found src" }, "No matches"],
  ]) {
    const messages = [human(), { info: { id: "agent", role: "assistant" }, parts: [
      { type: "tool", tool: "write", state: {
        status: "completed", input: { filePath: "src/item.ts", content: "export const fixed = true;" },
        metadata: { exit: 0 },
      } },
      { type: "tool", tool, state: { status: "completed", input, output, metadata: { exit: 0 } } },
    ] }];
    assert.equal(hasPostMutationReview(collectTurnEvidence(messages), true), false, JSON.stringify(input));
  }
});

test("real grep matches and source diffs provide post-change inspection evidence", () => {
  for (const [command, output] of [
    ["rg -n fixed src/item.ts", "src/item.ts:1:export const fixed = true;"],
    ["git diff src/item.ts", "diff --git a/src/item.ts b/src/item.ts\n@@ -1 +1 @@\n-export const fixed = false;\n+export const fixed = true;"],
    ["git show HEAD:src/item.ts", "export const fixed = true;"],
    ["sed -n '1,30p' src/item.ts", "export const fixed = true;"],
  ]) {
    const messages = [human(), { info: { id: "agent", role: "assistant" }, parts: [
      { type: "tool", tool: "write", state: {
        status: "completed", input: { filePath: "src/item.ts", content: "export const fixed = true;" },
        metadata: { exit: 0 },
      } },
      { type: "tool", tool: "bash", state: {
        status: "completed", input: { command }, output, metadata: { exit: 0 },
      } },
    ] }];
    assert.equal(hasPostMutationReview(collectTurnEvidence(messages), true), true, command);
  }
});
