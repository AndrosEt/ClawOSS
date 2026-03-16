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

0. COMMENT ON THE ISSUE (if orchestrator indicated high-confidence):
   If the orchestrator already posted a comment on this issue, skip this step.
   Otherwise, if this looks like a clear, fixable issue, post a brief comment:
   `gh issue comment {issue} --repo {repo} --body "I've been looking into this — [1-sentence approach]. Happy to submit a fix."`
   Keep it short, specific to this issue, and written like a human developer. No AI phrasing.

1. Create isolated workspace: WORKDIR=/tmp/clawoss-{issue}-$(date +%s)
   mkdir -p $WORKDIR && cd $WORKDIR
   Clone repo INTO this directory (shallow clone to save time/disk):
   `gh repo clone {repo} $WORKDIR -- --depth=50`
   All work happens here.

1b. READ REPO GUIDELINES:
   Check for CONTRIBUTING.md and AGENTS.md in the repo root.
   - CONTRIBUTING.md: follow its style/process/commit conventions
   - AGENTS.md: if present, follow its agent-specific instructions (they override defaults)
   If CONTRIBUTING.md requires a CLA you cannot sign, ABANDON with reason `cla_required`.

1c. CHECK IF ALREADY FIXED OR IN PROGRESS:
   Run `git log --oneline -20` and scan recent commits for keywords matching the issue.
   Also check: `git log --oneline --all --grep="{key error message or term}" -5`
   If the bug was already fixed in a recent commit, ABANDON with reason `already_fixed_upstream`.
   Also check: `gh pr list --repo {repo} --state open --search "{issue number or key term}" --json number,title --jq 'length'`
   If someone else already has an open PR for this issue, ABANDON with reason `duplicate_pr: existing PR from another contributor`.
   This avoids competing with existing PRs (atuin #3272 was closed because another contributor had it first).

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
   b. Progressive test strategy (saves time — run targeted first, expand after):
      1. Run TARGETED tests first — only the module/file you changed:
         `pytest tests/test_<module>.py` or `jest <module>.test.ts` or `go test ./<pkg>/`
      2. If targeted tests pass, run the FULL test suite.
      3. If targeted tests fail, fix before running full suite (saves cycles).
      Also run all other CI checks:
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
   **If tests don't pass, ABANDON. Do not submit untested PRs. Do not submit with "I skipped
   these tests because..." — a broken CI wastes the maintainer's time and damages our
   reputation. One bad PR can get us blocked from a repo forever.**
   **If the project uses a language/framework where you CANNOT run tests locally (e.g., C# with
   specific SDK requirements, Lua plugins needing a host app, embedded targets), you MUST:
   (a) state this clearly in the PR description: "Tested: [what you actually tested]. Unable to
   run [specific tests] locally due to [reason]."
   (b) only submit if you are confident the fix is correct from code analysis alone.
   Never claim tests pass if you didn't actually run them — maintainers WILL check.**

7. REVIEW — ACT AS A SKEPTICAL REVIEWER (not the author):
   Read your own diff as if you're a maintainer seeing it for the first time.
   Score each item pass/fail:
   - [ ] Does this FULLY resolve the reported issue? Partial fixes = abandon.
   - [ ] Root cause addressed, not just symptom? (for bugs)
   - [ ] Fix is factually correct? (for docs/typos, verify against actual code behavior)
   - [ ] No feature additions, refactoring, or 'while I'm here' changes snuck in? STRIP if found.
   - [ ] Every changed line is NECESSARY for the fix? Remove anything cosmetic.
   - [ ] Code style matches surrounding code EXACTLY? (indentation, naming, patterns)
   - [ ] Will this pass the FULL CI matrix? If unsure, run more tests.
   - [ ] No unverified assumptions about third-party API behavior?
   - [ ] Diff size: target 25-100 LOC, max 200. Smaller PRs merge 40% faster.
   - [ ] Commit type correct: 'fix' for bugs, 'docs' for documentation, 'test' for tests.
   3+ failures = abandon. This review step catches the issues that get PRs rejected.

8. SUBMIT: Commit, push, create PR with evidence.

   **COMMIT TYPE GATE (mandatory):** Your commit MUST use one of these prefixes:
   - `fix(scope): ...` — for bug fixes
   - `docs(scope): ...` — for documentation fixes
   - `test(scope): ...` — for test additions
   NEVER use `feat:`, `chore:`, `refactor:`, `perf:`, or `style:`. If your commit starts with `feat:`, you are submitting a feature — ABANDON IMMEDIATELY. We only contribute fixes, docs, and tests.

   **DIFF SIZE HARD GATE (mandatory — check BEFORE pushing):**
   ```bash
   DIFF_STATS=$(git diff --stat HEAD~1 | tail -1)
   INSERTIONS=$(echo "$DIFF_STATS" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
   DELETIONS=$(echo "$DIFF_STATS" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo 0)
   TOTAL=$((${INSERTIONS:-0} + ${DELETIONS:-0}))
   if [ "$TOTAL" -gt 200 ]; then
     echo "ABORT: diff is $TOTAL lines (max 200). Smaller PRs merge 40% faster."
     # Write result as failure with reason "scope_creep: diff too large ($TOTAL lines)"
     # Clean up and exit
   fi
   ```
   If total insertions + deletions > 200, ABANDON. Do not submit large PRs.

   **BRANCH NAME CHECK (mandatory):** Verify your branch starts with `clawoss/`:
   ```bash
   BRANCH=$(git branch --show-current)
   if [[ "$BRANCH" != clawoss/* ]]; then
     git branch -m "clawoss/${BRANCH}"
     BRANCH="clawoss/${BRANCH}"
   fi
   ```
   Valid prefixes: `clawoss/fix/`, `clawoss/docs/`, `clawoss/test/`, `clawoss/typo/`.

   **DE-DUPLICATION CHECK (mandatory — NEVER SKIP):** Before creating the PR:
   ```bash
   # ALWAYS use explicit username BillionClaw — @me fails in sub-agent contexts
   # and is the root cause of duplicate PRs
   EXISTING_OPEN=$(gh search prs --author BillionClaw --repo {repo} --state open --json number --jq 'length')
   if [ "$EXISTING_OPEN" -gt 0 ]; then
     echo "ABORT: open PR already exists for this repo"
     # Write result as failure with reason "duplicate_pr" and clean up
     exit 1
   fi
   # Check for recently closed PRs (avoid re-submitting)
   EXISTING_CLOSED=$(gh search prs --author BillionClaw --repo {repo} --state closed --json closedAt --jq '[.[] | select(.closedAt > "'"$(date -v-7d +%Y-%m-%dT00:00:00Z 2>/dev/null || date -d '7 days ago' +%Y-%m-%dT00:00:00Z)"'")] | length')
   if [ "$EXISTING_CLOSED" -gt 0 ]; then
     echo "ABORT: we had a PR closed on this repo in the last 7 days"
     # Write result as failure with reason "duplicate_pr: recently closed" and clean up
     exit 1
   fi
   ```
   If ANY open or recently-closed PR exists from us on this repo, ABANDON.
   This prevents the 5x-duplicate-PR-on-instructor and 3x-duplicate-on-taskcoach incidents.

   **FORK & PUSH (mandatory):** We don't have write access to upstream repos. Fork first, then push:
   ```bash
   # Fork the repo (idempotent — if already forked, this is a no-op)
   gh repo fork {repo} --clone=false
   # Add fork as remote and push
   git remote add fork https://github.com/BillionClaw/{repo_name}.git 2>/dev/null || true
   git push fork $BRANCH
   ```
   If push to fork fails, try `gh repo sync BillionClaw/{repo_name}` then retry.

   **TARGET BRANCH CHECK (mandatory):** Before creating the PR, verify the target branch:
   ```bash
   DEFAULT_BRANCH=$(gh api repos/{owner}/{repo} --jq '.default_branch')
   ```
   Create the PR against $DEFAULT_BRANCH — NOT hardcoded 'main' or 'master'.
   A PR targeting the wrong branch will be closed immediately.
   Use `gh pr create --repo {repo} --head BillionClaw:$BRANCH --base $DEFAULT_BRANCH`.
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
   Include AI disclosure in the PR body (MANDATORY — transparency builds trust):
   '> **Note:** This contribution was generated with AI assistance (@BillionClaw / ClawOSS).'

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
