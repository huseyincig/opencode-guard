# Task contract and OpenCode V1/V2 adapter design

This is the implementation design for **unreleased** Guardian task controls on `main`. It is not a claim that the feature is available in the existing npm package or GitHub release. Publication and versioning are separate, manual decisions.

## Primary, dated sources

- OpenCode V1 [plugin documentation](https://opencode.ai/docs/plugins/): `chat.message`, `experimental.chat.system.transform`, `tool.execute.before`, `event` (`session.idle`).
- OpenCode V2 [plugin overview](https://opencode.ai/v2/docs/build/plugins): `ctx.session.hook("prompt")`, `ctx.session.hook("context")`, `ctx.event.subscribe`, `ctx.session.context`, `ctx.session.synthetic`.
- OpenCode's [V1-to-V2 migration documentation](https://opencode.ai/v2/docs/build/plugins/migrate-v1/): hook boundaries are **not** interchangeable; `ctx.location` refers to where the plugin loaded, not to every session's current location.
- Actual installed TypeScript declarations verified against `@opencode-ai/plugin` **1.18.34** and `@opencode/plugin` **2.0.21**, including `SessionPrompt`, `SessionContext`, `ToolHooks`, and `SystemPart`.
- [OpenCode issue #44788](https://github.com/anomalyco/opencode/issues/44788) describes a **reported beta-host failure** to deliver events/context/synthetic prompts. Its existence does not establish that all V2 builds fail, but plugin capability detection alone cannot prove runtime delivery.

For the separately implemented 11-language signal packs, the exact first-line directive, the pure task policy, and source-verified shell/OPA tradeoffs, see [international policy design](international-policy.md).

## Lifecycle and actual integration

| Operation | V1 (`@opencode-ai/plugin`) | V2 (`@opencode/plugin`) |
| --- | --- | --- |
| Capture submitted user request | Returned `"chat.message"` hook | `ctx.session.hook("prompt", ...)` |
| Guide the active model request | `"experimental.chat.system.transform"`; append a system string | `ctx.session.hook("context", ...)`; append a typed `{type:"text", text}` system part |
| Read messages on idle | `client.session.messages({path:{id},query:{directory}})` | `ctx.session.context({sessionID})`, then normalize V2 records |
| Continue a bounded review | `client.session.promptAsync(...)` | `ctx.session.synthetic({sessionID, text, delivery:"queue", resume:true})` |
| Observe lifecycle | Returned `event` callback | `ctx.event.subscribe({signal})` async iterable |
| Resolve session directory | V1 plugin's known project directory | Prefer `ctx.session.get({sessionID}).location.directory`; fall back to `ctx.location.directory` |
| Unload | V1 hook lifecycle | Abort the event stream and dispose registered hook handles |

OpenCode V2 partial or transition contexts are deliberately ignored if the required event/session capabilities are absent. Optional task hooks may fail independently without disabling the existing idle path. A successful registration does **not** guarantee that a beta host actually delivers its events.

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
- A single successful read is observable post-change inspection, **not proof that an entire repository was comprehensively audited**. The agent's claim of a completely clean codebase is never mathematically guaranteed by this plugin.
- The normal Guardian destructive-operation rule runs **after** a tool completes, not as a pre-execution barrier. This implementation does **not** add a default pre-execution blocker or change user permission rules.
- V1's system transformation is an experimental hook. V2 `prompt` and `context` are different boundaries; a hook registration can succeed while affected beta versions still fail to deliver runtime events. Confirm on the actual intended host before release.
- Synthetic continuation is bounded rather than unconditionally repeating until the model says the task is complete. This prevents a plugin-induced infinite loop; the user may request additional iterations when the budget is exhausted.
- Existing conversation-style rules retain their configurable severities. To prioritize task completion without blocking on stylistic phrases, set `discipline/no-apology`, `discipline/no-evasion`, or `quality/no-shortcuts` to `warn` explicitly.

## Further development, intentionally not claimed as implemented

- Rich, user-confirmed structured task scopes for complex multi-part requirements; the current optional first-line directive supports a small typed contract, not a full per-file scope manifest.
- Richer per-file coverage and before/after diff evidence for a genuinely verifiable complete audit.
- Optional, separately authorized **pre-tool** checks using V1 `tool.execute.before` and V2 `ctx.tool.hook("execute.before")`; keep default fail-open and avoid unsafe blanket command blocking.
- Real-host integration tests against the exact OpenCode V1 and V2 binary builds in which the plugin will be deployed, including event loss and session interruption.
