---
name: oss-review
description: "Pre-submission self-review for contributions (bug fixes, docs fixes, typo fixes, test additions): run git diff, check all 8 quality gates (contribution type gate, scope, code quality, tests, security, anti-slop, git hygiene, PR template). ABANDON if not a valid contribution."
user-invocable: true
---

# OSS Contribution Self-Review

Review changes against all 8 quality gates before submission. **Gate 0 (Contribution Type Gate) is the most important — if this PR is not a valid contribution (bug fix, docs fix, typo fix, or test addition), ABANDON immediately.**

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

**Gate 0.5 — Completeness & Depth**:
- Does this fix FULLY resolve the reported bug? No partial fixes allowed.
- Does the fix address the ROOT CAUSE, not just the surface symptom?
- Does the PR description include a root cause analysis (WHY the bug existed)?
- If the fix is incomplete or only patches the symptom: go back and fix it properly, or ABANDON.
- A partial fix is worse than no fix — it wastes maintainer review time.

**Gate 1 — Scope**: Changes related to target bug only, no unrelated files, <200 LOC. Every changed line must be necessary for the fix. Multi-file changes are fine if the root cause demands it.

**Gate 2 — Code Quality**: Linter passes, no new warnings, matches repo style, no debug statements, no commented-out code

**Gate 3 — Tests**: All existing tests pass, new/modified test demonstrates the bug was fixed (fails before fix, passes after), test names follow repo conventions

**Gate 4 — Security**: No hardcoded secrets/API keys, no .env files staged, no eval() or dangerous patterns, no private paths

**Gate 5 — Anti-Slop**: No unnecessary comments restating code, no AI markers, no over-engineered abstractions, no premature optimization, no single-use helper functions, variable names match repo conventions

**Gate 6 — Git Hygiene**: Branch named correctly (clawoss/fix/...), conventional commits with `fix` type, no merge commits, clean linear history

**Gate 7 — PR Template**: Title clearly indicates bug fix, body includes ROOT CAUSE ANALYSIS (why the bug existed), explains what was broken and how fix addresses it, references bug report issue, includes before/after test evidence, AI disclosure present

## Independent Review (Critical)
Spawn an ISOLATED subagent via `sessions_spawn` with clean context:
- Provide ONLY: `git diff`, issue description, repo style guide
- Subagent must NOT see your implementation journey
- Use a fresh session with clean context (no implementation history)
- Subagent checks: Is this actually a bug fix? Does it address root cause? Is the fix complete? Correctness, slop, bugs, style compliance
- **If the reviewer determines this is a feature addition or refactor, ABANDON**
- **If the reviewer determines the fix is partial or superficial, go back and fix it properly**
- Fix any flagged issues before proceeding to oss-submit
