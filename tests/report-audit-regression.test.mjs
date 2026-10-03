import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GuardEngine, BUILTIN_RULES } from "../dist/engine.js";
import { noGhostDepsRule, clearDeclaredDepsCache } from "../dist/rules/no-ghost-deps.js";
import { noSilentFailureRule } from "../dist/rules/no-silent-failure.js";
import { noApologyRule } from "../dist/rules/no-apology.js";
import { collectTurnEvidence } from "../dist/evidence.js";
import { latestMutationSequence } from "../dist/task-contract.js";

function context(parts, response = "") {
  const currentTurn = [
    { info: { id: "audit-human", role: "user" }, parts: [{ type: "text", text: "Check this." }] },
    { info: { id: "audit-agent", role: "assistant" }, parts: [
      ...parts,
      ...(response ? [{ type: "text", text: response }] : []),
    ] },
  ];
  return {
    sessionID: "report-regression", directory: process.cwd(), messages: currentTurn,
    currentTurn, ruleConfig: {}, evidence: collectTurnEvidence(currentTurn),
  };
}

function tool(input, toolName = "write", output = "") {
  return { type: "tool", tool: toolName, state: {
    status: "completed", input, output, metadata: { exit: 0 },
  } };
}

test("Python distributions only authorize exact imports or known aliases, not matching prefixes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-dep-boundary-"));
  try {
    fs.writeFileSync(path.join(root, "pyproject.toml"),
      '[project]\ndependencies = ["requests-oauthlib", "python-dateutil"]\n');
    clearDeclaredDepsCache();
    const ctx = context([tool({
      path: path.join(root, "app.py"), content: "import requests\nimport python\nimport dateutil\n",
    })]);
    ctx.directory = root;
    const result = noGhostDepsRule.inspect({
      ...ctx, ruleConfig: { blockPythonGhostDeps: true },
    });
    assert.equal(result.decision, "block");
    assert.deepEqual(result.findings.map((f) => f.pattern).sort(), ["python", "requests"]);
  } finally {
    clearDeclaredDepsCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("VCS requirement URLs cannot create a fake 'git' distribution", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-vcs-boundary-"));
  try {
    fs.writeFileSync(path.join(root, "requirements.txt"),
      "git+https://example.invalid/org/package.git@v1#egg=package\n");
    clearDeclaredDepsCache();
    const ctx = context([tool({ path: path.join(root, "app.py"), content: "import git\n" })]);
    ctx.directory = root;
    const result = noGhostDepsRule.inspect({
      ...ctx, ruleConfig: { blockPythonGhostDeps: true },
    });
    assert.equal(result.decision, "block");
    assert.equal(result.findings[0].pattern, "git");
  } finally {
    clearDeclaredDepsCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("JavaScript named and default dollar imports retain dependency boundaries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-js-dollar-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"),
      JSON.stringify({ dependencies: { jquery: "1.0.0" } }));
    clearDeclaredDepsCache();
    const ctx = context([tool({
      path: path.join(root, "app.js"),
      content: [
        'import $ from "jquery";',
        'import { $ } from "missing-named";',
        'import $other from "missing-default";',
        'export { $ } from "missing-export";',
      ].join("\n"),
    })]);
    ctx.directory = root;
    const result = noGhostDepsRule.inspect(ctx);
    assert.equal(result.decision, "block");
    assert.deepEqual(result.findings.map((f) => f.pattern).sort(),
      ["missing-default", "missing-export", "missing-named"]);
  } finally {
    clearDeclaredDepsCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Python typed, tuple, aliased exceptions swallowing errors are detected", () => {
  for (const snippet of [
    "try:\n    work()\nexcept (OSError, ValueError) as e:\n    pass\n",
    "try:\n    work()\nexcept ValueError:\n    pass\n",
    "try:\n    work()\nexcept thirdparty.SomeError as e:\n    # this is a comment\n    pass\n",
  ]) {
    const result = noSilentFailureRule.inspect(context([tool({
      path: "src/work.py", content: snippet,
    })]));
    assert.equal(result.findings.length, 1, snippet);
    assert.equal(result.findings[0].pattern, "Python except: pass");
  }
  const legitimate = noSilentFailureRule.inspect(context([tool({
    path: "src/work.py", content: "try:\n    work()\nexcept ValueError:\n    log_error()\n",
  })]));
  assert.equal(legitimate.findings.length, 0);
});

test("reported apology terms are ignored across languages without hiding a later real apology", () => {
  for (const phrase of [
    "The response contained entschuldigung as an error message.",
    "The output text is désolé.",
    "The payload returned özür dilerim.",
    "The message contains disculpas as a quoted token.",
  ]) {
    assert.equal(noApologyRule.inspect(context([], phrase)).findings.length, 0, phrase);
  }
  const actual = noApologyRule.inspect(context([],
    "The response contained entschuldigung as an error message. Entschuldigung, I made a mistake."));
  assert.ok(actual.findings.some((finding) => finding.pattern === "German"));
});

