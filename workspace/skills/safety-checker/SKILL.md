---
name: safety-checker
description: "Final safety gate before PR submission: contribution type verification (bug/docs/typo/test), budget check, diff size <200 LOC, no secrets, branch naming, anti-spam limits, independent review. Abort if any check fails."
user-invocable: true
---

# Safety Checker

Final validation gate before `oss-submit`. Every check must pass or submission is aborted.

## Checks

### 0. Contribution Type Verification & Completeness (MOST IMPORTANT CHECK)
Confirm that this PR is a valid contribution, NOT a large feature or refactor:
- Read the original issue: is it a bug report, docs issue, typo, or test gap?
- Read the diff: do changes ONLY address the reported issue?
- **Does this FULLY resolve the issue?** A partial fix is not acceptable — abort and skip.
- For bugs: does the fix address the root cause, not just the symptom?
- For docs/typos: is the corrected text factually accurate (verified against code)?
- Check commit messages: is the type correct? (`fix` for bugs, `docs` for docs/typos, `test` for tests)
- **If this is a large feature addition, enhancement, or refactor: ABORT IMMEDIATELY.**
- **If this is partial work that doesn't fully resolve the issue: ABORT.**
- Red flags: new public APIs, new config options, renamed variables without issue context, files changed unrelated to the issue.

### 1. Budget Check
Verify daily token spend hasn't exceeded cap before starting new work.
Check memory for today's token usage. If over budget, abort and enter idle mode.

### 2. Diff Size
Run `git diff --stat` and verify:
- Total lines changed < 200
- Files changed < 5
- No binary files in diff

### 3. Secret Scan
Search staged changes for:
- API keys (patterns: `sk-`, `ghp_`, `AKIA`, `Bearer`)
- Tokens and passwords (patterns: `password=`, `secret=`, `token=`)
- .env file contents
- Private keys (patterns: `-----BEGIN`)

### 4. Branch Name
Verify branch matches: `clawoss/{type}/<description>`
Valid types for ClawOSS: `fix` (bugs), `docs` (documentation/typos), `test` (test additions), `typo` (typo fixes).
**If branch type is `feat`, `refactor`, or `chore`: ABORT — these are not valid contribution types.**

### 5. Anti-Spam Limits (HARD GATE — no exceptions)
Check memory/wake-state.md for today's submissions:
- **All repos: must be < 10 PRs today. If >= 10: ABORT IMMEDIATELY.** This is a hard ceiling.
- This repo: must be < 3 PRs today. If >= 3: ABORT.
- Last PR to this repo: must be > 30 minutes ago. If < 30 min: ABORT.
- **Also verify:** Run `gh pr list --author @me --repo {owner}/{repo} --state open` — if we
  already have an open PR for this repo, ABORT (avoid piling multiple PRs on one repo).

### 6. No Dangerous Commands
Verify no force-push, no push to main/master, no `--force` flags.

### 7. CI Status
If target repo has required CI checks, verify our branch builds locally.

### 8. Independent Review
Spawn an isolated subagent via `sessions_spawn` with ONLY the diff and issue description (no implementation context). Subagent must confirm:
- The change is correct and slop-free
- **The change is a valid contribution (bug fix, docs fix, typo, or test addition) — not a feature or refactor**
- **The work is complete — it fully resolves the reported issue, not just partially**
- For bugs: the fix addresses the root cause, not just the surface symptom
- For docs/typos: the corrected text is factually accurate
- Every changed line is necessary for resolving the reported issue

## On Failure
Log which check failed, abort submission, report to dashboard.
If check 0 (Contribution Type Verification) fails, log "ABORTED: not a valid contribution" prominently.
If the work is partial/incomplete, log "ABORTED: partial work — does not fully resolve the issue".
