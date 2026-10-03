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

test("root tui.js resolves the same V2 sidebar plugin for local path loading", () => {
  assert.equal(RootTui, TuiPlugin);
  assert.equal(LocalPathTui, TuiPlugin);
  assert.equal(RootTui.id, "opencode-guardian.tui");
});
