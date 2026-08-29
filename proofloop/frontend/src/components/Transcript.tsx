import { useEffect, useRef } from "react";
import type { Phase } from "../api.js";
import { fmtTime } from "../statusMeta.js";

export interface TranscriptItem {
  at: string;
  text: string;
  phase: Phase;
}

export default function Transcript({ items }: { items: TranscriptItem[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [items.length]);

  return (
    <section className="panel">
      <div className="stamp">
        <span className="stamp-word">TRANSCRIPT</span>
        <span className="stamp-note">the agent's own tool stream</span>
      </div>
      <div className="panel-pad">
        <div className="terminal">
          {items.length === 0 ? (
            <p className="t-empty">// the agent's tool stream appears here while it works</p>
          ) : (
            items.slice(-80).map((item, i) => (
              <p key={`${item.at}-${i}`} className="t-line">
                <span className="t-time">{fmtTime(item.at)}</span>
                <span className={`t-text ${item.phase}`}>{item.text}</span>
              </p>
            ))
          )}
          <div ref={endRef} />
        </div>
      </div>
    </section>
  );
}
