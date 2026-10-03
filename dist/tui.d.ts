/** Dedicated TUI entrypoint: OpenCode 1 (tui / sidebar_content) and 2 (setup / sidebar.content). */
import { Plugin } from "@opencode/plugin/tui";
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
declare const v1Tui: TuiPlugin;
declare const guardianTui: TuiPluginModule & Plugin.Definition;
export default guardianTui;
