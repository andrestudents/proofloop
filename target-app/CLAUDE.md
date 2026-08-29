# Target App — Agent Working Instructions

This is a tiny Express + static web app (a signup form). It is ALREADY RUNNING at
http://localhost:4000 — static files are served live, so edits to `public/` are visible on the
next page load. Do not restart or rebuild anything.

## Mandatory verification rule

After ANY code change in this repository, you MUST verify the change in a real browser with
Kane CLI BEFORE considering the task done:

```
kane-cli run --agent --url http://localhost:4000 --timeout 300 "<objective>"
```

- Kane prints NDJSON. A run ends with a line containing `"type":"run_end"` and
  `"status":"passed"` or `"failed"` (plus `summary`, `test_url`, `session_dir`).
- If a run FAILS: read the failure summary/remarks, fix the code, and verify again.
- MAXIMUM 3 Kane attempts total for one task. If it still fails, stop and report exactly
  what is wrong and what you tried.

## Objective grammar (empirically learned — follow strictly)

- Phrase actions as direct commands ("Type `abc` into the email field"). NEVER use conditional
  phrasing ("if not logged in, ...") — Kane treats it as a checkpoint to analyze, not an action.
- Click a field to focus it BEFORE typing — typing without focus sometimes doesn't land.
- End every objective with a clear terminal assertion ("verify that ... is visible").
- For form-validation features: include BOTH a negative case (invalid input is rejected and the
  error message is visible) and a positive case (valid input is accepted) in the objective.

## Code conventions

- Keep feature logic client-side in `public/app.js` (live without rebuild).
- Only touch `server.js` if strictly necessary; no build step; no new dependencies unless essential.
- Match the existing code style.

## When you are done

Finish with a short report: what changed (files), the Kane verification status for each attempt,
and the `test_url` of the last run.
