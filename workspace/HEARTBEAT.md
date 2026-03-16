# Heartbeat -- Autonomous Work Loop

## CRITICAL: DO NOT JUST REPLY HEARTBEAT_OK
Execute ALL steps. Only reply HEARTBEAT_OK if: queue empty, no follow-ups pending, no stalled agents, oss-discover found nothing. Otherwise: PICK WORK AND DO IT.

## Rules (compact — lightContext mode, AGENTS.md may not load)
- Keep all 5 sub-agent slots filled. Follow-ups FIRST, then new work.
- Max 5 active PRs. Max 10/day total. 30-min same-repo gap. Max 3 follow-up rounds.
- NEVER push to main/master. NEVER force-push. NEVER commit secrets.
- Max 200 lines, 5 files per PR. Small diffs merge fastest.
- Optimize for merge rate. 60% easy wins + 40% bug fixes.
- Every PR must fully resolve its scope. Partial fixes = abandon.
- Read CONTRIBUTING.md before first PR to any repo.
- Branch: clawoss/{fix,docs,test,typo}/. Commit: fix/docs/test type.
- Work queue should have 10+ items. If < 5, run oss-discover IMMEDIATELY.

## 0. Health Checks
**0a. Context**: Call session_status. >70%: flush to memory, /compact, re-read state. >50%: compact before next cycle.
**0b. Circuit breakers**: Read wake-state.md. HEARTBEAT_OK if consecutive_wakes >= 50 or errors_this_hour >= 2.

## 1. Stall Recovery
Check for stalled sub-agents (no messages >5 min). Kill, re-queue at TOP of work-queue.md, increment errors_this_hour. 2 consecutive stalls on same task = SKIP it.

## 2. PR Follow-ups (HIGHEST PRIORITY)
**2a.** Run `gh pr list --author @me --state open --json number,title,url,updatedAt,reviewDecision,statusCheckRollup,comments`. Fetch inline + general comments for each.
**2b.** Read pr-followup-state.md. **SPAWNED_PENDING GUARD:** skip if `spawned_pending`. Classify each PR:
- `changes_requested` (round < 3): spawn follow-up. Round >= 3: skip.
- `comment_only`: spawn to respond. Counts as round only if code pushed.
- `approved`/`merged`: log success.
- `ci_failing` (our fault): treat as changes_requested.
- `stale` (>7 days): close with polite comment.
- `close_withdraw`: close with polite withdrawal.

**2c.** Write context to `memory/subagent-inputs/followup-{repo}-{pr}.md`.
**2d.** Spawn using `templates/subagent-followup.md`. Set status to `spawned_pending` IMMEDIATELY. Max 2 follow-ups per cycle.
**2e.** Update timestamps, remove closed PRs.

## 3. Pick Work

### 3-ZERO. DAILY PR LIMIT
Read wake-state.md. **prs_today >= 10: STOP. HEARTBEAT_OK.** Follow-ups exempt.

### 3a. Merge Staging
Merge work-queue-staging.md and followup-staging.md into work-queue.md. Clear staging. DEDUP by issue URL.

### 3b. Count and Pick
Count active sub-agents (sessions_list, exclude main + stale >30min).

- **active >= 5**: skip to step 6.
- **active < 5, queue has items**: pick next (urgent first, score >= 5). Gates:
  a. **DEDUP** (ALL 4): skip if in pr-ledger.md, open PR for repo, in subagent-result-*.md, or status `spawned`.
  b. Skip if repo has 3 PRs today.
  c. Prefer different repos across concurrent agents.
  d. **TYPE CHECK**: bug fix, docs fix, typo fix, or test addition only.
  f. **TITLE REJECT**: Skip if title whole-word matches: `add`, `extend`, `enable`, `improve`, `enhance`, `new feature`, `request`, `implement`, `support`, `introduce`, `create`, `propose`, `migrate`, `upgrade`, `refactor`, `redesign`, `optimize`, `allow`, `provide`.
  g. **HEALTH GATE**: `bash scripts/repo-health-check.sh {owner}/{repo}`. Exit 1 = skip. Cache 7 days.
  After spawn, LOOP BACK until 5 active or queue empty.
- **Queue < 5**: run oss-discover. Target 20-30 candidates, score >= 5.
- **Queue >= 10**: skip discovery, drain first.

## 4. Triage (< 3 min, main session)
**4-ZERO.** Health gate: `bash scripts/repo-health-check.sh`. Exit 1 = remove, go to step 3.
**4a.** Type: bug/docs/typo/test. Title keyword reject (same as 3f). Label reject: `enhancement`, `feature`, `feature-request`, `improvement`, `refactor`, `discussion`, `question`, `proposal`, `rfc`, `design`, `meta`, `chore`, `performance`, `optimization`. Invalid = remove.
**4b.** Run oss-triage. Skip if: not actionable, vague, wontfix/duplicate/invalid, >30 days old.
**4c.** Score: +5 docs/typo, +3 tests, +5 merge <3d, +3 review >80%, +2 gfi/help-wanted. -5 merge >14d, -10 if 100% closure rate. Skip: 0 merges/30d, >50 open PRs.
**4d.** Quick research via web_search.

## 5. Spawn Implementation Sub-Agent
Read `templates/subagent-implementation.md`. Substitute `{repo}`, `{issue}`, `{title}`. Spawn via sessions_spawn. Pass repo conventions + issue details as attachments.
**IMMEDIATELY mark issue `status: spawned` in work-queue.md.**

Sub-agent results: `memory/subagent-result-<repo>-<issue>.md` (YAML frontmatter per `templates/subagent-result-schema.md`). maxConcurrent: 5. Sub-agents clean their own `/tmp/clawoss-*` workspaces.

## 6. Handle Sub-Agent Results

**6a. Implementation**: List `memory/subagent-result-*.md` (not followup-*). Parse YAML.
- success + pr_url: remove from queue, add to pr-followup-state.md (status: `pending_review`, round 0).
- success, no pr_url: re-queue once, then fail.
- failure/abandoned: clear `spawned`, log failure_reason in failure-log.md. `repo_health_fail` = cache 7d.
- already_fixed: remove. Delete result file after processing.

**6b. Follow-up**: List `memory/subagent-result-followup-*.md`. Parse YAML. Clear `spawned_pending`, increment round.
- `changes_pushed`/`question_answered` -> `follow_up_round_N`
- `closed_*`/`disengaged_*` -> terminal
- `failure` -> `pending_review` (retry next cycle)
- Round 3: `disengaged`, never spawn again. Delete result file.

## 7. Report & Loop
Run dashboard-reporter. Update wake-state.md. Remove completed/abandoned from queue.
If < 5 active AND queue has items: go to step 3. If queue empty: run oss-discover, then step 3.
HEARTBEAT_OK only if all slots full OR queue empty + discovery found nothing.
Self-wake: `exec: openclaw system event --text "cycle-complete" --mode now`
