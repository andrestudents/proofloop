import type { Phase } from "./api.js";

export interface StatusMeta {
  label: string;
  /** one-line explanation of what this state means, in the interface's voice */
  hint: string;
}

export const STATUS_META: Record<Phase, StatusMeta> = {
  idle: {
    label: "Idle",
    hint: "Describe a feature below to open a case.",
  },
  building: {
    label: "Building",
    hint: "The agent is reading and editing the target app.",
  },
  verifying: {
    label: "Verifying",
    hint: "Kane is driving a real browser against the app.",
  },
  fixing: {
    label: "Fixing",
    hint: "A check failed. The agent is repairing it, then verifies again.",
  },
  verified: {
    label: "Verified",
    hint: "Kane confirmed the feature in a real browser. Evidence on record.",
  },
  failed: {
    label: "Failed",
    hint: "The run ended without a passing verification.",
  },
  unverified: {
    label: "Unverified",
    hint: "The agent finished but never ran a Kane check.",
  },
};

export function fmtDuration(sec: number | undefined): string {
  if (sec === undefined) return "";
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : `${sec.toFixed(1)}s`;
}

export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

export const EXHIBIT_LETTERS = ["A", "B", "C", "D", "E", "F"];
