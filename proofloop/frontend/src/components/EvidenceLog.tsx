import { useState } from "react";
import type { KaneEntry } from "../api.js";
import { EXHIBIT_LETTERS, fmtDuration, fmtTime } from "../statusMeta.js";

function CopyPath({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => undefined);
      }}
      className="copy-link"
      title={value}
    >
      {copied ? "path copied ✓" : "evidence path"}
    </button>
  );
}

/**
 * Every Kane run the agent triggered, filed as exhibits: verdict stamp,
 * the objective verbatim, the failure/success reason, and the links out
 * to the real dashboard run and local evidence pack.
 */
export default function EvidenceLog({ entries }: { entries: KaneEntry[] }) {
  return (
    <section className="panel">
      <div className="stamp">
        <span className="stamp-word">EVIDENCE</span>
        <span className="stamp-note">
          {entries.length === 0
            ? "kane browser runs, filed as exhibits"
            : `${entries.filter((e) => e.passed).length}/${entries.length} passed`}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="empty-note">
          No verification runs yet. Every Kane run the agent triggers is filed here with its evidence.
        </p>
      ) : (
        <div className="exhibits">
          {entries.map((entry, i) => (
            <article key={`${entry.timestamp}-${i}`} className="exhibit">
              <div className="exhibit-head">
                <span className="exhibit-tag">EXHIBIT {EXHIBIT_LETTERS[i] ?? i + 1}</span>
                <span className="exhibit-attempt">attempt {i + 1}</span>
                <span className={`verdict ${entry.passed ? "pass" : "fail"}`}>
                  {entry.passed ? "PASS" : "FAIL"}
                </span>
              </div>

              <p className="exhibit-objective">“{entry.flowDescription}”</p>

              {entry.reason && (
                <p className={`exhibit-reason ${entry.passed ? "pass" : "fail"}`}>{entry.reason}</p>
              )}

              <p className="exhibit-meta">
                {fmtTime(entry.timestamp)}
                {entry.durationSec !== undefined && ` · ${fmtDuration(entry.durationSec)}`}
                {entry.credits !== undefined && ` · ${entry.credits.toFixed(1)} credits`}
              </p>

              <div className="exhibit-links">
                {entry.testUrl && (
                  <a href={entry.testUrl} target="_blank" rel="noreferrer" className="evidence-link">
                    Kane dashboard run ↗
                  </a>
                )}
                {entry.evidenceDir && <CopyPath value={entry.evidenceDir} />}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
