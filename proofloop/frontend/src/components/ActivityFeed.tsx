import { useEffect, useRef } from "react";
import type { Phase } from "../api.js";
import { STATUS_META, fmtTime } from "../statusMeta.js";

export interface ActivityItem {
  at: string;
  text: string;
  phase: Phase;
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [items.length]);

  return (
    <div className="rounded-xl border border-[#232d42] bg-[#131a2a]">
      <div className="border-b border-[#232d42] px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Agent activity</h2>
      </div>
      <div className="max-h-56 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
        {items.length === 0 ? (
          <p className="text-slate-600">// waiting for the first run…</p>
        ) : (
          items.slice(-80).map((item, i) => (
            <p key={`${item.at}-${i}`} className="flex gap-2">
              <span className="shrink-0 text-slate-600">{fmtTime(item.at)}</span>
              <span className={STATUS_META[item.phase]?.text ?? "text-slate-400"}>{item.text}</span>
            </p>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
