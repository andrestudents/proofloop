/**
 * Per-run prompt wrapper sent to the agent via stdin.
 * (The durable rules live in target-app/CLAUDE.md — this is the per-run reminder.)
 */
export function buildPromptWrapper(userPrompt: string): string {
  return [
    "Implement this feature request in the current repository (a small Express + static web app):",
    "",
    `"""${userPrompt.trim()}"""`,
    "",
    "Follow the rules in CLAUDE.md. Summary:",
    "- Read the relevant code first; make the change with minimal edits.",
    "- The app is already running at http://localhost:4000 — static files are live, no rebuild needed.",
    "- After every change, verify with kane-cli exactly as CLAUDE.md describes (max 3 attempts total).",
    "- Finish with a short report: what changed (files), the Kane verification status of each attempt,",
    "  and the test_url of the last Kane run.",
  ].join("\n");
}
