import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { newerStableVersion, checkGuardianUpdate, announceGuardianUpdate } from "../dist/version-notice.js";

function options(t, latest = "0.4.3") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-notice-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let calls = 0;
  return {
    input: {
      installedVersion: "0.4.2", allowDevelopment: true,
      cachePath: path.join(dir, "notice.json"), now: 1_800_000_000_000,
      fetcher: async () => { calls++; return {
        ok: true, json: async () => ({ name: "opencode-guardian", version: latest }),
      }; },
    },
    get calls() { return calls; },
  };
}
test("stable semver comparison ignores prereleases and does not downgrade", () => {
  for (const [a, b, expected] of [
    ["0.4.2", "0.4.3", true], ["0.4.2", "0.5.0", true],
    ["0.4.2", "1.0.0", true], ["0.4.2", "0.4.2", false],
    ["1.0.0", "0.99.99", false], ["0.4.2", "0.4.3-beta.1", false],
    ["0.4.2-local", "0.4.3", false],
  ]) assert.equal(newerStableVersion(a, b), expected, a + " / " + b);
});
test("24-hour cached update appears without a second registry request", async (t) => {
  const fixture = options(t);
  assert.deepEqual(await checkGuardianUpdate(fixture.input), { current: "0.4.2", latest: "0.4.3" });
  assert.deepEqual(await checkGuardianUpdate({ ...fixture.input, now: fixture.input.now + 23 * 3600_000 }), { current: "0.4.2", latest: "0.4.3" });
  assert.equal(fixture.calls, 1);
  await checkGuardianUpdate({ ...fixture.input, now: fixture.input.now + 25 * 3600_000 });
  assert.equal(fixture.calls, 2);
});
test("an up-to-date install stays silent and network failures fail open", async (t) => {
  assert.equal(await checkGuardianUpdate(options(t, "0.4.2").input), undefined);
  const fixture = options(t);
  assert.equal(await checkGuardianUpdate({ ...fixture.input, fetcher: async () => { throw new Error("offline"); } }), undefined);
  let shown = 0;
  await announceGuardianUpdate(() => { shown++; throw new Error("toast unavailable"); }, fixture.input);
  assert.equal(shown, 1);
});
test("local development mode skips networking by default", async (t) => {
  const fixture = options(t);
  assert.equal(await checkGuardianUpdate({ ...fixture.input, allowDevelopment: false }), undefined);
  assert.equal(fixture.calls, 0);
});
test("invalid registry responses do not create notices", async (t) => {
  const fixture = options(t);
  const fetcher = async () => ({ ok: true, json: async () => ({ name: "other-package", version: "9.0.0" }) });
  assert.equal(await checkGuardianUpdate({ ...fixture.input, fetcher }), undefined);
});
