import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentAuthSummary, projectAgentEnv } from "../src/projectEnv.js";

function tempSettings(env: Record<string, string> | undefined): string {
  const file = path.join(os.tmpdir(), `pl-env-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify({ permissions: { allow: ["Bash(ls:*)"] }, env }));
  return file;
}

test("projectAgentEnv: lifts only the env block from settings.local.json", () => {
  const env = projectAgentEnv(tempSettings({ ANTHROPIC_AUTH_TOKEN: "t", ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-5.2" }));
  assert.deepEqual(env, { ANTHROPIC_AUTH_TOKEN: "t", ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-5.2" });
});

test("projectAgentEnv: settings without env, and missing file, are no-ops", () => {
  assert.deepEqual(projectAgentEnv(tempSettings(undefined)), {});
  assert.deepEqual(projectAgentEnv(path.join(os.tmpdir(), "pl-no-such-settings.json")), {});
});

test("agentAuthSummary: masks the token and names the source", () => {
  const file = tempSettings({
    ANTHROPIC_AUTH_TOKEN: "1234567890abcdef",
    ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-5.2",
  });
  const summary = agentAuthSummary(file);
  assert.equal(summary, "token 12345678…cdef from project .claude/settings.local.json, opus→glm-5.2");
  assert.ok(!summary.includes("90abcdef"), "the token body must never appear in the summary");
});
