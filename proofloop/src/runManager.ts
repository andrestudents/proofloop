import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RunReducer, type AgentEvent } from "./agentStream.js";
import { CLAUDE_ARGS, claudeSpawn, killTree } from "./claudeCommand.js";
import { DEMO_TRANSCRIPT, RUNS_DIR, TARGET_APP_DIR, WATCHDOG_MS } from "./config.js";
import { projectAgentEnv } from "./projectEnv.js";
import { buildPromptWrapper } from "./promptWrapper.js";
import type { ClaudeStreamEvent, RunEvent, RunEventKind, RunRecord } from "./types.js";

/* --------------------------------------------------------------------------
 * In-memory store. One build session at a time (FR-11).
 * ------------------------------------------------------------------------ */
const runs = new Map<string, RunRecord>();
let activeRunId: string | null = null;

type Listener = (ev: RunEvent) => void;
const subscribers = new Map<string, Set<Listener>>();

export function getRun(id: string): RunRecord | undefined {
  return runs.get(id);
}

export function listRuns(): RunRecord[] {
  return [...runs.values()].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export function hasActiveRun(): boolean {
  return activeRunId !== null;
}

/** Subscribe to live events for a run. Returns an unsubscribe function. */
export function subscribe(runId: string, listener: Listener): () => void {
  const set = subscribers.get(runId) ?? new Set<Listener>();
  set.add(listener);
  subscribers.set(runId, set);
  return () => set.delete(listener);
}

function emit(run: RunRecord, kind: RunEventKind, payload: Record<string, unknown>): void {
  const ev: RunEvent = { kind, payload, at: new Date().toISOString(), seq: run.events.length + 1 };
  run.events.push(ev);
  for (const listener of subscribers.get(run.id) ?? []) {
    try {
      listener(ev);
    } catch { /* a broken SSE client must not break the pipeline */ }
  }
}

/* --------------------------------------------------------------------------
 * Live run: spawn `claude -p` and reduce its stream.
 * ------------------------------------------------------------------------ */
export function startRun(prompt: string): string {
  if (activeRunId) throw new Error("RUN_IN_PROGRESS");

  const run: RunRecord = {
    id: randomUUID(),
    prompt,
    status: "building",
    kaneAttempts: 0,
    kaneLog: [],
    events: [],
    startedAt: new Date().toISOString(),
  };
  runs.set(run.id, run);
  activeRunId = run.id;

  emit(run, "status", { status: "building", detail: "Starting agent session (claude -p)" });

  const { cmd, shell, detached } = claudeSpawn();
  let child: ChildProcess;
  try {
    child = spawn(cmd, [...CLAUDE_ARGS], {
      cwd: TARGET_APP_DIR,
      shell,
      detached,
      // Project env last: the agent must run on this repo's pinned auth/model even
      // if the server was launched from a terminal with a stale environment.
      env: { ...process.env, KANE_CLI_USER_AGENT: "claude-code", ...projectAgentEnv() },
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    finalize(run, "failed", `failed to spawn claude: ${(err as Error).message}`);
    return run.id;
  }

  // The user prompt travels via stdin — no quoting, no argv length limits.
  child.stdin!.write(buildPromptWrapper(prompt));
  child.stdin!.end();

  const reducer = new RunReducer();
  const rawLines: string[] = [];
  let lineBuf = "";
  let finalized = false;
  let finalMeta: { numTurns?: number; isError: boolean } | null = null;

  const watchdog = setTimeout(() => {
    killTree(child.pid);
    finalize(run, "failed", `watchdog timeout after ${Math.round(WATCHDOG_MS / 1000)}s - process tree killed`);
  }, WATCHDOG_MS);

  function apply(events: AgentEvent[]): void {
    for (const ev of events) {
      if (ev.kind === "status") {
        run.status = ev.status;
        emit(run, "status", { status: ev.status, detail: ev.detail });
      } else if (ev.kind === "kane_result") {
        run.kaneAttempts = reducer.kaneAttempts;
        run.kaneLog.push(ev.entry);
        emit(run, "kane_result", { ...ev.entry });
      } else if (ev.kind === "final") {
        finalMeta = { numTurns: ev.numTurns, isError: ev.isError };
      }
    }
  }

  function finalize(r: RunRecord, finalStatus: RunRecord["status"], why: string): void {
    if (finalized) return;
    finalized = true;
    clearTimeout(watchdog);
    r.status = finalStatus;
    r.endedAt = new Date().toISOString();
    r.finalReason = why;
    activeRunId = null;
    emit(r, "run_complete", {
      finalStatus,
      attempts: r.kaneAttempts,
      reason: why,
      numTurns: finalMeta?.numTurns,
      isError: finalMeta?.isError ?? false,
    });
    dumpTranscript(r, rawLines);
  }

  child.stdout!.on("data", (chunk: Buffer) => {
    lineBuf += chunk.toString("utf8");
    const lines = lineBuf.split(/\r?\n/);
    lineBuf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      rawLines.push(line);
      let ev: ClaudeStreamEvent;
      try {
        ev = JSON.parse(line) as ClaudeStreamEvent;
      } catch {
        continue; // non-JSON line (banner/warning) — keep it in rawLines only
      }
      apply(reducer.feed(ev));
    }
  });

  child.stderr!.on("data", (chunk: Buffer) => {
    rawLines.push(`[stderr] ${chunk.toString("utf8").trimEnd()}`);
  });

  child.on("error", (err) => {
    finalize(run, "failed", `claude process error: ${err.message}`);
  });

  child.on("exit", (code) => {
    if (finalized) return;
    const status = finalMeta
      ? finalMeta.isError
        ? "failed"
        : reducer.finalStatus()
      : code === 0
        ? reducer.finalStatus()
        : "failed";
    finalize(run, status, `agent session ended (exit ${code})`);
  });

  return run.id;
}

/* --------------------------------------------------------------------------
 * Demo replay: feed a recorded/synthetic transcript through the same pipeline.
 * ------------------------------------------------------------------------ */
interface TranscriptItem {
  kind: RunEventKind;
  payload: Record<string, unknown>;
  delayMs?: number;
}

export function createReplayRun(prompt: string, transcriptPath?: string): string {
  if (activeRunId) throw new Error("RUN_IN_PROGRESS");
  const file = transcriptPath ?? DEMO_TRANSCRIPT;
  const items = JSON.parse(fs.readFileSync(file, "utf8")) as TranscriptItem[];

  const run: RunRecord = {
    id: randomUUID(),
    prompt,
    status: "building",
    kaneAttempts: 0,
    kaneLog: [],
    events: [],
    startedAt: new Date().toISOString(),
    demo: true,
  };
  runs.set(run.id, run);
  activeRunId = run.id;

  emit(run, "status", { status: "building", detail: "DEMO REPLAY — recorded events, no agent running" });

  let cancelled = false;
  const finish = (emitComplete: boolean) => {
    if (cancelled) return;
    cancelled = true;
    run.endedAt = new Date().toISOString();
    run.finalReason = "demo replay finished";
    activeRunId = null;
    if (emitComplete) {
      emit(run, "run_complete", {
        finalStatus: run.status,
        attempts: run.kaneAttempts,
        reason: "demo replay finished",
        isError: false,
      });
    }
  };

  let i = 0;
  const step = (): void => {
    if (cancelled) return;
    if (i >= items.length) {
      finish(true); // transcript exhausted without its own run_complete — synthesize one
      return;
    }
    const item = items[i++];
    if (item.kind === "status") run.status = (item.payload.status as RunRecord["status"]) ?? run.status;
    if (item.kind === "kane_result") {
      run.kaneAttempts += 1;
      run.kaneLog.push({
        flowDescription: String(item.payload.flowDescription ?? ""),
        passed: Boolean(item.payload.passed),
        reason: item.payload.reason as string | undefined,
        testUrl: item.payload.testUrl as string | undefined,
        evidenceDir: item.payload.evidenceDir as string | undefined,
        durationSec: item.payload.durationSec as number | undefined,
        credits: item.payload.credits as number | undefined,
        timestamp: new Date().toISOString(),
      });
    }
    emit(run, item.kind, item.payload);
    if (item.kind === "run_complete") {
      run.status = (item.payload.finalStatus as RunRecord["status"]) ?? run.status;
      finish(false); // its own run_complete was just emitted — finalize silently
      return;
    }
    setTimeout(step, Math.max(150, item.delayMs ?? 600));
  };
  setTimeout(step, 400);

  return run.id;
}

/* --------------------------------------------------------------------------
 * Transcript dump: every finished run is written under proofloop/runs/
 * (gitignored). A good one gets copied to fixtures/ for demo replay.
 * ------------------------------------------------------------------------ */
function dumpTranscript(run: RunRecord, rawLines: string[]): void {
  try {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RUNS_DIR, `${run.id}.json`), JSON.stringify(run, null, 2));
    fs.writeFileSync(path.join(RUNS_DIR, `${run.id}-stream.ndjson`), rawLines.join("\n") + "\n");
  } catch { /* diagnostics only — never fail the run because of this */ }
}
