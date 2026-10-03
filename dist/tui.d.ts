/** Dedicated TUI entrypoint: OpenCode 1 (tui / sidebar_content) and 2 (setup / sidebar.content). */
import { Plugin } from "@opencode/plugin/tui";
declare function GuardianSidebar(): import("@opentui/solid").JSX.Element;
type V1TuiApi = {
    state?: {
        path?: {
            directory?: string;
        };
    };
    slots: {
        register(input: {
            order: number;
            slots: {
                sidebar_content: () => ReturnType<typeof GuardianSidebar>;
            };
        }): unknown;
    };
};
declare const _default: Plugin.Definition & {
    tui(api: V1TuiApi): Promise<void>;
};
export default _default;
