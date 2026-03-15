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

Execute this checklist strictly. One task per cycle. Quality over speed.

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
- image: K2.5 has vision (MoonViT) -- use to analyze screenshots attached to issues
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
- consecutive_wakes >= 8 (mandatory cooldown)
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

## 3. Merge Staging Files & Pick Work
Merge any new items from memory/work-queue-staging.md and memory/followup-staging.md into memory/work-queue.md, then clear the staging files. (This prevents race conditions with concurrent cron writes.)

Read memory/work-queue.md:
- Urgent items (PR follow-ups) --> pick first urgent.
- Normal items --> pick top item with score >= 5.
- Queue empty AND queue has < 10 items --> run oss-discover (fast: 3 repos, 5 issues, score >= 5). If nothing, HEARTBEAT_OK.
- Queue has >= 10 items --> skip discovery, drain the queue first.
Check memory/wake-state.md prs_today_by_repo. If selected repo is at daily limit, skip to next item.

## 4. Triage (in main session, < 3 min)
1. oss-triage: Confirm open, unassigned, estimate complexity.
2. If too complex or closed, remove from queue, go to step 3.
3. repo-analyzer: Only if repo NOT in memory/repos/. Check for anti-AI-PR policy. If hostile, skip permanently. (skip if cached)
4. Quick research: If the issue references upstream bugs, CVEs, or external context, use web_search to understand before spawning. If issue has screenshot attachments, use image tool to analyze them.

## 5. Spawn Implementation Sub-Agent
Use sessions_spawn to delegate the coding task to a fresh sub-agent session:
  task: "Fix <repo>#<issue>: <title>.
    Read the attached repo-conventions.md and issue-details.md.
    Follow the REPRODUCE-FIRST workflow (oss-implement skill):
    1. Clone repo, create branch clawoss/<type>/<desc>.
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
    Tools: You have web_search, web_fetch, image, and apply_patch available.
    Use web_search to research error messages or find related upstream fixes.
    Use image to analyze any screenshots attached to the issue.
    IMPORTANT: When finished, write results to /Users/kevinlin/clawOSS/workspace/memory/subagent-result.md:
    - Status: success/failure
    - PR URL (if created)
    - Files changed
    - Test results (before/after)
    - Error details (if failed)
    Then reply: ANNOUNCE_SKIP"
  label: "<repo>#<issue>"
  attachments: [repo-conventions.md, issue-details.md]

Read memory files for repo conventions and issue details BEFORE spawning.
Pass them as attachments since sub-agents cannot access memory tools.
The sub-agent runs in a FRESH context with zero pollution from prior tasks.
Do NOT implement in the main session.
If web_search results were gathered during triage, include a summary in the attachments.

### Sub-Agent Discipline
- Each sub-agent MUST write results to memory/subagent-result.md, then reply ANNOUNCE_SKIP
- ANNOUNCE_SKIP bypasses the announce model call — no content filter risk, faster completion
- NO hard timeout — sub-agents take as long as they need to do quality work
- maxConcurrent: 5 — up to 5 sub-agents can work in parallel on different tasks
- If 5 are already active, wait for one to finish before spawning another
- Result file must include: status, PR URL, files changed, test results, or error details
- Do NOT accumulate sub-agent sessions — each task = one sub-agent = one lifecycle

### Stale Session Cleanup
- At the start of each heartbeat, check sessions_list for any sessions older than 30 minutes
- If a stale session exists (>30 min old, not the main orchestrator session): ignore it
- Stale sessions are dead weight — they consumed context and produced nothing useful
- Do NOT send messages to stale sessions — just move on and spawn fresh

## 6. Handle Sub-Agent Result
Read memory/subagent-result.md to get the sub-agent's outcome.
If file doesn't exist or is empty, the sub-agent failed silently — increment errors_this_hour.
- If Status: success and PR URL present: update memory/pipeline-state.md with new PR.
- If Status: failure: log reason in memory/work-queue.md.
- If timeout/error: increment errors_this_hour in wake-state.md.
Delete memory/subagent-result.md after processing to avoid stale reads next cycle.

## 7. Report & Loop
Run dashboard-reporter: log cycle outcome (submitted/abandoned/followup), cost, repo, issue.
Update memory/wake-state.md: increment counters.
Remove completed/abandoned item from memory/work-queue.md.

If circuit breakers OK AND work-queue.md has items AND active PRs < 5:
  exec: openclaw system event --text "Cycle complete" --mode now

Otherwise: HEARTBEAT_OK
