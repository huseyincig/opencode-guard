import test from "node:test";
import assert from "node:assert/strict";
import { parseExplicitTaskDirective, extractTaskContract, taskGuidance } from "../dist/task-contract.js";
import { collectTurnEvidence } from "../dist/evidence.js";
import { evaluateTaskPolicy } from "../dist/task-policy.js";

const PREFIX = '@guardian-task {"mode":"iterative-review","review":"source","verify":["test"]}';

function contract(text) {
  return extractTaskContract([{
    info: { id: "human", role: "user" },
    parts: [{ type: "text", text }],
  }]);
}

test("optional typed directive makes an otherwise unsupported language deterministic", () => {
  const greek = `${PREFIX}\nΒρες και διόρθωσε τα λάθη. Ξεκίνα την ανασκόπηση από την αρχή μετά από κάθε διόρθωση.`;
  const task = contract(greek);
  assert.equal(task.signalLocale, "structured");
  assert.equal(task.iterativeReview, true);
  assert.equal(task.requiresSourceReview, true);
  assert.deepEqual(task.requiredVerifications, ["test"]);
  assert.match(taskGuidance(task), /another review pass/);
  const evidence = collectTurnEvidence([
    { info: { id: "u", role: "user" }, parts: [{ type: "text", text: greek }] },
    { info: { id: "a", role: "assistant" }, parts: [
      { type: "tool", tool: "write", state: {
        status: "completed", input: { filePath: "src/code.ts", content: "export const ok = 1;" },
        metadata: { exit: 0 },
      } },
    ] },
  ]);
  const decision = evaluateTaskPolicy(task, evidence);
  assert.equal(decision.review, "missing");
  assert.equal(decision.verifications[0].status, "unknown");
});

test("typed directive supports a deliberate one-pass instruction without an inferred loop", () => {
  const task = contract(
    '@guardian-task {"mode":"one-pass","review":"checks","verify":["lint","test"]}\n' +
    "Review and repeat until clean (this line is a quoted example)."
  );
  assert.equal(task.iterativeReview, false);
  assert.deepEqual(task.requiredVerifications, ["lint", "test"]);
});

test("a recognized explicit prohibition in the body overrides a conflicting directive", () => {
  for (const text of [
    `${PREFIX}\nDo not repeat the review. Do not run tests.`,
    `${PREFIX}\nİncelemeyi tekrar başlatma, testleri çalıştırma.`,
    `${PREFIX}\n不要重复检查。不要运行测试。`,
    `${PREFIX}\n不要重复检查。Do not run tests.`,
  ]) {
    const task = contract(text);
    assert.equal(task.iterativeReview, false, text);
    assert.deepEqual(task.requiredVerifications, [], text);
  }
});

test("malformed and unexpected-key directives cannot silently enable policy", () => {
  const invalid = [
    '@guardian-task {"mode":"iterative-review","review":"source","verify":',
    '@guardian-task {"mode":"iterative-review","review":"source","verify":[],"publish":true}',
    '@guardian-task {"mode":"infinite","review":"source","verify":[]}',
    '@guardian-task {"mode":"iterative-review","review":"source","verify":["release"]}',
    '@guardian-task {"mode":"iterative-review","review":"source","verify":"test"}',
    '@guardian-task ' + 'x'.repeat(900),
    '\n@guardian-task {"mode":"iterative-review","review":"source","verify":[]}',
  ];
  for (const input of invalid) {
    assert.equal(parseExplicitTaskDirective(input), undefined, input.slice(0, 90));
  }
});

test("duplicate verification kinds in structured directives are deduplicated", () => {
  const task = contract('@guardian-task {"mode":"iterative-review","review":"checks","verify":["test","test","lint"]}');
  assert.deepEqual(task.requiredVerifications, ["test", "lint"]);
  assert.equal(task.requiresSourceReview, false);
});
