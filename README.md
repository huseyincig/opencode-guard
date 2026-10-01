# opencode-guardian 🛡️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenCode: v1 & v2](https://img.shields.io/badge/OpenCode-v1%20%26%20v2%20Compatible-blue.svg)](https://github.com/huseyincig/opencode-guardian)
[![TypeScript: 5.x](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Tests: 100% Pass](https://img.shields.io/badge/Tests-267%2F267%20Passing-brightgreen.svg)](tests/)

A universal, high-performance quality and safety guardian plugin for **OpenCode** AI agents.

Designed to detect common AI agent failure modes using request-time guidance and post-turn inspection: unsupported claims, responsibility evasion, silent failure masking, test weakening, unsafe destructive operations, hardcoded secrets, undeclared dependencies, incomplete implementations, and repetitive error loops.

Uses OpenCode's supported plugin hooks — **no manual markdown rules or system prompt files required**. Actual hook delivery depends on the host version and capabilities.

---

## 🌟 Why OpenCode Guardian?

Traditional agent detectors often rely on external platform-specific binaries (Rust, Go, or Python) which introduce compile issues, glibc mismatches, and sluggish child-process invocation. 

**OpenCode Guardian** provides:
- **Task fidelity:** Captures explicit user requirements before model execution (V1 `chat.message`/system transform; V2 `prompt`/`context` hooks) and checks completion on `session.idle`. Historical deferrals do not override a new explicit instruction.
- **Zero-Binary, Pure TypeScript:** Native in-memory execution (~0.5ms per inspection) with zero external runtime dependencies.
- **Dual-Mode Host Support:** Works with **OpenCode 1.x** (via `server`) and full **OpenCode 2.x** hosts (via `setup` and `event.subscribe`); transition builds that invoke `setup()` without the complete V2 capability surface are detected and ignored safely.
- **Pre-Built Distribution:** Pre-compiled `dist/` is included in the package and git repository — no build toolchain (`tsc`) required on target systems.
- **Evidence-Aware Inspection:** Correlates tool commands, exit codes, test/build/audit results, file mutations, git state, baseline checks, and normalized error fingerprints before deciding.
- **False-Positive Defenses:** Explicit uncertainty is allowed, stale verification after a later edit is not treated as proof, and Python local/stdlib modules are distinguished from third-party dependencies.
- **Bounded continuation:** Explicit repeated-review tasks use a separate `iterationBudget` (default 3, maximum 5) and require observable progress. Ordinary remediation remains capped at one prompt per human turn.

---

## 📦 Installation

### Method 1: NPM Package (Recommended)

Add the package to the OpenCode configuration used by your host.

**OpenCode v1:**

```json
{
  "plugin": [
    "opencode-guardian@latest"
  ]
}
```

**OpenCode v2:**

```json
{
  "plugins": [
    "opencode-guardian@latest"
  ]
}
```

### Method 2: Local Directory / Development

If developing or testing locally:

```bash
git clone https://github.com/huseyincig/opencode-guardian.git ~/.config/opencode/vendor/opencode-guardian
```

Use the absolute `file:///` path in the matching host configuration.

**OpenCode v1:**

```json
{
  "plugin": [
    "file:///home/me/.config/opencode/vendor/opencode-guardian"
  ]
}
```

**OpenCode v2:**

```json
{
  "plugins": [
    "file:///home/me/.config/opencode/vendor/opencode-guardian"
  ]
}
```

> `OpencodeGuard` remains a JavaScript export alias for source compatibility. The npm package name `opencode-guard` is **not** an alias for this project; install `opencode-guardian`.

---

## 🛡️ The 14 Rules

| Rule | Default | What it checks |
| :--- | :---: | :--- |
| **`discipline/no-evasion`** | error | Unsupported dismissal such as pre-existing/unrelated/out-of-scope claims. A successful baseline/main check allows factual pre-existing or unrelated claims. |
| **`discipline/no-apology`** | error | Sycophantic, defensive, or excessive apology language across multiple languages. |
| **`quality/no-shortcuts`** | error | Concrete deferred-work language and `TODO`/`FIXME`/`HACK` comments block; ambiguous descriptive words such as “temporary” and “workaround” are advisory. |
| **`integrity/no-stubs`** | error | `NotImplementedError`, empty stubs, Rust `todo!/unimplemented!`, and explicit placeholder constant returns. |
| **`integrity/no-unverified-claims`** | error* | Correlates claims such as “tests pass”, “build succeeded”, “audit clean”, “pushed”, “working tree clean”, and “bug fixed” with tool evidence. Direct contradictions block; missing evidence is advisory by default. |
| **`integrity/no-silent-failure`** | error* | Blocks test/build/lint/typecheck/audit commands whose failure is masked with `|| true`, `exit 0`, etc. Empty catch/`except: pass` handlers are advisory by default. |
| **`safety/no-truncation`** | error | Lazy file-edit placeholders that can delete real code. |
| **`safety/destructive-operations`** | **warn** | Hard reset, force push, recursive force delete, database drop, Terraform destroy, registry unpublish, and similar operations unless explicitly requested by the user. |
| **`testing/no-cheat`** | error | Targeted skip/focus/todo edits block. Existing skips in whole-file writes, assertion weakening, test deletion, coverage reduction, CI test-step removal, and snapshot regeneration are advisory by default unless strict settings or failed-test evidence require blocking. |
| **`security/no-secrets`** | error | OpenAI/GitHub/AWS/Slack/npm/GitLab/Google/Stripe credentials, JWTs, private keys, registry auth, bearer tokens, and credential-bearing DB URLs. |
| **`manifest/no-ghost-deps`** | error | Undeclared imports against the nearest Node (`package.json`), Python (`pyproject.toml` / `requirements*.txt`), Go (`go.mod`), or Rust (`Cargo.toml`) manifest. Python findings are advisory by default because import names can differ from package names. |
| **`runtime/circuit-breaker`** | error | Exact repeated failures plus cosmetic command variants that keep hitting the same normalized root-cause error without successful progress. |
| **`task/instruction-fidelity`** | error | A current, explicit action is refused solely because the user previously deferred or paused the work. Questions and negative instructions do not count as authorization. |
| **`task/completion-gate`** | error* | Explicit repeated-review and requested verification requirements. A fix without a subsequent required review can trigger bounded continuation; missing verification evidence is advisory unless an observed failure contradicts completion. |

`*` These rules distinguish high-confidence blocking behavior from lower-confidence advisory findings.

For `git clean`, an explicit request authorizes normal cleanup; mentioning the command, forbidding it, or requesting a different command does not. Deleting ignored files with `-x` or `-X` requires separate authorization. A scoped `git -C ... clean` requires matching scope in the request, and shell substitutions or chained commands are not treated as authorized. Dry-run (`-n` / `--dry-run`) is not classified as destructive. **Guardian inspects after the tool runs:** findings are advisory at the default `warn` severity, not a pre-execution safety barrier.

---

## ⚙️ Configuration (`opencode-guardian.json`)

OpenCode Guardian works out of the box with zero configuration. `safety/destructive-operations` defaults to `warn`; the other blocking rules default to `error`.

To customize behavior, create `opencode-guardian.json` (or legacy `opencode-guard.json`) in the project root, `.opencode/`, or the global OpenCode config directory:

```json
{
  "enabled": true,
  "remediationBudget": 1,
  "iterationBudget": 3,
  "rules": {
    "discipline/no-evasion": "error",
    "discipline/no-apology": "error",
    "quality/no-shortcuts": {
      "severity": "error",
      "customPhrases": ["works on my machine", "not my job"],
      "exceptions": ["temporarydirectory", "tempdir"]
    },
    "integrity/no-stubs": "error",
    "integrity/no-unverified-claims": {
      "severity": "error",
      "blockUnverified": false
    },
    "integrity/no-silent-failure": {
      "severity": "error",
      "blockEmptyHandlers": false
    },
    "safety/no-truncation": "error",
    "safety/destructive-operations": "warn",
    "testing/no-cheat": {
      "severity": "error",
      "blockSnapshotUpdates": false,
      "blockStructuralTestChanges": false
    },
    "security/no-secrets": "error",
    "manifest/no-ghost-deps": {
      "severity": "error",
      "blockPythonGhostDeps": false
    },
    "runtime/circuit-breaker": "error",
    "task/instruction-fidelity": "error",
    "task/completion-gate": "error"
  }
}
```

### Severity Levels:
- `"error"`: a blocking rule can send one combined remediation prompt, subject to the turn remediation budget.
- `"warn"`: findings remain in the engine result but do **not** trigger remediation.
- `"off"`: disables the rule.

`iterationBudget` independently accepts `0..5` (default `3`), and only applies to explicit iterative tasks. Both budgets fail open when exhausted; repeating an idle message without new tool progress does not trigger another continuation.

For a task-focused configuration, the older conversation-style rules can be changed to `"warn"` without disabling the new task rules. Unknown evidence never justifies declaring a comprehensive audit complete.

`remediationBudget` accepts `0..5`; `0` keeps findings but disables automatic remediation, and the default is `1`. The strict options `blockUnverified`, `blockEmptyHandlers`, `blockSnapshotUpdates`, `blockStructuralTestChanges`, and `blockPythonGhostDeps` are deliberately `false` by default to reduce false positives. Structural test changes become blocking automatically when the same turn contains failed-test evidence.

---

## 🧭 Explicit Task Contracts

When the latest genuine user prompt **explicitly** requests a repeated debug/review, Guardian builds a task contract for that human turn. It guides the agent before its model request and checks the observed tools at `session.idle`. A source-review loop requires a new, nonempty source inspection **after** the last change; a test-only loop can be supported by a successful later test run. Omitted or ambiguous evidence remains advisory where a direct contradiction cannot be established. A concrete blocker is reported instead of causing an infinite retry.

This is a **conservative heuristic**, not semantic proof that every file was examined or that all requirements were met. The host must actually deliver the hooks; some V2 beta versions have reported broken event/context delivery. See [the V1/V2 task-contract design](docs/task-contract-v1-v2.md) and [source-verified international policy design](docs/international-policy.md) for architecture, sources, limitations and proposed AST/OPA extensions.

---

## 🌍 International, language-neutral task decisions

English and Turkish task extraction now has conservative signal support for **Spanish, Portuguese, French, German, Russian, Arabic, Hindi, Chinese, Japanese, Korean and Indonesian**. These identify explicit actions, repeated review, negation, requested tests, historical refusal, completion reports and blockers. They are **not** universal language understanding or an exhaustive list of paraphrases.

Every supported language produces the same typed task contract; `evaluateTaskPolicy` makes the actual task/verification decision from **structured tool evidence**, not from the detected language. Missing or ambiguous evidence is not accepted as a proven success. The optional first-line directive below gives deterministic task conditions even in unsupported languages:

```text
@guardian-task {"mode":"iterative-review","review":"source","verify":["test"]}
[Write the task in any language.]
```

The header is optional, accepts only the documented fields, and does not grant tool permissions or authorize a release. Recognized explicit prohibitions in the body override conflicting directives. See [international architecture and source review](docs/international-policy.md).

---

## 🔄 How It Works: Evidence + Remediation Flow

```mermaid
flowchart TD
    Z[Explicit human task] --> Y[V1 chat.message or V2 prompt hook]
    Y --> X[Task contract guidance before model call]
    X --> A[Agent executes tools and responds]
    A --> B[OpenCode emits session.idle]
    B --> C[Extract current human turn]
    C --> D[EvidenceCollector]
    D --> E[Normalize tools, exit codes, mutations, git state, error fingerprints]
    E --> F[Run 14 rules]
    F --> G{High-confidence blocking findings?}
    G -->|No| H[Pass / advisory findings only]
    G -->|Yes| I{Remediation budget available?}
    I -->|No| H
    I -->|Yes| J[Send remediation or bounded task continuation]
    J --> K[Agent remediation response]
    K --> L[Loop guard passes remediation turn]
```

1. **Evidence collection:** Each completed human turn is normalized once. Tests, builds, typechecks, lint, audits, git operations, file mutations, explicit exit codes, and failure fingerprints become shared evidence.
2. **Rule evaluation:** Rules inspect both text/code and the same evidence snapshot. A successful verification that happened before a later file edit is considered stale for completion claims. Compound commands are tracked by verification kind; ambiguous failures in multi-step commands remain advisory.
3. **Conservative blocking:** Missing or ambiguous evidence is generally advisory. Direct contradictions and concrete code/tool violations are the primary blocking path.
4. **Remediation budgets:** Standard remediation defaults to one intervention per human turn. Explicit iterative reviews use a separate `iterationBudget` (default 3) and will not retry without progress.
5. **Loop protection:** Guardian's remediation marker is recognized on both V1 and V2. During a Guardian continuation, the completion gate checks the entire human turn, while other rules inspect **only the new assistant work**; prior findings are not repeatedly reprocessed. Synthetic messages from other plugins do not reset the human-turn budget.

---

## 🧪 Testing & Verification

```bash
# Build + 267 unit/regression tests
npm test

# Typecheck TypeScript sources
npm run typecheck

# Isolated plugin smoke test
node sandbox/smoke-test.mjs

# 18 end-to-end behavioral scenarios
node sandbox/comprehensive-test.mjs

# Dependency/security audit
npm audit

# Verify publish contents
npm pack --dry-run
```

CI runs the full verification sequence on Node **22** and **24**. The regression suite contains explicit false-positive cases for hypotheses/uncertainty, baseline-backed pre-existing claims, legitimate assertion changes, Python standard-library imports, successful-progress circuit-breaker resets, partial-v2 contexts, remediation budgeting, and default-warn destructive operations.

---

## 🛠️ Project Structure

```
opencode-guardian/
├── dist/                    # Pre-built ESM distribution
├── src/
│   ├── index.ts             # OpenCode v1/v2 adapters
│   ├── engine.ts            # Rule orchestration + remediation budget
│   ├── evidence.ts          # Tool/evidence normalization + error fingerprints
│   ├── state.ts             # Remediation/continuation budgets per human turn
│   ├── task-contract.ts     # Explicit task extraction and optional typed directive
│   ├── locale-intents.ts    # Conservative multilingual signals
│   ├── task-policy.ts       # Language-neutral evidence and completion policy
│   ├── prose.ts             # Prose normalization
│   ├── tool-input.ts        # Common shell/file mutation extraction
│   ├── types.ts
│   └── rules/               # 14 built-in rules
├── sandbox/
│   ├── smoke-test.mjs
│   └── comprehensive-test.mjs
├── tests/
│   ├── guard.test.mjs       # Existing rules and V1/V2 host simulations
│   ├── multilingual-task.test.mjs  # International positive/negative tests
│   ├── structured-task.test.mjs    # Exact directive validation
│   ├── international-adapters.test.mjs # V1/V2 locale hook simulations
│   └── task-policy.test.mjs        # Language-neutral policy tests
├── index.js
├── server.js
├── package.json
└── tsconfig.json
```

---

## 📄 License

[MIT](LICENSE) © Hüseyin Hadi Çığ
