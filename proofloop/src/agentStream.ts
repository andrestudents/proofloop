import { extractObjective, parseKaneOutput } from "./kaneParser.js";
import {
  isToolResult,
  isToolUse,
  type ClaudeStreamEvent,
  type KaneLogEntry,
  type RunStatus,
} from "./types.js";

/**
 * Pure reducer over the claude stream-json event flow. Turns raw stream events
 * into semantic ProofLoop events — no I/O, fully unit-testable.
 */
export type AgentEvent =
  | { kind: "status"; status: RunStatus; detail?: string }
  | { kind: "kane_result"; entry: KaneLogEntry }
  | {
      kind: "final";
      isError: boolean;
      numTurns?: number;
      terminalReason?: string;
    };

export class RunReducer {
  status: RunStatus = "building";
  kaneAttempts = 0;
  /** tool_use_id → kane objective, awaiting the matching tool_result */
  private pendingKane = new Map<string, string>();

  feed(ev: ClaudeStreamEvent): AgentEvent[] {
    const out: AgentEvent[] = [];
    const blocks = ev.message?.content;

    if (Array.isArray(blocks)) {
      for (const block of blocks) {
        if (isToolUse(block)) {
          if (block.name === "Edit" || block.name === "Write" || block.name === "MultiEdit") {
            // Don't downgrade a verified run because of post-verification edits.
            if (this.status !== "verified") {
              this.status = this.kaneAttempts > 0 ? "fixing" : "building";
              out.push({ kind: "status", status: this.status });
            }
          } else if (block.name === "Bash" || block.name === "PowerShell") {
            const cmd = String(block.input?.command ?? block.input?.["command"] ?? "");
            if (/kane-cli\s+run\b/.test(cmd)) {
              this.pendingKane.set(block.id, extractObjective(cmd));
              this.status = "verifying";
              out.push({ kind: "status", status: "verifying", detail: cmd });
            }
          }
        } else if (isToolResult(block)) {
          const id = block.tool_use_id;
          if (id && this.pendingKane.has(id)) {
            const flow = this.pendingKane.get(id)!;
            this.pendingKane.delete(id);
            const parsed = parseKaneOutput(block.content);
            if (parsed) {
              this.kaneAttempts += 1;
              const entry: KaneLogEntry = {
                flowDescription: flow,
                passed: parsed.passed,
                reason: parsed.reason,
                testUrl: parsed.testUrl,
                evidenceDir: parsed.evidenceDir,
                durationSec: parsed.durationSec,
                credits: parsed.credits,
                timestamp: new Date().toISOString(),
              };
              out.push({ kind: "kane_result", entry });
              if (parsed.passed) {
                this.status = "verified";
                out.push({ kind: "status", status: "verified" });
              }
            }
          }
        }
      }
    }

    if (ev.type === "result") {
      out.push({
        kind: "final",
        isError: Boolean(ev.is_error),
        numTurns: typeof ev.num_turns === "number" ? ev.num_turns : undefined,
        terminalReason: typeof ev.terminal_reason === "string" ? ev.terminal_reason : undefined,
      });
    }

    return out;
  }

  /** Map the process/stream end state to the record's final status. */
  finalStatus(): RunStatus {
    if (this.status === "verified") return "verified";
    if (this.status === "verifying" || this.status === "fixing") return "failed";
    return "unverified";
  }
}
