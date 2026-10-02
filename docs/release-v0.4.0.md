# v0.4.0 release status

**GitHub tag:** [v0.4.0](https://github.com/huseyincig/opencode-guardian/tree/v0.4.0) points to [`cafb5cf`](https://github.com/huseyincig/opencode-guardian/commit/cafb5cf41b9adbeba4233ef3361d32ff3bb02b42). **CI:** [successful](https://github.com/huseyincig/opencode-guardian/actions/runs/36923665512). npm publication and a GitHub Release have **not been verified in this document**. Documentation fixes committed to `main` after the tag do not change the existing tagged source or an already packed artifact.

## Included capabilities

- Dual OpenCode adapters: V1 `server` hooks and V2 `setup` / event-subscription integration, subject to host capabilities.
- Fourteen configurable post-turn quality/safety rules and bounded task continuation.
- Opt-in strict preflight (`preflight.enabled: true`, **off by default**) for recognized shell-execution tools. It rejects selected destructive commands, plain `rm` invocations, active paired backtick substitutions, opaque decoded-shell pipelines, and uninspectable shell input before the host executes a supported tool.
- Target-aware post-turn deletion findings: plain and recursive file removals require matching, explicit target authorization. Questions and requests for explanations do not authorize deletion.
- Strict V2 preflight fails visibly on incomplete host context, invalid/unavailable event subscription, or unsupported tool-hook registration rather than silently skipping the protection. Partial V2 contexts remain tolerated when strict preflight is disabled.
- Evidence-based verification and source-review checks; missing evidence is not presented as proven success.

## Verification and limits

The automated suite has **318 unit/regression tests** and **18 isolated sandbox scenarios**, plus a frozen **17-case non-executing synthetic security benchmark**. CI targets Node 22 and 24, runs typechecking, npm audit, and a package dry run. Passing the synthetic benchmark does not establish real-world bypass rates or complete shell coverage.

An earlier **OpenCode V1 1.18.34** live sandbox run was reported against v0.3.0-era code. The **exact v0.4.0 artifact has not been rerun on a live V1 installation**. V2 adapters have type and mock-host coverage; **real V2 host integration has not been verified**. Test actual hook delivery, pre-execution refusal, event handling, and plugin cleanup on the deployment host. No test here proves that arbitrary custom MCP tools, dynamic interpreters, or arbitrary shell syntax are intercepted.

The ordinary `safety/destructive-operations` rule defaults to `warn` and runs **after** tool execution. Opt-in strict preflight only applies to supported shell tool names and inspected command shapes, and it rejects recognized destructive calls even when the user requested them. Keep host permissions, confirmation and filesystem isolation in place.

## Publication and validation

- **Completed for the tagged commit:** package version `0.4.0`, Node 22/24 CI, sandbox checks, npm audit and npm package dry run (62 files at preparation time), and the `v0.4.0` tag.
- **Still to validate:** the exact v0.4.0 package on a live V1 host and the adapter on a separate real V2 host before claiming production compatibility.
- **Maintainer-controlled:** npm publication and GitHub Release, if desired. Do not retarget `v0.4.0` to include later documentation fixes; use a separate documented update or new version when publishing a changed artifact.

Related documentation: [README](../README.md), [V1/V2 task design](task-contract-v1-v2.md), [security benchmark](security-benchmark.md), and [OWASP coverage map](owasp-agentic-top10-2026.md).
