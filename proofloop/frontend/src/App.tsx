import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchHealth,
  fetchHistory,
  openStream,
  startRun,
  type HistoryRun,
  type KaneEntry,
  type Phase,
  type RunComplete,
} from "./api.js";
import CaseIndex from "./components/CaseIndex.js";
import EvidenceLog from "./components/EvidenceLog.js";
import LoopTrace from "./components/LoopTrace.js";
import RequestForm from "./components/RequestForm.js";
import Specimen from "./components/Specimen.js";
import Transcript, { type TranscriptItem } from "./components/Transcript.js";
import { STATUS_META } from "./statusMeta.js";

function timestamp(): string {
  return new Date().toISOString();
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState<string>("");
  const [kaneEntries, setKaneEntries] = useState<KaneEntry[]>([]);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [runComplete, setRunComplete] = useState<RunComplete | null>(null);
  const [history, setHistory] = useState<HistoryRun[]>([]);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseTag, setCaseTag] = useState<string>("—");
  const [previewKey, setPreviewKey] = useState(0);
  const closeRef = useRef<(() => void) | null>(null);

  const pushTranscript = useCallback((text: string, phase: Phase) => {
    setTranscript((prev) => [...prev, { at: timestamp(), text, phase }]);
  }, []);

  const loadHistory = useCallback(() => {
    fetchHistory()
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchHealth()
      .then((h) => setDemo(h.demo))
      .catch(() => undefined);
    loadHistory();
    return () => closeRef.current?.();
  }, [loadHistory]);

  const handleSubmit = useCallback(
    async (prompt: string) => {
      setError(null);
      setBusy(true);
      setPhase("building");
      setDetail("");
      setKaneEntries([]);
      setTranscript([]);
      setRunComplete(null);
      pushTranscript(`request filed: "${prompt}"`, "building");
      try {
        const { runId, demo: isDemo } = await startRun(prompt);
        setCaseTag(runId.slice(0, 8).toUpperCase());
        if (isDemo) pushTranscript("replay: recorded from a real run, no agent active", "building");
        closeRef.current?.();
        closeRef.current = openStream(runId, {
          onStatus: (p) => {
            setPhase(p.status);
            setDetail(p.detail ?? "");
            if (p.detail) pushTranscript(p.detail, p.status);
            else pushTranscript(`→ ${STATUS_META[p.status]?.label ?? p.status}`, p.status);
          },
          onKaneResult: (entry) => {
            setKaneEntries((prev) => [...prev, entry]);
            pushTranscript(
              entry.passed
                ? `kane PASSED — ${entry.reason ?? "verified"}`
                : `kane FAILED — ${entry.reason ?? "see evidence"}`,
              entry.passed ? "verified" : "fixing",
            );
          },
          onRunComplete: (c) => {
            setRunComplete(c);
            setPhase(c.finalStatus);
            setBusy(false);
            pushTranscript(
              `case closed: ${STATUS_META[c.finalStatus]?.label ?? c.finalStatus}` +
                (c.reason ? ` (${c.reason})` : ""),
              c.finalStatus,
            );
            // a build finished — reload the specimen
            setPreviewKey((k) => k + 1);
            loadHistory();
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
        setPhase("idle");
      }
    },
    [loadHistory, pushTranscript],
  );

  return (
    <div className="layout">
      <header className="masthead">
        <div className="masthead-left">
          <div className="mark" aria-hidden="true">
            ↻
          </div>
          <div>
            <div className="wordmark">PROOFLOOP</div>
            <div className="tagline">dossier · autonomous build-verify session</div>
          </div>
        </div>
        <div className="masthead-right">
          <span className="case-tag">CASE {caseTag}</span>
        </div>
      </header>

      {error && <div className="error-strip">{error}</div>}
      {demo && (
        <div className="demo-strip">
          REPLAY MODE — this is a recorded real run. No agent is active; evidence links resolve to
          the actual Kane dashboard.
        </div>
      )}

      <section className="panel" aria-label="Loop status">
        <div className="stamp">
          <span className="stamp-word">THE LOOP</span>
          <span className="stamp-note">
            {STATUS_META[phase].hint}
          </span>
        </div>
        <div className="loop-stage">
          <LoopTrace phase={phase} kaneEntries={kaneEntries} />
        </div>
        {runComplete && (
          <p className="loop-outcome on">
            {runComplete.finalStatus === "verified" ? (
              <span className="ok">case closed — verified</span>
            ) : (
              <span className="bad">case closed — {runComplete.finalStatus}</span>
            )}
            <span className="dim">
              {" "}
              · {runComplete.attempts} kane attempt{runComplete.attempts === 1 ? "" : "s"}
              {runComplete.numTurns !== undefined && ` · ${runComplete.numTurns} agent turns`}
              {runComplete.reason && ` · ${runComplete.reason}`}
            </span>
          </p>
        )}
      </section>

      <div className="cols">
        <div className="col">
          <RequestForm busy={busy} onSubmit={handleSubmit} />
          <Transcript items={transcript} />
          <CaseIndex runs={history} />
        </div>
        <div className="col">
          <EvidenceLog entries={kaneEntries} />
          <Specimen refreshKey={previewKey} live={!demo} />
        </div>
      </div>

      <footer className="foot">
        <span>backend :3001 · specimen :4000</span>
        <span>{detail ? "live: " + detail.slice(0, 90) : "states derive from the agent's own tool stream"}</span>
      </footer>
    </div>
  );
}
