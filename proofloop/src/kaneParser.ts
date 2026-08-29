import type { KaneRunEnd } from "./types.js";

export interface KaneRunResult {
  passed: boolean;
  reason: string;
  summary?: string;
  testUrl?: string;
  evidenceDir?: string;
  durationSec?: number;
  credits?: number;
}

/**
 * Extract the objective text from a `kane-cli run ...` shell command line,
 * e.g.  kane-cli run --agent --url http://x --timeout 300 "Go to ..."
 */
export function extractObjective(command: string): string {
  const dq = command.match(/kane-cli\s+run\s+(?:[^"]|"[^"]*")*?"((?:[^"\\]|\\.)*)"/);
  if (dq) return dq[1];
  const sq = command.match(/kane-cli\s+run\s+(?:[^']|'[^']*')*?'([^']*)'/);
  if (sq) return sq[1];
  return command.trim();
}

/**
 * Parse a kane `--agent` NDJSON output found inside a tool_result content.
 * Returns null when this content holds no kane run_end (e.g. it is an npm log).
 */
export function parseKaneOutput(content: unknown): KaneRunResult | null {
  const text = contentToText(content);
  if (!text || !text.includes("run_end")) return null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const end = obj as KaneRunEnd;
    if (end && end.type === "run_end") {
      const reason =
        end.one_liner ||
        firstLine(end.summary) ||
        end.reason ||
        `kane run ended with status ${end.status}`;
      return {
        passed: end.status === "passed",
        reason,
        summary: end.summary,
        testUrl: typeof end.test_url === "string" ? end.test_url : undefined,
        evidenceDir: typeof end.session_dir === "string" ? end.session_dir : undefined,
        durationSec: typeof end.duration === "number" ? end.duration : undefined,
        credits: typeof end.credits_consumed === "number" ? end.credits_consumed : undefined,
      };
    }
  }
  return null;
}

function firstLine(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const line = s.split(/\r?\n/).find((l) => l.trim().length > 0);
  return line ? line.trim() : undefined;
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(contentToText).filter(Boolean).join("\n");
  if (content && typeof content === "object" && "text" in (content as Record<string, unknown>)) {
    const text = (content as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "";
}
