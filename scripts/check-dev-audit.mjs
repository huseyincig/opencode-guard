#!/usr/bin/env node
/** Keep the dev dependency audit visible and fail on any new advisory. */
import { spawnSync } from "node:child_process";

const audit = spawnSync("npm", ["audit", "--json"], {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
if (audit.error) {
  console.error("Could not run npm audit:", audit.error);
  process.exit(1);
}
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error("Could not parse npm audit output:", audit.stdout.slice(0, 500), audit.stderr.slice(0, 500));
  process.exit(1);
}
if (audit.status !== 0 && audit.status !== 1) {
  console.error("npm audit did not finish normally:", audit.stderr.slice(0, 500));
  process.exit(1);
}
if (!report.vulnerabilities || !report.metadata?.vulnerabilities) {
  console.error("npm audit returned an incomplete report");
  process.exit(1);
}
const knownUpstreamChain = new Set([
  "@npmcli/arborist", "@npmcli/metavuln-calculator", "@opencode/plugin",
  "@opencode/util", "@sigstore/sign", "@sigstore/tuf",
  "http-cache-semantics", "make-fetch-happen", "npm-registry-fetch",
  "pacote", "sigstore", "tuf-js",
]);
const advisory = "GHSA-ch52-4w7c-c8xp";
const issues = Object.entries(report.vulnerabilities);
const underlying = report.vulnerabilities["http-cache-semantics"];
const correctAdvisory = underlying && underlying.via.some(
  (item) => typeof item === "object" &&
    (item.url?.includes(advisory) || item.title?.includes(advisory)),
);
const unexpected = issues.filter(([name, details]) =>
  !knownUpstreamChain.has(name) || details.severity !== "high" ||
  details.via.some((item) => typeof item === "string"
    ? !knownUpstreamChain.has(item)
    : !item.url?.includes(advisory)),
);
const counts = report.metadata.vulnerabilities;
const valid = unexpected.length === 0 &&
  (issues.length === 0 || correctAdvisory) &&
  counts.critical === 0 && counts.moderate === 0 && counts.low === 0 &&
  counts.high === issues.length;
console.log(`Full development-dependency audit: ${issues.length} vulnerable packages (${counts.high} high, ${counts.moderate} moderate, ${counts.low} low, ${counts.critical} critical).`);
if (issues.length) {
  console.warn(`Known unresolved development-only SDK dependency chain: ${advisory}; root package http-cache-semantics.`);
  console.warn(`Tracked packages: ${issues.map(([name]) => name).join(", ")}`);
}
if (!valid) {
  console.error("New or unexpected audit vulnerabilities detected. Investigate before merging.");
  if (unexpected.length) console.error("Unexpected packages:", unexpected.map(([name]) => name).join(", "));
  process.exit(1);
}
