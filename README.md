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
| `fixtures/` | Real captured transcripts (claude stream-json, Kane NDJSON) used by tests & demo mode |
| `ProofLoop-PRD.md` | Product requirements document |

## Verification loop details

- The agent is instructed (via `target-app/CLAUDE.md` + a per-run prompt wrapper) to verify every
  change with `kane-cli run --agent --url http://localhost:4000 --timeout 300 "<objective>"`.
- Kane's NDJSON output is parsed from the agent's own `tool_result` events (correlated by
  `tool_use_id`); the terminal `run_end` line yields pass/fail, reason, credits, and evidence URLs.
- Safety rails: `--max-budget-usd` per run, max 3 Kane attempts per run (prompt-enforced),
  and a 10-minute watchdog that kills the whole process tree.

## Hackathon checklist mapping

| Judge criterion | Where ProofLoop shows it |
|---|---|
| Ships | `npm start` → app works end-to-end locally |
| Verified | Kane Run Log panel with clickable `test_url` + evidence dir per attempt |
| Closed loop | Live `failed → agent fixes → verified` moment in one `claude -p` session |
| Craft | Real-time loop visualization; backend is a passive listener — no faked statuses |

---

*Built with Claude Code. Verified with Kane CLI.*
