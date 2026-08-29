import type { HistoryRun } from "../api.js";
import { STATUS_META, fmtTime } from "../statusMeta.js";

export default function CaseIndex({ runs }: { runs: HistoryRun[] }) {
  // stable ascending case numbers, newest case first
  const numbered = runs.map((r, i) => ({ run: r, no: i + 1 })).reverse();

  return (
    <section className="panel">
      <div className="stamp">
        <span className="stamp-word">CASE INDEX</span>
        <span className="stamp-note">{runs.length === 0 ? "this session" : `${runs.length} filed`}</span>
      </div>
      {runs.length === 0 ? (
        <p className="empty-note">No runs filed yet.</p>
      ) : (
        <div className="case-rows">
          {numbered.map(({ run, no }) => {
            const meta = STATUS_META[run.status] ?? STATUS_META.idle;
            return (
              <div key={run.id} className="case-row">
                <span className="case-no">№{no}</span>
                <span className="case-prompt" title={run.prompt}>
                  {run.prompt}
                </span>
                <span className={`case-status ${run.status}`}>{meta.label.toUpperCase()}</span>
                <span className="case-meta">
                  {fmtTime(run.startedAt)}
                  {run.endedAt ? "" : " · open"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
