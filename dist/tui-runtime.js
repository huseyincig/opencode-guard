import { createComponent as _$createComponent } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement } from "opentui:runtime-module:%40opentui%2Fsolid";
/** Dedicated TUI entrypoint: OpenCode 1 (tui / sidebar_content) and 2 (setup / sidebar.content). */

import { createSignal, onCleanup, Show } from "opentui:runtime-module:solid-js";
import { readFileSync } from "node:fs";
import { readGuardianStatus } from "./telemetry.js";
import { loadConfig } from "./engine.js";
import { announceGuardianUpdate } from "./version-notice.js";
const guardianVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
function GuardianSidebar(props) {
  const [open, setOpen] = createSignal(false);
  const [status, setStatus] = createSignal(readGuardianStatus());
  const timer = setInterval(() => setStatus(readGuardianStatus()), 2500);
  onCleanup(() => clearInterval(timer));
  return (() => {
    var _el$ = _$createElement("box"),
      _el$2 = _$createElement("box"),
      _el$3 = _$createElement("text"),
      _el$4 = _$createElement("text"),
      _el$5 = _$createElement("b"),
      _el$7 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$setProp(_el$, "flexDirection", "column");
    _$setProp(_el$, "gap", 0);
    _$insertNode(_el$2, _el$3);
    _$insertNode(_el$2, _el$4);
    _$insertNode(_el$2, _el$7);
    _$setProp(_el$2, "flexDirection", "row");
    _$setProp(_el$2, "gap", 1);
    _$setProp(_el$2, "onMouseDown", () => setOpen(value => !value));
    _$insert(_el$3, () => open() ? "▼" : "▶");
    _$insertNode(_el$4, _el$5);
    _$insertNode(_el$5, _$createTextNode(` Guardian `));
    _$insert(_el$7, "v" + guardianVersion);
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return !open();
      },
      get children() {
        var _el$8 = _$createElement("text");
        _$insert(_el$8, () => "W:" + status().warnings + "  R:" + status().remediations);
        _$effect(_$p => _$setProp(_el$8, "fg", props.colors.muted, _$p));
        return _el$8;
      }
    }), null);
    _$insert(_el$, _$createComponent(Show, {
      get when() {
        return open();
      },
      get children() {
        return [(() => {
          var _el$9 = _$createElement("text");
          _$insert(_el$9, () => "Preflight (last start): " + status().preflight);
          _$effect(_$p => _$setProp(_el$9, "fg", props.colors.muted, _$p));
          return _el$9;
        })(), (() => {
          var _el$0 = _$createElement("text");
          _$insert(_el$0, () => "Checked: " + status().inspected + "  Blocked: " + status().blocked);
          _$effect(_$p => _$setProp(_el$0, "fg", props.colors.muted, _$p));
          return _el$0;
        })(), (() => {
          var _el$1 = _$createElement("text");
          _$insert(_el$1, () => "Warnings: " + status().warnings + "  Remediations: " + status().remediations);
          _$effect(_$p => _$setProp(_el$1, "fg", props.colors.muted, _$p));
          return _el$1;
        })(), _$createComponent(Show, {
          get when() {
            return status().errors > 0;
          },
          get children() {
            var _el$10 = _$createElement("text");
            _$insert(_el$10, () => "Inspection errors: " + status().errors);
            _$effect(_$p => _$setProp(_el$10, "fg", props.colors.muted, _$p));
            return _el$10;
          }
        }), _$createComponent(Show, {
          get when() {
            return status().truncated;
          },
          get children() {
            var _el$11 = _$createElement("text");
            _$insertNode(_el$11, _$createTextNode(`Recent log window only`));
            _$effect(_$p => _$setProp(_el$11, "fg", props.colors.muted, _$p));
            return _el$11;
          }
        })];
      }
    }), null);
    _$effect(_p$ => {
      var _v$ = props.colors.text,
        _v$2 = props.colors.accent,
        _v$3 = props.colors.onAccent,
        _v$4 = props.colors.muted;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$4, "bg", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp(_el$4, "fg", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp(_el$7, "fg", _v$4, _p$.o));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined
    });
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
      render: () => _$createComponent(GuardianSidebar, {
        get colors() {
          return {
            accent: context.theme.background.action.primary.base,
            onAccent: context.theme.text.action.primary.base,
            text: context.theme.text.base,
            muted: context.theme.text.muted
          };
        }
      })
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
        return _$createComponent(GuardianSidebar, {
          get colors() {
            return {
              accent: api.theme.current.primary,
              onAccent: api.theme.current.background,
              text: api.theme.current.text,
              muted: api.theme.current.textMuted
            };
          }
        });
      }
    }
  });
};
const guardianTui = {
  ...v2Plugin,
  tui: v1Tui
};
export default guardianTui;
