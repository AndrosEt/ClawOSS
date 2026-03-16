---
name: oss-implement
description: "Implement an OSS BUG FIX using deep-comprehension + reproduce-first workflow: understand repo architecture, trace the full execution path, find root cause, write comprehensive fix with failing test evidence. REJECT non-bug issues."
user-invocable: true
---

# OSS Bug Fix Implementation — Deep Comprehension + Reproduce-First

We fix bugs **deeply and comprehensively**. No surface-level patches. Understand the codebase before you touch it. Trace the bug through the full execution path. Fix the root cause, not just the symptom. Every PR must fully resolve the reported issue — no partial fixes.

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

### 1. DEEP COMPREHENSION (mandatory — understand before you touch)
Do NOT jump to writing code. First, build a mental model of the relevant codebase:

**1a. Understand the repo architecture:**
- Read the project README, directory structure, and key configuration files
- Identify the module/package structure and how components relate
- Understand the data flow and execution model (sync/async, event-driven, etc.)

**1b. Trace the bug through the full execution path:**
- Start from the entry point (API handler, CLI command, event listener, etc.)
- Follow the code path that leads to the reported error
- Read EVERY function in the call chain, not just the file where the error occurs
- Identify where the incorrect behavior diverges from the expected behavior

**1c. Identify the ROOT CAUSE:**
- Why does the bug exist? (not just WHERE it manifests)
- Is it a logic error, edge case, race condition, incorrect assumption, missing validation?
- Could the same root cause affect other parts of the codebase?
- Check for similar patterns elsewhere — use grep/search to find related code

**1d. Plan the complete fix:**
- What needs to change to fully resolve the issue?
- If the fix requires touching multiple files across the codebase, that's fine — do it right
- Will your fix handle all edge cases of this bug, or just the one reported?
- **If the bug is too complex to fully resolve: ABANDON rather than submit a partial fix**

### 2. REPRODUCE (mandatory — the failing test IS the bug proof)
- Run existing tests for baseline
- Write a FAILING test that demonstrates the exact bug reported
- The test should cover the root cause, not just the surface symptom
- If the bug has multiple manifestations, test the most representative one
- The test must fail because of the bug, not because of a typo or import error
- Record failure output as evidence — this proves the bug exists
- Cannot reproduce after 10 min? Abandon with note. Already fixed upstream? Remove from queue.

### 3. IMPLEMENT (comprehensive root-cause fix)
- Fix the ROOT CAUSE identified in Step 1, not just the surface symptom
- If the fix correctly requires changes across multiple files, do it — a proper fix spanning 3 files is better than a hack in 1 file
- Match existing code style exactly
- **No "while I'm here" improvements** — do not refactor surrounding code
- **No feature additions** — do not add new functionality even if it seems related
- **No scope creep** — if you discover other bugs, file separate issues, do NOT fix them here
- **But DO fix the reported bug completely** — a partial fix is worse than no fix

### 4. VERIFY (mandatory)
- Failing test MUST now pass
- Full test suite — no regressions. Fix failures (max 2 tries) or abandon.
- Record passing output as evidence
- Verify the fix addresses the root cause, not just the symptom — would the test catch a recurrence?

### 5. REVIEW (bug-fix specific checks)
Self-check diff with these questions:
1. **Does this fix fully resolve the reported bug?** Partial fixes are not acceptable — if incomplete, abandon or keep working.
2. **Does the fix address the root cause or just the symptom?** If just the symptom, go back to Step 1.
3. **Is every change directly related to fixing the reported bug?** If not, revert unrelated changes.
4. **Did I accidentally add a feature or refactor code?** If yes, strip it out.
5. **Is the commit type "fix"?** It must be `fix(scope): description`, never `feat` or `refactor`.
6. Scoped to issue only? Matches style? No secrets/debug/AI-slop? <200 LOC?
7. If 3+ checks fail, abandon.

### 6. SUBMIT
Commit with `fix(scope): description`, create PR:
- Title clearly indicates a bug fix
- PR body format: Summary (Fixes #N), Bug Description, Root Cause Analysis (explain WHY the bug existed), Reproduction steps, Before Fix (failure output), After Fix (pass output), Changes list (explain why each changed file was necessary), AI disclosure.
- Push to fork.

## Constraints
- Max 200 LOC. Match repo style. No new deps unless essential.
- No AI-slop, no single-use helpers, variable names match repo conventions.
- **Commit type MUST be `fix`** — never `feat`, `refactor`, `docs`, or `chore`.
- **Every line changed must be necessary to fix the reported bug.**
- **The fix must COMPLETELY resolve the issue** — no partial fixes. If you can't fully fix it, ABANDON.
- Multi-file fixes are fine if the root cause demands it — do it right, not minimal for minimal's sake.

## Related Skills
systematic-debugging, test-driven-development, verification-before-completion
