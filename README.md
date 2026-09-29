# opencode-guard 🛡️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenCode: v1 & v2](https://img.shields.io/badge/OpenCode-v1%20%26%20v2%20Compatible-blue.svg)](https://github.com/huseyincig/opencode-guard)
[![TypeScript: 5.x](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Tests: 100% Pass](https://img.shields.io/badge/Tests-29%2F29%20Passing-brightgreen.svg)](tests/)

A universal, high-performance quality and safety guard plugin for **OpenCode** AI agents.

Designed to prevent common AI agent bad habits in real time: responsibility evasion, sycophantic apologies, hedging shortcuts, empty stub implementations, lazy code truncation, test skipping, hardcoded secrets, undeclared dependencies, and repetitive error loops.

Works **100% out of the box** using OpenCode's native lifecycle hooks — **no manual markdown files, rules, or system prompt files required**.

---

## 🌟 Why OpenCode Guard?

Traditional agent detectors often rely on external platform-specific binaries (Rust, Go, or Python) which introduce compile issues, glibc mismatches, and sluggish child-process invocation. 

**OpenCode Guard** provides:
- **Native Lifecycle Integration:** Hooks directly into OpenCode's `session.idle` event — zero manual `.md` configuration, zero boilerplate.
- **Zero-Binary, Pure TypeScript:** Native in-memory execution (~0.5ms per inspection) with zero external runtime dependencies.
- **Dual-Mode Host Support:** Works seamlessly with both **OpenCode 1.x** (via `server` hook) and **OpenCode 2.x** (via `setup` and `event.subscribe`).
- **Pre-Built Distribution:** Pre-compiled `dist/` is included in the package and git repository — no build toolchain (`tsc`) required on target systems.
- **Zero False-Positives:** Localized exception boundaries (e.g., `TemporaryDirectory` won't mask subsequent hedging), AST/patch header extraction, and template variable filtering.
- **Anti-Loop Architecture:** Automatically detects synthetic remediation prompts to ensure the agent never gets trapped in an infinite feedback loop.

---

## 📦 Installation

### Method 1: NPM Package (Recommended)

Install the plugin directly via OpenCode CLI:

```bash
opencode plugin opencode-guard
```

Or add it to your OpenCode configuration (`~/.config/opencode/opencode.json` or project-local `opencode.json`):

```json
{
  "plugin": [
    "opencode-guard@latest"
  ]
}
```

### Method 2: Local Directory / Development

If developing or testing locally:

```bash
git clone https://github.com/huseyincig/opencode-guard.git ~/.config/opencode/vendor/opencode-guard
```

Add the absolute `file:///` path to your OpenCode configuration (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": [
    "file:///root/.config/opencode/vendor/opencode-guard"
  ]
}
```

---

## 🛡️ The 9 Universal Rules

| Rule ID | Category | What it Prevents | Examples Blocked |
| :--- | :--- | :--- | :--- |
| **`discipline/no-evasion`** | Discipline | Evading responsibility or dismissing errors as out-of-scope or pre-existing. | *"unrelated to this change"*, *"already broken on main"*, *"outside the scope of this PR"* |
| **`discipline/no-apology`** | Discipline | Sycophantic, defensive, or excessive apologies and conversational filler. | *"I apologize for the confusion"*, *"I am so sorry"*, *"çok özür dilerim"*, *"kusura bakmayın"* |
| **`quality/no-shortcuts`** | Quality | Hedging language, temporary fixes, and lingering marker comments. | *"good enough for now"*, *"basic implementation"*, *"temporary fix"*, `TODO`, `FIXME` |
| **`integrity/no-stubs`** | Integrity | Claiming completion while leaving hollow placeholder methods or stubs. | `throw new NotImplementedError`, `raise NotImplementedError`, `def ...: pass` |
| **`safety/no-truncation`** | Safety | Lazy truncation comments that delete real code during file edits. | `// ... existing code unchanged ...`, `# ... rest of code ...` |
| **`testing/no-cheat`** | Testing | Weakening test suites to fake a green test run. | `test.skip()`, `it.only()`, commented-out assertions (`// expect(...)`) |
| **`security/no-secrets`** | Security | Hardcoding raw API keys, private tokens, or database credentials. | `sk-...`, `ghp_...`, `AKIA...`, `xoxb-...`, raw database connection strings |
| **`manifest/no-ghost-deps`** | Manifest | Importing third-party packages not listed in `package.json`. | Importing `lodash` or `axios` when not declared in dependencies. |
| **`runtime/circuit-breaker`** | Runtime | Repeating the exact same failing tool command 3+ times in a single turn. | Database connection refused retry storms, missing path error loops. |

---

## ⚙️ Configuration (`opencode-guard.json`)

OpenCode Guard works out of the box with zero configuration (all rules enabled with `error` severity).

To customize rule severities or add phrase exceptions, create `opencode-guard.json` in your project root or `~/.config/opencode/opencode-guard.json`:

```json
{
  "enabled": true,
  "rules": {
    "discipline/no-evasion": "error",
    "discipline/no-apology": "error",
    "quality/no-shortcuts": {
      "severity": "warn",
      "customPhrases": ["works on my machine", "not my job"],
      "exceptions": ["temporarydirectory", "tempdir"]
    },
    "integrity/no-stubs": "error",
    "safety/no-truncation": "error",
    "testing/no-cheat": "error",
    "security/no-secrets": "error",
    "manifest/no-ghost-deps": "warn",
    "runtime/circuit-breaker": "error"
  }
}
```

### Severity Levels:
- `"error"`: **Blocks** the agent turn and sends a synthetic remediation prompt instructing the agent to rectify the issue.
- `"warn"`: Records the finding in inspection logs but **does not block** the agent from completing its turn.
- `"off"`: Completely disables the rule.

---

## 🔄 How It Works: Lifecycle & Remediation Flow

```mermaid
flowchart TD
    A[Agent executes tools & responds] --> B[OpenCode emits session.idle event]
    B --> C{opencode-guard inspect}
    C -->|Has Violations?| D[Build Targeted Remediation Prompt]
    D --> E[Inject Synthetic User Prompt]
    E --> F[Agent Rectifies Code or Provides Evidence]
    F --> G[Remediation Turn Passes via Loop Guard]
    C -->|No Violations| H[Turn Passes Unblocked]
```

1. **Inspection on Idle:** When the AI agent completes its actions, OpenCode triggers `session.idle`.
2. **Deep Turn Analysis:** The Guard inspects the assistant's text and all tool inputs (file edits, writes, patches) against active rules.
3. **Structured Remediation:** If a violation is caught, a structured, actionable remediation prompt is sent back to the agent with the exact offending snippet.
4. **Loop Protection:** When the agent responds to the remediation prompt (`synthetic: true`), the engine detects this and allows the response through, preventing deadlock.

---

## 🧪 Testing & Verification

The repository comes with a comprehensive test suite covering unit behaviors and end-to-end sandbox simulations:

```bash
# Run 29/29 unit tests (~65ms)
npm test

# Typecheck TypeScript sources
npm run typecheck

# Build distribution files
npm run build
```

---

## 🛠️ Project Structure

```
opencode-guard/
├── dist/                # Pre-compiled ESM distribution files (tracked for zero-build installs)
├── src/
│   ├── index.ts         # Dual-Mode entry point (OpenCode v1 server & v2 setup)
│   ├── engine.ts        # GuardEngine inspection orchestrator & config loader
│   ├── prose.ts         # Prose normalization & blockquote/citation stripper
│   ├── types.ts         # TypeScript interfaces & definitions
│   └── rules/           # The 9 modular rule implementations
├── tests/
│   └── guard.test.mjs   # Comprehensive 29-case unit test suite
├── index.js             # Root module export for universal module loaders
├── server.js            # Root server export for OpenCode plugin discovery
├── package.json
├── tsconfig.json
├── LICENSE              # MIT License
└── README.md
```

---

## 📄 License

[MIT](LICENSE) © Hüseyin Hadi Çığ
