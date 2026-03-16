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

TITLE KEYWORD GATE: If the issue title contains ANY of these as whole words, ABANDON immediately:
`add`, `extend`, `enable`, `improve`, `enhance`, `new feature`, `request`, `implement`,
`support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`,
`redesign`, `optimize`, `allow`, `provide`
(Word boundary only — "Unsupported" does NOT match "support".)

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

1a. QUICK HEALTH CHECK (defense-in-depth):
   ```bash
   STARS=$(gh api repos/{repo} --jq '.stargazers_count' 2>/dev/null || echo 0)
   [ "$STARS" -lt 200 ] && echo "ABORT: $STARS stars (<200)" && rm -rf $WORKDIR && exit 1
   ```

1b. READ REPO GUIDELINES:
   Check for CONTRIBUTING.md and AGENTS.md in the repo root.
   - CONTRIBUTING.md: follow its style/process/commit conventions
   - AGENTS.md: if present, follow its agent-specific instructions (they override defaults)
   If CONTRIBUTING.md requires a CLA you cannot sign, ABANDON with reason `cla_required`.

   **CLA ORG HARD REJECT (defense-in-depth):** Extract the repo owner from {repo}.
   If the owner is ANY of: `deepset-ai`, `iterative`, `Aider-AI`, `milvus-io`, `apache`,
   `microsoft`, `google`, `meta-llama` — ABANDON with reason `cla_required: org requires CLA`.
   We cannot sign CLAs, so PRs to these orgs can NEVER merge.

1c. PR CONFLICT & SUPERSESSION CHECK (CRITICAL — do ALL of these before writing any code):

   **Check 1 — Linked PRs on this issue (most important):**
   ```bash
   # Check if any open PR already addresses this issue
   LINKED_PRS=$(gh api "repos/{repo}/issues/{issue}/timeline" --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null) | {number: .number, title: .title, state: .state, url: .html_url}]' 2>/dev/null || echo "[]")
   OPEN_LINKED=$(echo "$LINKED_PRS" | jq '[.[] | select(.state=="open")] | length')
   if [ "$OPEN_LINKED" -gt 0 ]; then
     echo "ABORT: $OPEN_LINKED open PR(s) already linked to this issue"
     echo "$LINKED_PRS" | jq '.[] | select(.state=="open")'
     # Write result as failure with reason "superseded: open PR already addresses this issue"
     rm -rf $WORKDIR && exit 1
   fi
   # Also check if a linked PR was recently MERGED (issue already fixed)
   MERGED_LINKED=$(echo "$LINKED_PRS" | jq '[.[] | select(.state=="closed")] | length')
   if [ "$MERGED_LINKED" -gt 0 ]; then
     echo "WARNING: $MERGED_LINKED closed PR(s) linked — check if issue is already resolved"
     # If the issue is still open despite merged PRs, proceed cautiously
   fi
   ```

   **Check 2 — Issue assignee:**
   ```bash
   ASSIGNEES=$(gh api "repos/{repo}/issues/{issue}" --jq '.assignees[].login' 2>/dev/null || echo "")
   if [ -n "$ASSIGNEES" ]; then
     echo "ABORT: issue is assigned to: $ASSIGNEES"
     # Write result as failure with reason "issue_assigned: assigned to $ASSIGNEES"
     rm -rf $WORKDIR && exit 1
   fi
   ```

   **Check 3 — Already fixed in recent commits:**
   Run `git log --oneline -20` and scan recent commits for keywords matching the issue.
   Also check: `git log --oneline --all --grep="{key error message or term}" -5`
   If the bug was already fixed in a recent commit, ABANDON with reason `already_fixed_upstream`.

   **Check 4 — Competing open PRs (same issue or same files):**
   ```bash
   # Check for PRs from OTHER contributors addressing same issue
   gh pr list --repo {repo} --state open --search "{issue}" --json number,title,author --jq '.[] | select(.author.login != "BillionClaw") | {number, title, author: .author.login}'
   ```
   If someone else already has an open PR for this issue, ABANDON with reason `duplicate_pr_other: existing PR from another contributor`.

   **Check 5 — Read ALL open PRs in repo (conflict awareness):**
   ```bash
   # Get list of all open PRs and their changed files — understand what's in flight
   OPEN_PRS=$(gh pr list --repo {repo} --state open --json number,title,headRefName --limit 30)
   echo "Open PRs in repo: $(echo $OPEN_PRS | jq 'length')"
   ```
   Keep this list in mind during implementation. If your fix touches files that another open PR also modifies, either:
   (a) adjust scope to avoid the overlap, or
   (b) ABANDON if the overlap is unavoidable.
   Submitting a conflicting PR wastes maintainer time and gets us blocked.

