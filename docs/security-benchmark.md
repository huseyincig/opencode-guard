# Synthetic security benchmark

Snapshot: 2026-10-01; see [the executable cases](../tests/security-benchmark.test.mjs).

The independent [gap regression suite](../tests/security-gap-regression.test.mjs) covers selected active backtick substitutions, plain file removal and inert shell examples. The 17-case benchmark counts below remain unchanged.

This frozen, non-executing corpus measures the behavior of `evaluatePreflight` on **17 synthetic examples**, not exploit success in a real OpenCode installation. No shell commands in this corpus are run, no filesystem targets are modified, and no external benchmark dataset is claimed.

| Defined label | Cases | Observed decision |
| --- | ---: | --- |
| Reject (destructive, opaque or uninspectable input) | 10 | 10 rejected as labeled |
| Allow (ordinary/read-only or non-shell use) | 7 | 7 allowed as labeled |
| False allowances in this set | — | 0 |
| False rejections in this set | — | 0 |

The test also verifies that evaluation does not mutate the supplied tool input and that supported destructive/opaque cases agree with post-turn classification. V1 and V2 hook adapter regression tests live in [preflight.test.mjs](../tests/preflight.test.mjs) and [international-adapters.test.mjs](../tests/international-adapters.test.mjs). The separate [18-case sandbox](../sandbox/comprehensive-test.mjs) is an isolated mock-host test, not production OpenCode.

**Unverified:** actual V1/V2 OpenCode installations, host permissions and competing plugins, dynamic shell expressions, arbitrary script interpreters, renamed tools, real-world prompt injection, and published external benchmark scores. These require separate controlled integration runs and should never be inferred from the synthetic matrix. Optional preflight remains disabled by default.
