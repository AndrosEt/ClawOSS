# Implementation Sub-Agent Spawn Template

## Variables (substitute before spawning)
- `{repo}` — owner/repo (e.g., `facebook/react`)
- `{issue}` — issue number (e.g., `12345`)
- `{title}` — issue title (sanitized, no PII)

## Spawn Config
```
label: "{repo}#{issue}"
attachments: [repo-conventions.md, issue-details.md]
```

## Task Prompt

Fix BUG (not feature/refactor) in {repo}#{issue}: {title}.

IMPORTANT: This MUST be a bug fix. If at any point you determine this is actually
a feature request, enhancement, or refactor — ABANDON IMMEDIATELY and report
Status: failure, Reason: 'not a bug — issue is a feature request/enhancement'.

Read the attached repo-conventions.md and issue-details.md.
Follow the DEEP COMPREHENSION + REPRODUCE-FIRST workflow (oss-implement skill):

1. Create isolated workspace: WORKDIR=/tmp/clawoss-{issue}-$(date +%s)
   mkdir -p $WORKDIR && cd $WORKDIR
   Clone repo INTO this directory. All work happens here.

2. CONFIRM BUG: Verify this is a real bug, not a feature request. If not a bug, ABANDON.

3. DEEP COMPREHENSION (do NOT skip this):
   a. Read the repo's architecture: directory structure, key modules, how components connect.
   b. Trace the bug through the FULL execution path — start from the entry point,
      follow every function call to where the error occurs. Do NOT just look at the
      file mentioned in the stack trace.
   c. Understand WHY the bug exists, not just WHERE it manifests. Is it a logic error?
      Edge case? Race condition? Incorrect assumption? Missing validation?
   d. Search for similar patterns elsewhere in the codebase (grep/search). Could the
      same root cause affect other code paths?
   e. Plan a COMPLETE fix that addresses the root cause. If the fix needs to touch
      multiple files across the codebase, that's fine — do it right.
   f. If the bug is too complex to fully resolve, ABANDON rather than submit a partial fix.

4. REPRODUCE: Run existing tests. Find or write a FAILING test for the bug.
   The test should target the root cause, not just the surface symptom.
   Record the failure output as evidence. The failing test proves the bug exists.

5. IMPLEMENT: Write a COMPREHENSIVE fix that addresses the root cause.
   Fix the bug COMPLETELY — no partial fixes. The PR must fully resolve the issue.
   If the proper fix spans multiple files, that's expected — a correct 3-file fix
   beats a hacky 1-file workaround.
   No refactoring. No scope creep. No 'while I'm here' improvements.
   But DO fix the reported bug thoroughly and completely.

6. VERIFY: Run tests again. The failing test MUST now pass. No regressions.
   Record the passing output as evidence.
   Verify the fix addresses root cause, not just symptom.

7. REVIEW: Self-check diff:
   - Does this FULLY resolve the reported bug? Partial fixes = abandon.
   - Does it fix the root cause, not just the symptom?
   - Is this ONLY fixing a bug? If changes include feature additions or refactoring, STRIP THEM.
   - Scope, style, secrets, size, commit msg.
   - Commit type MUST be 'fix', not 'feat' or 'refactor'.
   - 3+ failures = abandon.

8. SUBMIT: Commit, push, create PR with reproduction evidence
   (before/after test output in PR description).
   PR title should indicate it's a bug fix. PR body must include:
   - Root Cause Analysis: explain WHY the bug existed
   - Fix explanation: how this addresses the root cause
   - Before/after test evidence
   - Reference to the bug report
   Include a CLA confirmation section at the bottom of the PR body:
   '## Contributor License Agreement
   By submitting this pull request, I confirm that my contribution is made
   under the terms of the project's license and I have the right to submit
   it. I agree that my contributions may be distributed under the project license.
   - [x] I have read and agree to the project's contributing guidelines
   - [x] This contribution is my original work (or properly attributed)
   - [x] I license this contribution under the project's existing license'

9. Do NOT wait for remote CI. Submit and report result.

10. CLEANUP: After submit or abandon, ALWAYS run: rm -rf $WORKDIR
    This is NON-OPTIONAL. Cloned repos waste 500MB-2GB each.

Tools: You have web_search, web_fetch, image, and apply_patch available.
Use web_search to research error messages or find related upstream fixes.
Use image to analyze any screenshots attached to the issue.

## Result File

When finished, write results to `memory/subagent-result-{repo}-{issue}.md`
using the format defined in `templates/subagent-result-schema.md`.

Then run: rm -rf $WORKDIR
Then reply: ANNOUNCE_SKIP
