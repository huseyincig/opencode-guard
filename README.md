# opencode-guardian 🛡️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenCode: v1 & v2](https://img.shields.io/badge/OpenCode-v1%20%26%20v2%20Compatible-blue.svg)](https://github.com/huseyincig/opencode-guardian)
[![TypeScript: 5.x](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Tests: 100% Pass](https://img.shields.io/badge/Tests-43%2F43%20Passing-brightgreen.svg)](tests/)

A universal, high-performance quality and safety guardian plugin for **OpenCode** AI agents.

Designed to prevent common AI agent bad habits in real time: responsibility evasion, sycophantic apologies, hedging shortcuts, empty stub implementations, lazy code truncation, test skipping, hardcoded secrets, undeclared dependencies, and repetitive error loops.

Works **100% out of the box** using OpenCode's native lifecycle hooks — **no manual markdown files, rules, or system prompt files required**.

---

## 🌟 Why OpenCode Guardian?

Traditional agent detectors often rely on external platform-specific binaries (Rust, Go, or Python) which introduce compile issues, glibc mismatches, and sluggish child-process invocation. 

**OpenCode Guardian** provides:
- **Native Lifecycle Integration:** Hooks directly into OpenCode's `session.idle` event — zero manual `.md` configuration, zero boilerplate.
- **Zero-Binary, Pure TypeScript:** Native in-memory execution (~0.5ms per inspection) with zero external runtime dependencies.
- **Dual-Mode Host Support:** Works seamlessly with both **OpenCode 1.x** (via `server` hook) and **OpenCode 2.x** (via `setup` and `event.subscribe`).
- **Pre-Built Distribution:** Pre-compiled `dist/` is included in the package and git repository — no build toolchain (`tsc`) required on target systems.
- **False-Positive Defenses:** Localized exception boundaries, comment/string-aware dependency scanning, patch-path extraction, and explicit template-variable filtering.
- **Anti-Loop Architecture:** Automatically detects synthetic remediation prompts to ensure the agent never gets trapped in an infinite feedback loop.

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

## ⚙️ Configuration (`opencode-guardian.json`)

OpenCode Guardian works out of the box with zero configuration (all rules enabled with `error` severity).

To customize rule severities or add phrase exceptions, create `opencode-guardian.json` (or `opencode-guard.json`) in your project root or `~/.config/opencode/opencode-guardian.json`:

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
    B --> C{opencode-guardian inspect}
    C -->|Has Violations?| D[Build Targeted Remediation Prompt]
    D --> E[Inject Synthetic User Prompt]
    E --> F[Agent Rectifies Code or Provides Evidence]
    F --> G[Remediation Turn Passes via Loop Guard]
    C -->|No Violations| H[Turn Passes Unblocked]
```

1. **Inspection on Idle:** When the AI agent completes its actions, OpenCode triggers `session.idle`.
2. **Deep Turn Analysis:** The Guardian inspects assistant text and supported file-mutation tool inputs, including writes, edits, patches, and common shell file-write forms.
3. **Structured Remediation:** If a violation is caught, a structured, actionable remediation prompt is sent back to the agent with the exact offending snippet.
4. **Loop Protection:** V2 uses native synthetic messages; V1 uses a Guardian remediation marker. The engine recognizes either form and avoids re-blocking its own remediation turn.

---

## 🧪 Testing & Verification

The repository comes with a comprehensive test suite covering unit behaviors and end-to-end sandbox simulations:

```bash
# Build and run 43/43 unit/regression tests
npm test

# Typecheck TypeScript sources
npm run typecheck

# Build distribution files
npm run build
```

---

## 🛠️ Project Structure

```
opencode-guardian/
├── dist/                # Pre-compiled ESM distribution files (tracked for zero-build installs)
├── src/
│   ├── index.ts         # Dual-Mode entry point (OpenCode v1 server & v2 setup)
│   ├── engine.ts        # GuardEngine inspection orchestrator & config loader
│   ├── prose.ts         # Prose normalization & blockquote/citation stripper
│   ├── tool-input.ts    # Common shell/file-mutation input extraction
│   ├── types.ts         # TypeScript interfaces & definitions
│   └── rules/           # The 9 modular rule implementations
├── tests/
│   └── guard.test.mjs   # Comprehensive 43-case unit/regression suite
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
