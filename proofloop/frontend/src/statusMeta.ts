import type { Phase } from "./api.js";

export interface StatusMeta {
  label: string;
  dot: string; // tailwind bg class for the status dot
  text: string;
  hint: string;
}

export const STATUS_META: Record<Phase, StatusMeta> = {
  idle: {
    label: "Idle",
    dot: "bg-slate-500",
    text: "text-slate-400",
    hint: "Type a feature request to start the loop.",
  },
  building: {
    label: "Building",
    dot: "bg-sky-400",
    text: "text-sky-300",
    hint: "The agent is reading and editing the target app.",
  },
  verifying: {
    label: "Verifying",
    dot: "bg-amber-400",
    text: "text-amber-300",
    hint: "Kane CLI is driving a real browser against the app.",
  },
  fixing: {
    label: "Fixing",
    dot: "bg-violet-400",
    text: "text-violet-300",
    hint: "Kane found a failure — the agent is repairing it.",
  },
  verified: {
    label: "Verified",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    hint: "Kane confirmed the feature works in a real browser.",
  },
  failed: {
    label: "Failed",
    dot: "bg-rose-500",
    text: "text-rose-300",
    hint: "The run ended without a passing verification.",
  },
  unverified: {
    label: "Unverified",
    dot: "bg-slate-400",
    text: "text-slate-300",
    hint: "The agent finished but never verified with Kane.",
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