test("deletion commands and explicit delete actions invalidate earlier verification", () => {
  const successfulTest = tool({ command: "npm test" }, "bash", "267 passed");
  const cases = [
    tool({ action: "delete", path: "src/a.ts" }, "file"),
    tool({ action: "remove", path: "src/a.ts" }, "file"),
    tool({ command: "rm -f src/a.ts" }, "bash"),
    tool({ command: "unlink src/a.ts" }, "bash"),
    tool({ command: "git clean -fd" }, "bash"),
    tool({ command: "git reset --hard HEAD" }, "bash"),
  ];
  for (const deletion of cases) {
    const evidence = collectTurnEvidence(context([successfulTest, deletion]).currentTurn);
    assert.ok(evidence.fileMutations.length >= 1, JSON.stringify(deletion.state.input));
    assert.ok(latestMutationSequence(evidence) > evidence.successfulVerifications[0].sequence);
  }
  for (const harmless of [
    tool({ command: "git clean -nfd" }, "bash"),
    tool({ command: "rm --help" }, "bash"),
  ]) {
    assert.equal(collectTurnEvidence(context([harmless]).currentTurn).fileMutations.length, 0);
  }
});

test("a failed delete does not masquerade as a successful file change", () => {
  const deletion = tool({ action: "delete", path: "src/a.ts" }, "file");
  deletion.state.status = "error";
  deletion.state.metadata.exit = 1;
  const evidence = collectTurnEvidence(context([deletion]).currentTurn);
  assert.equal(evidence.fileMutations.length, 1);
  assert.equal(latestMutationSequence(evidence), -1);
});

