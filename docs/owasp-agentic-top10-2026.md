# OWASP Agentic Top 10 (2026): Guardian coverage and limits

Coverage mapped against the **v0.4.0** source. This is a feature-and-gap map, not an OWASP certification.

Sources: [OWASP Agentic Top 10 (December 2025)](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) and the [OWASP release explanation](https://genai.owasp.org/2025/12/09/owasp-top-10-for-agentic-applications-the-benchmark-for-agentic-security-in-the-age-of-autonomous-ai/).

## Risk-by-risk scope

| Risk | Current Guardian capability | Explicit limitations |
| --- | --- | --- |
| **ASI01 – Agent Goal Hijack** | Task contracts use human messages; synthetic messages and quoted instruction examples are filtered from some intent extraction. Instruction-fidelity checks some contradictions. | No general prompt-injection detection, trusted-data provenance, or guarantee that tool output cannot redirect a model. |
| **ASI02 – Tool Misuse** | Post-turn destructive-operation findings; optional strict preflight rejects selected high-risk shell patterns and plain file removal before execution. Target-aware post-turn deletion review prevents some permission-scope expansion. | Post-turn findings are advisory at default severity. Preflight is opt-in, applies to known shell-tool names and supported command shapes, and is not a comprehensive tool-policy engine. |
| **ASI03 – Identity & Privilege Abuse** | Post-turn deletion review checks literal path-specific consent, refuses unrequested `sudo`, and does not interpret questions about deletion as permission. | No actor authentication, credential scope enforcement, privilege sandbox, or authorization service. Preflight does not authenticate a human's identity. |
| **ASI04 – Agentic Supply Chain** | The no-ghost-deps rule cross-checks imports against selected dependency manifests. CI runs npm audit. | No dependency signature/provenance, lockfile trust, package integrity verification, MCP tool signing, or external-plugin vetting. |
| **ASI05 – Unexpected Code Execution** | Optional preflight detects selected destructive shell forms (including paired active backtick substitutions and plain `rm`) and opaque decoded shell pipelines. | No complete shell interpreter, sandbox, dynamic code analysis, or universal execution interception. Arbitrary interpreters and renamed tools remain outside the proven scope. |
| **ASI06 – Memory & Context Poisoning** | Some synthetic messages and quoted text are excluded from task-intent interpretation. | No persistent-memory integrity checking, retrieval provenance, tool-result trust separation, or untrusted-context quarantine. |
| **ASI07 – Insecure Inter-Agent Communication** | No dedicated control. | No sender authentication, signed inter-agent messages, message authorization or A2A/MCP protocol security. |
| **ASI08 – Cascading Failures** | Circuit-breaker detects certain repeated tool failures; remediation and iterative-review budgets bound retries. | No distributed failure containment, dependency isolation, transaction rollback, or propagation control across agents/services. |
| **ASI09 – Human-Agent Trust Exploitation** | No-unverified-claims compares selected claims with observed tool evidence. | No protection against deceptive approval interfaces, social engineering, forged evidence, or all forms of human trust abuse. |
| **ASI10 – Rogue Agents** | Completion and instruction-fidelity checks catch selected task deviations after a turn. | No independent agent identity, mandatory action allowlist, autonomy boundary, or guaranteed containment of unauthorized side effects. |

## Evidence and reproducible checks

- [src/preflight.ts](https://github.com/huseyincig/opencode-guardian/blob/main/src/preflight.ts), [src/index.ts](https://github.com/huseyincig/opencode-guardian/blob/main/src/index.ts), [tests/preflight.test.mjs](https://github.com/huseyincig/opencode-guardian/blob/main/tests/preflight.test.mjs), and [tests/security-audit-regression.test.mjs](https://github.com/huseyincig/opencode-guardian/blob/main/tests/security-audit-regression.test.mjs): opt-in V1/V2 shell pre-execution checks, strict V2 setup error handling, and mock-host behavior.
- [src/rules/destructive-operations.ts](https://github.com/huseyincig/opencode-guardian/blob/main/src/rules/destructive-operations.ts), [tests/owasp-scope-regression.test.mjs](https://github.com/huseyincig/opencode-guardian/blob/main/tests/owasp-scope-regression.test.mjs), [tests/guardfall-regression.test.mjs](https://github.com/huseyincig/opencode-guardian/blob/main/tests/guardfall-regression.test.mjs), and [tests/security-gap-regression.test.mjs](https://github.com/huseyincig/opencode-guardian/blob/main/tests/security-gap-regression.test.mjs): post-turn authorization findings, literal path scoping, and selected shell-pattern regression cases.
- [src/task-contract.ts](https://github.com/huseyincig/opencode-guardian/blob/main/src/task-contract.ts) and [tests/report-followup-regression.test.mjs](https://github.com/huseyincig/opencode-guardian/blob/main/tests/report-followup-regression.test.mjs): task extraction and limits on what counts as review evidence.
- [src/rules/no-ghost-deps.ts](https://github.com/huseyincig/opencode-guardian/blob/main/src/rules/no-ghost-deps.ts) and [src/rules/no-secrets.ts](https://github.com/huseyincig/opencode-guardian/blob/main/src/rules/no-secrets.ts): narrow dependency and hardcoded-secret checks; neither performs supply-chain or identity verification.
- [src/rules/circuit-breaker.ts](https://github.com/huseyincig/opencode-guardian/blob/main/src/rules/circuit-breaker.ts), [src/rules/no-unverified-claims.ts](https://github.com/huseyincig/opencode-guardian/blob/main/src/rules/no-unverified-claims.ts), and [src/rules/task-completion.ts](https://github.com/huseyincig/opencode-guardian/blob/main/src/rules/task-completion.ts): bounded retries, selected claim checks, and task completion logic.

For unit/sandbox coverage, earlier V1 host testing and pending live validation of the current source, see the [changelog](../CHANGELOG.md).

## Deployment controls outside this plugin

Use OpenCode host permissions and human confirmation for sensitive tools; restrict filesystem/network/credential access at the operating-system or container layer; grant agents only scoped credentials; vet and pin dependencies and MCP integrations; and review high-impact actions independently. Enabling Guardian preflight does not replace any of these controls.

## Maintenance

Update a capability claim only when supported by code and reproducible tests.
