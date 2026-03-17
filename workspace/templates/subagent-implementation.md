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

## CRITICAL: Script Path
**EVERY bash block MUST start with this line:**
```bash
SCRIPTS=/Users/kevinlin/clawOSS/scripts
```
All ClawOSS utility scripts are at this path. Subagents run in /tmp workspaces — relative paths WILL NOT WORK.

## Skills — Load These Before Working
You have skills available. **Read each SKILL.md file** with the `read` tool for detailed instructions:
1. **`~/clawOSS/workspace/skills/oss-implement/SKILL.md`** — The reproduce-first workflow. Read this FIRST.
2. **`~/clawOSS/workspace/skills/oss-review/SKILL.md`** — 8-point self-review checklist. Read BEFORE committing.
3. **`~/clawOSS/workspace/skills/safety-checker/SKILL.md`** — Final safety gate. Read BEFORE submitting PR.
4. **`~/clawOSS/workspace/skills/oss-submit/SKILL.md`** — PR creation workflow. Read when ready to submit.
5. **`~/clawOSS/workspace/skills/systematic-debugging/SKILL.md`** — If you get stuck debugging, read this for structured approach.
Load skills proactively — they contain exact steps, not just guidelines.

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

1. SETUP WORKSPACE — run quick checks, then clone:
   ```bash
   SCRIPTS=/Users/kevinlin/clawOSS/scripts

   # Quick checks (use gh directly — no scripts needed for basic gates)
   # Is issue still open?
   STATE=$(gh api repos/{repo}/issues/{issue} --jq '.state' 2>/dev/null)
   [ "$STATE" = "closed" ] && echo "ABORT: issue is closed" && exit 1

   # Is it assigned to someone else?
   ASSIGNEES=$(gh api repos/{repo}/issues/{issue} --jq '[.assignees[].login] | map(select(. != "BillionClaw")) | length' 2>/dev/null || echo 0)
   [ "$ASSIGNEES" -gt 0 ] && echo "ABORT: assigned to someone" && exit 1

   # Lock repo (prevents duplicate agents)
   bash $SCRIPTS/lock-repo.sh {repo} {issue} || exit 1

   # Check for existing open PRs by BillionClaw (max 5 per repo)
   EXISTING=$(gh search prs --author BillionClaw --repo {repo} --state open --json number --jq 'length' 2>/dev/null || echo 0)
   [ "$EXISTING" -ge 5 ] && echo "ABORT: 5+ open PRs at this repo" && bash $SCRIPTS/unlock-repo.sh {repo} && exit 1

   # Clone
   WORKDIR=/tmp/clawoss-{issue}-$(date +%s)
   mkdir -p $WORKDIR
   gh repo clone {repo} $WORKDIR -- --depth=50 || exit 1
   cd $WORKDIR
   DEFAULT_BRANCH=$(gh api repos/{repo} --jq '.default_branch' 2>/dev/null || echo main)
   ```
   **IMPORTANT**: Use `python3` (not `python`). The `python` binary does not exist on macOS.

1b. READ FULL REPO GUIDELINES (setup extracted metadata, now read the full text):
   ```bash
   # Parse CONTRIBUTING.md for structured metadata (branch target, CLA, test/lint commands)
   CONTRIB=$(bash $SCRIPTS/check-contributing-guide.sh {repo} --workspace $WORKDIR)
   echo "$CONTRIB" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Branch: {d.get(\"branch_target\",\"main\")} | CLA: {d.get(\"cla_type\",\"none\")} | Tests: {d.get(\"test_commands\",[])} | Lint: {d.get(\"lint_commands\",[])} | Anti-bot: {d.get(\"anti_bot\",False)}')"
   # Also read the raw text for any nuances the parser missed
   for f in CONTRIBUTING.md .github/CONTRIBUTING.md docs/CONTRIBUTING.md AGENTS.md; do
     [ -f "$WORKDIR/$f" ] && echo "=== $f ===" && head -200 "$WORKDIR/$f"
   done
   ```
   **You MUST follow every requirement in CONTRIBUTING.md**, including:
   - Code style, linting, formatting requirements
   - Commit message conventions (some repos require specific formats)
   - PR template requirements (fill out their template, not ours)
   - Branch naming conventions (some repos have their own)
   - Test requirements (some require specific test frameworks or patterns)
   - **AI disclosure policy**: If the repo has an AI policy, follow it EXACTLY.
   - **CLA/DCO**: If required, sign it. `bash $SCRIPTS/sign-cla.sh {repo}` shows how.
   - AGENTS.md: if present, follow its agent-specific instructions (they override defaults)
   **If you skip reading CONTRIBUTING.md, maintainers WILL close the PR.**

