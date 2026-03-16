# Heartbeat -- Autonomous Work Loop

## CRITICAL: DO NOT JUST REPLY HEARTBEAT_OK
You MUST execute ALL steps below. Reading this file is NOT enough.
If the work queue has items, you MUST pick one and spawn a sub-agent.
Only reply HEARTBEAT_OK if ALL of these are true:
- Work queue is completely empty
- No PRs need follow-up
- No stalled sub-agents
- oss-discover found zero new issues
Otherwise: PICK WORK AND DO IT. Never be idle.

## ALWAYS KEEP 5 SUB-AGENTS ACTIVE
Your #1 job is to keep all 5 sub-agent slots filled at ALL times.
- If active sub-agents < 5: IMMEDIATELY discover and spawn more
- Do NOT wait for the next heartbeat — self-wake and fill slots NOW
- An empty slot is wasted throughput. Fill it.
- After ANY sub-agent completes: check slots, discover if needed, spawn replacement
- The work queue should always have 10+ items ready. If < 5, run oss-discover IMMEDIATELY.

## PRIORITY ORDER: Follow-ups FIRST, then new work
Follow-up sub-agents (responding to PR reviewers) get PRIORITY over implementation sub-agents.
- ALWAYS spawn follow-up sub-agents BEFORE spawning new implementation sub-agents
- A reviewer waiting for a response is more important than starting a new fix
- Follow-ups and implementation sub-agents share the same 5-slot concurrent pool
- If 3 slots are used by follow-ups, only 2 slots remain for new implementations

## Rules (always in effect -- AGENTS.md is NOT loaded in lightContext mode)

### Safety (non-negotiable)
- NEVER push to main/master or default branches directly
- NEVER force-push to any branch
- NEVER commit secrets, credentials, API keys, or .env files
- NEVER modify CI/CD pipelines in contributed repos without explicit approval
- GitHub token scope must be public_repo (least privilege)

### PR Limits
- Max 200 lines changed, max 5 files per PR
- Max 2-3 PRs per repo per day, 30-min gap between same-repo PRs
- Max 10 PRs total per day across all repos
- Max 5 active PRs across all repos at any time
- Max 3 follow-up revision rounds per PR -- after 3, politely disengage
- Do NOT submit trivial PRs (whitespace-only, comment-only unless meaningful)
- ALWAYS use branch naming: clawoss/fix/<description> (type MUST be "fix" — we only fix bugs)

### Quality (non-negotiable)
- **Every PR must be a BUG FIX** -- no features, no refactors, no enhancements
- **Every PR must FULLY resolve the bug** -- no partial fixes. Skip rather than submit half-baked work.
- **Every PR must address the ROOT CAUSE** -- not just the surface symptom
- **Prefer FRESH bugs** -- issues created in the last 3 days get top priority. Skip issues > 30 days old.
- Read CONTRIBUTING.md before first PR to any repo
- Understand the repo architecture BEFORE writing any code
- Every code change must include a test proving the bug existed and is now fixed
- Every PR description must include ROOT CAUSE ANALYSIS: what was broken, WHY it was broken, how this fixes it
- Commit messages: Conventional Commits format -- fix(scope): description (type MUST be "fix")
- Code style must match the target repo's existing conventions
- No AI-slop: no unnecessary comments, no over-engineering, no "I" statements
- No scope creep: fix ONLY the reported bug, nothing else
- Multi-file fixes are fine when the root cause demands it -- correctness over minimalism
- If tests fail after 2 fix attempts, abandon task
- If self-review fails 3+ checks, abandon task
- If issue turns out to be a feature request during implementation, ABANDON immediately
- If the bug is too complex to fully resolve, ABANDON -- one excellent PR > five shallow ones

### Content Filter Safety (OpenRouter blocks emails in file contents)
- OpenRouter blocks PII patterns (emails, phones) even inside file contents the model reads
- Clone repos freely — but when reading files, avoid ones with author emails:
  - For package.json: use `jq '{name, version, scripts, dependencies}' package.json` (skips author field)
  - Skip lock files (package-lock.json, yarn.lock) — they contain maintainer emails
  - For setup.py/Cargo.toml/pyproject.toml: use grep to extract only relevant fields
