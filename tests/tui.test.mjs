import test from "node:test";
import assert from "node:assert/strict";
import TuiPlugin from "../dist/tui.js";
import RootTui, { default as LocalPathTui } from "../tui.js";

test("V2 TUI registers an additive sidebar slot and returns its disposer", () => {
  let claim;
  const stop = () => {};
  const cleanup = TuiPlugin.setup({
    ui: { slot(input) { claim = input; return stop; } },
  });
  assert.equal(TuiPlugin.id, "opencode-guardian.tui");
  assert.equal(claim.append, "sidebar.content");
  assert.equal(claim.replace, undefined);
  assert.equal(typeof claim.render, "function");
  assert.equal(cleanup, stop);
});

test("root tui.js resolves the same dual-mode sidebar plugin for local path loading", () => {
  assert.equal(RootTui, TuiPlugin);
  assert.equal(LocalPathTui, TuiPlugin);
  assert.equal(RootTui.id, "opencode-guardian.tui");
});


test("V1 TUI registers sidebar_content as an additive slot and renders the Guardian sidebar", async () => {
  let claim;
  let calls = 0;
  const registration = await TuiPlugin.tui({
    slots: {
      register(input) { calls++; claim = input; return "guardian-v1-slot"; },
    },
  });
  assert.equal(registration, undefined);
  assert.equal(calls, 1);
  assert.equal(claim.order, 600);
  assert.equal(typeof claim.slots.sidebar_content, "function");
  assert.equal(typeof claim.slots.sidebar_content({}, { session_id: "session" }), "object");
  assert.equal(TuiPlugin.server, undefined);
});

test("V1 and V2 sidebar registration APIs coexist in the same package entrypoint", async () => {
  let v1 = false;
  let v2 = false;
  await TuiPlugin.tui({ slots: { register(input) {
    v1 = typeof input.slots.sidebar_content === "function";
    return "guardian-v1-slot";
  } } });
  const dispose = TuiPlugin.setup({ ui: { slot(input) {
    v2 = input.append === "sidebar.content";
    return () => {};
  } } });
  assert.equal(v1, true);
  assert.equal(v2, true);
  assert.equal(typeof dispose, "function");
});

test("V1 TUI honors the same disabled Guardian configuration", async (t) => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-v1-tui-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "opencode-guardian.json"), '{"enabled":false}');
  let called = false;
  await TuiPlugin.tui({
    state: { path: { directory: dir } },
    slots: { register() { called = true; } },
  });
  assert.equal(called, false);
});
