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
import ActivityFeed, { type ActivityItem } from "./components/ActivityFeed.js";
import HistoryList from "./components/HistoryList.js";
import KaneLog from "./components/KaneLog.js";
import PromptForm from "./components/PromptForm.js";
import StatusStepper from "./components/StatusStepper.js";
import TargetPreview from "./components/TargetPreview.js";
import { STATUS_META } from "./statusMeta.js";

function timestamp(): string {
  return new Date().toISOString();
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState<string>("");
  const [kaneEntries, setKaneEntries] = useState<KaneEntry[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [runComplete, setRunComplete] = useState<RunComplete | null>(null);
  const [history, setHistory] = useState<HistoryRun[]>([]);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const closeRef = useRef<(() => void) | null>(null);

  const pushActivity = useCallback((text: string, phase: Phase) => {
    setActivity((prev) => [...prev, { at: timestamp(), text, phase }]);
  }, []);

  const loadHistory = useCallback(() => {
    fetchHistory().then(setHistory).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchHealth().then((h) => setDemo(h.demo)).catch(() => undefined);
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
      setActivity([]);
      setRunComplete(null);
      pushActivity(`prompt accepted: "${prompt}"`, "building");
      try {
        const { runId, demo: isDemo } = await startRun(prompt);
        if (isDemo) pushActivity("DEMO_MODE: replaying a recorded real run", "building");
        closeRef.current?.();
        closeRef.current = openStream(runId, {
          onStatus: (p) => {
            setPhase(p.status);
            setDetail(p.detail ?? "");
            if (p.detail) pushActivity(p.detail, p.status);
            else pushActivity(`→ ${STATUS_META[p.status]?.label ?? p.status}`, p.status);
          },
          onKaneResult: (entry) => {
            setKaneEntries((prev) => [...prev, entry]);
            pushActivity(
              entry.passed
                ? `kane PASSED — ${entry.reason ?? "verified"}`
                : `kane FAILED — ${entry.reason ?? "see log"}`,
              entry.passed ? "verified" : "fixing",
            );
          },
          onRunComplete: (c) => {
            setRunComplete(c);
            setPhase(c.finalStatus);
            setBusy(false);
            pushActivity(
              `run complete: ${STATUS_META[c.finalStatus]?.label ?? c.finalStatus}` +
                (c.reason ? ` (${c.reason})` : ""),
              c.finalStatus,
            );
            // finished a build → reload the target app preview
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
    [loadHistory, pushActivity],
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            ProofLoop <span className="text-sky-400">🔁</span>
          </h1>
          <p className="text-xs text-slate-500">
            An agent builds the feature, then proves it in a real browser with Kane CLI — and fixes it until it passes.
          </p>
        </div>
        {demo && (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-medium text-amber-300">
            DEMO_MODE — replaying recorded runs
          </span>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-4">
          <PromptForm busy={busy} onSubmit={handleSubmit} />
          <StatusStepper phase={phase} attempts={kaneEntries.length} />
          <ActivityFeed items={activity} />
          {runComplete && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                runComplete.finalStatus === "verified"
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : runComplete.finalStatus === "failed"
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                    : "border-[#2a3448] bg-[#131a2a] text-slate-300"
              }`}
            >
              <p className="font-semibold">
                {runComplete.finalStatus === "verified" ? "✓ Feature shipped and verified" : `Run ended: ${runComplete.finalStatus}`}
              </p>
              <p className="mt-1 text-slate-400">
                {runComplete.attempts} kane attempt{runComplete.attempts === 1 ? "" : "s"}
                {runComplete.numTurns !== undefined && ` · ${runComplete.numTurns} agent turns`}
                {runComplete.reason && ` · ${runComplete.reason}`}
              </p>
            </div>
          )}
          <KaneLog entries={kaneEntries} />
        </div>

        <div className="flex flex-col gap-4">
          <TargetPreview refreshKey={previewKey} live={!demo} />
          <HistoryList runs={history} />
        </div>
      </div>

      <footer className="mt-2 border-t border-[#1c2540] pt-3 text-[11px] text-slate-600">
        Backend <code>:3001</code> · target app <code>:4000</code> · {detail ? `current: ${detail}` : "evidence: every kane run links to its dashboard trace"}
      </footer>
    </div>
  );
}