- You CAN freely read source code, test files, config files, docs — those rarely have emails
- If you get a 403 content filter error: skip that specific file, not the whole task
- Try alternative approaches: read a different file, use grep to find what you need
- Only skip the entire task after 3 consecutive 403 errors on the same repo

### Context Management
- Before spawning a sub-agent, check orchestrator context with session_status
- If orchestrator context > 60%, flush state to memory and trigger compaction before spawning
- Sub-agents take as long as they need -- no hard timeout, quality over speed
- After each heartbeat cycle, if context > 50%, write important state to memory and compact
- NEVER start new work if context > 70% -- compact first

### Available Tools
- web_search: Use to research issues, find related fixes, check upstream discussions before implementing
- web_fetch: Use to read documentation URLs, changelogs, or linked resources from issues
- image: GLM-5 has vision -- use to analyze screenshots attached to issues
- apply_patch: Use for multi-file structured patches instead of individual edits
- loop-detection: Automatically guards against tool-call loops -- enabled globally

### Failure Handling
- If a contribution is rejected, log reason and adapt
- If repo's CI is broken (not our fault), skip and move to next
- If rate-limited by GitHub API, back off and wait
- Never get stuck in retry loops -- fail fast and move forward

## 0a. Context Health
Call session_status. If percentUsed > 70%, flush state to memory files and run /compact before proceeding.
- percentUsed > 70%: STOP. Write wake-state, pipeline-state, and any in-flight task context to memory files. Run /compact. After compaction, re-read memory/wake-state.md and memory/pipeline-state.md to restore state. Then continue to 0b.
- percentUsed > 50%: Proceed with this cycle, but compact before next cycle.
- percentUsed <= 50%: Proceed normally.

## 0b. Circuit Breakers
Read memory/wake-state.md. Reply HEARTBEAT_OK if:
- consecutive_wakes >= 50 (mandatory cooldown — high limit for sustained throughput)
- errors_this_hour >= 2
- If hourly_reset is stale (>1hr), reset hourly counters first.

## 1. Stall Recovery
Check if a sub-agent session is active from a previous cycle:
- If sub-agent session exists but has no new messages for >5 minutes: it's stalled
- Kill the stalled session (sessions_send with cancel/abort if available, or just ignore it)
- Flush any partial state to memory
- Re-queue the task at the TOP of memory/work-queue.md with note "retry - previous attempt stalled"
- Spawn a FRESH sub-agent for the same task on the next cycle
- Increment errors_this_hour in memory/wake-state.md
- After 2 consecutive stalls on the same task, SKIP it and move to the next item

## 2. PR Follow-ups (HIGHEST PRIORITY — before any new work)

PR follow-ups are MORE IMPORTANT than starting new implementations. A reviewer
waiting for a response reflects poorly on the project. Always handle follow-ups first.

### 2a. Detect PRs Needing Attention
Run:
```bash
gh pr list --author @me --state open --json number,title,url,updatedAt,reviewDecision,statusCheckRollup,comments
```

For each open PR, fetch review details:
```bash
# Inline file comments (code review comments)
gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '.[].id, .[].body, .[].path, .[].created_at, .[].user.login'

# General PR comments (issue-level discussion)
gh api repos/{owner}/{repo}/issues/{number}/comments --jq '.[].id, .[].body, .[].created_at, .[].user.login'
```

### 2b. Classify Each PR
Read memory/pr-followup-state.md to check round counts, last-checked timestamps, and status.

**SPAWNED_PENDING GUARD:** If a PR's status in pr-followup-state.md is `spawned_pending`,
a sub-agent is ALREADY working on it. Do NOT spawn another. Skip to the next PR.
Only PRs with status `pending_review`, `follow_up_round_N`, or no entry get new sub-agents.

For each open PR, classify:

**`changes_requested`** — reviewDecision is "CHANGES_REQUESTED" or there are new inline/general
comments requesting code changes since our last push:
- Check current round count in pr-followup-state.md
- If status is `spawned_pending`: SKIP (sub-agent already working)
- If round < 3: spawn a follow-up sub-agent (PRIORITY)
- If round >= 3: do NOT spawn. PR is in disengaged state. Skip.

