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

0. COMMENT ON THE ISSUE FIRST (before any code):
   Post a brief comment on the issue: "I've been looking into this — [1-2 sentence description of your approach]."
   This signals intent, builds trust with maintainers, and significantly increases merge odds.
   Use: `gh issue comment {issue} --repo {repo} --body "your comment"`
   Keep it short, specific to this issue, and written like a human developer.

1. Create isolated workspace: WORKDIR=/tmp/clawoss-{issue}-$(date +%s)
   mkdir -p $WORKDIR && cd $WORKDIR
   Clone repo INTO this directory. All work happens here.

2. CLASSIFY & CONFIRM: Read the issue. Determine the contribution type:
   - **bug-fix**: broken behavior, error, crash, regression
   - **docs-fix**: incorrect/outdated documentation
   - **typo-fix**: typo in code, docs, comments, or error messages
   - **test-addition**: missing test coverage for existing code
   If it's a feature request, enhancement, or refactor — ABANDON.

3. ROUTE BY TYPE — follow the workflow for YOUR contribution type:

### BUG FIX WORKFLOW (reproduce-first):
   3a. DEEP COMPREHENSION (do NOT skip):
       - Read the repo's architecture: directory structure, key modules, how components connect.
       - Trace the bug through the FULL execution path — start from the entry point,
         follow every function call to where the error occurs.
       - Understand WHY the bug exists, not just WHERE it manifests.
       - Search for similar patterns elsewhere in the codebase.
       - Plan a COMPLETE fix that addresses the root cause.
       - If too complex to fully resolve, ABANDON rather than submit a partial fix.
   3b. REPRODUCE: Run existing tests. Write a FAILING test for the bug.
       Record failure output as evidence. Cannot reproduce after 10 min? Abandon.
   3c. IMPLEMENT: Fix the ROOT CAUSE, not just the symptom.
       If the fix spans multiple files, that's fine — do it right.

### DOCS/TYPO FIX WORKFLOW (read-and-fix):
   3a. READ relevant source code to understand ACTUAL behavior.
   3b. VERIFY the current text is incorrect by checking code behavior.
   3c. FIX the documentation/typo. Keep changes minimal and accurate.
   3d. CROSS-CHECK: does the corrected text match actual code behavior?

### TEST ADDITION WORKFLOW:
   3a. UNDERSTAND the code path being tested — read the relevant module.
   3b. RUN existing tests to establish baseline.
   3c. WRITE new test(s) targeting the identified code path.
       Follow repo's test conventions (file naming, framework, patterns).
   3d. VERIFY tests pass with current code.

### ALL TYPES:
   No refactoring. No scope creep. No 'while I'm here' improvements.
   The PR must fully resolve the issue — no partial fixes.

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
   - Scope, style, secrets, size (target 25-100 LOC, max 150 — smaller PRs merge 40% faster), commit msg.
   - Commit type: 'fix' for bugs, 'docs' for documentation, 'test' for tests.
   - 3+ failures = abandon.

8. SUBMIT: Commit, push, create PR with evidence.
   **TARGET BRANCH CHECK (mandatory):** Before creating the PR, verify the target branch:
   ```bash
   DEFAULT_BRANCH=$(gh api repos/{owner}/{repo} --jq '.default_branch')
   ```
   Create the PR against $DEFAULT_BRANCH — NOT hardcoded 'main' or 'master'.
   A PR targeting the wrong branch will be closed immediately.
   PR title should clearly describe the fix. PR body rules:
   - Write as a human developer, specific to THIS codebase. No generic AI phrasing.
   - NO: "I noticed this issue and...", "This PR addresses...", "Upon investigation..."
   - YES: State the bug/problem in 1 sentence. State root cause in 1 sentence. State fix in 1 sentence.
   - Be terse: 3-5 sentences total for the description. Maintainers skim, not read.
   - Reference codebase-specific files, functions, and line numbers.
   - For bugs: root cause + fix + before/after test evidence
   - For docs/typos: what was wrong + what's now correct
   - For tests: what's now tested + why it matters
   - Reference the original issue (Fixes #{issue})
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

**pr_category MUST be set** on success: `bug_fix`, `docs`, `typo`, `test`, `dep_update`, `dead_code`, or `other`.

**failure_reason MUST use a standard category** from the taxonomy in the schema.
Common implementation failures: `cannot_reproduce`, `too_complex`, `tests_fail_after_fix`,
`not_a_bug`, `scope_creep`, `self_review_fail`, `already_fixed_upstream`.
Format: `"category: optional details"` — e.g., `"too_complex: requires auth middleware rewrite"`.

Then run: rm -rf $WORKDIR
Then reply: ANNOUNCE_SKIP
