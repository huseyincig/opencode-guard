import { jsx as _jsx, jsxs as _jsxs } from "@opentui/solid/jsx-runtime";
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
    return (_jsxs("box", { flexDirection: "column", gap: 0, children: [_jsx("text", { children: _jsx("b", { children: "Guardian" }) }), _jsx("text", { children: () => `Preflight (last start): ${status().preflight}` }), _jsx("text", { children: () => `Checked: ${status().inspected}  Blocked: ${status().blocked}` }), _jsx("text", { children: () => `Warnings: ${status().warnings}  Remediations: ${status().remediations}` }), _jsx("text", { children: () => status().truncated ? "Recent log window only" : "" })] }));
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
            render: () => _jsx(GuardianSidebar, {}),
        });
    },
});
/** Use V1's actual SDK contract; V1 slot IDs are host-managed, not disposers. */
const v1Tui = async (api) => {
    const config = loadConfig(api.state.path.directory);
    if (config.enabled === false)
        return;
    api.slots.register({
        order: 600,
        slots: {
            sidebar_content(_context, _props) {
                return _jsx(GuardianSidebar, {});
            },
        },
    });
};
const guardianTui = {
    ...v2Plugin,
    tui: v1Tui,
};
export default guardianTui;