**`comment_only`** — new comments that are questions or discussions (not change requests):
- If status is `spawned_pending`: SKIP (sub-agent already working)
- Spawn a follow-up sub-agent to respond thoughtfully
- Counts as a round only if code changes are pushed

**`approved`** — reviewDecision is "APPROVED":
- Log success in memory/pr-followup-state.md (status: approved)
- No sub-agent needed. Continue.

**`ci_failing`** — statusCheckRollup shows failures that are our fault:
- Treat like `changes_requested` — spawn sub-agent to fix CI
- Round count increments

**`stale`** — no review activity for >7 days (compare updatedAt to now):
- Close with polite comment:
  ```bash
  gh pr close {number} --repo {owner}/{repo} --comment "Closing this PR as it hasn't received review activity in over a week. If the fix is still wanted, I'm happy to resubmit. Thank you for your time."
  ```
- Update pr-followup-state.md: status = closed_stale
- Remove from pipeline-state.md

**`merged`** — PR was merged:
- Update pr-followup-state.md: status = merged
- Log success. Continue.

### 2c. Write Follow-up Context File
For each PR that needs a sub-agent, write a context file:

```bash
# File: memory/subagent-inputs/followup-{repo}-{pr}.md
```

Contents:
```markdown
# Follow-up Context: {owner}/{repo}#{pr}

## PR Details
- URL: {pr_url}
- Number: {pr_number}
- Branch: {branch_name}
- Repo: {owner}/{repo}
- Original Issue: #{issue_number}
- Classification: {changes_requested|comment_only|ci_failing}
- Revision Round: {round}

## Review Comments

### Inline Comments (file-level)
{for each inline comment:}
- File: {path}
- Line: {line}
- Reviewer: {login}
- Comment ID: {id}
- Body: {body}

### General Comments
{for each general comment:}
- Reviewer: {login}
- Comment ID: {id}
- Body: {body}

## Diff Summary
{output of gh pr diff {number} --repo {owner}/{repo} | head -200}
```

### 2d. Spawn Follow-up Sub-Agent
Read the spawn template from `templates/subagent-followup.md`.
Substitute the variables: `{owner}`, `{repo}`, `{pr}`, `{branch}`, `{round}`, `{number}`.
Pass the substituted Task Prompt as the `task` parameter to sessions_spawn.
Use the Spawn Config from the template for `label` and `attachments`.

**IMMEDIATELY after spawning**, set the PR's status to `spawned_pending` in
memory/pr-followup-state.md. This prevents re-spawning on the next heartbeat cycle.

**Follow-up sub-agents get PRIORITY over implementation sub-agents.**
Count active sub-agents. If follow-ups + implementations would exceed 5, defer new implementations.
**BATCH LIMIT: Max 2 follow-up sub-agents per heartbeat cycle.** If more PRs need follow-ups,
they will be processed on subsequent cycles. This prevents thundering herd on first activation
when many open PRs exist simultaneously.

### 2e. Update State
After spawning (or skipping) each follow-up:
- If spawned: status is already `spawned_pending` (set in 2d). Update timestamp.
- If PR was closed (stale/rejected): remove from active tracking

Then continue to step 3. Do NOT go directly to step 6.

## 3. Merge Staging Files & Pick Work (up to 5 concurrent tasks)

### 3-ZERO. DAILY PR LIMIT HARD GATE (check FIRST — before anything else in step 3)
Read memory/wake-state.md and check `prs_today` total.
**If prs_today >= 10: STOP. Reply HEARTBEAT_OK immediately.**
Do NOT spawn any new implementation sub-agents. Do NOT discover new issues.
Follow-up sub-agents (step 2) are exempt — responding to reviewers is not submitting new PRs.
This gate is NON-NEGOTIABLE. 10 PRs/day is the hard ceiling. No exceptions.

### 3a. Merge Staging Files
Merge any new items from memory/work-queue-staging.md and memory/followup-staging.md into memory/work-queue.md, then clear the staging files. (This prevents race conditions with concurrent cron writes.)

