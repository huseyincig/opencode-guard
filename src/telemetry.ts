/** Minimal, redacted, local Guardian event log shared by the server and TUI. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

export type GuardianEventKind =
  | "runtime-started" | "preflight-allowed" | "preflight-blocked"
  | "post-warning" | "post-remediation" | "inspection-error";
export type PreflightState = "active" | "disabled" | "unavailable";
export interface GuardianEvent {
  at: string;
  kind: GuardianEventKind;
  runtime?: "v1" | "v2";
  preflight?: PreflightState;
  session?: string;
  tool?: string;
  rules?: string[];
}
export type GuardianStatus = {
  preflight: PreflightState | "unknown";
  inspected: number;
  blocked: number;
  warnings: number;
  remediations: number;
  errors: number;
  truncated: boolean;
  lastEvent?: string;
};

export function guardianStateDirectory(directory?: string): string {
  if (process.env.OPENCODE_GUARDIAN_STATE_DIR) return process.env.OPENCODE_GUARDIAN_STATE_DIR;
  if (directory && typeof directory === "string" && directory.trim().length > 0) {
    return path.join(directory, ".opencode");
  }
  // Node's built-in test runner sets this only in test workers. Keep synthetic
  // checks from polluting the actual user's live intervention statistics.
  if (process.env.NODE_TEST_CONTEXT) return path.join(os.tmpdir(), `opencode-guardian-tests-${process.pid}`);
  return path.join(os.homedir(), ".local", "state", "opencode-guardian");
}
export function guardianEventPath(directory?: string): string {
  const dir = guardianStateDirectory(directory);
  if (fs.existsSync(path.join(dir, "events.jsonl")) && !fs.existsSync(path.join(dir, "guardian-events.jsonl"))) {
    return path.join(dir, "events.jsonl");
  }
  return path.join(dir, "guardian-events.jsonl");
}
export function sessionFingerprint(value?: string): string | undefined {
  return value ? createHash("sha256").update(value).digest("hex").slice(0, 16) : undefined;
}
let reportedWriteFailure = false;
export function recordGuardianEvent(event: Omit<GuardianEvent, "at">, directoryArg?: string): void {
  try {
    const dir = guardianStateDirectory(directoryArg);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(dir);
    // A pre-existing shared directory or a symlink must not expose the log.
    // When writing to a project directory (.opencode), standard project umask permissions apply.
    // Strict 0700 private mode is enforced for global user directories or when explicitly configured.
    const isProjectDirectory = Boolean(directoryArg && !process.env.OPENCODE_GUARDIAN_STATE_DIR);
    if (!stat.isDirectory() || (process.platform !== "win32" &&
        ((!isProjectDirectory && (stat.mode & 0o077) !== 0) ||
        (typeof process.getuid === "function" && stat.uid !== process.getuid())))) {
      throw new Error("Guardian state directory is not private to the current user");
    }
    const fd = fs.openSync(
      guardianEventPath(directoryArg),
      fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | (fs.constants.O_NOFOLLOW ?? 0),
      0o600
    );
    try {
      const file = fs.fstatSync(fd);
      if (!file.isFile() || (typeof process.getuid === "function" && file.uid !== process.getuid())) {
        throw new Error("Guardian event log is not a regular file owned by the current user");
      }
      if (process.platform !== "win32" && (file.mode & 0o777) !== 0o600) {
        fs.fchmodSync(fd, 0o600);
      }
      const safe: GuardianEvent = {
        at: new Date().toISOString(), kind: event.kind,
        ...(event.runtime ? { runtime: event.runtime } : {}),
        ...(event.preflight ? { preflight: event.preflight } : {}),
        ...(event.session ? { session: event.session } : {}),
        ...(event.tool ? { tool: event.tool } : {}),
        ...(event.rules ? { rules: event.rules } : {}),
      };
      fs.writeSync(fd, `${JSON.stringify(safe)}\n`);
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    if (!reportedWriteFailure) {
      reportedWriteFailure = true;
      console.error("[opencode-guardian] Could not write local event log:", error);
    }
  }
}

/** Reads at most the newest 2 MiB: counters describe this bounded event window. */
export function readGuardianStatus(
  directoryOrMaxBytes?: string | number,
  maxBytesArg = 2 * 1024 * 1024
): GuardianStatus {
  let directory: string | undefined;
  let maxBytes = maxBytesArg;
  if (typeof directoryOrMaxBytes === "number") {
    maxBytes = directoryOrMaxBytes;
  } else if (typeof directoryOrMaxBytes === "string") {
    directory = directoryOrMaxBytes;
  }
  const result: GuardianStatus = {
    preflight: "unknown", inspected: 0, blocked: 0, warnings: 0,
    remediations: 0, errors: 0, truncated: false,
  };
  let fd: number | undefined;
  try {
    fd = fs.openSync(guardianEventPath(directory), "r");
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    const buffer = Buffer.alloc(size - start);
    const read = fs.readSync(fd, buffer, 0, buffer.length, start);
    const source = buffer.toString("utf8", 0, read);
    const lines = source.split("\n");
    if (start > 0) {
      result.truncated = true;
      lines.shift(); // Discard the incomplete leading JSONL record.
    }
    let recentPreflightAt = "";
    for (const line of lines) {
      if (!line) continue;
      let entry: GuardianEvent;
      try { entry = JSON.parse(line) as GuardianEvent; } catch { continue; }
      if (!entry || typeof entry.kind !== "string" || typeof entry.at !== "string") continue;
      result.lastEvent = entry.at;
      if (entry.kind === "runtime-started" && entry.preflight && entry.at >= recentPreflightAt) {
        recentPreflightAt = entry.at;
        result.preflight = entry.preflight;
      }
      if (entry.kind === "preflight-allowed" || entry.kind === "preflight-blocked") result.inspected++;
      if (entry.kind === "preflight-blocked") result.blocked++;
      if (entry.kind === "post-warning") result.warnings++;
      if (entry.kind === "post-remediation") result.remediations++;
      if (entry.kind === "inspection-error") result.errors++;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[opencode-guardian] Could not read local event log:", error);
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return result;
}
