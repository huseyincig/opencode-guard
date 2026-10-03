/** Dedicated TUI entrypoint: OpenCode 1 (tui / sidebar_content) and 2 (setup / sidebar.content). */
import type { Plugin } from "@opencode/plugin/tui";
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
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

const v2Plugin: Plugin.Definition = {
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
};

/** Use V1's actual SDK contract; V1 slot IDs are host-managed, not disposers. */
const v1Tui: TuiPlugin = async (api: TuiPluginApi) => {
  const config = loadConfig(api.state.path.directory);
  if (config.enabled === false) return;
  api.slots.register({
    order: 600,
    slots: {
      sidebar_content(_context, _props) {
        return <GuardianSidebar />;
      },
    },
  });
};

const guardianTui: TuiPluginModule & Plugin.Definition = {
  ...v2Plugin,
  tui: v1Tui,
};

export default guardianTui;
