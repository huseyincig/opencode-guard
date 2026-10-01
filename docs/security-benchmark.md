# Synthetic security benchmark

Snapshot: 2026-10-01; see [the executable cases](../tests/security-benchmark.test.mjs).

The independent [gap regression suite](../tests/security-gap-regression.test.mjs) covers selected active backtick substitutions, plain file removal and inert shell examples; [security audit regressions](../tests/security-audit-regression.test.mjs) cover deletion questions versus explicit authorization and strict V2 setup failures. These additional tests do **not** change the frozen 17-case benchmark counts below.

This frozen, non-executing corpus measures the behavior of `evaluatePreflight` on **17 synthetic examples**, not exploit success in a real OpenCode installation. No shell commands in this corpus are run, no filesystem targets are modified, and no external benchmark dataset is claimed.

| Defined label | Cases | Observed decision |
| --- | ---: | --- |
| Reject (destructive, opaque or uninspectable input) | 10 | 10 rejected as labeled |
| Allow (ordinary/read-only or non-shell use) | 7 | 7 allowed as labeled |
| False allowances in this set | — | 0 |
| False rejections in this set | — | 0 |

The test also verifies that evaluation does not mutate the supplied tool input and that supported destructive/opaque cases agree with post-turn classification. V1 and V2 hook adapter regression tests live in [preflight.test.mjs](../tests/preflight.test.mjs) and [international-adapters.test.mjs](../tests/international-adapters.test.mjs). The separate [18-case sandbox](../sandbox/comprehensive-test.mjs) is an isolated mock-host test, not production OpenCode.

**Verification boundary for v0.4.0:** a previous live OpenCode V1 1.18.34 test used v0.3.0-era code, not this exact release candidate. v0.4.0's current adapter behavior is covered by unit/mock-host tests and the isolated sandbox; the exact v0.4.0 package has not yet been revalidated on a live V1 installation. A real V2 host has not been tested. Host permissions, competing plugins, dynamic shell expressions, arbitrary interpreters, renamed tools, real-world prompt injection, and external benchmark results also remain unverified. Do not infer these from the synthetic matrix. Optional preflight remains disabled by default.
