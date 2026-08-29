import { useState } from "react";
import type { KaneEntry } from "../api.js";
import { fmtDuration, fmtTime } from "../statusMeta.js";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => undefined);
      }}
      className="text-[11px] text-slate-500 underline decoration-dotted transition hover:text-slate-300"
      title={value}
    >
      {copied ? "copied ✓" : "evidence path"}
    </button>
  );
}

export default function KaneLog({ entries }: { entries: KaneEntry[] }) {
  return (
    <div className="rounded-xl border border-[#232d42] bg-[#131a2a]">
      <div className="flex items-center justify-between border-b border-[#232d42] px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Kane verification log</h2>
        <span className="text-[11px] text-slate-500">
          {entries.length === 0 ? "no runs yet" : `${entries.filter((e) => e.passed).length}/${entries.length} passed`}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-slate-600">
          Every Kane CLI run the agent triggered will appear here, with clickable evidence.
        </p>
      ) : (
        <ul className="divide-y divide-[#1c2540]">
          {entries.map((entry, i) => (
            <li key={`${entry.timestamp}-${i}`} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500">#{i + 1}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                    entry.passed ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {entry.passed ? "PASS" : "FAIL"}
                </span>
                <span className="text-[11px] text-slate-500">
                  {fmtTime(entry.timestamp)}
                  {entry.durationSec !== undefined && ` · ${fmtDuration(entry.durationSec)}`}
                  {entry.credits !== undefined && ` · ${entry.credits.toFixed(1)} credits`}
                </span>
              </div>

              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                <span className="text-slate-500">objective: </span>
                {entry.flowDescription}
              </p>
              {entry.reason && (
                <p className={`mt-1 text-xs leading-relaxed ${entry.passed ? "text-emerald-300/80" : "text-rose-300/90"}`}>
                  <span className="text-slate-500">{entry.passed ? "result: " : "failure: "}</span>
                  {entry.reason}
                </p>
              )}

              <div className="mt-2 flex items-center gap-3">
                {entry.testUrl && (
                  <a
                    href={entry.testUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-medium text-sky-400 underline decoration-sky-400/40 transition hover:text-sky-300"
                  >
                    Kane dashboard run ↗
                  </a>
                )}
                {entry.evidenceDir && <CopyButton value={entry.evidenceDir} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