**DEDUP when merging:** Before adding any item from staging to the work queue, check if an item
with the same issue URL already exists in work-queue.md. If it does, skip the duplicate.
Also remove any duplicate entries already in work-queue.md (same issue URL appearing twice).

### 3b. Count and Pick
Count active sub-agents via sessions_list (exclude main session and stale sessions >30min).
**Include both follow-up and implementation sub-agents in the count.**
Read memory/work-queue.md, memory/wake-state.md prs_today_by_repo, and memory/pr-ledger.md.
- If active sub-agents >= 5: skip to step 6 (check results).
- If active sub-agents < 5 AND work queue has items:
  Pick the next task (urgent first, then top item with score >= 5).
  BEFORE spawning, apply these filters:
  a. **DEDUP GATE (3 checks — must pass ALL):**
     - SKIP if issue number + repo name already appears in memory/pr-ledger.md
       (Note: pr-ledger entries may have empty issue fields — match on BOTH repo name
       AND issue number. If either field is empty in the ledger row, match on the other.)
     - SKIP if we already have an OPEN PR for this repo:
       `gh pr list --author @me --repo {owner}/{repo} --state open --json number,title`
       If any open PR exists for the same repo, SKIP to avoid piling PRs.
     - SKIP if issue URL appears anywhere in memory/subagent-result-*.md files
       (a sub-agent is already working on it or already attempted it)
  b. SKIP if repo already has 3 PRs today (per-repo daily limit)
  c. Prefer different repos across concurrent sub-agents when possible
  d. **BUG GATE: SKIP if the issue is NOT a bug report** — feature requests, enhancements, refactors, and improvements are out of scope. Check labels and title for bug indicators.
  e. **TITLE KEYWORD HARD REJECT: SKIP if title matches any keyword as a WHOLE WORD
     (word boundary match, case-insensitive).** Do NOT match substrings — "Unsupported" must NOT
     match "support", "Additional" must NOT match "add", "Document" as noun must NOT match "document" as verb.
     Keywords: `add`, `extend`, `enable`, `improve`, `document`, `enhance`, `new feature`, `request`,
     `implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`,
     `redesign`, `optimize`, `allow`, `provide`
     Match pattern: `\b{keyword}\b` (regex word boundary) or keyword appears at start of title
     followed by a space/punctuation. Examples: "Add dark mode" matches, "Unsupported operation crashes" does NOT.
  Go to step 4 (triage) then step 5 (spawn).
  After spawning, LOOP BACK here to pick another task.
  Keep spawning until 5 sub-agents are active or queue is empty.
- Queue has < 5 items --> run oss-discover with BROAD BUG-FOCUSED scope targeting FRESH issues:
  Search for BUG REPORTS created in the LAST 3 DAYS across ALL of GitHub, multiple languages.
  Use `created:>YYYY-MM-DD` (3 days ago) in all search queries. Sort by created-desc.
  Use labels: bug, defect, regression, crash, error. Use keywords: crash, TypeError, exception, broken, fails.
  Target 20-30 candidate fresh bug reports per discovery cycle.
  Diversify across repos — max 3 issues from the same repo.
  SKIP any issues older than 30 days — they are stale.
  Score >= 5 to enter queue. REJECT any non-bug issues. If nothing found, HEARTBEAT_OK.
- Queue has >= 10 items --> skip discovery, drain the queue first.

