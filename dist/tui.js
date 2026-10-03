import { jsx as _jsx, jsxs as _jsxs } from "@opentui/solid/jsx-runtime";
/** OpenCode V2 CLI-only status surface. V1 loads the server without this entry. */
import { Plugin } from "@opencode/plugin/tui";
import { createSignal, onCleanup } from "solid-js";
import { readGuardianStatus } from "./telemetry.js";
function GuardianSidebar() {
    const [status, setStatus] = createSignal(readGuardianStatus());
    const timer = setInterval(() => setStatus(readGuardianStatus()), 2500);
    onCleanup(() => clearInterval(timer));
    return (_jsxs("box", { flexDirection: "column", gap: 0, children: [_jsx("text", { children: _jsx("b", { children: "Guardian" }) }), _jsx("text", { children: () => `Preflight (last start): ${status().preflight}` }), _jsx("text", { children: () => `Checked: ${status().inspected}  Blocked: ${status().blocked}` }), _jsx("text", { children: () => `Warnings: ${status().warnings}  Remediations: ${status().remediations}` }), _jsx("text", { children: () => status().truncated ? "Recent log window only" : "" })] }));
}
export default Plugin.define({
    id: "opencode-guardian.tui",
    setup(context) {
        // Append: never override Magic Context, AFT, or built-in sidebar sections.
        return context.ui.slot({
            append: "sidebar.content",
            render: () => _jsx(GuardianSidebar, {}),
        });
    },
});
