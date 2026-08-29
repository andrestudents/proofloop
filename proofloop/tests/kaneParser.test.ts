import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { extractObjective, parseKaneOutput } from "../src/kaneParser.js";

const FIXTURES = path.resolve(import.meta.dirname, "..", "..", "fixtures");

/** The real passing run captured against target-app (Phase 2). */
function realPassedRunEnd(): string {
  const lines = fs
    .readFileSync(path.join(FIXTURES, "kane-passed.ndjson"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes('"type":"run_end"'));
  assert.ok(lines.length >= 1, "fixture must contain a run_end line");
  return lines[lines.length - 1];
}

test("parses a real captured passing kane run", () => {
  const content = ['{"step":1,"status":"done","remark":"navigate: Go to url"}', realPassedRunEnd()].join("\n");
  const parsed = parseKaneOutput(content);
  assert.ok(parsed, "should parse");
  assert.equal(parsed.passed, true);
  assert.ok(parsed.testUrl!.includes("test-manager.lambdatest.com"));
  assert.ok(parsed.evidenceDir!.includes(".testmuai"));
  assert.ok(parsed.credits! > 1, "credits from real run");
  assert.ok(parsed.durationSec! > 5, "duration from real run");
});

test("parses a failed run_end and prefers one_liner as the short reason", () => {
  const content = [
    '{"step":3,"status":"done","remark":"type: typing username"}',
    '{"type":"run_end","status":"failed","summary":"Line one of failure\\nLine two","one_liner":"form rejected nothing","duration":94.2,"credits_consumed":21.2,"test_url":"http://x/y","session_dir":"C:\\\\sessions\\\\abc"}',
  ].join("\n");
  const parsed = parseKaneOutput(content);
  assert.ok(parsed);
  assert.equal(parsed.passed, false);
  assert.equal(parsed.reason, "form rejected nothing");
  assert.equal(parsed.durationSec, 94.2);
  assert.equal(parsed.credits, 21.2);
});

test("summary first line is used when one_liner is missing", () => {
  const parsed = parseKaneOutput('{"type":"run_end","status":"failed","summary":"\\nFirst real line\\nmore"}');
  assert.ok(parsed);
  assert.equal(parsed.reason, "First real line");
});

test("non-kane tool output returns null", () => {
  assert.equal(parseKaneOutput("added 68 packages in 3s"), null);
  assert.equal(parseKaneOutput(undefined), null);
  assert.equal(parseKaneOutput([{ type: "text", text: "npm warn deprecated" }]), null);
});

test("tool_result array content is handled", () => {
  const runEnd = '{"type":"run_end","status":"passed","one_liner":"ok"}';
  const parsed = parseKaneOutput([{ type: "text", text: runEnd }]);
  assert.ok(parsed);
  assert.equal(parsed.passed, true);
});

test("extractObjective pulls the quoted objective out of a kane command", () => {
  const cmd =
    'kane-cli run --agent --url http://localhost:4000 --timeout 300 "Go to the form and verify the heading"';
  assert.equal(extractObjective(cmd), "Go to the form and verify the heading");
});

test("extractObjective handles env-prefixed and single-quoted commands", () => {
  assert.equal(
    extractObjective("export KANE_CLI_USER_AGENT=claude-code && kane-cli run --agent \"Check it\""),
    "Check it",
  );
  assert.equal(extractObjective("kane-cli run --agent 'Single quoted'"), "Single quoted");
});
