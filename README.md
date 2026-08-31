# ProofLoop

> Type a feature request. Watch an AI agent build it, verify it in a real browser with
> [Kane CLI](https://www.testmuai.com/kane-cli/), fix what failed, and re-verify — all in one
> autonomous session. ProofLoop is the live window into that loop.

**Closed-loop feature delivery: Claude Code writes the change, Kane proves it in a real browser, ProofLoop shows the loop live.**

Stack: **Node.js 20+** · **Express + TypeScript** (backend, `:3001`) · **React + Vite** (dossier UI) ·
**Claude Code, headless** (the coding agent ProofLoop spawns) · **Kane CLI** (the verifier the agent
calls) · one command from any terminal.

Built for the **Kane CLI Online Hackathon** (TestMu AI).

---

## 0. Read this first — the one rule everything hangs on

The scored loop is: **the agent writes code → the agent itself decides to run Kane → Kane fails →
the agent reads the failure → the agent patches → the hook re-fires → Kane goes green.** Claude
Code must be the agent that writes the fix *and* the one that invokes the verifier.

So ProofLoop's backend is a **passive translator** — it never calls Kane. If the orchestrator
called Kane itself, the loop would be scripted theater; here the autonomy is real and observable
in the tool stream. The backend's job is narrow:

1. Take a prompt in, spawn **one** headless `claude -p` process (cwd = `target-app/`, prompt via stdin).
2. Parse the agent's `stream-json` tool stream (`agentStream.ts` — a pure reducer, unit-tested against real captured fixtures).
3. Detect the agent invoking `kane-cli run` → status flips to VERIFYING, the objective captured verbatim.
4. Correlate Kane's NDJSON output with the matching `tool_result` (`tool_use_id`) → a verdict exhibit.
5. Enforce the safety rails (budget cap, watchdog, one run at a time).
6. Stream every transition to the browser over SSE.

Everything below is those six steps, built so that **what you see on screen is data, never narration.**

---

## 1. The loop at a glance

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

The UI never fakes a state: every status change on screen is derived from a real tool event in
the agent's stream. A FAIL is a real Kane `run_end: failed` the agent received and acted on.

---

## 2. Quickstart (one command)

Prerequisites: Node.js 20+, `claude` CLI authenticated, `kane-cli` authenticated (`kane-cli login`),
Chrome installed.

```bash
npm start          # from the repo root: installs, builds, starts everything
```

Then open **http://localhost:3001** and type a feature request, e.g.
`add email validation to the signup form — reject invalid emails with a visible error message`.

The specimen app under test is served at **http://localhost:4000** and embedded live in the UI's
bottom-right frame (it auto-reloads when a run completes).

### Demo replay (no agent needed)

```bash
DEMO_MODE=1 npm start                      # bash
$env:DEMO_MODE="1"; npm start              # PowerShell (Windows)
```

Replays a recorded **real** run through the same UI (banner shown) — and the target app is
served too, so the specimen frame is live: after the replay verifies, submit an invalid
password in it yourself.

```bash
DEMO_TRANSCRIPT=fixtures/demo-transcript-real-failed.json DEMO_MODE=1 npm start  # a real failed run
DEMO_TRANSCRIPT=fixtures/demo-transcript.json DEMO_MODE=1 npm start              # synthetic fix-loop showcase
```

Default replay (`fixtures/demo-transcript-real.json`) is run #3 from the live table below — a real
FAIL→PASS fix loop whose Kane dashboard link and evidence dir are from actual browser runs.

---

## 3. Architecture at a glance

```
   browser — React dossier UI (:3001)
       │  POST /api/generate {prompt}            GET /api/stream/:runId (SSE)
       ▼                                                ▲
┌────────────────────────────────────────────────────────┴──────────┐
│  ProofLoop backend — Express + TypeScript (:3001)                  │
│                                                                    │
│   server.ts       API + SSE + serves the built frontend            │
│   runManager.ts   run registry · event bus · watchdog · replay     │
│   agentStream.ts  pure reducer: claude stream-json → UI events     │
│   kaneParser.ts   Kane NDJSON → verdict exhibit (run_end)          │
└──────┬─────────────────────────────────────────────────────────────┘
       │  spawn headless (cwd = target-app/), prompt travels via stdin
       ▼
   claude -p   ── the coding agent (Claude Code)
       │   edits the code, then — its own decision — executes:
       ▼
   kane-cli run --agent --url http://localhost:4000 "<objective>"
       │   drives a real Chrome session (cloud, LambdaTest)
       ▼
   target-app (:4000) — the specimen under test
```

### Why these choices

| Decision | Rationale |
|---|---|
| Headless `claude -p` + `--output-format stream-json` | One real agent session whose every tool call is observable — the UI is a translation of real events, never a simulation. |
| Backend never calls Kane | The autonomy is the product: the *agent* decides to verify. Parsing its tool stream keeps ProofLoop honest by construction. |
| Pure reducer over the stream (`agentStream.ts`) | No I/O — fully unit-testable. 20/20 tests green against real captured fixtures (`proofloop/tests/`). |
| Kane NDJSON keyed off `run_end` + `tool_use_id` correlation | Stable schema (verdict, reason, duration, credits, dashboard URL); correlation means we never guess which output belongs to which objective. |
| SSE with full buffered replay on connect | Kills the connect race; a browser refresh mid-run rehydrates completely. |
| In-memory run registry + on-disk `runs/*.ndjson` transcripts | A hackathon doesn't need a database — and raw transcripts double as evidence and demo-replay fixtures. |
| Objective grammar in `target-app/CLAUDE.md` + per-run prompt wrapper | Every rule was earned empirically in live runs (§6), not invented. |
| Watchdog (20 min) + `--max-budget-usd` + one-run-at-a-time (409) | A real Kane run takes 200s+; three attempts need headroom — learned the hard way in run #2. |
| Demo replay from real fixtures | Judges get the full UI with zero credentials, and evidence links still point at the real Kane dashboard. |

---

## 4. Repository layout

```
kane/
├── proofloop/
│   ├── src/                      # backend (Express + TypeScript)
│   │   ├── server.ts             # API routes, SSE endpoint, static hosting (:3001)
│   │   ├── runManager.ts         # run registry, event bus, watchdog, transcript dump, demo replay
│   │   ├── agentStream.ts        # the state reducer: stream-json → status/kane_result events
│   │   ├── kaneParser.ts         # Kane NDJSON parser + objective extraction from the command
│   │   ├── claudeCommand.ts      # headless claude invocation, allowlist, budget, kill-tree
│   │   ├── promptWrapper.ts      # per-run prompt contract (wraps the user's request)
│   │   ├── projectEnv.ts         # agent auth env plumbing (the boot "agent auth:" line)
│   │   ├── targetApp.ts          # ensures the specimen app is up on :4000
│   │   ├── config.ts             # ports, watchdog, budget cap, demo transcript
│   │   └── types.ts              # shared types + stream-json / Kane NDJSON guards
│   ├── tests/                    # parser, reducer, run-manager, env tests (real fixtures)
│   └── frontend/src/             # React dossier UI (Vite)
│       ├── App.tsx               # two-column dossier layout
│       └── components/
│           ├── RequestForm.tsx   # intake: file a feature request
│           ├── LoopTrace.tsx     # the loop circuit — segments light up from real events
│           ├── Transcript.tsx    # what the agent did, narrated from tool calls
│           ├── EvidenceLog.tsx   # Kane exhibits: verdict stamp, duration, credits, dashboard ↗
│           ├── Specimen.tsx      # live iframe of the app under test (:4000)
│           └── CaseIndex.tsx     # run history
├── target-app/                   # the specimen: Express + static signup form (:4000)
│   ├── public/                   # index.html / styles.css / app.js (no validation — agent's job)
│   ├── CLAUDE.md                 # the empirically-earned Kane objective grammar + verification rule
│   └── .testmuai/context.md      # Kane's own context doc for this app
├── fixtures/                     # real captured transcripts (tests + demo replay sources)
└── ProofLoop-PRD.md              # product requirements document
```

---

## 5. The run pipeline

### Status machine (driven only by tool events)

| Status | Entered when | Meaning |
|---|---|---|
| `building` | run starts; agent's first `Edit`/`Write` before any Kane attempt | agent is reading and editing code |
| `verifying` | agent runs a command matching `kane-cli run` | Kane is driving the real browser — the raw command (objective) is captured and shown verbatim |
| `fixing` | agent edits after ≥ 1 Kane attempt | a verification failed; the agent is patching |
| `verified` | a Kane `run_end` says `passed` | loop closed — exhibit stamped (sticky: later edits don't downgrade it) |
| `failed` | stream ends while verifying/fixing, or watchdog fires | non-convergence, killed process tree |
| `unverified` | stream ends without any Kane pass | agent finished but never verified |

### SSE event contract (`GET /api/stream/:runId`)

Every event line is `event: <kind>\ndata: <json>\n\n`; on connect the full buffered history is
replayed first, then the live tail. Three kinds, ever:

| `event:` | When | Payload |
|---|---|---|
| `status` | state transition | `{ status, detail? }` — on `verifying`, `detail` is the exact `kane-cli` command the agent chose |
| `kane_result` | a Kane `run_end` parsed from the agent's `tool_result` | `{ flowDescription, passed, reason, testUrl, evidenceDir, durationSec, credits, timestamp }` |
| `run_complete` | terminal | `{ finalStatus, attempts, reason, numTurns, isError }` |

### API surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/generate` | Start a run (`{prompt}`); 409 if one is already active. Demo mode: creates a replay run. |
| GET | `/api/stream/:runId` | SSE live feed with full replay-on-connect |
| GET | `/api/history` | Past runs (case index) |
| GET | `/api/health` | `{ok, demo}` |

### Safety rails

- The agent is spawned with an **allowlisted toolset** (`Bash,Edit,Write,Read,Glob,Grep,TodoWrite`),
  `--permission-mode acceptEdits`, and **`--max-budget-usd`** per run.
- The user prompt travels via **stdin, never argv** (no shell-injection surface on the Windows shim).
- **20-minute watchdog** kills the whole process tree (agent → shell → kane → chrome).
- Max 3 Kane attempts per run (contract in `target-app/CLAUDE.md`, re-stated per run by the prompt wrapper).

---

## 6. What we learned running it live

Three full live sessions (`claude -p` + real Kane browser runs), no human touching the app:

| Run | Prompt | Outcome | Total | Kane attempts |
|---|---|---|---|---|
| #1 | email validation | ✅ `verified` | 2m 28s · 9 turns | 1 — PASS (73s, 23.5 cr) |
| #2 | password rule | ❌ `failed` (watchdog) | 10m (killed) | 2 — FAIL, FAIL (197s / 204s) |
| #3 | password rule, hardened grammar | ✅ `verified` | 4m 35s · 11 turns | 2 — FAIL (79.5s, browser flake) → **PASS** (50.2s, 18.5 cr) |

Run #3 is the money shot: a **real** Kane failure (browser screenshot flake) that the agent
retried on its own and passed — the autonomous loop closing live, with dashboard evidence
for both the failure and the pass. That run is the default `DEMO_MODE` replay.

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

---

## 7. Demo runbook (~90s video)

**Pre-flight (2 min before recording):**

```bash
npm start
curl http://localhost:3001/api/health     # {"ok":true,"demo":false}
# boot log must show the "agent auth:" line (not "none") — that means live runs will work
```

**The arc:**

1. **0:00–0:10** — One terminal command: `npm start`. Server + target app boot.
2. **0:10–0:20** — Open http://localhost:3001. Type "add email validation to the signup form". Hit Generate.
3. **0:20–0:40** — UI goes BUILDING: the agent's live activity streams in (Read/Edit tool calls
   rendered as human-readable narration). Target-app panel shows the untouched form.
4. **0:40–0:50** — Status flips VERIFYING: the loop circuit's amber segment starts marching, and the
   Kane objective the agent wrote is shown verbatim — the agent decided to call Kane itself.
5. **0:50–1:10** — An exhibit lands in the Evidence panel: verdict stamp, duration, credits, and a
   **clickable link to the real Kane dashboard run** (browser automation trace in actual Chrome).
6. **1:10–1:30** — VERIFIED. The specimen frame auto-reloads: submit an invalid email live, error
   message appears. Close on the Evidence panel: exhibits for every attempt, zero human intervention.

**Failure modes & instant recovery:**

| If… | Do this |
|---|---|
| Live run passes on the first Kane attempt (no FAIL moment) | Show the default demo replay right after — run #3 is a real FAIL→PASS loop (`DEMO_MODE=1 npm start`, banner discloses the replay). |
| A Kane run stalls (browser flake) | Let it breathe — the agent simplifies the objective on retry (that *is* run #3's story); the watchdog caps the session at 20 min. |
| No Kane credits / no API key on the machine | `DEMO_MODE=1 npm start` — the full UI, zero credentials, evidence links still real. |
| Browser tab refreshed mid-run | Nothing lost — SSE replays the full buffered event log on reconnect. |
| Agent auth fails (401s in the transcript) | Check the boot `agent auth:` line and the first lines of `proofloop/runs/*.ndjson` — the auth env must reach the spawned claude. |

---

## 8. Hackathon checklist mapping

| Judge criterion | Where ProofLoop shows it |
|---|---|
| Ships | `npm start` → app works end-to-end locally |
| Verified | Evidence panel: every Kane attempt filed as an exhibit with verdict stamp, clickable `test_url`, and evidence dir |
| Closed loop | The loop circuit at the top of the UI — the FAIL return path lights up and the agent travels it live |
| Craft | Verification-dossier UI (state colors are data, not decoration); backend is a passive listener — no faked statuses |

---

## Submission paragraph

> ProofLoop is a live window into an agent's build-verify loop. Type a feature request in plain
> English; a headless Claude Code session (the coding agent) implements it in a small target web
> app, then calls Kane CLI itself to verify the change in a real browser — Kane drives actual
> Chrome through the app and asserts the new behavior really works (e.g. invalid input is
> rejected with a visible error, valid input is accepted). If the verdict is FAIL, the agent
> reads Kane's NDJSON result, fixes the code, and re-verifies, all in one autonomous session.
> ProofLoop's backend never calls Kane: it only translates the agent's own tool stream into a
> real-time status UI, filing every attempt as an evidence exhibit with a clickable link to the
> live Kane dashboard run. Built with Claude Code; verified with Kane CLI; ships with a
> one-command local setup and a zero-credential demo replay.

---

*Built with Claude Code (spawned headless by ProofLoop itself). Verified with Kane CLI.*
