export type Phase =
  | "idle"
  | "building"
  | "verifying"
  | "fixing"
  | "verified"
  | "failed"
  | "unverified";

export interface KaneEntry {
  flowDescription: string;
  passed: boolean;
  reason?: string;
  testUrl?: string;
  evidenceDir?: string;
  durationSec?: number;
  credits?: number;
  timestamp: string;
}

export interface RunComplete {
  finalStatus: Phase;
  attempts: number;
  numTurns?: number;
  isError?: boolean;
  reason?: string;
}

export interface StatusPayload {
  status: Phase;
  detail?: string;
}

export interface HistoryRun {
  id: string;
  prompt: string;
  status: Phase;
  kaneAttempts: number;
  kaneLog: KaneEntry[];
  startedAt: string;
  endedAt?: string;
  demo?: boolean;
}

export async function startRun(prompt: string): Promise<{ runId: string; demo: boolean }> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (res.status === 409) throw new Error("A run is already in progress");
  if (!res.ok) throw new Error(`generate failed (${res.status})`);
  return res.json();
}

export async function fetchHistory(): Promise<HistoryRun[]> {
  const res = await fetch("/api/history");
  if (!res.ok) return [];
  const body = (await res.json()) as { runs: HistoryRun[] };
  return body.runs ?? [];
}

export async function fetchHealth(): Promise<{ ok: boolean; demo: boolean }> {
  const res = await fetch("/api/health");
  if (!res.ok) return { ok: false, demo: false };
  return res.json();
}

/** Subscribe to a run's SSE stream. Returns a close function. */
export function openStream(
  runId: string,
  handlers: {
    onStatus: (p: StatusPayload) => void;
    onKaneResult: (e: KaneEntry) => void;
    onRunComplete: (c: RunComplete) => void;
  },
): () => void {
  const es = new EventSource(`/api/stream/${runId}`);
  let gotAny = false;
  let closed = false;
  const close = () => {
    if (!closed) {
      closed = true;
      es.close();
    }
  };
  es.addEventListener("status", (ev) => {
    gotAny = true;
    handlers.onStatus(JSON.parse((ev as MessageEvent).data) as StatusPayload);
  });
  es.addEventListener("kane_result", (ev) => {
    gotAny = true;
    handlers.onKaneResult(JSON.parse((ev as MessageEvent).data) as KaneEntry);
  });
  es.addEventListener("run_complete", (ev) => {
    gotAny = true;
    handlers.onRunComplete(JSON.parse((ev as MessageEvent).data) as RunComplete);
    close(); // server ends the response; stop the browser from reconnecting
  });
  es.onerror = () => {
    if (!gotAny && !closed) {
      // unknown runId or stream lost before any event — don't reconnect forever
      close();
    }
  };
  return close;
}
