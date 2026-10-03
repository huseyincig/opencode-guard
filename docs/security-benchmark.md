# Synthetic security benchmark

The frozen test set is defined in [the benchmark tests](https://github.com/huseyincig/opencode-guardian/blob/main/tests/security-benchmark.test.mjs).

Separate [shell-gap regressions](https://github.com/huseyincig/opencode-guardian/blob/main/tests/security-gap-regression.test.mjs) cover backticks, plain `rm` and inert examples. [Audit regressions](https://github.com/huseyincig/opencode-guardian/blob/main/tests/security-audit-regression.test.mjs) cover questions versus consent and strict V2 setup errors. These are outside the 17-case benchmark.

The **17 non-executing synthetic cases** exercise `evaluatePreflight`. They do not execute the supplied shell commands, modify filesystem targets or measure successful attacks on a real OpenCode host.

| Defined label | Cases | Observed decision |
| --- | ---: | --- |
| Reject (destructive, opaque or uninspectable input) | 10 | 10 rejected as labeled |
| Allow (ordinary/read-only or non-shell use) | 7 | 7 allowed as labeled |
| Incorrect decisions in this 17-case set | — | 0 |

All 17 cases matched their predefined labels. This result does **not** imply a zero false-positive or false-negative rate outside the curated set. The tests also verify that evaluation preserves input and that selected cases agree with post-turn classification. Adapter tests are in [preflight.test.mjs](https://github.com/huseyincig/opencode-guardian/blob/main/tests/preflight.test.mjs); the separate [18-scenario sandbox](https://github.com/huseyincig/opencode-guardian/blob/main/sandbox/comprehensive-test.mjs) uses isolated mock hosts.

The benchmark excludes live host permissions, arbitrary interpreters, dynamic shell expressions and custom shell-tool names. Strict preflight is disabled by default. For real-host verification status, see the [changelog](../CHANGELOG.md), and for previous V1 latency measurements see [performance benchmark](performance-benchmark.md).
