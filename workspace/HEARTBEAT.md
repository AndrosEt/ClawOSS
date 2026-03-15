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
- ALWAYS use branch naming: clawoss/<type>/<description>

### Quality (non-negotiable)
- Read CONTRIBUTING.md before first PR to any repo
- Every code change must include relevant tests
- Every PR description must explain the "why" not just the "what"
- Commit messages: Conventional Commits format -- type(scope): description
- Code style must match the target repo's existing conventions
- No AI-slop: no unnecessary comments, no over-engineering, no "I" statements
- If tests fail after 2 fix attempts, abandon task
- If self-review fails 3+ checks, abandon task

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

## 2. PR Follow-ups (Highest Priority)
Run: gh pr list --author @me --state open --json number,title,reviewDecision,statusCheckRollup,url,updatedAt
- New review comments? --> oss-followup for that PR. Go to step 6.
- CI failing (our fault)? --> fix and push. Go to step 6.
- PR merged? --> Update memory/pipeline-state.md. Continue.
- PR stale >7 days, no review? --> Close with polite comment. Remove from pipeline.

## 3. Merge Staging Files & Pick Work (up to 5 concurrent tasks)
Merge any new items from memory/work-queue-staging.md and memory/followup-staging.md into memory/work-queue.md, then clear the staging files. (This prevents race conditions with concurrent cron writes.)

Count active sub-agents via sessions_list (exclude main session and stale sessions >30min).
Read memory/work-queue.md, memory/wake-state.md prs_today_by_repo, and memory/pr-ledger.md.
- If active sub-agents >= 5: skip to step 6 (check results).
- If active sub-agents < 5 AND work queue has items:
  Pick the next task (urgent first, then top item with score >= 5).
  BEFORE spawning, apply these filters:
  a. SKIP if issue already appears in memory/pr-ledger.md (never submit two PRs for same issue)
  b. SKIP if repo already has 3 PRs today (per-repo daily limit)
  c. Prefer different repos across concurrent sub-agents when possible
  Go to step 4 (triage) then step 5 (spawn).
  After spawning, LOOP BACK here to pick another task.
  Keep spawning until 5 sub-agents are active or queue is empty.
- Queue has < 5 items --> run oss-discover with BROAD scope:
  Search across ALL of GitHub, multiple languages (rust, python, typescript, go, java).
  Target 20-30 candidate issues per discovery cycle.
  Diversify across repos — max 3 issues from the same repo.
  Score >= 5 to enter queue. If nothing found, HEARTBEAT_OK.
- Queue has >= 10 items --> skip discovery, drain the queue first.

## 4. Triage (in main session, < 3 min)
1. oss-triage: Confirm open, unassigned, estimate complexity.
2. If too complex or closed, remove from queue, go to step 3.
3. Quality gate — SKIP issues that fail any of these:
   - Must have clear reproduction steps or acceptance criteria
   - Must be well-scoped (not vague "improve X" without specifics)
   - Must NOT be labeled "wontfix", "duplicate", "invalid"
   - Prefer issues with maintainer engagement (comments from repo owners)
   - Skip issues older than 6 months with no recent activity
   - Skip issues in repos with < 10 stars (low impact)
4. repo-analyzer: Only if repo NOT in memory/repos/. Check for anti-AI-PR policy. If hostile, skip permanently. (skip if cached)
5. Quick research: If the issue references upstream bugs, CVEs, or external context, use web_search to understand before spawning. If issue has screenshot attachments, use image tool to analyze them.

## 5. Spawn Implementation Sub-Agent
Use sessions_spawn to delegate the coding task to a fresh sub-agent session:
  task: "Fix <repo>#<issue>: <title>.
    Read the attached repo-conventions.md and issue-details.md.
    Follow the REPRODUCE-FIRST workflow (oss-implement skill):
    1. Create isolated workspace: WORKDIR=/tmp/clawoss-<issue>-$(date +%s)
       mkdir -p $WORKDIR && cd $WORKDIR
       Clone repo INTO this directory. All work happens here.
    2. REPRODUCE: Run existing tests. Find or write a FAILING test for the bug.
       Record the failure output as evidence.
    3. IMPLEMENT: Write the MINIMAL fix to make the failing test pass.
    4. VERIFY: Run tests again. The failing test MUST now pass. No regressions.
       Record the passing output as evidence.
    5. REVIEW: Self-check diff (scope, style, secrets, size, commit msg).
       3+ failures = abandon.
    6. SUBMIT: Commit, push, create PR with reproduction evidence
       (before/after test output in PR description).
    7. Do NOT wait for remote CI. Submit and report result.
    8. CLEANUP: After submit or abandon, ALWAYS run: rm -rf $WORKDIR
       This is NON-OPTIONAL. Cloned repos waste 500MB-2GB each.
    Tools: You have web_search, web_fetch, image, and apply_patch available.
    Use web_search to research error messages or find related upstream fixes.
    Use image to analyze any screenshots attached to the issue.
    IMPORTANT: When finished, write results to memory/subagent-result-<repo>-<issue>.md (relative to workspace root):
    - Status: success/failure
    - PR URL (if created)
    - Files changed
    - Test results (before/after)
    - Error details (if failed)
    Then run: rm -rf $WORKDIR
    Then reply: ANNOUNCE_SKIP"
  label: "<repo>#<issue>"
  attachments: [repo-conventions.md, issue-details.md]

