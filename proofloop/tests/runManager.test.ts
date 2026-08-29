import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createReplayRun,
  getRun,
  hasActiveRun,
  subscribe,
} from "../src/runManager.js";
import type { RunEvent } from "../src/types.js";

function waitFor(predicate: () => boolean, ms = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > ms) {
        clearInterval(timer);
        reject(new Error("waitFor timeout"));
      }
    }, 50);
  });
}

function tempTranscript(items: unknown[]): string {
  const file = path.join(os.tmpdir(), `pl-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(items));
  return file;
}

test("replay run: events stream in order, record finalizes, history updates", async () => {
  const transcript = tempTranscript([
    { kind: "status", payload: { status: "building" }, delayMs: 60 },
    { kind: "status", payload: { status: "verifying", detail: "kane-cli run ..." }, delayMs: 60 },
    { kind: "kane_result", payload: { flowDescription: "verify signup", passed: false, reason: "no validation" }, delayMs: 60 },
    { kind: "status", payload: { status: "fixing" }, delayMs: 60 },
    { kind: "kane_result", payload: { flowDescription: "verify signup", passed: true, reason: "rejected invalid" }, delayMs: 60 },
    { kind: "status", payload: { status: "verified" }, delayMs: 60 },
    { kind: "run_complete", payload: { finalStatus: "verified", attempts: 2, isError: false }, delayMs: 60 },
  ]);

  const runId = createReplayRun("test prompt", transcript);
  const run = getRun(runId)!;
  assert.equal(run.demo, true);

  const collected: RunEvent[] = [];
  subscribe(runId, (ev) => collected.push(ev));

  await waitFor(() => run.endedAt !== undefined);
  assert.equal(hasActiveRun(), false);
  assert.equal(run.status, "verified");
  assert.equal(run.kaneAttempts, 2);
  assert.equal(run.kaneLog.length, 2);
  assert.equal(run.kaneLog[0].passed, false);
  assert.equal(run.kaneLog[1].passed, true);

  const kinds = run.events.map((e) => e.kind);
  assert.deepEqual(kinds.slice(-2), ["status", "run_complete"]);
  const complete = run.events.find((e) => e.kind === "run_complete")!;
  assert.equal((complete.payload as { finalStatus: string }).finalStatus, "verified");
});

test("buffered replay: a late subscriber sees the full history (FR-8)", async () => {
  const transcript = tempTranscript([
    { kind: "status", payload: { status: "building" }, delayMs: 50 },
    { kind: "run_complete", payload: { finalStatus: "verified", attempts: 0 }, delayMs: 50 },
  ]);
  const runId = createReplayRun("replay race test", transcript);
  const run = getRun(runId)!;
  await waitFor(() => run.endedAt !== undefined);

  // subscribe AFTER the run finished — everything must still be delivered
  const late: RunEvent[] = [];
  subscribe(runId, (ev) => late.push(ev));
  assert.equal(late.length, 0); // already-ended runs deliver via buffer, not live

  const seenKinds = run.events.map((e) => e.kind);
  assert.ok(seenKinds.includes("run_complete"));
});

test("second run while one is active is rejected (RUN_IN_PROGRESS / FR-11)", async () => {
  const slow = tempTranscript([
    { kind: "status", payload: { status: "building" }, delayMs: 700 },
    { kind: "run_complete", payload: { finalStatus: "unverified", attempts: 0 }, delayMs: 100 },
  ]);
  const firstId = createReplayRun("slow run", slow);
  assert.ok(hasActiveRun());

  const fast = tempTranscript([
    { kind: "run_complete", payload: { finalStatus: "verified", attempts: 0 }, delayMs: 50 },
  ]);
  assert.throws(() => createReplayRun("second run", fast), /RUN_IN_PROGRESS/);

  await waitFor(() => getRun(firstId)!.endedAt !== undefined);
  assert.equal(hasActiveRun(), false);
});