test("PEP 420 namespace packages under project root and src are local without __init__.py", () => {
  for (const prefix of ["", "src"]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-pep420-"));
    try {
      fs.writeFileSync(path.join(root, "pyproject.toml"),
        '[project]\ndependencies = []\n');
      const moduleDirectory = path.join(root, prefix, "mypkg");
      fs.mkdirSync(moduleDirectory, { recursive: true });
      fs.writeFileSync(path.join(moduleDirectory, "foo.py"), "answer = 42\n");
      assert.equal(fs.existsSync(path.join(moduleDirectory, "__init__.py")), false);
      clearDeclaredDepsCache();

      const present = context([tool({
        path: path.join(root, prefix, "app.py"),
        content: "import mypkg\nfrom mypkg.foo import answer\n",
      })]);
      present.directory = root;
      const found = noGhostDepsRule.inspect({
        ...present, ruleConfig: { blockPythonGhostDeps: true },
      });
      assert.equal(found.decision, "pass", prefix);
      assert.equal(found.findings.length, 0, prefix);

      const missing = context([tool({
        path: path.join(root, prefix, "app.py"),
        content: "import missing_external\n",
      })]);
      missing.directory = root;
      const absent = noGhostDepsRule.inspect({
        ...missing, ruleConfig: { blockPythonGhostDeps: true },
      });
      assert.equal(absent.decision, "block");
      assert.equal(absent.findings[0].pattern, "missing-external");
    } finally {
      clearDeclaredDepsCache();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("PEP 508 extras in PEP 621 TOML arrays do not truncate later dependencies", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-pep508-"));
  try {
    fs.writeFileSync(path.join(root, "pyproject.toml"), [
      "[project]",
      "dependencies = [",
      '  "requests>=2",',
      '  "fastapi[all]>=1", # bracket within quoted extra',
      '  "uvicorn[standard]>=0.20",',
      '  "httpx>=0.2",',
      "]",
      "",
    ].join("\n"));
    clearDeclaredDepsCache();
    const valid = context([tool({
      path: path.join(root, "app.py"),
      content: "import requests\nimport fastapi\nimport uvicorn\nimport httpx\n",
    })]);
    valid.directory = root;
    const result = noGhostDepsRule.inspect({
      ...valid, ruleConfig: { blockPythonGhostDeps: true },
    });
    assert.equal(result.decision, "pass");
    assert.equal(result.findings.length, 0);

    const undeclared = context([tool({
      path: path.join(root, "app.py"),
      content: "import httpcore\n",
    })]);
    undeclared.directory = root;
    const missing = noGhostDepsRule.inspect({
      ...undeclared, ruleConfig: { blockPythonGhostDeps: true },
    });
    assert.equal(missing.decision, "block");
    assert.equal(missing.findings[0].pattern, "httpcore");
  } finally {
    clearDeclaredDepsCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("PEP 508 extras and another requirement remain visible on the same TOML line", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-pep508-inline-"));
  try {
    fs.writeFileSync(path.join(root, "pyproject.toml"),
      '[project]\ndependencies = ["fastapi[all]>=1", "httpx>=1"]\n');
    clearDeclaredDepsCache();
    const ctx = context([tool({
      path: path.join(root, "app.py"),
      content: "import fastapi\nimport httpx\n",
    })]);
    ctx.directory = root;
    const result = noGhostDepsRule.inspect({
      ...ctx, ruleConfig: { blockPythonGhostDeps: true },
    });
    assert.equal(result.decision, "pass");
    assert.equal(result.findings.length, 0);
  } finally {
    clearDeclaredDepsCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test("VCS requirements use only explicitly declared egg names, never URL schemes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-vcs-egg-"));
  try {
    fs.writeFileSync(path.join(root, "requirements.txt"), [
      "git+https://example.invalid/org/project.git@v1#egg=realpkg",
      "-e git+ssh://git@example.invalid/project.git#egg=editablepkg&subdirectory=backend",
      "file:///tmp/local-package#egg=localpkg",
      "hg+https://example.invalid/unnamed-project",
      "ssh://example.invalid/somewhere",
      "",
    ].join("\n"));
    clearDeclaredDepsCache();

    const ctx = context([tool({
      path: path.join(root, "app.py"),
      content: "import realpkg\nimport editablepkg\nimport localpkg\n",
    })]);
    ctx.directory = root;
    const found = noGhostDepsRule.inspect({
      ...ctx, ruleConfig: { blockPythonGhostDeps: true },
    });
    assert.equal(found.decision, "pass");
    assert.equal(found.findings.length, 0);

    const falseSchemes = context([tool({
      path: path.join(root, "app.py"),
      content: "import git\nimport hg\nimport ssh\nimport file\n",
    })]);
    falseSchemes.directory = root;
    const absent = noGhostDepsRule.inspect({
      ...falseSchemes, ruleConfig: { blockPythonGhostDeps: true },
    });
    assert.equal(absent.decision, "block");
    assert.deepEqual(absent.findings.map((f) => f.pattern).sort(),
      ["file", "git", "hg", "ssh"]);
  } finally {
    clearDeclaredDepsCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test("existing remediation fingerprints prevent duplicate prompts on concurrent idle", async () => {
  const engine = new GuardEngine({
    enabled: true,
    rules: Object.fromEntries(Object.keys(BUILTIN_RULES).map((id) => [id, "off"])),
  });
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  engine.registerRule({
    id: "audit/concurrent-prompt",
    description: "Delay completion to exercise concurrent idle events",
    async inspect() {
      calls++;
      await gate;
      return {
        ruleId: "audit/concurrent-prompt",
        decision: "block",
        findings: [{
          ruleId: "audit/concurrent-prompt", pattern: "same-finding",
          description: "Same finding", messageSnippet: "same",
        }],
        remediationPrompt: "Resolve the finding.",
      };
    },
  });
  const messages = context([], "The task is incomplete.").currentTurn;
  const first = engine.inspect("concurrent-observation", process.cwd(), messages);
  const second = engine.inspect("concurrent-observation", process.cwd(), messages);
  assert.equal(calls, 2, "both rule evaluations can start before async inspection yields");
  release();
  const outcomes = await Promise.all([first, second]);
  assert.equal(outcomes.filter((result) => result.decision === "block").length, 1);
  assert.equal(outcomes.filter((result) => result.decision === "pass").length, 1);
});

test("Node dependency cache follows package.json edits in the same five-second window", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-node-manifest-edit-"));
  try {
    const manifest = path.join(root, "package.json");
    fs.writeFileSync(manifest, JSON.stringify({ dependencies: {} }));
    clearDeclaredDepsCache();
    const ctx = context([tool({
      path: path.join(root, "app.js"), content: 'import external from "new-lib";',
    })]);
    ctx.directory = root;
    assert.equal(noGhostDepsRule.inspect(ctx).decision, "block");
    fs.writeFileSync(manifest, JSON.stringify({ dependencies: { "new-lib": "1.0.0" } }));
    const checked = noGhostDepsRule.inspect(ctx);
    assert.equal(checked.decision, "pass");
    assert.equal(checked.findings.length, 0);
  } finally {
    clearDeclaredDepsCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Python dependency cache follows included requirements edits immediately", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-python-manifest-edit-"));
  try {
    fs.writeFileSync(path.join(root, "requirements.txt"), "-r nested.txt\n");
    const nested = path.join(root, "nested.txt");
    fs.writeFileSync(nested, "# empty\n");
    clearDeclaredDepsCache();
    const ctx = context([tool({
      path: path.join(root, "app.py"), content: "import brand_new\n",
    })]);
    ctx.directory = root;
    ctx.ruleConfig = { blockPythonGhostDeps: true };
    assert.equal(noGhostDepsRule.inspect(ctx).decision, "block");
    fs.writeFileSync(nested, "brand-new>=1\n");
    const checked = noGhostDepsRule.inspect(ctx);
    assert.equal(checked.decision, "pass");
    assert.equal(checked.findings.length, 0);
  } finally {
    clearDeclaredDepsCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
