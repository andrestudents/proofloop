import type { KaneEntry, Phase } from "../api.js";

type NodeState = "todo" | "active" | "done" | "error";

function nodeStates(phase: Phase): [NodeState, NodeState, NodeState] {
  switch (phase) {
    case "building":
      return ["active", "todo", "todo"];
    case "verifying":
      return ["done", "active", "todo"];
    case "fixing":
      return ["active", "error", "todo"];
    case "verified":
      return ["done", "done", "done"];
    case "failed":
      return ["done", "error", "todo"];
    case "unverified":
      return ["done", "todo", "todo"];
    default:
      return ["todo", "todo", "todo"];
  }
}

const Y = 58;
const R = 24;

const NODES = [
  { x: 96, label: "BUILD", sub: "agent writes the feature" },
  { x: 400, label: "VERIFY", sub: "kane drives a real browser" },
  { x: 704, label: "VERIFIED", sub: "evidence on record" },
];

/**
 * The signature: the loop, drawn as a live circuit. The return path
 * (VERIFY -> BUILD on failure) is always faintly visible — it is the
 * product's thesis — and lights up when a check actually fails.
 */
export default function LoopTrace({
  phase,
  kaneEntries,
}: {
  phase: Phase;
  kaneEntries: KaneEntry[];
}) {
  const [s1, s2, s3] = nodeStates(phase);
  const states = [s1, s2, s3];

  const hasFail = kaneEntries.some((e) => !e.passed);
  const returnLit = phase === "fixing" || phase === "failed" || (hasFail && phase !== "verified");

  // segment: build -> verify
  const seg1Class =
    phase === "building" || phase === "fixing"
      ? `seg seg-active ${phase}`
      : s1 === "done"
        ? phase === "verified"
          ? "seg seg-final"
          : "seg seg-done"
        : "seg seg-todo";

  // segment: verify -> verified
  const seg2Class =
    phase === "verifying"
      ? "seg seg-active verifying"
      : phase === "verified"
        ? "seg seg-final"
        : "seg seg-todo";

  return (
    <svg viewBox="0 0 800 178" role="img" aria-label={`Loop status: ${phase}`}>
      {/* return path: verify -> build, drawn below, always visible */}
      <path
        d={`M ${NODES[1].x} ${Y + R + 6} V 128 H ${NODES[0].x} V ${Y + R + 6}`}
        className={`return-path${returnLit ? " lit" : ""}`}
      />
      <text x={248} y={148} textAnchor="middle" className={`loop-return-label${returnLit ? " lit" : ""}`}>
        FAIL — AGENT FIXES, VERIFIES AGAIN
      </text>

      {/* main line segments */}
      <line
        x1={NODES[0].x + R + 8}
        y1={Y}
        x2={NODES[1].x - R - 8}
        y2={Y}
        className={seg1Class}
      />
      <line
        x1={NODES[1].x + R + 8}
        y1={Y}
        x2={NODES[2].x - R - 8}
        y2={Y}
        className={seg2Class}
      />
      {/* arrowheads into each next station */}
      <path d={`M ${NODES[1].x - R - 12} ${Y - 4} l 7 4 l -7 4`} fill="none" stroke="var(--ink-60)" strokeWidth="1.5" />
      <path d={`M ${NODES[2].x - R - 12} ${Y - 4} l 7 4 l -7 4`} fill="none" stroke="var(--ink-60)" strokeWidth="1.5" />

      {/* stations */}
      {NODES.map((n, i) => {
        const st = states[i];
        const final = phase === "verified" && i === 2;
        const cls = [
          "station",
          st,
          st === "active" ? phase : "",
          final ? "final" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <g key={n.label}>
            {st === "active" && (
              <circle
                cx={n.x}
                cy={Y}
                r={R}
                className={`halo on ${phase}`}
                style={{ transformOrigin: `${n.x}px ${Y}px` }}
              />
            )}
            <circle cx={n.x} cy={Y} r={R} className={cls} />
            {final && <circle cx={n.x} cy={Y} r={R - 5} fill="none" stroke="var(--proof)" strokeWidth="1" />}
            {st === "active" && i === 0 && phase === "building" && (
              <rect x={n.x - 4} y={Y - 8} width={8} height={16} className="cursor-block" />
            )}
            {st === "error" && (
              <text x={n.x} y={Y + 5} textAnchor="middle" className="station-icon cross">
                ✕
              </text>
            )}
            {final && (
              <text x={n.x} y={Y + 5} textAnchor="middle" className="station-icon check">
                ✓
              </text>
            )}
            <text x={n.x} y={Y + R + 20} textAnchor="middle" className="loop-node-label">
              {n.label}
            </text>
            <text x={n.x} y={Y + R + 35} textAnchor="middle" className="loop-node-sub">
              {n.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