Read memory files for repo conventions and issue details BEFORE spawning.
Pass them as attachments since sub-agents cannot access memory tools.
The sub-agent runs in a FRESH context with zero pollution from prior tasks.
Do NOT implement in the main session.
If web_search results were gathered during triage, include a summary in the attachments.

### Sub-Agent Discipline
- Each sub-agent MUST write results to memory/subagent-result-<repo>-<issue>.md, then reply ANNOUNCE_SKIP
- Per-task result files allow multiple sub-agents to write concurrently without conflicts
- ANNOUNCE_SKIP bypasses the announce model call — no content filter risk, faster completion
- NO hard timeout — sub-agents take as long as they need to do quality work
- maxConcurrent: 5 — up to 5 sub-agents can work in parallel on different tasks
- Result file must include: status, PR URL, files changed, test results, or error details
- Do NOT accumulate sub-agent sessions — each task = one sub-agent = one lifecycle

### Disk Cleanup (non-negotiable)
- Sub-agents clone repos to /tmp/clawoss-<issue>-<timestamp>/ — isolated per task
- After PR submit or task abandon, sub-agent MUST rm -rf its workdir
- Orchestrator runs cleanup of stale workdirs (>60 min old) every cycle in step 6
- NEVER clone to /tmp/clawoss-workdir (shared dir causes conflicts between sub-agents)
- Expected disk: /tmp/clawoss-* should be <2GB total during peak (5 active sub-agents)

### Stale Session Cleanup
- At the start of each heartbeat, check sessions_list for any sessions older than 30 minutes
- If a stale session exists (>30 min old, not the main orchestrator session): ignore it
- Stale sessions are dead weight — they consumed context and produced nothing useful
- Do NOT send messages to stale sessions — just move on and spawn fresh

## 6. Handle Sub-Agent Results
Check ALL active sub-agents via sessions_list.
List memory/subagent-result-*.md files to find completed results.
For each result file:
- Read it to get the sub-agent's outcome.
- If Status: success — VALIDATE before counting:
  - Check that the result file contains a PR URL (starts with https://github.com/ and contains /pull/)
  - If PR URL is MISSING or EMPTY:
    - Do NOT count as a submitted PR
    - Log as "incomplete — no PR URL" in memory/work-queue.md
    - Re-queue the issue for retry (once). If already retried, mark as failed.
    - Delete the result file.
  - If PR URL is PRESENT and valid:
    - Update memory/pipeline-state.md with new PR.
    - Remove the issue from memory/work-queue.md.
    - NOTE: pr-ledger.md is AUTO-SYNCED by pr-ledger-sync.sh (runs every 60s via launchd).
      It pulls all PRs from GitHub API + result files. Do NOT manually edit the ledger.
- If Status: failure: log reason in memory/work-queue.md.
- If timeout/error: increment errors_this_hour in wake-state.md.
- Delete the result file after processing.
- Run disk cleanup: find /tmp -maxdepth 1 -name 'clawoss-*' -type d -mmin +60 -exec rm -rf {} +
  This catches any workdirs left behind by crashed/stalled sub-agents.
For sub-agents still running (no result file yet): leave them running, check next cycle.

## 7. Report & Loop
Run dashboard-reporter: log cycle outcome (submitted/abandoned/followup), cost, repo, issue.
Update memory/wake-state.md: increment counters.
Remove completed/abandoned item from memory/work-queue.md.

Count active sub-agents via sessions_list.
If active sub-agents < 5 AND work queue has items:
  DO NOT reply HEARTBEAT_OK. Go back to step 3 and spawn more.
If active sub-agents < 5 AND work queue is empty:
  Run oss-discover BROADLY (all languages, 30+ candidates).
  Then go back to step 3 and spawn.
ONLY reply HEARTBEAT_OK if:
  - All 5 slots are full, OR
  - Work queue is empty AND oss-discover found nothing AND all slots checked
Always self-wake: exec: openclaw system event --text "cycle-complete" --mode now
