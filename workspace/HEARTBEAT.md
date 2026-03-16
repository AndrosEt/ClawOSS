# Heartbeat -- Autonomous Work Loop

## CRITICAL: DO NOT JUST REPLY HEARTBEAT_OK
Execute ALL steps. Only reply HEARTBEAT_OK if: queue empty, no follow-ups pending, no stalled agents, oss-discover found nothing. Otherwise: PICK WORK AND DO IT.

## Rules — see AGENTS.md (loaded alongside this file)
Keep all 5 sub-agent slots filled. Follow-ups FIRST, then new work.
Work queue should have 10+ items. If < 5, run oss-discover IMMEDIATELY.

## 0. Health Checks
**0a. Context**: Use the `session_status` tool (NOT a bash command — it's an OpenClaw built-in tool). >70%: flush to memory, /compact, re-read state. >50%: compact before next cycle.
**0b. Circuit breakers**: Read wake-state.md. HEARTBEAT_OK if consecutive_wakes >= 50 or errors_this_hour >= 2.
**0b2. Cycle guardrails** (prevent runaway cycles and quota burn):
- **Max cycle time**: If any single step takes >5 minutes, skip to the next step. Do not block the entire cycle.
- **Context check mid-cycle**: If >50% context used after steps 2-3, compact immediately before continuing to steps 4-7.
- **API error backoff**: If 3+ API calls fail in a row (rate limit, 403, 5xx), pause 60 seconds before continuing. If 5+ fail, HEARTBEAT_OK and wait for next cycle.
**0c. Dashboard self-check** (run every cycle, skip if dashboard unreachable):
```bash
HEALTH=$(curl -s --max-time 5 https://clawoss-dashboard.vercel.app/api/agent/health-check)
```
Parse the response and OBEY all three fields:
- `directives`: plain-English corrections (slow down, follow up first, avoid dead repos). Read and follow.
- `avoidRepos`: repos with 2+ PRs and 0 merges — do NOT submit new PRs to any of these.
- `reposWithOpenPRs`: repos where we already have open PRs — do NOT submit new PRs, focus on follow-ups instead.
If curl fails or times out, proceed without dashboard data — the other gates still apply.

## 0.5. Always-On Subagent Management (scout + PR monitor)
Check always-on subagents via `sessions_list`:

**1. Scout** (label "scout-*") — continuous issue discovery:
- **Alive** (active in last 30 min): read `memory/scout-report-*.md`. Merge scored candidates into `memory/work-queue-staging.md`. Delete processed reports.
- **Dead or missing**: Spawn:
  ```
  sessions_spawn(task: <read templates/subagent-scout.md>, label: "scout-tier0", mode: "session", thread: true, runTimeoutSeconds: 3600)
  ```
  Pass trust-repos.md and pr-ledger.md via attachments.

**2. PR Monitor** (label "pr-monitor") — continuous PR follow-up scanning:
- **Alive** (active in last 30 min): read `memory/followup-staging.md` for items needing code changes (see step 2). Read `memory/pr-monitor-report.md` for cycle summary.
- **Dead or missing**: Spawn:
  ```
  sessions_spawn(task: <read templates/subagent-pr-monitor.md>, label: "pr-monitor", mode: "session", thread: true, runTimeoutSeconds: 3600)
  ```
  The PR monitor handles: merging approved PRs, bumping stale PRs, responding to questions, closing invalid PRs, updating pr-followup-state.md.

**3. PR Analyst** (label "pr-analyst") — daily portfolio analysis:
- Once daily (check date in `memory/pr-strategy.md`): spawn if not run today:
  ```
  sessions_spawn(task: <read templates/subagent-pr-analyst.md>, label: "pr-analyst", runTimeoutSeconds: 1800)
  ```
- Read `memory/pr-strategy.md` and `memory/repo-blocklist.md` — adjust issue selection and repo targeting.

Always-on subagents use 2 slots (scout + PR monitor). Remaining 5 are for implementation/follow-up. Total maxConcurrent = 7.

## 1. Stall Recovery
Check for stalled sub-agents (no messages >5 min). Kill, re-queue at TOP of work-queue.md, increment errors_this_hour. Mark stalled task as `failed` in `memory/impl-spawn-state.md`. 2 consecutive stalls on same task = SKIP it.
**Clean stale locks**: Remove any lock files in `memory/locks/` older than 1 hour: `find memory/locks/ -name "*.lock" -mmin +60 -delete`

## 2. PR Follow-ups (delegated to PR Monitor — main agent handles code changes only)
The PR Monitor subagent (step 0.5) continuously scans ALL open PRs and handles simple actions
(merging approved PRs, bumping stale, responding to questions, closing invalid PRs, batch cleanup).
The main agent only needs to process items requiring CODE CHANGES.

**2a.** Read `memory/followup-staging.md`. This is written by the PR Monitor with items needing follow-up subagents.
**SPAWNED_PENDING GUARD:** skip items with `spawned_pending` in `memory/impl-spawn-state.md`.

**2b.** For each staged item, spawn follow-up subagent based on classification:
- `changes_requested` (round < 3): spawn follow-up subagent to implement requested changes.
- `changes_requested` (round >= 3): leave open for maintainer — do NOT spawn.
- `comment_only` (needs code changes): spawn follow-up. Counts as round only if code pushed.
- `ci_failing` (our fault): treat as changes_requested — spawn to fix CI.
- `fix_rejected`: spawn subagent with DIFFERENT approach, force-push to same branch. Priority: urgent.

**2c.** Write context to `memory/subagent-inputs/followup-{repo}-{pr}.md`.
**2d.** Spawn using `templates/subagent-followup.md`. Set status to `spawned_pending` IMMEDIATELY.
**2e.** Clear processed items from `memory/followup-staging.md`.
**2f.** Read `memory/pr-monitor-report.md` — note any merges or trust-building events from the monitor's cycle.

## 3. Pick Work

### 3a. Merge Staging + Trust Priority
Merge work-queue-staging.md and followup-staging.md into work-queue.md. Clear staging. DEDUP by issue URL.
**TRUST SORT**: After merging, re-sort the queue: issues from trusted repos (memory/trust-repos.md) go to TOP. Prefer trusted repos but no hard cap on new repos.

### 3b. Count and Pick
Count active impl/followup sub-agents (sessions_list, exclude main + always-on scouts/monitors + stale >30min).

- **impl/followup active >= 5**: skip to step 6.
- **impl/followup active < 5, queue has items**: pick next (urgent first, score >= 5). Gates:
  a. **IMPL SPAWN GUARD**: skip if issue has `spawned_pending` in `memory/impl-spawn-state.md`.
  b. **DEDUP** (ALL 5 — check EVERY one): skip if in pr-ledger.md, open PR for repo (`gh search prs --author BillionClaw --repo {owner}/{repo} --state open --json number --jq 'length'` > 0), in subagent-result-*.md, repo has `spawned_pending` in impl-spawn-state.md (even for a different issue — ONE active agent per repo at a time), OR lock file exists (`memory/locks/{owner}_{repo}.lock`). ALWAYS use `BillionClaw` explicitly — `@me` can fail in sub-agent contexts.
  **LOCK FILE**: Before spawning, write lock: `echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) {issue}" > memory/locks/{owner}_{repo}.lock`. Sub-agent deletes lock after PR creation or failure. Orchestrator cleans stale locks (>1 hour) in step 1 (stall recovery).
  c. Skip if we had a PR closed on this repo in the last 7 days.
  d. Prefer different repos across concurrent agents. NEVER have 2 agents working the same repo simultaneously.
  e. **TYPE CHECK**: bug fix, docs fix, typo fix, or test addition only.
  f. **TITLE REJECT**: Skip if title whole-word matches: `add`, `extend`, `enable`, `improve`, `enhance`, `new feature`, `request`, `implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`, `redesign`, `optimize`, `allow`, `provide`.
  g. **HEALTH GATE**: `bash scripts/repo-health-check.sh {owner}/{repo}`. Exit 1 = skip. Cache 7 days.
  g2. **DASHBOARD BLOCKLIST**: If step 0c returned `avoidRepos`, skip any repo in that list. If step 0c returned `reposWithOpenPRs`, skip any repo in that list (focus on follow-ups instead).
  h. **SUPERSESSION CHECK**: Before spawning, quick-check if issue already has linked PRs or is assigned:
     `gh api "repos/{owner}/{repo}/issues/{number}/timeline" --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null and .state == "open")] | length'`
     If > 0: skip (someone else is already working on it).
     `gh api "repos/{owner}/{repo}/issues/{number}" --jq '.assignees | length'`
     If > 0: skip (assigned to someone).
     Mark skipped issues as `superseded` or `assigned` in pr-ledger.md so we don't re-check.
  After spawn, LOOP BACK until 5 active or queue empty.
- **Queue < 5**: run oss-discover. Target 20-30 candidates, score >= 5.
- **Queue >= 10**: skip discovery, drain first.

## 4. Triage (< 3 min, main session)
**4-ZERO.** Health gate: `bash scripts/repo-health-check.sh`. Exit 1 = remove, go to step 3.
**4a.** Type: bug/docs/typo/test. Title keyword reject (same as 3f). Label reject: `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`. Invalid = remove.
**4b.** Run oss-triage. Skip if: not actionable, vague, wontfix/duplicate/invalid, >30 days old. CLA repos: sign automatable CLAs (CLA-assistant, DCO). Skip non-automatable CLAs (apache, microsoft, google, meta-llama).
**4b-SUPERSESSION.** Check if issue is already being worked on: assigned? linked PRs? someone commented "I'll take this"? If yes, remove from queue and mark `superseded` or `assigned` in pr-ledger.md. This is cheaper to check here (1 API call) than to discover mid-implementation.
**4c.** Score: +5 docs/typo, +3 tests, +5 merge <3d, +3 review >80%, +2 gfi/help-wanted. -5 merge >14d, -10 if 100% closure rate. Skip: 0 merges/30d, >50 open PRs.
**4d.** Quick research via web_search.

## 5. Spawn Implementation Sub-Agent
**5a. Pre-spawn issue comment (score >= 8, or >= 6 for trusted repos):** If the issue's triage score >= 8 (or >= 6 and repo is in memory/trust-repos.md), post a brief comment before spawning: `gh issue comment {issue} --repo {owner}/{repo} --body "I've been looking into this — [1-sentence approach]. Happy to submit a fix."` This signals intent and increases merge odds. Skip for lower-scoring issues to avoid noise on uncertain picks.
**5b.** Read `templates/subagent-implementation.md`. Substitute `{repo}`, `{issue}`, `{title}`. Spawn via sessions_spawn. Pass repo conventions + issue details as attachments.
**IMMEDIATELY mark issue as `spawned_pending` in `memory/impl-spawn-state.md` BEFORE spawning the next agent.**
**ALSO check: `gh search prs --author BillionClaw --repo {owner}/{repo} --state open --json number --jq 'length'`. If > 0, SKIP — we already have an open PR for this repo. NEVER use `@me` — it fails in sub-agent contexts.**
**Read `memory/repos/{owner}_{repo}.md`** if it exists — pass key info (target branch, CLA, CI) to the subagent via attachments.
**5c. PASS OPEN PR CONTEXT**: Before spawning, fetch open PRs in the repo and pass as attachment:
`gh pr list --repo {owner}/{repo} --state open --json number,title,headRefName --limit 20`
This gives the sub-agent awareness of what's in flight so it can avoid file conflicts.

Sub-agent results: `memory/subagent-result-<repo>-<issue>.md` (YAML frontmatter per `templates/subagent-result-schema.md`). maxConcurrent: 7 (1 scout + 1 PR monitor + 5 impl/followup). Sub-agents clean their own `/tmp/clawoss-*` workspaces.

## 6. Handle Sub-Agent Results

**6a. Implementation**: List `memory/subagent-result-*.md` (not followup-*). Parse YAML. Update `memory/impl-spawn-state.md` status for each result.
- success + pr_url: mark `completed` in impl-spawn-state.md. Remove from queue, add to pr-followup-state.md (status: `pending_review`, round 0). **If repo merged a previous PR from us, add/update memory/trust-repos.md.**
- success, no pr_url: mark `failed`. Re-queue once, then fail.
- failure/abandoned: mark `failed`. Log failure_reason in failure-log.md. `repo_health_fail` = cache 7d. If `fix_rejected_terminal` (2+ failed reworks) or `reviewer_rejected_scope`, deprioritize repo in trust-repos.md for 30 days. Single `fix_rejected` = rework opportunity, not deprioritization.
- already_fixed: mark `completed`. Remove. Delete result file after processing.

**6b. Follow-up**: List `memory/subagent-result-followup-*.md`. Parse YAML. Clear `spawned_pending`, increment round.
- `changes_pushed`/`question_answered`/`scope_adjusted`/`rework_in_progress` -> `follow_up_round_N` (continue iterating)
- `already_fixed_upstream`/`scope_rejected_terminal`/`fix_rejected_terminal`/`disengaged_max_rounds` -> terminal
- `failure` -> `pending_review` (retry next cycle)
- Round 3: `disengaged`, leave PR open for maintainer. Delete result file.

## 7. Report & Loop
Run dashboard-reporter. Update wake-state.md. Remove completed/abandoned from queue.
If < 5 active AND queue has items: go to step 3. If queue empty: run oss-discover, then step 3.
HEARTBEAT_OK only if all slots full OR queue empty + discovery found nothing.
Self-wake: `exec: openclaw system event --text "cycle-complete" --mode now`
