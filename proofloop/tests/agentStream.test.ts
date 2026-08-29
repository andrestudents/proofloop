import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { RunReducer } from "../src/agentStream.js";
import type { ClaudeStreamEvent } from "../src/types.js";

const PASSED_NDJSON = [
  '{"step":1,"status":"done","remark":"navigate: Go to http://localhost:4000"}',
  '{"type":"run_end","status":"passed","one_liner":"signup verified","duration":40,"credits_consumed":7,"test_url":"http://t/1","session_dir":"C:\\\\s\\\\1"}',
].join("\n");

const FAILED_NDJSON =
  '{"type":"run_end","status":"failed","summary":"email accepted invalid input","one_liner":"no validation present","duration":60,"credits_consumed":9,"test_url":"http://t/2","session_dir":"C:\\\\s\\\\2"}';

function toolUse(id: string, name: string, input: Record<string, unknown>): ClaudeStreamEvent {
  return { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } };
}

function toolResult(id: string, content: unknown): ClaudeStreamEvent {
  return { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content }] } };
}

const KANE_CMD =
  'kane-cli run --agent --url http://localhost:4000 --timeout 300 "Verify the signup form"';

test("full happy path: edit -> verify -> pass -> final", () => {
  const r = new RunReducer();

  let evs = r.feed(toolUse("t1", "Edit", { file_path: "app.js" }));
  assert.deepEqual(evs.map((e) => e.kind), ["status"]);
  assert.equal(r.status, "building");

  evs = r.feed(toolUse("t2", "Bash", { command: KANE_CMD }));
  assert.equal(r.status, "verifying");

  // an unrelated tool_result (npm install) must NOT be treated as a kane result
  evs = r.feed(toolResult("other-id", "added 68 packages in 3s"));
  assert.equal(evs.length, 0);

  evs = r.feed(toolResult("t2", PASSED_NDJSON));
  const kaneEv = evs.find((e) => e.kind === "kane_result");
  assert.ok(kaneEv && kaneEv.kind === "kane_result");
  assert.equal(kaneEv.entry.passed, true);
  assert.equal(kaneEv.entry.testUrl, "http://t/1");
  assert.equal(kaneEv.entry.flowDescription, "Verify the signup form");
  assert.equal(r.kaneAttempts, 1);
  assert.equal(r.status, "verified");

  evs = r.feed({ type: "result", is_error: false, num_turns: 9, terminal_reason: "completed" });
  const final = evs.find((e) => e.kind === "final");
  assert.ok(final && final.kind === "final" && final.isError === false && final.numTurns === 9);
  assert.equal(r.finalStatus(), "verified");
});

test("failure path: kane fails -> fixing -> still failing maps to failed", () => {
  const r = new RunReducer();
  r.feed(toolUse("t1", "Write", { file_path: "app.js", content: "x" }));
  r.feed(toolUse("t2", "Bash", { command: KANE_CMD }));
  const evs = r.feed(toolResult("t2", FAILED_NDJSON));
  assert.ok(evs.some((e) => e.kind === "kane_result" && e.entry.passed === false));
  assert.equal(r.status, "verifying"); // failed verify keeps status until next edit

  const fixEvs = r.feed(toolUse("t3", "Edit", { file_path: "app.js" }));
  assert.equal(r.status, "fixing");
  assert.ok(fixEvs.some((e) => e.kind === "status" && e.status === "fixing"));

  r.feed({ type: "result", is_error: false });
  assert.equal(r.finalStatus(), "failed"); // was mid-fix when session ended
});

test("unverified: agent finishes without ever calling kane", () => {
  const r = new RunReducer();
  r.feed(toolUse("t1", "Edit", { file_path: "a.js" }));
  r.feed({ type: "result", is_error: false });
  assert.equal(r.finalStatus(), "unverified");
});

test("failed kane then a passing retry reaches verified", () => {
  const r = new RunReducer();
  r.feed(toolUse("t1", "Bash", { command: KANE_CMD }));
  r.feed(toolResult("t1", FAILED_NDJSON));
  r.feed(toolUse("t2", "Edit", { file_path: "app.js" }));
  r.feed(toolUse("t3", "Bash", { command: KANE_CMD + " (retry)" }));
  r.feed(toolResult("t3", PASSED_NDJSON));
  assert.equal(r.kaneAttempts, 2);
  assert.equal(r.status, "verified");
  assert.equal(r.finalStatus(), "verified");
});

test("post-verification edits do not downgrade a verified run", () => {
  const r = new RunReducer();
  r.feed(toolUse("t1", "Bash", { command: KANE_CMD }));
  r.feed(toolResult("t1", PASSED_NDJSON));
  const evs = r.feed(toolUse("t2", "Edit", { file_path: "notes.md" }));
  assert.equal(r.status, "verified");
  assert.ok(!evs.some((e) => e.kind === "status"));
});

test("non-kane Bash commands are ignored", () => {
  const r = new RunReducer();
  const evs = r.feed(toolUse("t1", "Bash", { command: "kane-cli --version" }));
  assert.equal(evs.length, 0);
  assert.equal(r.status, "building");
});

test("feeding a real captured fixture never throws and ends with final", () => {
  const r = new RunReducer();
  const file = path.resolve(import.meta.dirname, "..", "..", "fixtures", "claude-stream-tooluse.ndjson");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  let sawFinal = false;
  for (const line of lines) {
    for (const ev of r.feed(JSON.parse(line) as ClaudeStreamEvent)) {
      if (ev.kind === "final") sawFinal = true;
    }
  }
  assert.ok(sawFinal, "fixture contains a result event");
  // the Read tool_use in that fixture is not kane — no attempts recorded
  assert.equal(r.kaneAttempts, 0);
});
