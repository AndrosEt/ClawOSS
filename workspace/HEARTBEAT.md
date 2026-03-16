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
- Empty slot = wasted throughput. Fill it immediately.
- After ANY sub-agent completes: check slots, discover if needed, spawn replacement.
- Work queue should always have 10+ items. If < 5, run oss-discover IMMEDIATELY.

## PRIORITY ORDER: Follow-ups FIRST, then new work
Follow-up sub-agents (responding to PR reviewers) get PRIORITY over implementation sub-agents.
- ALWAYS spawn follow-up sub-agents BEFORE new implementations
- Follow-ups and implementations share the same 5-slot pool

## Rules -- see AGENTS.md (loaded with this file during heartbeat)

## 0a. Context Health
Call session_status.
- percentUsed > 70%: STOP. Flush state to memory. Run /compact. Re-read wake-state.md and pipeline-state.md. Continue to 0b.
- percentUsed > 50%: Proceed, compact before next cycle.
- percentUsed <= 50%: Proceed normally.

## 0b. Circuit Breakers
Read memory/wake-state.md. Reply HEARTBEAT_OK if:
- consecutive_wakes >= 50 or errors_this_hour >= 2
- If hourly_reset is stale (>1hr), reset hourly counters first.

## 1. Stall Recovery
Check for stalled sub-agent sessions (no new messages >5 min):
- Kill stalled session, flush partial state
- Re-queue task at TOP of work-queue.md with "retry - previous attempt stalled"
- Increment errors_this_hour. After 2 consecutive stalls on same task, SKIP it.

## 2. PR Follow-ups (HIGHEST PRIORITY)

### 2a. Detect PRs Needing Attention
Run `gh pr list --author @me --state open --json number,title,url,updatedAt,reviewDecision,statusCheckRollup,comments`. For each PR, fetch inline comments (`gh api repos/{owner}/{repo}/pulls/{number}/comments`) and general comments (`gh api repos/{owner}/{repo}/issues/{number}/comments`).

### 2b. Classify Each PR
Read memory/pr-followup-state.md for round counts and status.
**SPAWNED_PENDING GUARD:** If status is `spawned_pending`, skip (sub-agent already working).

Classify each open PR:
- **changes_requested**: Round < 3: spawn follow-up. Round >= 3: skip (disengaged).
- **comment_only**: Spawn to respond. Counts as round only if code pushed.
- **approved**: Log success. No sub-agent needed.
- **ci_failing** (our fault): Treat like changes_requested.
- **stale** (no activity >7 days): Close with polite comment. Status: `closed_stale`.
- **close_withdraw** (maintainer rejected contribution): Close with polite withdrawal message. No sub-agent needed.
- **merged**: Status: `merged`. Log success.

### 2c. Write Follow-up Context File
For each PR needing a sub-agent, write context to `memory/subagent-inputs/followup-{repo}-{pr}.md` with: PR details (URL, number, branch, repo, issue, classification, round), all inline/general review comments (file, line, reviewer, comment ID, body), and diff summary.

### 2d. Spawn Follow-up Sub-Agent
Read `templates/subagent-followup.md`. Substitute variables: `{owner}`, `{repo}`, `{pr}`, `{branch}`, `{round}`, `{number}`. Spawn via sessions_spawn using the template's config.
IMMEDIATELY set PR status to `spawned_pending` in pr-followup-state.md.
**BATCH LIMIT: Max 2 follow-up sub-agents per heartbeat cycle.**

### 2e. Update State
Update timestamps. Remove closed PRs from tracking. Continue to step 3.

## 3. Merge Staging Files & Pick Work

### 3-ZERO. DAILY PR LIMIT HARD GATE
Read wake-state.md. **If prs_today >= 10: STOP. Reply HEARTBEAT_OK immediately.**
Follow-ups (step 2) are exempt. NON-NEGOTIABLE.

### 3a. Merge Staging Files
Merge items from work-queue-staging.md and followup-staging.md into work-queue.md, then clear staging files. **DEDUP by issue URL when merging.**

### 3b. Count and Pick
Count active sub-agents via sessions_list (exclude main session and stale >30min).
Read work-queue.md, wake-state.md prs_today_by_repo, and pr-ledger.md.

- **active >= 5**: skip to step 6.
- **active < 5 AND queue has items**: pick next task (urgent first, score >= 5). Apply gates:
  a. **DEDUP GATE** (pass ALL 3): skip if in pr-ledger.md, skip if open PR for repo, skip if in subagent-result-*.md.
  b. Skip if repo has 3 PRs today.
  c. Prefer different repos across concurrent sub-agents.
  d. **CONTRIBUTION TYPE CHECK**: Must be bug fix, docs fix, typo fix, or test addition.
  f. **TITLE KEYWORD HARD REJECT**: Skip if title matches whole word (`\b{keyword}\b`, case-insensitive): `add`, `extend`, `enable`, `improve`, `enhance`, `new feature`, `request`, `implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`, `redesign`, `optimize`, `allow`, `provide`. "Unsupported" does NOT match "support".
  g. **REPO HEALTH GATE**: Run `bash scripts/repo-health-check.sh {owner}/{repo}`. Exit 0 = pass, exit 1 = skip. Use cached results from memory/repos/ if < 7 days old.
  Go to step 4, then step 5. After spawning, LOOP BACK to pick more until 5 active or queue empty.
