/** Dedicated TUI entrypoint: OpenCode 1 (tui / sidebar_content) and 2 (setup / sidebar.content). */
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

const v2Plugin = Plugin.define({
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


/** OpenCode 1 TUI API is separate from the V2 setup/slot API. */
type V1TuiApi = {
  state?: { path?: { directory?: string } };
  slots: {
    register(input: {
      order: number;
      slots: { sidebar_content: () => ReturnType<typeof GuardianSidebar> };
    }): unknown;
  };
};

export default {
  ...v2Plugin,
  async tui(api: V1TuiApi) {
    const config = loadConfig(api.state?.path?.directory ?? process.cwd());
    if (config.enabled === false) return;
    // V1 owns the registration lifecycle. This entrypoint exports no server hook.
    api.slots.register({
      order: 600,
      slots: {
        sidebar_content() {
          return <GuardianSidebar />;
        },
      },
    });
  },
};
