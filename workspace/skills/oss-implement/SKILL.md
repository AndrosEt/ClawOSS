---
name: oss-implement
description: "Implement an OSS BUG FIX using reproduce-first workflow: confirm it's a bug, reproduce with failing test, minimal targeted fix, verify, self-review. REJECT non-bug issues."
user-invocable: true
---

# OSS Bug Fix Implementation — Reproduce-First

TDD-style approach for **bug fixes only**. Every PR must include EVIDENCE (before/after test output). This skill is ONLY for fixing bugs — not for adding features, refactoring, or enhancements.

## Prerequisites
- Issue selected and CONFIRMED as a bug (not a feature request)
- Repo cloned+analyzed
- Branch: clawoss/fix/<issue>-<desc> (type MUST be "fix")

## Workflow (in order, no skipping)

### 0. CONFIRM BUG (mandatory first step)
Before any coding, verify this is a genuine bug:
- Does the issue describe broken/incorrect behavior?
- Is there an error message, stack trace, or crash report?
- Can you identify what "correct" behavior should be?
- **If this is a feature request, enhancement, or refactor: ABANDON IMMEDIATELY.**
- Write "ABANDONED: not a bug" in the result file and stop.

### 1. Understand
Read issue, extract the broken behavior, explore relevant source, identify the root cause of the bug.

### 2. REPRODUCE (mandatory — the failing test IS the bug proof)
- Run existing tests for baseline
- Write a FAILING test that demonstrates the exact bug reported
- The test must fail because of the bug, not because of a typo or import error
- Record failure output as evidence — this proves the bug exists
- Cannot reproduce after 10 min? Abandon with note. Already fixed upstream? Remove from queue.

### 3. IMPLEMENT (minimal targeted fix)
- MINIMAL fix to make the failing test pass — fix ONLY the reported bug
- Match existing code style exactly
- **No "while I'm here" improvements** — do not refactor surrounding code
- **No feature additions** — do not add new functionality even if it seems related
- **No scope creep** — if you discover other bugs, file separate issues, do NOT fix them here
- Touch as few files as possible

### 4. VERIFY (mandatory)
- Failing test MUST now pass
- Full test suite — no regressions. Fix failures (max 2 tries) or abandon.
- Record passing output as evidence

### 5. REVIEW (bug-fix specific checks)
Self-check diff with these questions:
1. **Is every change directly related to fixing the reported bug?** If not, revert unrelated changes.
2. **Did I accidentally add a feature or refactor code?** If yes, strip it out.
3. **Is the commit type "fix"?** It must be `fix(scope): description`, never `feat` or `refactor`.
4. Scoped to issue only? Matches style? No secrets/debug/AI-slop? <200 LOC, <5 files?
5. If 3+ checks fail, abandon.

### 6. SUBMIT
Commit with `fix(scope): description`, create PR:
- Title clearly indicates a bug fix
- PR body format: Summary (Fixes #N), Bug Description, Reproduction steps, Before Fix (failure output), After Fix (pass output), Root Cause explanation, Changes list, AI disclosure.
- Push to fork.

## Constraints
- Max 200 LOC, 5 files. Match repo style. No new deps unless essential.
- No AI-slop, no single-use helpers, variable names match repo conventions.
- **Commit type MUST be `fix`** — never `feat`, `refactor`, `docs`, or `chore`.
- **Every line changed must be necessary to fix the reported bug.**

## Related Skills
systematic-debugging, test-driven-development, verification-before-completion
