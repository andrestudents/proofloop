import type { Phase } from "../api.js";
import { STATUS_META } from "../statusMeta.js";

type NodeState = "todo" | "active" | "done" | "error";

function nodeState(phase: Phase, index: number): NodeState {
  // node 0 = Build, node 1 = Verify, node 2 = Verified
  const doneMap: Record<string, NodeState[]> = {
    idle: ["todo", "todo", "todo"],
    building: ["active", "todo", "todo"],
    fixing: ["active", "error", "todo"],
    verifying: ["done", "active", "todo"],
    verified: ["done", "done", "done"],
    failed: ["done", "error", "todo"],
    unverified: ["done", "todo", "todo"],
  };
  return (doneMap[phase] ?? ["todo", "todo", "todo"])[index];
}

const NODE_STYLES: Record<NodeState, { ring: string; fill: string; label: string }> = {
  todo: { ring: "border-[#2a3448]", fill: "bg-[#1a2236]", label: "text-slate-500" },
  active: { ring: "border-amber-400/70", fill: "bg-amber-400/15", label: "text-amber-300" },
  done: { ring: "border-emerald-400/60", fill: "bg-emerald-400/15", label: "text-emerald-300" },
  error: { ring: "border-rose-500/60", fill: "bg-rose-500/15", label: "text-rose-300" },
};

const NODE_ICONS: Record<number, string> = { 0: "⚒", 1: "◉", 2: "✓" };

export default function StatusStepper({ phase, attempts }: { phase: Phase; attempts: number }) {
  const meta = STATUS_META[phase];
  const labels = ["Build", "Verify", "Verified"];
  return (
    <div className="rounded-xl border border-[#232d42] bg-[#131a2a] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} ${phase === "building" || phase === "verifying" || phase === "fixing" ? "animate-pulse" : ""}`} />
          <span className={`text-sm font-semibold ${meta.text}`}>{meta.label}</span>
          {attempts > 0 && (
            <span className="rounded-full border border-[#2a3448] px-2 py-0.5 text-[11px] text-slate-400">
              Kane attempt {attempts}
              {phase === "fixing" || phase === "verifying" ? ` · iteration ${attempts + (phase === "fixing" ? 1 : 0)}` : ""}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500">{meta.hint}</span>
      </div>

      <div className="flex items-center">
        {labels.map((label, i) => {
          const state = nodeState(phase, i);
          const style = NODE_STYLES[state];
          return (
            <div key={label} className={`flex items-center ${i < labels.length - 1 ? "flex-1" : ""}`}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm ${style.ring} ${style.fill} ${style.label} ${
                    state === "active" ? "animate-pulse" : ""
                  }`}
                >
                  {state === "error" ? "✕" : NODE_ICONS[i]}
                </div>
                <span className={`text-[11px] font-medium ${style.label}`}>{label}</span>
              </div>
              {i < labels.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 rounded ${nodeState(phase, i) === "done" ? "bg-emerald-400/50" : "bg-[#232d42]"}`} />
              )}
            </div>
          );
        })}
      </div>

      {phase === "fixing" && (
        <p className="mt-3 rounded-lg bg-violet-400/10 px-3 py-2 text-xs text-violet-300">
          Loop closed: Kane failed → agent is fixing → will verify again. No human involved.
        </p>
      )}
    </div>
  );
}