1d. CHECK ISSUE READINESS:
   Read the last 5 comments on the issue: `gh api repos/{repo}/issues/{issue}/comments --jq '.[-5:] | .[] | {user: .user.login, body: .body[:200]}'`
   ABANDON if:
   - Maintainer said "won't fix", "by design", "not a bug", "duplicate", "already fixed"
   - Active design discussion still happening (people debating approach) — wait, don't jump in
   - Issue was closed then reopened (controversial)
   - Maintainer explicitly assigned the issue to someone else
   - Someone commented "I'm working on this" or "I'll take this" (respect dibs)

2. CLASSIFY & CONFIRM: Read the issue title and body. Determine the contribution type:
   - **bug-fix**: broken behavior, error, crash, regression
   - **docs-fix**: incorrect/outdated documentation
   - **typo-fix**: typo in code, docs, comments, or error messages
   - **test-addition**: missing test coverage for existing code

   **TITLE KEYWORD REJECT (defense-in-depth — check even if orchestrator already triaged):**
   If the issue title contains ANY of these as whole words (case-insensitive), ABANDON immediately:
   `add`, `extend`, `enable`, `improve`, `enhance`, `new feature`, `request`, `implement`,
   `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`, `redesign`,
   `optimize`, `allow`, `provide`.
   Exception: substrings don't count — "Unsupported operation crashes" does NOT match `support`.

   If it's a feature request, enhancement, or refactor — ABANDON with reason `not_a_bug`.

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
   c. For cross-platform projects: if the fix touches platform-specific code or uses
      OS-dependent APIs, verify correctness for ALL target platforms (not just the one you tested on).
   d. Record passing output as evidence. The failing test MUST now pass. No regressions.
   e. Verify the fix addresses root cause, not just symptom.
   f. If your fix relies on unverified API behavior, state it in the PR description.
   **If tests don't pass, ABANDON. A broken CI damages reputation — one bad PR gets us blocked.**
   **If you CANNOT run tests locally** (C#, Lua, embedded): state what you tested and what you couldn't.
   Never claim tests pass if you didn't run them.

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
   - [ ] No new dependencies added unless absolutely essential for the fix?
   - [ ] Diff size: target 25-100 LOC, max 200. Smaller PRs merge 40% faster.
   - [ ] Commit type correct: 'fix' for bugs, 'docs' for documentation, 'test' for tests.
   3+ failures = abandon. This review step catches the issues that get PRs rejected.

8. SUBMIT: Commit, push, create PR with evidence.

   **COMMIT TYPE GATE (mandatory — RUN THIS CHECK):**
   ```bash
   # Check commit message prefix — ABORT if feature/refactor
   COMMIT_MSG=$(git log -1 --format=%s)
   if echo "$COMMIT_MSG" | grep -qE '^(feat|chore|refactor|perf|style)(\(|:)'; then
     echo "ABORT: commit type '$(echo $COMMIT_MSG | cut -d: -f1)' is not allowed. We only submit fix/docs/test."
     # Write result as failure with reason "not_a_bug: commit type indicates feature/refactor"
     rm -rf $WORKDIR && exit 1
   fi
   ```
   Valid prefixes: `fix(scope):`, `docs(scope):`, `test(scope):`. If your commit starts with `feat:`, you are submitting a feature — ABANDON IMMEDIATELY.

   **DIFF SIZE HARD GATE (mandatory — RUN THIS CHECK before pushing):**
   ```bash
   DIFF_STATS=$(git diff --stat HEAD~1 | tail -1)
   INSERTIONS=$(echo "$DIFF_STATS" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
   DELETIONS=$(echo "$DIFF_STATS" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo 0)
   TOTAL=$((${INSERTIONS:-0} + ${DELETIONS:-0}))
   if [ "$TOTAL" -gt 200 ]; then
     echo "ABORT: diff is $TOTAL lines (max 200). Smaller PRs merge 40% faster."
     # Write result as failure with reason "scope_creep: diff too large ($TOTAL lines)"
     rm -rf $WORKDIR && exit 1
   fi
   ```
   **YOU MUST ACTUALLY RUN the above script.** Do not skip it. PRs > 200 lines are NEVER submitted.

   **BRANCH NAME CHECK (mandatory):** Verify your branch starts with `clawoss/`:
   ```bash
   BRANCH=$(git branch --show-current)
   if [[ "$BRANCH" != clawoss/* ]]; then
     git branch -m "clawoss/${BRANCH}"
     BRANCH="clawoss/${BRANCH}"
   fi
   ```
   Valid prefixes: `clawoss/fix/`, `clawoss/docs/`, `clawoss/test/`, `clawoss/typo/`.

   **DE-DUPLICATION CHECK (mandatory):** Before creating the PR:
   ```bash
   EXISTING_OPEN=$(gh search prs --author BillionClaw --repo {repo} --state open --json number --jq 'length')
   [ "$EXISTING_OPEN" -gt 0 ] && echo "ABORT: open PR exists" && exit 1
   EXISTING_CLOSED=$(gh search prs --author BillionClaw --repo {repo} --state closed --json closedAt --jq '[.[] | select(.closedAt > "'"$(date -v-7d +%Y-%m-%dT00:00:00Z 2>/dev/null || date -d '7 days ago' +%Y-%m-%dT00:00:00Z)"'")] | length')
   [ "$EXISTING_CLOSED" -gt 0 ] && echo "ABORT: recently closed PR on this repo" && exit 1
   ```

   **FORK & PUSH (mandatory):** We don't have write access to upstream repos. Fork first, then push:
   ```bash
   # Fork the repo (idempotent — if already forked, this is a no-op)
   gh repo fork {repo} --clone=false
   # Extract just the repo name from owner/repo
   REPO_NAME=$(echo "{repo}" | cut -d/ -f2)
   # Add fork as remote and push
   git remote add fork https://github.com/BillionClaw/$REPO_NAME.git 2>/dev/null || true
   git push fork $BRANCH
   ```
   If push to fork fails, try `gh repo sync BillionClaw/$REPO_NAME` then retry.

   **TARGET BRANCH CHECK (mandatory):** Before creating the PR, verify the target branch:
   ```bash
   DEFAULT_BRANCH=$(gh api repos/{repo} --jq '.default_branch')
   ```
   Create the PR against $DEFAULT_BRANCH — NOT hardcoded 'main' or 'master'.
   A PR targeting the wrong branch will be closed immediately.
   Use `gh pr create --repo {repo} --head BillionClaw:$BRANCH --base $DEFAULT_BRANCH`.
   PR title should clearly describe the fix.
   **PR TEMPLATE CHECK:** Before writing the PR body, check if the repo has a PR template:
   `ls .github/PULL_REQUEST_TEMPLATE.md .github/PULL_REQUEST_TEMPLATE/ 2>/dev/null`
   If a template exists, use its structure (fill in sections, check checkboxes). If not, use our format.
   PR body rules — WRITE LIKE A HUMAN DEVELOPER (AI PRs get 4.6x slower review pickup):
   - Jump straight to what's broken and what you did. Write like leaving a note for a colleague.
   - **AI tells (NEVER USE)**: "This PR addresses...", "I noticed...", "Upon investigation...",
     "This change ensures...", "This commit fixes...", "I identified...", "After analyzing...",
     "The root cause was identified as...", "This resolves the issue by...", "Comprehensive fix for...",
     bullet lists starting with "Ensures", "Improves", "Handles"
   - **Write like this** (bug fix example):
     `ProcessPoolTaskRunner.submit` swallows `BrokenProcessPool` — the except clause
     catches `Exception` but doesn't re-raise after logging. Changed to re-raise after
     `self._report_failure()`. Test added confirming propagation. Fixes #21131
   - **NOT like this**: "This PR addresses an issue where ProcessPoolTaskRunner silently
     swallows exceptions. Upon investigation, I identified that the root cause is..."
   - Be terse: 3-5 sentences max. Maintainers skim. Reference specific files/functions/lines.
   - For bugs: what broke + why (root cause) + what you changed + test evidence
   - For docs/typos: what was wrong + what's correct now (2-3 sentences)
   - For tests: what's tested + why it matters (2-3 sentences)
   - Reference the original issue (Fixes #{issue})
   Include AI disclosure in the PR body (MANDATORY — transparency builds trust):
   '> **Note:** This contribution was generated with AI assistance (@BillionClaw / ClawOSS).'

   **CLA RULE:** Never include CLA claims unless the repo requires it AND you completed their process.
   CLA repos should have been caught at step 1b. No CLA mention = correct for non-CLA repos.

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
