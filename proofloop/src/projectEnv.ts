import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "./config.js";

/**
 * The headless agent runs with cwd=target-app, so the repo root's
 * .claude/settings.local.json env block (the "project-only" custom-model setup)
 * never applies to it — and on Windows the server may itself live in a terminal
 * whose environment predates the current token, which the agent then inherits
 * (observed as 10x 401 authentication_failed). Lifting the project env here pins
 * the agent's auth to this repo no matter which terminal launched the server.
 * No file (e.g. a fresh clone) → {} → the agent simply inherits process env.
 */
export function projectAgentEnv(settingsFile?: string): Record<string, string> {
  const file = settingsFile ?? path.join(ROOT_DIR, ".claude", "settings.local.json");
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { env?: Record<string, string> };
    return raw.env ?? {};
  } catch {
    return {};
  }
}

/** One masked line for the boot log, so future auth failures are diagnosable on sight. */
export function agentAuthSummary(settingsFile?: string): string {
  const project = projectAgentEnv(settingsFile);
  const token = project.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_AUTH_TOKEN;
  if (!token) {
    return "no project env and no inherited token — agent will use claude's own login";
  }
  const source = project.ANTHROPIC_AUTH_TOKEN ? "project .claude/settings.local.json" : "inherited process env";
  const model = project.ANTHROPIC_DEFAULT_OPUS_MODEL ?? process.env.ANTHROPIC_DEFAULT_OPUS_MODEL;
  const masked = `${token.slice(0, 8)}…${token.slice(-4)}`;
  return `token ${masked} from ${source}` + (model ? `, opus→${model}` : ", opus unmapped");
}
