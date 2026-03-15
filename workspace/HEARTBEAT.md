# Heartbeat -- Autonomous Work Loop

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

### Failure Handling
- If a contribution is rejected, log reason and adapt
- If repo's CI is broken (not our fault), skip and move to next
- If rate-limited by GitHub API, back off and wait
- Never get stuck in retry loops -- fail fast and move forward

## 0. Circuit Breakers
Read memory/wake-state.md. Reply HEARTBEAT_OK if:
- consecutive_wakes >= 8 (mandatory cooldown)
- errors_this_hour >= 2
- If hourly_reset is stale (>1hr), reset hourly counters first.

## 1. PR Follow-ups (Highest Priority)
Run: gh pr list --author @me --state open --json number,title,reviewDecision,statusCheckRollup,url,updatedAt
- New review comments? --> oss-followup for that PR. Go to step 5.
- CI failing (our fault)? --> fix and push. Go to step 5.
- PR merged? --> Update memory/pipeline-state.md. Continue.
- PR stale >7 days, no review? --> Close with polite comment. Remove from pipeline.

## 2. Merge Staging Files & Pick Work
Merge any new items from memory/work-queue-staging.md and memory/followup-staging.md into memory/work-queue.md, then clear the staging files. (This prevents race conditions with concurrent cron writes.)

Read memory/work-queue.md:
- Urgent items (PR follow-ups) --> pick first urgent.
- Normal items --> pick top item with score >= 5.
- Queue empty --> run oss-discover (fast: 3 repos, 5 issues, score >= 5). If nothing, HEARTBEAT_OK.
Check memory/wake-state.md prs_today_by_repo. If selected repo is at daily limit, skip to next item.

## 3. Triage (in main session, < 2 min)
1. oss-triage: Confirm open, unassigned, estimate complexity.
2. If too complex or closed, remove from queue, go to step 2.
3. repo-analyzer: Only if repo NOT in memory/repos/. Check for anti-AI-PR policy. If hostile, skip permanently. (skip if cached)

## 4. Spawn Implementation Sub-Agent
Use sessions_spawn to delegate the coding task to a fresh sub-agent session:
  task: "Fix <repo>#<issue>: <title>.
    Read the attached repo-conventions.md and issue-details.md.
    1. Clone repo, create branch clawoss/<type>/<desc>.
    2. Implement fix (max 200 lines, max 5 files).
    3. Run safety checks: diff size, secrets scan, branch naming.
    4. Self-review: 5-question check. 3+ NO = abandon.
    5. Run local tests (related tests, 3-min timeout). 2 fix attempts max.
    6. Commit, push, create PR with clear description.
    7. Do NOT wait for remote CI. Submit and report result."
  label: "<repo>#<issue>"
  runTimeoutSeconds: 600
  attachments: [repo-conventions.md, issue-details.md]

Read memory files for repo conventions and issue details BEFORE spawning.
Pass them as attachments since sub-agents cannot access memory tools.
The sub-agent runs in a FRESH context with zero pollution from prior tasks.
Do NOT implement in the main session. Wait for the announce step.

## 5. Handle Sub-Agent Result
When the sub-agent announces back:
- If PR submitted: update memory/pipeline-state.md with new PR.
- If abandoned: log reason in memory/work-queue.md.
- If timeout/error: increment errors_this_hour in wake-state.md.

## 6. Report & Loop
Run dashboard-reporter: log cycle outcome (submitted/abandoned/followup), cost, repo, issue.
Update memory/wake-state.md: increment counters.
Remove completed/abandoned item from memory/work-queue.md.

If circuit breakers OK AND work-queue.md has items AND active PRs < 5:
  exec: openclaw system event --text "Cycle complete" --mode now

Otherwise: HEARTBEAT_OK
