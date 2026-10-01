# International and evidence-based policy design

This document describes the **v0.4.0 repository source** prepared for maintainer publication. A version bump or Git commit is not proof of an npm publication or GitHub release. No finite phrase list or language model can guarantee perfect interpretation across all languages.

## Sources actually verified

- [Guardians of the Agents](https://doi.org/10.1145/3777544), Erik Meijer, *Communications of the ACM*, online 16 December 2025. The ACM author listing names Erik Meijer; Nada Amin is not listed. The relevant idea is to verify explicitly defined properties before executing tools, where the host supports such an intervention.
- [albertjoseph0/opencode-plugin-guardians](https://github.com/albertjoseph0/opencode-plugin-guardians): the V1 `tool.execute.before` implementation POSTs tool arguments to a local Python/Z3 sidecar at port 8765. When the service is unavailable it logs and continues. It is an example of integration, not proof that every agent action is safe.
- [bashlex](https://github.com/idank/bashlex): Bash AST parsing through Python, GPLv3+ licensing and documented incomplete expansion support. It is not a dependency of this MIT TypeScript plugin.
- [ShellCheck](https://www.shellcheck.net/wiki/SC1071): static analysis for sh/bash/dash/ksh. It does not decide whether the user authorized an operation.
- [tree-sitter-bash](https://github.com/tree-sitter/tree-sitter-bash): MIT-licensed Bash grammar and Node bindings. A candidate for a separately tested, optional AST parser rather than a mandatory native runtime dependency.
- [OPA / Rego](https://www.openpolicyagent.org/docs/policy-language) and [integration methods](https://www.openpolicyagent.org/docs/integration): structured policy evaluation (including a WASM target), not an arbitrary-language intent interpreter.
- [OpenCode V1 plugin hooks](https://opencode.ai/docs/plugins/) and [OpenCode V2 plugin APIs](https://opencode.ai/v2/docs/build/plugins). The adapters were checked against installed `@opencode-ai/plugin` 1.18.34 and `@opencode/plugin` 2.0.21 type declarations. An earlier live OpenCode V1 1.18.34 run used v0.3.0-era code; current v0.4.0 changes have automated/mock-host coverage, and real V2 host testing remains outstanding.

## Implemented decision pipeline

The latest genuine human request is processed by conservative English/Turkish extraction, eleven additional signal packs (es, pt, fr, de, ru, ar, hi, zh, ja, ko, id), or an optional exact typed directive. Every supported route produces the same canonical `TaskContract`.

`evaluateTaskPolicy(TaskContract, TurnEvidence)` is a pure, language-neutral evaluator. It uses ordered tool records and returns a review state (`missing`, `observed`, `no-mutation`, `not-required`) and requested verification states (`passed`, `failed`, `unknown`). A successful read is evidence of some inspection, **not** proof of an exhaustive audit; `reviewProvesFullCoverage` is always false. Unsupported dialects or ambiguous outcomes do not create blocking requirements.

Explicit multilingual prohibitions, speculative questions, observed progress and reported blockers are separately tested. Bounded continuation uses the existing `iterationBudget`; normal remediation retains its own budget.

## Optional exact protocol for any language

The directive must begin the *latest real user's message*. Supported fields are only `mode`, `review` and `verify`:

```text
@guardian-task {"mode":"iterative-review","review":"source","verify":["test","typecheck"]}
[Describe the task in any language.]
```

Modes: `iterative-review` or `one-pass`. Review: `source` or `checks`. Verification: `test`, `build`, `typecheck`, `lint`, `audit`. Unknown fields and malformed directives are rejected. Recognized explicit prohibitions in the body override contradictory directives. This protocol is optional and never grants publishing, destructive-operation or tool permissions.

## Trust and failure model

An international phrase pack is a source of *signals*, not an independent authorization policy. It supports explicit action, repetition, review, negation, requested tests, historical refusal, completion and reported blockers. The original prompt is preserved and passed to the model; interpretation can be incomplete without inventing new obligations.

A missing tool result, a test executed before the last edit, an unrecognized command dialect, or an event not delivered by the host is **unknown**, not a confirmed success. The destructive-operation rule uses post-tool inspection at default `warn` severity, including literal path authorization for plain file removals; questions about deletion are not authorization. The separately implemented strict preflight is opt-in and rejects selected known-shell calls before execution. A typed directive cannot override these protections or authorize tools.

A single post-change file read does not establish that every file in the project has been inspected. A future exhaustive-review guarantee would require an explicit file-scope manifest, file-level coverage evidence and validation of exclusions. Until then Guardian must not claim such a guarantee.

## Next phases — deliberately not claimed as implemented

1. **Shell AST adapter:** prototype the MIT-licensed `tree-sitter-bash` parser or a WASM build behind an opt-in setting. Test quoting, nested substitutions, pipelines, redirects, unknown syntax, platform portability and Node 22/24 packaging. Never interpret a parse error as an authorized action.
2. **Extend existing pre-tool checks:** the optional V1 `tool.execute.before` / V2 `ctx.tool.hook("execute.before")` integration already rejects selected risky known-shell calls. Evaluate richer typed actions, scoped permissions, renamed/custom tools and an independent budget as separately designed additions. Keep current strict mode opt-in, and do not claim complete interception or shell parsing.
3. **Optional semantic interpreter:** an explicitly enabled, host-compatible multilingual model could *propose* a strictly validated contract with source spans from the latest human request. It must not itself authorize tools, manufacture successful test evidence or silently add requirements. Contradictions and uncertainty remain advisory until resolved.
4. **Policy-as-code backend:** complex organizational rules could evaluate the same canonical JSON through optional OPA/Rego/WASM. The pure TypeScript evaluator remains the dependency-free default.
5. **Real-host benchmark:** test the exact V1 and V2 binaries and varied languages, negations, questions, quotations, mixed-language instructions, interrupted sessions and lost events. Measure false positives, false negatives, latency, bounded continuations and actual task outcomes; passing curated tests is not universal accuracy.
