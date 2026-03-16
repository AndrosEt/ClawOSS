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

1. SETUP WORKSPACE (one command — runs ALL gates, clones repo, reads CONTRIBUTING.md):
   ```bash
   SCRIPTS=/Users/kevinlin/clawOSS/scripts
   SETUP=$(bash $SCRIPTS/workspace-setup.sh {repo} {issue})
   if [ $? -ne 0 ]; then
     echo "ABORT: $(echo "$SETUP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get(\"reason\",\"setup failed\"))')"
     exit 1
   fi
   WORKDIR=$(echo "$SETUP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["workspace_path"])')
   cd $WORKDIR
   echo "$SETUP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Branch: {d[\"default_branch\"]}, CLA: {d[\"cla_type\"]}, Stars: {d[\"stars\"]}')"
   ```
   The setup script runs: blocklist check, repo health check, already-fixed check, supersession check,
   dedup check, clone, CONTRIBUTING.md parsing, anti-AI policy check, lock acquisition.
   **IMPORTANT**: Use `python3` (not `python`) for all commands. The `python` binary does not exist on this system.

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
   b. Progressive test strategy — targeted first, then full:
      ```bash
      # Targeted tests on the module you changed
      bash $SCRIPTS/run-repo-tests.sh $WORKDIR --targeted <changed_module>
      # If targeted pass, run full suite
      bash $SCRIPTS/run-repo-tests.sh $WORKDIR --full
      ```
   c. Auto-fix linting/formatting before commit:
      ```bash
      bash $SCRIPTS/lint-and-format.sh $WORKDIR --fix
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
   Include disclosure: '> This contribution was made by [ClawOSS](https://github.com/kevinlin/clawOSS), an autonomous codebase helper.'

9. SUBMIT (one command — runs all gates, fork, push, create PR, post-PR dedup):
   ```bash
   SUBMIT=$(bash $SCRIPTS/workspace-submit.sh $WORKDIR {repo} {issue} "$PR_TITLE" --type $TYPE)
   if [ $? -ne 0 ]; then
     echo "ABORT: $(echo "$SUBMIT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get(\"reason\",\"submit failed\"))')"
     bash $SCRIPTS/workspace-cleanup.sh $WORKDIR
     exit 1
   fi
   PR_URL=$(echo "$SUBMIT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get(\"pr_url\",\"unknown\"))')
   echo "PR created: $PR_URL"
   ```
   The submit script runs: commit type gate, diff size gate (max 200 LOC), branch name check,
   pre-push dedup, fork repo, push to fork, create PR with anti-slop description, post-PR dedup check.
   Do NOT wait for remote CI. Submit and report result.

10. CLEANUP: After submit or abandon, ALWAYS run:
    ```bash
    bash $SCRIPTS/unlock-repo.sh {repo}    # Release repo lock first
    bash $SCRIPTS/workspace-cleanup.sh $WORKDIR  # Remove workspace files
    ```
    This is NON-OPTIONAL. Removes workspace + lock file. Cloned repos waste 500MB-2GB each.

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
