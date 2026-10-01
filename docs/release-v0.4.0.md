# v0.4.0 release preparation

This is a **source and documentation release candidate**, not a statement that v0.4.0 has already been tagged, published to npm, or released on GitHub. The repository maintainer controls those steps.

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

## Maintainer publication checklist

1. Confirm `package.json` and `package-lock.json` both declare `0.4.0` and review the version commit on `main`.
2. Confirm the **v0.4.0 version commit's** CI completed successfully on Node 22 and Node 24, including sandbox and npm audit checks.
3. Run `npm pack --dry-run` and inspect the package contents. The npm package includes compiled `dist/`, entrypoints, README, LICENSE, and the `docs/` directory. Source and test evidence links in those documents point to this GitHub repository.
4. Create and push the `v0.4.0` tag pointing to the verified version commit, using authorized GitHub credentials. Do not retarget existing version tags.
5. Perform desired live V1 revalidation and the separate V2 host tests before claiming host-level compatibility.
6. **The maintainer alone** decides whether and when to run `npm publish` and create a GitHub Release. Update the published installation instructions or release notes if the publication outcome differs from this source candidate.

Related documentation: [README](../README.md), [V1/V2 task design](task-contract-v1-v2.md), [security benchmark](security-benchmark.md), and [OWASP coverage map](owasp-agentic-top10-2026.md).
