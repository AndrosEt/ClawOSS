---
name: oss-implement
description: "Implement an OSS contribution using reproduce-first workflow: reproduce bug, write failing test, minimal fix, verify, self-review."
user-invocable: true
---

# OSS Implementation — Reproduce-First

TDD-style approach. Every PR must include EVIDENCE (before/after test output).

## Prerequisites
- Issue selected, repo cloned+analyzed, branch: clawoss/<type>/<issue>-<desc>

## Workflow (in order, no skipping)

### 1. Understand
Read issue, extract acceptance criteria, explore relevant source, identify failing behavior.

### 2. REPRODUCE (mandatory)
- Run existing tests for baseline
- Write a FAILING test demonstrating the bug/missing feature
- Verify it fails for the RIGHT reason (not typo/import error)
- Record failure output as evidence
- Cannot reproduce after 10 min? Abandon with note. Already fixed upstream? Remove from queue.

### 3. IMPLEMENT
- MINIMAL fix to make failing test pass — nothing more
- Match existing code style exactly. No "while I'm here" improvements.

### 4. VERIFY (mandatory)
- Failing test MUST now pass
- Full test suite — no regressions. Fix failures (max 2 tries) or abandon.
- Record passing output as evidence

### 5. REVIEW
Self-check diff: scoped to issue only? Matches style? No secrets/debug/AI-slop? <200 LOC, <5 files? Conventional Commits? If 3+ fail, abandon.

### 6. SUBMIT
Commit, create PR: title refs issue, description explains "why", include before/after evidence, AI disclosure. Push to fork.

PR body format: Summary (Fixes #N), Reproduction steps, Before Fix (failure output), After Fix (pass output), Changes list, AI disclosure.

## Constraints
- Max 200 LOC, 5 files. Match repo style. No new deps unless essential.
- No AI-slop, no single-use helpers, variable names match repo conventions.

## Related Skills
systematic-debugging, test-driven-development, verification-before-completion
