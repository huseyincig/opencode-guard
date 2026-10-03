/** Dedicated TUI entrypoint: OpenCode 1 (tui / sidebar_content) and 2 (setup / sidebar.content). */
import type { Plugin } from "@opencode/plugin/tui";
import type { TuiPluginModule } from "@opencode-ai/plugin/tui";
declare const guardianTui: TuiPluginModule & Plugin.Definition;
export default guardianTui;
