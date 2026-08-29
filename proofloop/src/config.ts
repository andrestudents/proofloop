import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root (src/ and dist/ are both one level below proofloop/). */
export const ROOT_DIR = path.resolve(here, "..", "..");
export const PROOFLOOP_DIR = path.resolve(here, "..");
export const TARGET_APP_DIR = path.join(ROOT_DIR, "target-app");
export const FIXTURES_DIR = path.join(ROOT_DIR, "fixtures");
export const RUNS_DIR = path.join(PROOFLOOP_DIR, "runs");
export const FRONTEND_DIST = path.join(PROOFLOOP_DIR, "frontend-dist");

// Minimal .env loader (no dependency): never overrides existing env vars.
(function loadDotEnv() {
  try {
    const text = fs.readFileSync(path.join(ROOT_DIR, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env — fine */
  }
})();

export const PORT = Number(process.env.PORT || 3001);
export const TARGET_APP_PORT = Number(process.env.TARGET_APP_PORT || 4000);
export const TARGET_APP_URL = process.env.TARGET_APP_URL || `http://localhost:${TARGET_APP_PORT}`;

/**
 * Wall-clock cap for a whole agent run (FR-13). 20 min: a single real Kane run can take
 * 200s+, so 3 attempts (the prompt cap) plus build/fix time needs the headroom.
 */
export const WATCHDOG_MS = Number(process.env.WATCHDOG_MS || 20 * 60 * 1000);
/** Per-run API spend cap forwarded to claude (NFR-6). */
export const MAX_BUDGET_USD = process.env.MAX_BUDGET_USD || "3";
export const DEMO_MODE = process.env.DEMO_MODE === "1";
/**
 * DEMO_MODE replay source. Default: a REAL captured run (its kane evidence URLs are live).
 * Set DEMO_TRANSCRIPT=fixtures/demo-transcript.json for the synthetic fix-loop showcase.
 */
export const DEMO_TRANSCRIPT =
  process.env.DEMO_TRANSCRIPT || path.join(FIXTURES_DIR, "demo-transcript-real.json");
