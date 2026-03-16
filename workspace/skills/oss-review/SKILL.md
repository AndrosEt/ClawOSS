---
name: oss-review
description: "Pre-submission self-review for BUG FIXES: run git diff, check all 8 quality gates (bug-fix gate, scope, code quality, tests, security, anti-slop, git hygiene, PR template). ABANDON if not a bug fix."
user-invocable: true
---

# OSS Bug Fix Self-Review

Review changes against all 8 quality gates before submission. **Gate 0 (Bug Fix Gate) is the most important — if this PR is not fixing a bug, ABANDON immediately.**

## Process
1. Run `git diff main..HEAD` to see all changes
2. Check each gate below — fail fast on any violation
3. If a gate fails, fix the issue and re-check
4. Generate PR description from diff and issue context

## 8-Gate Checklist

**Gate 0 — Bug Fix Gate (MANDATORY FIRST CHECK)**:
- Is this PR fixing a confirmed bug? (not adding a feature, not refactoring, not improving)
- Does the diff ONLY contain changes necessary to fix the reported bug?
- Does the commit message use `fix(...)` type?
- Does the PR description reference a specific bug report (issue number)?
- **If any answer is NO: ABANDON THE PR. Do not submit.**
- Common red flags that indicate this is NOT a bug fix:
  - New public API methods or endpoints added
  - New configuration options or feature flags
  - Renamed variables or restructured code without fixing a bug
  - Added functionality that didn't exist before
  - Changes to files unrelated to the bug

**Gate 1 — Scope**: Changes related to target bug only, no unrelated files, <200 LOC, <5 files. Every changed line must be necessary for the fix.

**Gate 2 — Code Quality**: Linter passes, no new warnings, matches repo style, no debug statements, no commented-out code

**Gate 3 — Tests**: All existing tests pass, new/modified test demonstrates the bug was fixed (fails before fix, passes after), test names follow repo conventions

**Gate 4 — Security**: No hardcoded secrets/API keys, no .env files staged, no eval() or dangerous patterns, no private paths

**Gate 5 — Anti-Slop**: No unnecessary comments restating code, no AI markers, no over-engineered abstractions, no premature optimization, no single-use helper functions, variable names match repo conventions

**Gate 6 — Git Hygiene**: Branch named correctly (clawoss/fix/...), conventional commits with `fix` type, no merge commits, clean linear history

**Gate 7 — PR Template**: Title clearly indicates bug fix, body explains what was broken and why, references bug report issue, includes before/after test evidence, AI disclosure present

## Independent Review (Critical)
Spawn an ISOLATED subagent via `sessions_spawn` with clean context:
- Provide ONLY: `git diff`, issue description, repo style guide
- Subagent must NOT see your implementation journey
- Use a fresh session with clean context (no implementation history)
- Subagent checks: Is this actually a bug fix? Correctness, slop, bugs, style compliance
- **If the reviewer determines this is a feature addition or refactor, ABANDON**
- Fix any flagged issues before proceeding to oss-submit
