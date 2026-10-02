# Task contract and OpenCode V1/V2 adapter design

This document describes the implemented task controls and OpenCode adapters. For the tagged version, publication and live-host verification status, see [release status](release-v0.4.0.md).

## Host API references

- OpenCode V1 [plugin documentation](https://opencode.ai/docs/plugins/): `chat.message`, `experimental.chat.system.transform`, `tool.execute.before`, `event` (`session.idle`).
- OpenCode V2 [plugin overview](https://opencode.ai/v2/docs/build/plugins): `ctx.session.hook("prompt")`, `ctx.session.hook("context")`, `ctx.event.subscribe`, `ctx.session.context`, `ctx.session.synthetic`.
- OpenCode's [V1-to-V2 migration documentation](https://opencode.ai/v2/docs/build/plugins/migrate-v1/): hook boundaries are **not** interchangeable; `ctx.location` refers to where the plugin loaded, not to every session's current location.
- Adapter typing was checked against `@opencode-ai/plugin` **1.18.34** and `@opencode/plugin` **2.0.21**. Runtime hook delivery must still be checked on the target host.

See [international task policy](international-policy.md) for locale support and the optional typed directive.

## Adapter lifecycle

| Operation | V1 (`@opencode-ai/plugin`) | V2 (`@opencode/plugin`) |
| --- | --- | --- |
| Capture submitted user request | Returned `"chat.message"` hook | `ctx.session.hook("prompt", ...)` |
| Guide the active model request | `"experimental.chat.system.transform"`; append a system string | `ctx.session.hook("context", ...)`; append a typed `{type:"text", text}` system part |
| Read messages on idle | `client.session.messages({path:{id},query:{directory}})` | `ctx.session.context({sessionID})`, then normalize V2 records |
| Continue a bounded review | `client.session.promptAsync(...)` | `ctx.session.synthetic({sessionID, text, delivery:"queue", resume:true})` |
| Observe lifecycle | Returned `event` callback | `ctx.event.subscribe({signal})` async iterable |
| Resolve session directory | V1 plugin's known project directory | Prefer `ctx.session.get({sessionID}).location.directory`; fall back to `ctx.location.directory` |
| Unload | V1 hook lifecycle | Abort the event stream and dispose registered hook handles |

OpenCode V2 partial or transition contexts are ignored if required event/session capabilities are absent **only when strict preflight is off**. When `preflight.enabled` is true and the plugin is enabled, incomplete host context, invalid/unavailable event subscription or missing/invalid tool hook registration triggers an explicit setup error instead of silently disabling protection. Optional task hooks may fail independently without disabling an otherwise available idle path. Hook registration does not verify actual event delivery; check the target V2 host.

## Contract and state algorithm

1. Find the **latest genuine human user message**. Exclude Guardian-tagged remediation and synthetic messages from other plugins when deciding the human-turn boundary.
2. Extract only explicit supported requirements: an actionable request, a repeated review/debug request, a fresh source review, and individually requested `test`/`build`/`typecheck`/`lint`/`audit` checks. Questions, prohibitions and uncertain wording do not create binding obligations.
3. On model-context construction, remind the agent to follow the current explicit instruction rather than silently giving priority to an earlier suspension or deferral. Do not elevate raw user-provided text into a synthetic system prompt.
4. On `session.idle`, collect a single ordered evidence snapshot from recorded tool invocations. Correlate successful file changes, subsequent source reads, test/build exit codes and final completion claims. Evidence collected before the last change is not proof of the final state.
5. If an explicit iterative review stops immediately after a successful change with no successful subsequent **required** inspection, issue a targeted continuation. A full-source review requires observable post-change source inspection; a test-only loop can use a successful post-change test.
6. Limit continuation independently of ordinary remediation (`iterationBudget` defaults to `3`, maximum `5`; `remediationBudget` defaults to `1`). Never issue the same continuation again without progress. After Guardian's own synthetic message, the task completion gate uses the cumulative human-turn evidence. Other rules inspect only new work after that synthetic message, so new security/integrity violations are still checked without repeatedly reopening old findings.
7. If an explicit blocker is reported (missing credentials, service unavailable, permission required), stop automatic continuation and require a transparent report to the user. Unknown evidence remains advisory unless it directly contradicts a claim.

## Confidence, limitations and safety

- The contract is a conservative **deterministic extractor**, not a universal natural-language interpreter. Ambiguous or unsupported instructions are not silently invented. When needed, use a more explicit user prompt.
- Post-change source inspection uses successful file reads and substantive source-bearing search/diff results. File-name listings and diff statistics do not qualify. A read documents observed inspection, not exhaustive repository coverage.
- The normal Guardian destructive-operation rule runs **after** a tool completes, at default `warn` severity. It checks recognized destructive forms and plain `rm` target authorization; merely asking about deletion does not grant permission. The optional **strict preflight** (`preflight.enabled: true`, disabled by default) uses V1 `tool.execute.before` or V2 `ctx.tool.hook("execute.before")` to reject selected risky calls before execution, regardless of user consent. It is not a complete shell parser, permission system, or host sandbox.
- V1's system transformation is experimental. V2 `prompt` and `context` have different boundaries; verify delivery on the actual host.
- Synthetic continuation is bounded rather than unconditionally repeating until the model says the task is complete. This prevents a plugin-induced infinite loop; the user may request additional iterations when the budget is exhausted.
- Existing conversation-style rules retain their configurable severities. To prioritize task completion without blocking on stylistic phrases, set `discipline/no-apology`, `discipline/no-evasion`, or `quality/no-shortcuts` to `warn` explicitly.

## Potential extensions

- Rich, user-confirmed structured task scopes for complex multi-part requirements; the current optional first-line directive supports a small typed contract, not a full per-file scope manifest.
- Richer per-file coverage and before/after diff evidence for a genuinely verifiable complete audit.
- Expand the already implemented, opt-in pre-tool checks beyond recognized shell tool names and command fields, with explicit host capability tests, narrowly scoped authorization where appropriate, and careful false-positive controls.
- Revalidate the exact v0.4.0 package on a live V1 host and test the V2 adapter on a separate real V2 host, including lost events, preflight rejection and session interruption.
