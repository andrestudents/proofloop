# ProofLoop

> Type a feature request. Watch an AI agent build it, verify it in a real browser with
> [Kane CLI](https://www.testmuai.com/kane-cli/), fix what failed, and re-verify — all in one
> autonomous session. ProofLoop is the live window into that loop.

Built for the **Kane CLI Online Hackathon** (TestMu AI).

## What it is

```
You type:   "add email validation to the signup form"
                │
                ▼
   Claude Code (headless, spawned by ProofLoop)
       edits target-app code ──────────► status: BUILDING
                │
                ▼ calls Kane CLI itself (its own decision)
   Kane CLI opens real Chrome ─────────► status: VERIFYING
                │
        ┌───────┴────────┐
     PASS                FAIL
        │                  │
   status: VERIFIED    status: FIXING ──► agent edits again ──► verify again
```

ProofLoop's backend **never** calls Kane CLI. It spawns one `claude -p` process and passively
translates that agent's own tool stream (`--output-format stream-json`) into a real-time status UI,
with clickable evidence (Kane dashboard run URL + local evidence pack) for every verification.

## Quickstart (one command)

Prerequisites: Node.js 20+, `claude` CLI authenticated, `kane-cli` authenticated (`kane-cli login`),
Chrome installed.

```bash
npm start          # from the repo root: installs, builds, starts everything
```

Then open **http://localhost:3001** and type a feature request, e.g.
`add email validation to the signup form — reject invalid emails with a visible error message`.

### Demo replay (no agent needed)

```bash
DEMO_MODE=1 npm start   # replays a recorded real run through the same UI (banner shown)
```

## Repo layout

| Path | What |
|---|---|
| `proofloop/` | Backend (Express + TypeScript) + React frontend |
| `target-app/` | The app being edited & verified (Express + static signup form) |
| `fixtures/` | Real captured transcripts (claude stream-json, Kane NDJSON, demo replays) used by tests & demo mode |
| `ProofLoop-PRD.md` | Product requirements document |

## Verification loop details

- The agent is instructed (via `target-app/CLAUDE.md` + a per-run prompt wrapper) to verify every
  change with `kane-cli run --agent --url http://localhost:4000 --timeout 300 "<objective>"`.
- Kane's NDJSON output is parsed from the agent's own `tool_result` events (correlated by
  `tool_use_id`); the terminal `run_end` line yields pass/fail, reason, credits, and evidence URLs.
- Safety rails: `--max-budget-usd` per run, max 3 Kane attempts per run (prompt-enforced),
  and a 20-minute watchdog that kills the whole process tree (a real Kane run can take 200s+,
  so three attempts need the headroom — we learned this live).

### Demo replay sources

`DEMO_MODE=1` replays a **real captured run** by default (`fixtures/demo-transcript-real.json`) —
its Kane dashboard link and evidence dir are from an actual passing browser run. Alternatives:

```bash
DEMO_TRANSCRIPT=fixtures/demo-transcript-real-failed.json DEMO_MODE=1 npm start  # a real failed run
DEMO_TRANSCRIPT=fixtures/demo-transcript.json DEMO_MODE=1 npm start              # synthetic fix-loop showcase
```

## What we learned running it live

Every rule in `target-app/CLAUDE.md` was earned empirically. Two examples:

- **Objective length matters more than code correctness.** In one live run the agent's code was
  correct on the first attempt, but its Kane objective bundled three submit scenarios with
  repeated "clear the field" steps. Kane's browser agent got stuck twice trying to recognize the
  finished state (197s and 204s runs), and the session hit its wall-clock cap before a third
  attempt. A two-scenario objective (negative + positive) passes in ~73s.
  Hence the grammar rules: **max 2 scenarios, never ask Kane to clear a field, simplify the
  objective on retry instead of repeating it.**
- **Conditionals freeze Kane.** An objective phrased "if the error is visible, click…" makes Kane
  stop and analyze instead of acting. Direct commands only.

## Hackathon checklist mapping

| Judge criterion | Where ProofLoop shows it |
|---|---|
| Ships | `npm start` → app works end-to-end locally |
| Verified | Kane Run Log panel with clickable `test_url` + evidence dir per attempt |
| Closed loop | Live `failed → agent fixes → verified` moment in one `claude -p` session |
| Craft | Real-time loop visualization; backend is a passive listener — no faked statuses |

## Demo video storyboard (~90s)

1. **0:00–0:10** — One terminal command: `npm start`. Server + target app boot.
2. **0:10–0:20** — Open http://localhost:3001. Type "add email validation to the signup form". Hit Generate.
3. **0:20–0:40** — UI goes BUILDING: the agent's live activity streams in (Read/Edit tool calls
   rendered as human-readable narration). Target-app panel shows the untouched form.
4. **0:40–0:50** — Status flips VERIFYING: the stepper highlights, and the Kane objective the agent
   wrote is shown verbatim — the agent decided to call Kane itself.
5. **0:50–1:10** — Kane result card lands: PASS pill, duration, credits, and a **clickable link to
   the real Kane dashboard run** (browser automation trace in actual Chrome).
6. **1:10–1:30** — VERIFIED. Target-app iframe auto-refreshes: submit an invalid email live, error
   message appears. Close on the Kane Run Log: evidence for every attempt, zero human intervention.

(The fix-loop moment — FAIL → agent fixes → PASS — is shown either live or via the
`DEMO_TRANSCRIPT=fixtures/demo-transcript.json` replay if the live run passes first try.)

---

*Built with Claude Code (spawned headless by ProofLoop itself). Verified with Kane CLI.*
