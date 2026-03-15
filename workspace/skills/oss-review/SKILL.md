---
name: oss-review
description: "Pre-submission self-review: run git diff, check all 7 quality gates (scope, code quality, tests, security, anti-slop, git hygiene, PR template). Fail fast on any gate violation."
user-invocable: true
---

# OSS Self-Review

Review changes against all 7 quality gates before submission.

## Process
1. Run `git diff main..HEAD` to see all changes
2. Check each gate below — fail fast on any violation
3. If a gate fails, fix the issue and re-check
4. Generate PR description from diff and issue context

## 7-Gate Checklist

**Gate 1 — Scope**: Changes related to target issue only, no unrelated files, <200 LOC, <5 files

**Gate 2 — Code Quality**: Linter passes, no new warnings, matches repo style, no debug statements, no commented-out code

**Gate 3 — Tests**: All existing tests pass, new tests added for changes, test names follow repo conventions

**Gate 4 — Security**: No hardcoded secrets/API keys, no .env files staged, no eval() or dangerous patterns, no private paths

**Gate 5 — Anti-Slop**: No unnecessary comments restating code, no AI markers, no over-engineered abstractions, no premature optimization, no single-use helper functions, variable names match repo conventions

**Gate 6 — Git Hygiene**: Branch named correctly (clawoss/<type>/...), conventional commits, no merge commits, clean linear history

**Gate 7 — PR Template**: Title concise, body explains "why", references issue, includes test instructions, AI disclosure present

## Independent Review (Critical)
Spawn an ISOLATED subagent via `sessions_spawn` with clean context:
- Provide ONLY: `git diff`, issue description, repo style guide
- Subagent must NOT see your implementation journey
- Use a fresh session with clean context (no implementation history)
- Subagent checks: correctness, slop, bugs, style compliance
- Fix any flagged issues before proceeding to oss-submit
