# Changelog

Only user-visible changes and important compatibility notes are recorded here. Small fixes remain in the Git history.

## 0.4.1

- Added a local, redacted JSONL event log, `opencode-guardian-status` counters and an optional, additive OpenCode V2 sidebar status section.
- Added V1/V2 telemetry and sidebar-registration tests. Node 22/24 CI passes 323 tests and 18 isolated sandbox scenarios.
- Updated GitHub Actions and patched the Babel development dependency. Production dependency audit is clean; 12 reports from one unresolved upstream, development-only `http-cache-semantics` advisory remain visible and are explicitly checked in CI.
- Strict preflight remains opt-in and disabled by default. The V2 sidebar has SDK/mock coverage but has not been visually verified on a live V2 CLI.

## 0.4.0 — [GitHub tag](https://github.com/huseyincig/opencode-guardian/tree/v0.4.0)

- Added V1/V2 adapters, 14 configurable quality and safety rules, evidence-aware task completion and bounded remediation.
- Added optional strict pre-execution checks for recognized shell risks. The normal destructive-operation rule remains a post-turn warning by default.
- Tagged build passed Node 22/24 CI, 318 automated tests and 18 isolated sandbox scenarios. The exact tagged artifact was not verified on a live V1 or V2 host; an earlier V1 run used v0.3.0-era code.
