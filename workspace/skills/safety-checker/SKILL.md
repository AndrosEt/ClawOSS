---
name: safety-checker
description: "Final safety gate before PR submission: bug-fix verification, budget check, diff size <200 LOC, no secrets, branch naming, anti-spam limits, independent review. Abort if any check fails — especially if PR is not a bug fix."
user-invocable: true
---

# Safety Checker

Final validation gate before `oss-submit`. Every check must pass or submission is aborted.

## Checks

### 0. Bug Fix Verification & Completeness (MOST IMPORTANT CHECK)
Confirm that this PR is fixing a bug COMPLETELY, NOT adding a feature or refactoring:
- Read the original issue: is it a bug report with error/crash/broken behavior?
- Read the diff: do changes ONLY fix the reported bug?
- **Does this fix FULLY resolve the issue?** A partial fix is not acceptable — abort and skip.
- Does the fix address the root cause, not just the symptom?
- Check commit messages: is the type `fix`?
- **If this is a feature addition, enhancement, or refactor: ABORT IMMEDIATELY.**
- **If this is a partial fix that doesn't fully resolve the bug: ABORT.**
- Red flags: new public APIs, new config options, renamed variables without bug context, files changed that are unrelated to the bug.

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
Verify branch matches: `clawoss/fix/<description>`
**For bug fixes, type MUST be `fix`.** Other types (feat, refactor, docs) indicate a non-bug PR — abort.
Valid types for ClawOSS: fix (only)

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
- **The change is a bug fix, not a feature addition or refactor**
- **The fix is complete — it fully resolves the reported bug, not just partially**
- **The fix addresses the root cause, not just the surface symptom**
- Every changed line is necessary for fixing the reported bug

## On Failure
Log which check failed, abort submission, report to dashboard.
If check 0 (Bug Fix Verification) fails, log "ABORTED: not a bug fix" prominently.
If the fix is partial/incomplete, log "ABORTED: partial fix — does not fully resolve the issue".
