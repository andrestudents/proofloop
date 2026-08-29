import type { HistoryRun } from "../api.js";
import { STATUS_META, fmtTime } from "../statusMeta.js";

export default function HistoryList({ runs }: { runs: HistoryRun[] }) {
  return (
    <div className="rounded-xl border border-[#232d42] bg-[#131a2a]">
      <div className="border-b border-[#232d42] px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Run history</h2>
      </div>
      {runs.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs text-slate-600">No runs yet in this session.</p>
      ) : (
        <ul className="divide-y divide-[#1c2540]">
          {runs.map((run) => {
            const meta = STATUS_META[run.status] ?? STATUS_META.idle;
            return (
              <li key={run.id} className="flex items-start gap-2.5 px-4 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-slate-300" title={run.prompt}>
                    {run.prompt}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {fmtTime(run.startedAt)} · {run.kaneAttempts} kane attempt{run.kaneAttempts === 1 ? "" : "s"}
                    {run.demo ? " · replay" : ""}
                    {run.endedAt ? ` · ${meta.label.toLowerCase()}` : " · running…"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
