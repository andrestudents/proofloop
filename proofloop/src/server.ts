import express from "express";
import { DEMO_MODE, FRONTEND_DIST, PORT } from "./config.js";
import { createReplayRun, getRun, listRuns, startRun, subscribe } from "./runManager.js";
import { agentAuthSummary } from "./projectEnv.js";
import { ensureTargetApp } from "./targetApp.js";
import type { RunEvent } from "./types.js";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, demo: DEMO_MODE });
});

/** FR-1/FR-11: accept a prompt, spawn the agent run (409 if one is active). */
app.post("/api/generate", (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
  if (!prompt.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }
  let runId: string;
  try {
    runId = DEMO_MODE ? createReplayRun(prompt) : startRun(prompt);
  } catch (err) {
    if ((err as Error).message === "RUN_IN_PROGRESS") {
      res.status(409).json({ error: "A run is already in progress" });
      return;
    }
    throw err;
  }
  res.json({ runId, status: "started", demo: DEMO_MODE });
});

/**
 * FR-8: SSE with full replay of buffered events on connect (kills the
 * connect race and survives browser refreshes — NFR-2).
 */
app.get("/api/stream/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: "unknown runId" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const send = (ev: RunEvent) => {
    res.write(`event: ${ev.kind}\ndata: ${JSON.stringify(ev.payload)}\n\n`);
  };

  // 1) replay everything that already happened
  for (const ev of run.events) send(ev);
  if (run.endedAt) {
    res.end();
    return;
  }

  // 2) continue live until the run completes
  const unsubscribe = subscribe(run.id, (ev) => {
    send(ev);
    if (ev.kind === "run_complete") {
      unsubscribe();
      res.end();
    }
  });
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
  req.on("close", () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
});

/** FR-10: run history. */
app.get("/api/history", (_req, res) => {
  res.json({ runs: listRuns() });
});

// Serve the built frontend (vite output) from the same origin/port.
app.use(express.static(FRONTEND_DIST));

const boot = async (): Promise<void> => {
  if (DEMO_MODE) {
    console.log("[proofloop] DEMO_MODE=1 — replay only, no agent will be spawned");
  }
  // The target-app is served in demo mode too, so the specimen shows the real
  // artifact — in its committed before-state (the recorded run's starting point).
  try {
    await ensureTargetApp();
  } catch (err) {
    console.error(`[proofloop] ${(err as Error).message}`);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(
      `[proofloop] ${DEMO_MODE ? "(demo mode) " : ""}listening on http://localhost:${PORT}`,
    );
    if (!DEMO_MODE) console.log(`[proofloop] agent auth: ${agentAuthSummary()}`);
  });
};

boot();
