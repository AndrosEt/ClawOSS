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

Fix issue in {repo}#{issue}: {title}.

IMPORTANT: This must be a valid contribution (bug fix, docs fix, typo fix, or test addition).
If at any point you determine this is actually a large feature request, enhancement,
or refactor — ABANDON IMMEDIATELY and report
Status: failure, Reason: 'not actionable — issue is a feature request/enhancement'.

Read the attached repo-conventions.md and issue-details.md.
Follow the DEEP COMPREHENSION + REPRODUCE-FIRST workflow (oss-implement skill):

1. Create isolated workspace: WORKDIR=/tmp/clawoss-{issue}-$(date +%s)
   mkdir -p $WORKDIR && cd $WORKDIR
   Clone repo INTO this directory. All work happens here.

2. CONFIRM ACTIONABLE: Verify this is a real bug, docs issue, typo, or test gap.
   If it's a large feature request or refactor, ABANDON.

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

6. VERIFY — FULL CI MATRIX (a PR that breaks CI is WORSE than no PR):
   a. Read `.github/workflows/` FIRST to understand the full CI matrix:
      - Which OS does CI run on? (ubuntu, macos, windows, multiple?)
      - Which language versions? (Python 3.8-3.12, Node 16/18/20, etc.)
      - Which build configurations? (debug/release, with/without optional deps)
      - What test suites beyond the obvious one? (linting, type checking, formatting)
   b. Run ALL test suites the repo defines, not just `make test` or `pytest`:
      - Unit tests (pytest, jest, go test, cargo test, make test, etc.)
      - Linting (eslint, ruff, flake8, golangci-lint, clippy, etc.)
      - Type checking (mypy, pyright, tsc, etc.)
      - Formatters (black, prettier, gofmt — run in check mode)
      - Integration tests if they run in CI
      - Any custom test scripts in Makefile, package.json scripts, etc.
   c. For cross-platform projects (C/C++, Rust, MicroPython, embedded, etc.):
      - Does the fix touch platform-specific code? Check ALL target platforms.
      - Does the fix use APIs or behaviors that differ across OS/architectures?
      - If the repo builds for multiple targets (ARM, x86, RISC-V, etc.), verify
        the fix is correct for ALL of them, not just the one you tested on.
      - Example: micropython builds for stm32, esp32, rp2, unix — a fix that works
        on unix but breaks stm32 is a BAD PR that wastes maintainer time.
   d. Record passing output as evidence. The failing test MUST now pass. No regressions.
   e. Verify the fix addresses root cause, not just symptom.
   **If you cannot run the full test suite, explicitly note which tests you skipped and
   why in the PR description. Never submit blind. A broken CI wastes the maintainer's
   time and damages our reputation — one bad PR can get us blocked from a repo forever.**

7. REVIEW: Self-check diff:
   - Does this FULLY resolve the reported issue? Partial fixes = abandon.
   - Does it fix the root cause, not just the symptom? (for bugs)
   - Is the fix correct? (for docs/typos, verify against actual code behavior)
   - No feature additions or refactoring snuck in. STRIP them if found.
   - Will this pass the FULL CI matrix? If unsure, run more tests.
   - Scope, style, secrets, size, commit msg.
   - Commit type: 'fix' for bugs, 'docs' for documentation, 'test' for tests.
   - 3+ failures = abandon.

8. SUBMIT: Commit, push, create PR with evidence.
   PR title should clearly describe the fix. PR body must include:
   - For bugs: Root Cause Analysis, fix explanation, before/after test evidence
   - For docs/typos: What was incorrect, what's now correct, how you verified
   - For tests: What's now tested, why it matters
   - Reference to the original issue (Fixes #{issue})
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

**failure_reason MUST use a standard category** from the taxonomy in the schema.
Common implementation failures: `cannot_reproduce`, `too_complex`, `tests_fail_after_fix`,
`not_a_bug`, `scope_creep`, `self_review_fail`, `already_fixed_upstream`.
Format: `"category: optional details"` — e.g., `"too_complex: requires auth middleware rewrite"`.

Then run: rm -rf $WORKDIR
Then reply: ANNOUNCE_SKIP