1c. CONFLICT AWARENESS + ISSUE READINESS:
   ```bash
   # Open PRs in repo — know what's in flight to avoid file conflicts
   OPEN_PRS=$(gh pr list --repo {repo} --state open --json number,title,headRefName --limit 30)
   echo "Open PRs in repo: $(echo $OPEN_PRS | jq 'length')"

   # Check last 5 comments for readiness signals
   gh api repos/{repo}/issues/{issue}/comments --jq '.[-5:] | .[] | {user: .user.login, body: .body[:200]}'
   ```
   ABANDON if: maintainer said "won't fix"/"by design"/"not a bug"/"duplicate"/"already fixed",
   active design discussion, issue closed then reopened, assigned to someone else,
   someone claimed "I'm working on this", or your fix would overlap with an active PR.

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
   a. Understand what CI expects:
      ```bash
      CI_MATRIX=$(bash $SCRIPTS/check-ci-matrix.sh $WORKDIR)
      echo "$CI_MATRIX" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'OS: {d.get(\"os_targets\",[])} | Linters: {d.get(\"linters\",[])} | Formatters: {d.get(\"formatters\",[])} | Type checkers: {d.get(\"type_checkers\",[])}')"
      ```
   b. Progressive test strategy — detect the test framework and run yourself:
      ```bash
      # Detect and run tests (check package.json, Makefile, setup.py, Cargo.toml, go.mod)
      # Python: pytest or python3 -m pytest
      # Node: npm test or npx jest
      # Go: go test ./...
      # Rust: cargo test
      # Ruby: bundle exec rspec
      # Run targeted tests first (just the module you changed), then full suite if targeted pass
      ```
   c. Run linters/formatters before commit (check what the repo uses):
      ```bash
      # Python: ruff check . --fix || black . || flake8
      # Node: npx eslint . --fix || npx prettier --write .
      # Go: gofmt -w . || golangci-lint run
      # Rust: cargo fmt && cargo clippy
      ```
   d. For cross-platform projects: if the fix touches platform-specific code, verify for ALL targets.
   e. Record passing output as evidence. The failing test MUST now pass. No regressions.
   f. If your fix relies on unverified API behavior, state it in the PR description.
   **If tests don't pass, ABANDON. A broken CI damages reputation — one bad PR gets us blocked.**
   **If you CANNOT run tests locally** (C#, Lua, embedded): state what you tested and what you couldn't.

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

8. COMMIT & PREPARE:
   **COMMIT MESSAGE QUOTING (mandatory — prevents shell parsing errors):**
   Always use heredoc for commit messages:
   ```bash
   git commit -m "$(cat <<'COMMIT_EOF'
   fix(scope): one-line summary

   Details of the fix here.
   COMMIT_EOF
   )"
   ```
   Valid prefixes: `fix(scope):`, `docs(scope):`, `test(scope):`. NEVER `feat:` or `refactor:`.

   **CLA SIGNING** (if repo requires it — metadata from step 1 tells you):
   ```bash
   CLA_INFO=$(bash $SCRIPTS/sign-cla.sh {repo})
   echo "$CLA_INFO"  # Shows CLA type + signing instructions
   ```

   **PR DESCRIPTION (WRITE LIKE A HUMAN — AI PRs get 4.6x slower review pickup):**
   - Jump straight to what's broken and what you did. Write like a note to a colleague.
   - **NEVER USE**: "This PR addresses...", "I noticed...", "Upon investigation...",
     "This change ensures...", "I identified...", "After analyzing...", "Comprehensive fix for..."
   - **Write like this**: `ProcessPoolTaskRunner.submit` swallows `BrokenProcessPool` — the except
     clause catches `Exception` but doesn't re-raise after logging. Changed to re-raise after
     `self._report_failure()`. Test added confirming propagation. Fixes #21131
   - Be terse: 3-5 sentences. Reference specific files/functions/lines. Fixes #{issue}.
   - Verify EVERY claim matches the actual `git diff --stat HEAD~1`. Phantom changes = -51.7% merge rate.


9. SUBMIT — fork, push, create PR yourself:
   ```bash
   # Diff size gate (max 200 LOC)
   TOTAL=$(git diff --stat HEAD~1 | tail -1 | grep -oE '[0-9]+ insertion|[0-9]+ deletion' | grep -oE '[0-9]+' | paste -sd+ - | bc 2>/dev/null || echo 0)
   [ "$TOTAL" -gt 200 ] && echo "ABORT: $TOTAL lines (max 200)" && exit 1

   # Fork and push
   gh repo fork {repo} --clone=false 2>/dev/null || true
   REPO_NAME=$(echo "{repo}" | cut -d/ -f2)
   git remote add fork https://github.com/BillionClaw/$REPO_NAME.git 2>/dev/null || true
   BRANCH=$(git branch --show-current)
   if [[ "$BRANCH" != clawoss/* ]]; then
     BRANCH="clawoss/fix/$(echo "$BRANCH" | sed 's|^main$||;s|^master$||' | head -c 50)"
     git checkout -b "$BRANCH" 2>/dev/null || git branch -m "$BRANCH"
   fi
   git push fork $BRANCH --force

   # Create PR
   PR_URL=$(gh pr create --repo {repo} --head BillionClaw:$BRANCH --base $DEFAULT_BRANCH --title "$PR_TITLE" --body "$PR_BODY")
   ```
   echo "PR created: $PR_URL"
   ```
   Do NOT wait for remote CI. Submit and report result.

10. CLEANUP: After submit or abandon, ALWAYS run:
    ```bash
    bash $SCRIPTS/unlock-repo.sh {repo}    # Release repo lock
    rm -rf $WORKDIR                         # Remove workspace
    ```
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
