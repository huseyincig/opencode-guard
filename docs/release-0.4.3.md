# Guardian 0.4.3 — release notes

## Changes since 0.4.2

- A passive, five-second update notice checks npm for a newer stable Guardian release. The latest result is cached for 24 hours, network failures are ignored and Guardian never installs an update automatically.
- The optional TUI entrypoint supports both OpenCode V1 `tui(api)` / `sidebar_content` and OpenCode V2 `setup(context)` / `sidebar.content`. It adds its sidebar section without replacing existing widgets.
- V1 TUI registration is typed against `TuiPlugin`, `TuiPluginApi` and `TuiPluginModule` from `@opencode-ai/plugin/tui`; V2 remains typed against `@opencode/plugin/tui`.
- Additional regression tests verify V1/V2 slot registration, disabled configuration, update checks, caching and failure tolerance.
- Package metadata, lockfile and the source documentation identify the release as `0.4.3`.

## Verification and limits

The release checks are Node 22/24 typecheck and unit/regression tests, the 18-scenario sandbox, the existing CI dependency checks and an npm package dry run. See the linked CI run for actual results. V1 and V2 SDK/slot registration tests are not a substitute for observing the sidebar on real terminals. Actual V2 server-host integration and live TUI rendering remain unverified. Development dependency advisories documented in the README have not been declared resolved.

No npm publication or automatic updates are performed as part of this source release.
