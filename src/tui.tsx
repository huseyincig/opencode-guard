/** Dedicated TUI entrypoint: OpenCode 1 (tui / sidebar_content) and 2 (setup / sidebar.content). */
import type { Plugin } from "@opencode/plugin/tui";
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createSignal, onCleanup, Show } from "solid-js";
import { readFileSync } from "node:fs";
import type { RGBA } from "@opentui/core";
import { readGuardianStatus } from "./telemetry.js";
import { loadConfig } from "./engine.js";
import { announceGuardianUpdate } from "./version-notice.js";

const guardianVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

type SidebarColors = {
  accent: RGBA;
  onAccent: RGBA;
  text: RGBA;
  muted: RGBA;
};

function GuardianSidebar(props: { colors: SidebarColors }) {
  const [open, setOpen] = createSignal(false);
  const [status, setStatus] = createSignal(readGuardianStatus());
  const timer = setInterval(() => setStatus(readGuardianStatus()), 2500);
  onCleanup(() => clearInterval(timer));

  return (
    <box flexDirection="column" gap={0}>
      <box flexDirection="row" gap={1} onMouseDown={() => setOpen((value) => !value)}>
        <text fg={props.colors.text}>{() => open() ? "▼" : "▶"}</text>
        <text bg={props.colors.accent} fg={props.colors.onAccent}><b>{" Guardian "}</b></text>
        <text fg={props.colors.muted}>{"v" + guardianVersion}</text>
      </box>
      <Show when={!open()}>
        <text fg={props.colors.muted}>
          {() => "W:" + status().warnings + "  R:" + status().remediations}
        </text>
      </Show>
      <Show when={open()}>
        <text fg={props.colors.muted}>{() => "Preflight (last start): " + status().preflight}</text>
        <text fg={props.colors.muted}>{() => "Checked: " + status().inspected + "  Blocked: " + status().blocked}</text>
        <text fg={props.colors.muted}>{() => "Warnings: " + status().warnings + "  Remediations: " + status().remediations}</text>
        <Show when={status().errors > 0}>
          <text fg={props.colors.muted}>{() => "Inspection errors: " + status().errors}</text>
        </Show>
        <Show when={status().truncated}>
          <text fg={props.colors.muted}>Recent log window only</text>
        </Show>
      </Show>
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
      render: () => <GuardianSidebar colors={{
        accent: context.theme.background.action.primary.base,
        onAccent: context.theme.text.action.primary.base,
        text: context.theme.text.base,
        muted: context.theme.text.muted,
      }} />,
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
        return <GuardianSidebar colors={{
          accent: api.theme.current.primary,
          onAccent: api.theme.current.background,
          text: api.theme.current.text,
          muted: api.theme.current.textMuted,
        }} />;
      },
    },
  });
};

const guardianTui: TuiPluginModule & Plugin.Definition = {
  ...v2Plugin,
  tui: v1Tui,
};

export default guardianTui;