- **Queue < 5 items**: Run oss-discover skill with merge-optimized scope. Consider spawning scout (templates/subagent-scout.md). Target 20-30 candidates, score >= 5 to enter queue.
- **Queue >= 10 items**: skip discovery, drain queue first.

## 4. Triage (in main session, < 3 min)

### 4-ZERO. Health Gate
Run `bash scripts/repo-health-check.sh {owner}/{repo}` (or use cached results < 7 days). Exit 1 = remove from queue, go to step 3.

### 4a. Contribution Type Assessment
Determine type: bug fix, docs fix, typo fix, or test addition.
**TITLE KEYWORD HARD REJECT** (same list as step 3f).
**LABEL HARD REJECT**: skip if labeled `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`.
If not a valid contribution type: remove from queue, go to step 3.

### 4b. Quality Gate
Run oss-triage: confirm open, unassigned, estimate complexity.
SKIP if: not actionable, no repro steps (for bugs), vague scope, labeled wontfix/duplicate/invalid, older than 30 days. Prefer issues < 3 days old.

### 4c. Merge-Optimized Scoring
Bonuses: +5 docs/typo, +3 tests, +5 avg merge < 3d, +3 review rate > 80%, +2 good-first-issue/help-wanted. Penalties: -5 avg merge > 14d, -10 if 100% closure rate on our PRs (check pr-ledger.md). SKIP: 0 merges in 30d, > 50 open PRs.

### 4d. Quick Research
Use web_search for upstream bugs, CVEs, external context. Use image tool for screenshot attachments.

## 5. Spawn Implementation Sub-Agent
Read `templates/subagent-implementation.md`. Substitute variables: `{repo}`, `{issue}`, `{title}`. Spawn via sessions_spawn using the template's config.
Pass memory files for repo conventions and issue details as attachments (sub-agents cannot access memory tools). Include web_search summaries from triage. Fresh context, no main-session implementation.

### Sub-Agent Discipline
- Result files: `memory/subagent-result-<repo>-<issue>.md` (impl) or `memory/subagent-result-followup-<repo>-<pr>.md` (follow-up)
- YAML frontmatter format from `templates/subagent-result-schema.md`, then reply ANNOUNCE_SKIP
- maxConcurrent: 5, no hard timeout, one sub-agent per task lifecycle

### Cleanup
- Sub-agents clean their own `/tmp/clawoss-*` workspaces. Orchestrator NEVER deletes them.
- Stale sessions (>30 min, no activity): ignore, spawn fresh.

## 6. Handle Sub-Agent Results

### 6a. Implementation Results
List `memory/subagent-result-*.md` (excluding followup-*). Parse YAML frontmatter per `templates/subagent-result-schema.md`.
- **success with valid pr_url**: Update pipeline-state.md, remove from work-queue.md, add to pr-followup-state.md (status: `pending_review`, round 0). pr-ledger.md is auto-synced by pr-ledger-sync.sh.
- **success but no pr_url**: Log "incomplete", re-queue once, then mark failed.
- **failure/abandoned**: Log failure_reason (must use taxonomy category) in work-queue.md and failure-log.md (`| date | repo | #issue | category | details |`). If `repo_health_fail`: cache for 7 days.
- **already_fixed**: Remove from work-queue.md.
- No valid YAML: fall back to text search for "Status:" and "PR URL:".
- Delete result file after processing.

### 6b. Follow-up Results
List `memory/subagent-result-followup-*.md`. Parse YAML frontmatter.
Update pr-followup-state.md (clears `spawned_pending`): increment round, update timestamp.
- `changes_pushed`/`question_answered` -> `follow_up_round_N`
- `closed_scope_concern`/`closed_rejected`/`disengaged_max_rounds` -> terminal (no more sub-agents)
- `failure` -> `pending_review` (allows retry next cycle)
- Round 3 reached: `disengaged`, never spawn again. Delete result file after processing.

### 6c. Verify Self-Cleanup
Do NOT run external cleanup. Each sub-agent cleans its own workspace. Still-running sub-agents: leave them, check next cycle.

## 7. Report & Loop
Run dashboard-reporter. Update wake-state.md counters. Remove completed/abandoned from work-queue.md.

Count active sub-agents. If < 5 AND queue has items: go to step 3. If < 5 AND queue empty: run oss-discover, then step 3.
ONLY reply HEARTBEAT_OK if all 5 slots full, OR queue empty AND discovery found nothing.
Always self-wake: `exec: openclaw system event --text "cycle-complete" --mode now`
