import { spawn } from "node:child_process";
import { MAX_BUDGET_USD } from "./config.js";

/**
 * How to spawn the claude CLI on this platform.
 *
 * Windows: the npm install ships a claude.cmd shim, and Node >= 20 refuses to
 * spawn .cmd/.bat without a shell. Using shell:true is safe here because every
 * argument is a static flag — the user prompt travels via stdin, never argv.
 * (If a native claude.exe build is installed, spawn it directly instead.)
 */
export function claudeSpawn(): { cmd: string; shell: boolean; detached: boolean } {
  if (process.platform === "win32") return { cmd: "claude", shell: true, detached: false };
  return { cmd: "claude", shell: false, detached: true }; // detached => own pgid for kill-tree
}

export const CLAUDE_ARGS = [
  "-p",
  "--output-format", "stream-json",
  "--verbose",
  "--allowedTools", "Bash,Edit,Write,Read,Glob,Grep,TodoWrite",
  "--permission-mode", "acceptEdits",
  "--max-budget-usd", MAX_BUDGET_USD,
] as const;

/** Kill an entire process tree (agent -> bash -> kane -> chrome). Best effort. */
export function killTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      const p = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      p.on("error", () => { /* already gone */ });
    } else {
      process.kill(-pid, "SIGTERM"); // negative pid = process group (spawned detached)
    }
  } catch {
    try { process.kill(pid, "SIGTERM"); } catch { /* already gone */ }
  }
}
