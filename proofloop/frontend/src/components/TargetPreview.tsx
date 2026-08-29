import { useEffect, useState } from "react";

const TARGET_URL = "http://localhost:4000";

export default function TargetPreview({ refreshKey, live }: { refreshKey: number; live: boolean }) {
  const [manualKey, setManualKey] = useState(0);
  useEffect(() => {
    // give the static files a beat to be re-read, then show the fresh state
  }, [refreshKey]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#232d42] bg-[#131a2a]">
      <div className="flex items-center justify-between border-b border-[#232d42] px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Target app</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{live ? "auto-refreshed on verify" : "demo replay — app not live"}</span>
          <button
            onClick={() => setManualKey((k) => k + 1)}
            className="rounded-md border border-[#2a3448] px-2 py-1 text-[11px] text-slate-400 transition hover:border-sky-500/50 hover:text-sky-300"
          >
            refresh ⟳
          </button>
        </div>
      </div>
      <div className="flex-1 p-2">
        {live ? (
          <iframe
            key={`${refreshKey}-${manualKey}`}
            src={`${TARGET_URL}/?t=${refreshKey}-${manualKey}`}
            title="target app preview"
            className="h-full min-h-[320px] w-full rounded-lg border border-[#232d42] bg-white"
          />
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#2a3448] text-center">
            <span className="text-3xl">🔁</span>
            <p className="max-w-[240px] text-xs text-slate-500">
              Replay mode: the real target app runs on <code className="text-slate-400">{TARGET_URL}</code> when you
              start ProofLoop without DEMO_MODE.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