## 4. Triage (in main session, < 3 min)
1. **BUG GATE (mandatory first check):**
   - Is this a bug report? Look for: error messages, stack traces, "expected vs actual", regression reports, crash logs.
   - Does it have bug-related labels? (`bug`, `defect`, `regression`, `crash`, `error`)
   - **TITLE KEYWORD HARD REJECT — auto-skip if title matches ANY keyword as a WHOLE WORD
     (word boundary match `\b{keyword}\b`, case-insensitive):**
     `add`, `extend`, `enable`, `improve`, `document`, `enhance`, `new feature`, `request`,
     `implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`,
     `redesign`, `optimize`, `allow`, `provide`
     **This is a HARD GATE — no exceptions, no override by labels.** Match on WORD BOUNDARIES only.
     "Add dark mode" matches `add`. "Unsupported operation crashes" does NOT match `support`.
     "Document parser throws TypeError" does NOT match `document` (it's a noun, not verb-leading).
     Only match when the keyword stands alone as a word, not as a substring of another word.
   - **LABEL HARD REJECT — auto-skip if labeled:** `enhancement`, `feature`, `feature-request`,
     `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`,
     `chore`, `performance`, `optimization`, `docs`, `documentation`
   - **REJECT if:** no concrete broken behavior described, is a discussion/RFC/proposal.
   - If not a confirmed bug: remove from queue, go to step 3.
2. oss-triage: Confirm open, unassigned, estimate complexity.
3. If too complex or closed, remove from queue, go to step 3.
4. Quality gate — SKIP issues that fail any of these:
   - **Must be a bug fix, NOT a feature request, enhancement, or refactor**
   - Must have clear reproduction steps or error details (stack traces, error messages)
   - Must be well-scoped (not vague "improve X" without a specific broken behavior)
   - Must NOT be labeled "wontfix", "duplicate", "invalid"
   - Prefer issues with maintainer engagement (comments from repo owners)
   - Prefer issues with "expected vs actual" descriptions
   - **Prefer issues created in the last 3 days (freshest bugs get highest priority)**
   - Skip issues older than 30 days entirely — too stale
   - Skip issues in repos with < 10 stars (low impact)
5. repo-analyzer: Only if repo NOT in memory/repos/. Check for anti-AI-PR policy. If hostile, skip permanently. (skip if cached)
6. Quick research: If the issue references upstream bugs, CVEs, or external context, use web_search to understand before spawning. If issue has screenshot attachments, use image tool to analyze them.

## 5. Spawn Implementation Sub-Agent
Read the spawn template from `templates/subagent-implementation.md`.
Substitute the variables: `{repo}` (owner/repo), `{issue}` (issue number), `{title}` (issue title).
Pass the substituted Task Prompt as the `task` parameter to sessions_spawn.
Use the Spawn Config from the template for `label` and `attachments`.

Read memory files for repo conventions and issue details BEFORE spawning.
Pass them as attachments since sub-agents cannot access memory tools.
The sub-agent runs in a FRESH context with zero pollution from prior tasks.
Do NOT implement in the main session.
If web_search results were gathered during triage, include a summary in the attachments.

### Sub-Agent Discipline
- Each sub-agent MUST write results to its designated result file, then reply ANNOUNCE_SKIP
- **Implementation sub-agents**: memory/subagent-result-<repo>-<issue>.md
- **Follow-up sub-agents**: memory/subagent-result-followup-<repo>-<pr>.md
- Per-task result files allow multiple sub-agents to write concurrently without conflicts
- ANNOUNCE_SKIP bypasses the announce model call — no content filter risk, faster completion
- NO hard timeout — sub-agents take as long as they need to do quality work
- maxConcurrent: 5 — up to 5 sub-agents can work in parallel (follow-ups + implementations combined)
- Result file must use YAML frontmatter format from templates/subagent-result-schema.md
- Do NOT accumulate sub-agent sessions — each task = one sub-agent = one lifecycle

### Disk Cleanup (self-cleanup only)
- Implementation sub-agents clone repos to /tmp/clawoss-<issue>-<timestamp>/ — isolated per task
- Follow-up sub-agents clone repos to /tmp/clawoss-followup-<pr>-<timestamp>/ — isolated per PR
- After PR submit or task abandon, the sub-agent MUST rm -rf its OWN workdir
- **ONLY the sub-agent that created a workspace may delete it** — no external cleanup
- The orchestrator NEVER deletes /tmp/clawoss-* directories — active sub-agents may be working in them
- NEVER clone to /tmp/clawoss-workdir (shared dir causes conflicts between sub-agents)
- Expected disk: /tmp/clawoss-* should be <2GB total during peak (5 active sub-agents)

### Stale Session Cleanup
- At the start of each heartbeat, check sessions_list for any sessions older than 30 minutes
- If a stale session exists (>30 min old, not the main orchestrator session): ignore it
- Stale sessions are dead weight — they consumed context and produced nothing useful
- Do NOT send messages to stale sessions — just move on and spawn fresh

## 6. Handle Sub-Agent Results
Check ALL active sub-agents via sessions_list.

### 6a. Implementation Results
List memory/subagent-result-*.md files (excluding followup-* files) to find completed results.
For each result file, parse the YAML frontmatter (see templates/subagent-result-schema.md):
- Extract `status`, `pr_url`, `repo`, `issue`, `failure_reason` from the YAML block between `---` markers.
- If status: `success` — VALIDATE before counting:
  - Check that `pr_url` is present and starts with `https://github.com/` and contains `/pull/`
  - If `pr_url` is MISSING or EMPTY:
    - Do NOT count as a submitted PR
    - Log as "incomplete — no PR URL" in memory/work-queue.md
    - Re-queue the issue for retry (once). If already retried, mark as failed.
    - Delete the result file.
  - If `pr_url` is PRESENT and valid:
    - Update memory/pipeline-state.md with new PR.
    - Remove the issue from memory/work-queue.md.
    - **Add new entry to memory/pr-followup-state.md** with status `pending_review`, round 0.
    - NOTE: pr-ledger.md is AUTO-SYNCED by pr-ledger-sync.sh (runs every 60s via launchd).
      It pulls all PRs from GitHub API + result files. Do NOT manually edit the ledger.
- If status: `failure` or `abandoned`: log `failure_reason` in memory/work-queue.md.
- If status: `already_fixed`: remove from work-queue.md, no PR to track.
- If no valid YAML frontmatter: treat as legacy format, fall back to text search for "Status:" and "PR URL:".
- Delete the result file after processing.

### 6b. Follow-up Results
List memory/subagent-result-followup-*.md files to find completed follow-up results.
For each follow-up result file, parse the YAML frontmatter (see templates/subagent-result-schema.md):
- Extract `status`, `followup_round`, `followup_outcome`, `pr_number`, `repo` from the YAML block.
- Update memory/pr-followup-state.md (**clears `spawned_pending` status**):
  - Increment the round count for this PR
  - Update the last-checked timestamp
  - Set status based on `followup_outcome` field:
    - `changes_pushed` or `question_answered` → `follow_up_round_{N}` (N = new round count)
    - `closed_scope_concern` → `closed_scope_concern` (terminal — no more sub-agents)
    - `closed_rejected` → `closed_rejected` (terminal — no more sub-agents)
    - `disengaged_max_rounds` → `disengaged` (terminal — no more sub-agents)
    - If `status: failure` → set status to `pending_review` (clears spawned_pending, allows retry next cycle)
- If round count reaches 3: mark as `disengaged`, never spawn another sub-agent for this PR
- If PR was closed by the sub-agent: remove from pipeline-state.md
- Delete the follow-up result file after processing.

### 6c. Verify Self-Cleanup
Do NOT run external cleanup commands (no `find /tmp -name 'clawoss-*' -exec rm -rf`).
Active sub-agents may be working in those directories.

Each sub-agent is responsible for cleaning up its OWN workspace (`rm -rf $WORKDIR`)
as the final step before replying ANNOUNCE_SKIP. This is enforced in the spawn templates.

For sub-agents still running (no result file yet): leave them running, check next cycle.

## 7. Report & Loop
Run dashboard-reporter: log cycle outcome (submitted/abandoned/followup), cost, repo, issue.
Update memory/wake-state.md: increment counters.
Remove completed/abandoned item from memory/work-queue.md.

Count active sub-agents via sessions_list.
If active sub-agents < 5 AND work queue has items:
  DO NOT reply HEARTBEAT_OK. Go back to step 3 and spawn more.
If active sub-agents < 5 AND work queue is empty:
  Run oss-discover for FRESH BUG REPORTS (last 3 days, all languages, 30+ candidates, bug labels only, created:> date filter).
  Then go back to step 3 and spawn.
ONLY reply HEARTBEAT_OK if:
  - All 5 slots are full, OR
  - Work queue is empty AND oss-discover found nothing AND all slots checked
Always self-wake: exec: openclaw system event --text "cycle-complete" --mode now
