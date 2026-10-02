# International task policy

Guardian recognizes explicit task signals in English and Turkish, with additional conservative signal packs for Spanish, Portuguese, French, German, Russian, Arabic, Hindi, Chinese, Japanese, Korean and Indonesian. All supported inputs produce the same typed `TaskContract`. This is pattern-based extraction, not complete natural-language understanding.

## Implementation

The latest genuine user request is processed by the task extractor in [`src/task-contract.ts`](https://github.com/huseyincig/opencode-guardian/blob/main/src/task-contract.ts) and locale signals in [`src/locale-intents.ts`](https://github.com/huseyincig/opencode-guardian/blob/main/src/locale-intents.ts). The language-independent `evaluateTaskPolicy(TaskContract, TurnEvidence)` uses ordered tool records to assess post-change review and requested verification. It returns review states `missing`, `observed`, `no-mutation` or `not-required`, and verification states `passed`, `failed` or `unknown`.

A successful source read establishes that some inspection occurred, not that every project file was examined; `reviewProvesFullCoverage` is always `false`. Missing or ambiguous evidence is not treated as a confirmed success. Remediation and iterative continuation use separate, bounded budgets.

## Optional typed directive

The latest real user's message may begin with a directive to make the supported task conditions explicit:

```text
@guardian-task {"mode":"iterative-review","review":"source","verify":["test","typecheck"]}
[Describe the task in any language.]
```

Supported fields are `mode` (`iterative-review` or `one-pass`), `review` (`source` or `checks`), and `verify` (`test`, `build`, `typecheck`, `lint`, `audit`). Malformed directives and unknown fields are rejected. Recognized prohibitions in the message override conflicting directives. The directive does not grant tool permissions, authorize destructive actions or authorize publication.

## Security and host boundaries

Guardian's destructive-operation rule reviews completed tool activity at default `warn` severity. Selected `rm` operations require explicit, target-matching authorization; questions and explanation requests are not consent. Optional strict preflight (`preflight.enabled: true`) rejects recognized risky calls through supported shell hooks **before** execution, including recognized destructive commands even when explicitly requested. It is disabled by default and does not intercept every tool or parse arbitrary shell syntax.

The V1 adapter was tested on a real OpenCode V1 1.18.34 host with an earlier code revision. Current changes have automated and mock-host coverage; a real V2 installation has not yet been validated. See [V1/V2 adapter design](task-contract-v1-v2.md), [release status](release-v0.4.0.md) and [V1 performance results](performance-benchmark.md).

## References and future options

- [OpenCode V1 plugin hooks](https://opencode.ai/docs/plugins/) and [V2 plugin APIs](https://opencode.ai/v2/docs/build/plugins/) document the host integration boundaries. The adapters were checked against `@opencode-ai/plugin` 1.18.34 and `@opencode/plugin` 2.0.21 TypeScript declarations.
- Erik Meijer's [*Guardians of the Agents*](https://doi.org/10.1145/3777544), published in *Communications of the ACM* in December 2025, discusses checking defined properties before an agent executes tools when its host supports interception.
- [tree-sitter-bash](https://github.com/tree-sitter/tree-sitter-bash) and [OPA/Rego](https://www.openpolicyagent.org/docs/policy-language) are possible future options for structured shell parsing and policy-as-code. Neither is currently a Guardian dependency.

Planned work may include wider shell-tool coverage, richer per-file review evidence, and separately validated optional parsing or policy adapters. These are **not implemented** in v0.4.0.
