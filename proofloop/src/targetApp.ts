import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TARGET_APP_DIR, TARGET_APP_PORT } from "./config.js";

const HEALTH_URL = `http://localhost:${TARGET_APP_PORT}/api/health`;

async function healthy(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return Boolean(body?.ok);
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Make sure the target-app is listening on :4000. Spawns it as a detached
 * child if needed; fails fast with a clear message when the port is occupied
 * by something else or deps are missing.
 */
export async function ensureTargetApp(): Promise<void> {
  if (await healthy()) {
    console.log(`[proofloop] target-app already healthy on :${TARGET_APP_PORT}`);
    return;
  }

  const depsOk = fs.existsSync(path.join(TARGET_APP_DIR, "node_modules", "express"));
  if (!depsOk) {
    throw new Error(
      `target-app dependencies missing — run "npm run setup" at the repo root first`,
    );
  }

  const child = spawn(process.execPath, ["server.js"], {
    cwd: TARGET_APP_DIR,
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });
  child.unref();

  for (let i = 0; i < 30; i++) {
    if (await healthy()) {
      console.log(`[proofloop] target-app spawned on :${TARGET_APP_PORT} (pid ${child.pid})`);
      return;
    }
    await sleep(500);
  }
  throw new Error(
    `target-app did not become healthy on :${TARGET_APP_PORT} within 15s — ` +
      `is the port occupied by another process?`,
  );
}
