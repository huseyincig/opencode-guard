/** Minimal, redacted, local Guardian event log shared by the server and TUI. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
export function guardianStateDirectory() {
    if (process.env.OPENCODE_GUARDIAN_STATE_DIR)
        return process.env.OPENCODE_GUARDIAN_STATE_DIR;
    // Node's built-in test runner sets this only in test workers. Keep synthetic
    // checks from polluting the actual user's live intervention statistics.
    if (process.env.NODE_TEST_CONTEXT)
        return path.join(os.tmpdir(), `opencode-guardian-tests-${process.pid}`);
    return path.join(os.homedir(), ".local", "state", "opencode-guardian");
}
export function guardianEventPath() {
    return path.join(guardianStateDirectory(), "events.jsonl");
}
export function sessionFingerprint(value) {
    return value ? createHash("sha256").update(value).digest("hex").slice(0, 16) : undefined;
}
let reportedWriteFailure = false;
export function recordGuardianEvent(event) {
    try {
        const dir = guardianStateDirectory();
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        const directory = fs.lstatSync(dir);
        // A pre-existing shared directory or a symlink must not expose the log.
        if (!directory.isDirectory() || (process.platform !== "win32" &&
            ((directory.mode & 0o077) !== 0 ||
                (typeof process.getuid === "function" && directory.uid !== process.getuid())))) {
            throw new Error("Guardian state directory is not private to the current user");
        }
        const fd = fs.openSync(guardianEventPath(), fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | (fs.constants.O_NOFOLLOW ?? 0), 0o600);
        try {
            const file = fs.fstatSync(fd);
            if (!file.isFile() || (typeof process.getuid === "function" && file.uid !== process.getuid())) {
                throw new Error("Guardian event log is not a regular file owned by the current user");
            }
            if (process.platform !== "win32" && (file.mode & 0o777) !== 0o600) {
                fs.fchmodSync(fd, 0o600);
            }
            const safe = {
                at: new Date().toISOString(), kind: event.kind,
                ...(event.runtime ? { runtime: event.runtime } : {}),
                ...(event.preflight ? { preflight: event.preflight } : {}),
                ...(event.session ? { session: event.session } : {}),
                ...(event.tool ? { tool: event.tool } : {}),
                ...(event.rules ? { rules: event.rules } : {}),
            };
            fs.writeSync(fd, `${JSON.stringify(safe)}\n`);
        }
        finally {
            fs.closeSync(fd);
        }
    }
    catch (error) {
        if (!reportedWriteFailure) {
            reportedWriteFailure = true;
            console.error("[opencode-guardian] Could not write local event log:", error);
        }
    }
}
/** Reads at most the newest 2 MiB: counters describe this bounded event window. */
export function readGuardianStatus(maxBytes = 2 * 1024 * 1024) {
    const result = {
        preflight: "unknown", inspected: 0, blocked: 0, warnings: 0,
        remediations: 0, errors: 0, truncated: false,
    };
    let fd;
    try {
        fd = fs.openSync(guardianEventPath(), "r");
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
            if (!line)
                continue;
            let entry;
            try {
                entry = JSON.parse(line);
            }
            catch {
                continue;
            }
            if (!entry || typeof entry.kind !== "string" || typeof entry.at !== "string")
                continue;
            result.lastEvent = entry.at;
            if (entry.kind === "runtime-started" && entry.preflight && entry.at >= recentPreflightAt) {
                recentPreflightAt = entry.at;
                result.preflight = entry.preflight;
            }
            if (entry.kind === "preflight-allowed" || entry.kind === "preflight-blocked")
                result.inspected++;
            if (entry.kind === "preflight-blocked")
                result.blocked++;
            if (entry.kind === "post-warning")
                result.warnings++;
            if (entry.kind === "post-remediation")
                result.remediations++;
            if (entry.kind === "inspection-error")
                result.errors++;
        }
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            console.error("[opencode-guardian] Could not read local event log:", error);
        }
    }
    finally {
        if (fd !== undefined)
            fs.closeSync(fd);
    }
    return result;
}
