export type RunStatus =
  | "idle"
  | "building"
  | "verifying"
  | "fixing"
  | "verified"
  | "failed"
  | "unverified"; // process finished fine but Kane never passed a verification

export interface KaneLogEntry {
  flowDescription: string;
  passed: boolean;
  reason?: string;
  testUrl?: string;
  evidenceDir?: string;
  durationSec?: number;
  credits?: number;
  timestamp: string;
}

export type RunEventKind = "status" | "kane_result" | "run_complete";

export interface RunEvent {
  kind: RunEventKind;
  payload: Record<string, unknown>;
  at: string;
  seq: number;
}

export interface RunRecord {
  id: string;
  prompt: string;
  status: RunStatus;
  kaneAttempts: number;
  kaneLog: KaneLogEntry[];
  events: RunEvent[];
  startedAt: string;
  endedAt?: string;
  finalReason?: string;
  demo?: boolean;
}

/* ---- Claude Code stream-json shapes (verified against real fixtures) ---- */

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input?: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

export interface ClaudeStreamEvent {
  type?: string;
  subtype?: string;
  message?: { role?: string; content?: unknown[] };
  // present on the terminal "result" event:
  is_error?: boolean;
  num_turns?: number;
  terminal_reason?: string;
  [k: string]: unknown;
}

export function isToolUse(b: unknown): b is ToolUseBlock {
  return (
    typeof b === "object" && b !== null && (b as ToolUseBlock).type === "tool_use" &&
    typeof (b as ToolUseBlock).id === "string"
  );
}

export function isToolResult(b: unknown): b is ToolResultBlock {
  return typeof b === "object" && b !== null && (b as ToolResultBlock).type === "tool_result";
}

/* ---- Kane NDJSON (verified against real fixtures) ---- */

export interface KaneRunEnd {
  type: "run_end";
  status: "passed" | "failed" | string;
  summary?: string;
  one_liner?: string;
  reason?: string;
  duration?: number;
  credits_consumed?: number;
  test_url?: string;
  session_dir?: string;
}
