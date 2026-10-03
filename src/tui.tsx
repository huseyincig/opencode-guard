/** OpenCode V2 CLI-only status surface. V1 loads the server without this entry. */
import { Plugin } from "@opencode/plugin/tui";
import { createSignal, onCleanup } from "solid-js";
import { readGuardianStatus } from "./telemetry.js";
import { loadConfig } from "./engine.js";
import { announceGuardianUpdate } from "./version-notice.js";

function GuardianSidebar() {
  const [status, setStatus] = createSignal(readGuardianStatus());
  const timer = setInterval(() => setStatus(readGuardianStatus()), 2500);
  onCleanup(() => clearInterval(timer));
  return (
    <box flexDirection="column" gap={0}>
      <text><b>Guardian</b></text>
      <text>{() => `Preflight (last start): ${status().preflight}`}</text>
      <text>{() => `Checked: ${status().inspected}  Blocked: ${status().blocked}`}</text>
      <text>{() => `Warnings: ${status().warnings}  Remediations: ${status().remediations}`}</text>
      <text>{() => status().truncated ? "Recent log window only" : ""}</text>
    </box>
  );
}

export default Plugin.define({
  id: "opencode-guardian.tui",
  setup(context) {
    const config = loadConfig(context.location?.directory ?? process.cwd());
    if (config.enabled !== false && config.updateNotice?.enabled !== false && typeof context.ui.toast?.show === "function") {
      void announceGuardianUpdate((current, latest) => context.ui.toast.show({
        title: "OpenCode Guardian — New version", message: `v${current} → v${latest} (update manually)`, variant: "info", duration: 5000,
      }));
    }
    // Append: never override Magic Context, AFT, or built-in sidebar sections.
    return context.ui.slot({
      append: "sidebar.content",
      render: () => <GuardianSidebar />,
    });
  },
});
