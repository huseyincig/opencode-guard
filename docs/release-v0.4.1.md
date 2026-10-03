# Guardian v0.4.1 — observability and optional V2 TUI sidebar

- Redacted, persistent JSONL audit events for server startup, strict preflight shell checks and blocks, post-turn warnings and delivered remediations, and inspection failures.
- Local status summary via `opencode-guardian-status`, with bounded counter coverage and explicit last-start preflight status.
- Optional OpenCode V2 CLI sidebar contribution through `./tui` and `sidebar.content`; additive so other plugins and stock widgets are not replaced.
- V1 and V2 regression tests for real pre-execution hook decisions and telemetry; an additional TUI registration test.
- Strict preflight remains **opt-in**, and OpenCode V1 users retain the server-only behavior and CLI status command.

No npm release, tag, or installation change is performed as part of the source update.
Host rendering has not been verified against a running OpenCode V2 CLI in this development environment.
