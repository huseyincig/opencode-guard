import { createComponent as _$createComponent } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement } from "opentui:runtime-module:%40opentui%2Fsolid";
/** Dedicated TUI entrypoint: OpenCode 1 (tui / sidebar_content) and 2 (setup / sidebar.content). */

import { createSignal, onCleanup } from "opentui:runtime-module:solid-js";
import { readGuardianStatus } from "./telemetry.js";
import { loadConfig } from "./engine.js";
import { announceGuardianUpdate } from "./version-notice.js";
function GuardianSidebar() {
  const [status, setStatus] = createSignal(readGuardianStatus());
  const timer = setInterval(() => setStatus(readGuardianStatus()), 2500);
  onCleanup(() => clearInterval(timer));
  return (() => {
    var _el$ = _$createElement("box"),
      _el$2 = _$createElement("text"),
      _el$3 = _$createElement("b"),
      _el$5 = _$createElement("text"),
      _el$6 = _$createElement("text"),
      _el$7 = _$createElement("text"),
      _el$8 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$5);
    _$insertNode(_el$, _el$6);
    _$insertNode(_el$, _el$7);
    _$insertNode(_el$, _el$8);
    _$setProp(_el$, "flexDirection", "column");
    _$setProp(_el$, "gap", 0);
    _$insertNode(_el$2, _el$3);
    _$insertNode(_el$3, _$createTextNode(`Guardian`));
    _$insert(_el$5, () => `Preflight (last start): ${status().preflight}`);
    _$insert(_el$6, () => `Checked: ${status().inspected}  Blocked: ${status().blocked}`);
    _$insert(_el$7, () => `Warnings: ${status().warnings}  Remediations: ${status().remediations}`);
    _$insert(_el$8, () => status().truncated ? "Recent log window only" : "");
    return _el$;
  })();
}
const v2Plugin = {
  id: "opencode-guardian.tui",
  setup(context) {
    const config = loadConfig(context.location?.directory ?? process.cwd());
    if (config.enabled !== false && config.updateNotice?.enabled !== false && typeof context.ui.toast?.show === "function") {
      void announceGuardianUpdate((current, latest) => context.ui.toast.show({
        title: "OpenCode Guardian — New version",
        message: `v${current} → v${latest} (update manually)`,
        variant: "info",
        duration: 5000
      }));
    }
    // Append: never override Magic Context, AFT, or built-in sidebar sections.
    return context.ui.slot({
      append: "sidebar.content",
      render: () => _$createComponent(GuardianSidebar, {})
    });
  }
};

/** Use V1's actual SDK contract; V1 slot IDs are host-managed, not disposers. */
const v1Tui = async api => {
  const config = loadConfig(api.state.path.directory);
  if (config.enabled === false) return;
  api.slots.register({
    order: 600,
    slots: {
      sidebar_content(_context, _props) {
        return _$createComponent(GuardianSidebar, {});
      }
    }
  });
};
const guardianTui = {
  ...v2Plugin,
  tui: v1Tui
};
export default guardianTui;
