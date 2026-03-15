---
name: safety-checker
description: "Final safety gate before PR submission: verify diff size <500 LOC, no secrets, no force-push commands, branch naming correct, anti-spam limits not exceeded. Abort if any check fails."
user-invocable: true
---

# Safety Checker

Final validation gate before `oss-submit`. Every check must pass or submission is aborted.

## Checks

### 1. Diff Size
Run `git diff --stat` and verify:
- Total lines changed < 500
- Files changed < 10
- No binary files in diff

### 2. Secret Scan
Search staged changes for:
- API keys (patterns: `sk-`, `ghp_`, `AKIA`, `Bearer`)
- Tokens and passwords (patterns: `password=`, `secret=`, `token=`)
- .env file contents
- Private keys (patterns: `-----BEGIN`)

### 3. Branch Name
Verify branch matches: `clawoss/<type>/<description>`
Valid types: fix, feat, docs, test, refactor, deps, chore

### 4. Anti-Spam Limits
Check memory for today's submissions:
- This repo: must be < 3 PRs today
- All repos: must be < 10 PRs today
- Last PR to this repo: must be > 30 minutes ago

### 5. No Dangerous Commands
Verify no force-push, no push to main/master, no `--force` flags in recent commands.

### 6. CI Status
If target repo has required CI checks, verify our branch builds locally.

## On Failure
Log which check failed, abort submission, report to dashboard.
