# Builder Review #2 — Full V9 Change Review

**Date**: 2026-03-17
**Reviewer**: critique agent
**Files changed**: 14 files, 95 insertions, 64 deletions

---

## Task #3 (Rate Limits) — VERIFIED COMPLETE

All rate limit references removed correctly:
- [x] AGENTS.md:25 — "Max 10 PRs/day" removed
- [x] AGENTS.md:97 — "Max 3 NEW repos per day" removed
- [x] HEARTBEAT.md:81 — "3-ZERO. DAILY PR LIMIT" section removed
- [x] HEARTBEAT.md:85 — "Max 3 new repos per day" replaced with "no hard cap"
- [x] HEARTBEAT.md:94 — "Skip if repo has 3 PRs today" removed
- [x] HEARTBEAT.md:66 — "Max 2 follow-ups per cycle" removed
- [x] openclaw.json heartbeat prompt — limits replaced with DEDUP section
- [x] oss-discover/SKILL.md:29 — daily PR count check removed
- [x] oss-discover/SKILL.md:40 — "Max 3 NEW repos" → "no hard cap"
- [x] oss-discover/SKILL.md:291 — triage-only reference removed
- [x] subagent-result-schema.md:131 — `daily_limit_reached` category removed
- [x] cron-jobs.json:10 — "Max 3 NEW repos per day" removed
- [x] safety-checker/SKILL.md — anti-spam limits replaced with dedup check
- [x] oss-submit/SKILL.md — recently-closed check removed
- [x] subagent-implementation.md — recently-closed check removed

**GAP REMAINING: `~/.openclaw/openclaw.json` (live config) still needs update.** This is the config the agent reads.

## Task #4 (Never Close PRs) — VERIFIED COMPLETE

All close-to-rework changes made correctly:
- [x] HEARTBEAT.md:58 — `fix_rejected`: close → REWORK with different approach
- [x] HEARTBEAT.md:60 — `stale`: 7 days → 14 days, close → polite bump comment
- [x] HEARTBEAT.md:63 — `close_withdraw`: category eliminated entirely
- [x] AGENTS.md:143 — "close PR" → "adjust scope or leave open"
- [x] AGENTS.md: Added rework/retry principle (回炉重造)
- [x] subagent-followup.md:50 — `closed_scope_concern` → scope_adjusted + leave open
- [x] subagent-followup.md:52-54 — `fix_rejected` close → REWORK with force-push
- [x] oss-followup/SKILL.md — stale: close → bump comment, fix_rejected: close → rework
- [x] oss-followup/SKILL.md — `close_withdraw` → `scope_rejected` with adjust-scope logic
- [x] oss-pr-review-handler/SKILL.md — scope concern: close → adjust or leave open
- [x] oss-pr-review-handler/SKILL.md — rejection: close → REWORK
- [x] oss-submit/SKILL.md — "close PR" → "adjust scope or leave open"
- [x] subagent-result-schema.md — Updated followup_outcome enum with new states

Categories that correctly STAY as close:
- [x] `already_fixed_upstream` — still closes (correct)
- [x] `invalid_contribution` — still closes (correct)
- [x] `low_star_repo` — still closes (correct)
- [x] CLA orgs — still closes (correct)
- [x] Self-fork — still closes (correct)
- [x] True duplicates — still closes (correct)

## BerriAI CLA Addition — VERIFIED

- [x] AGENTS.md:62 — Added "BerriAI — CLA-assistant (litellm)"
- [x] HEARTBEAT.md batch cleanup — Added BerriAI to CLA org list
- [x] cron-jobs.json — Added BerriAI to CLA list in work-queue-refill payload

**GAP: Need to also add BerriAI to:**
- [ ] `scripts/repo-health-check.sh:280` (CLA_ORGS variable) — for faster detection
- [ ] `workspace/skills/oss-discover/SKILL.md:206` — CLA org list
- [ ] `workspace/skills/oss-triage/SKILL.md` — if CLA orgs are listed there
- [ ] `workspace/templates/subagent-implementation.md:56-58` — CLA org hard reject
- [ ] `workspace/templates/subagent-scout.md:102` — CLA org list
- [ ] Both heartbeat prompts (config/openclaw.json + ~/.openclaw/openclaw.json)

## Scout System (Task #5) — NEW ADDITION

Builder added step "0.5. Scout Management" to HEARTBEAT.md. Review:

### Concerns:
1. **"Scout does NOT count toward the 5 implementation/follow-up slots"** — this means we could have 6 concurrent agents (5 impl/followup + 1 scout). Is OpenClaw's `maxConcurrent: 5` a hard platform limit or a config option? If hard limit, the scout DOES consume a slot. Need to verify with DeepWiki or researcher.

2. **"runTimeoutSeconds: 0"** — this means the scout runs indefinitely. If the scout stalls or enters a loop, it will never be killed. Should have a timeout (e.g., 3600 seconds = 1 hour) with respawn logic.

3. **Scout template uses `sessions_spawn` but the scout is described as "always-on"**. The template says "reply: ANNOUNCE_SKIP" at the end, which means it terminates after one search cycle. For always-on behavior, either:
   - The scout template needs a loop (search → sleep → search), OR
   - The orchestrator needs to respawn it every cycle (which is what step 0.5 does)

   The current design (respawn every cycle) is fine but the "always-on" framing is misleading.

## Cross-File Consistency Check

### New followup_outcome values
Old: `changes_pushed | question_answered | closed_scope_concern | closed_rejected | disengaged_max_rounds | fix_rejected | already_fixed_upstream`

New: `changes_pushed | question_answered | scope_adjusted | scope_rejected_terminal | rework_in_progress | fix_rejected_terminal | disengaged_max_rounds | already_fixed_upstream`

Need to verify these new values are handled in:
- [ ] HEARTBEAT.md step 6b (followup result processing) — currently only handles `changes_pushed`/`question_answered`, `closed_*`/`disengaged_*`, `failure`. The new `rework_in_progress` and `scope_adjusted` need routing.
- [ ] Dashboard ingestion (if it parses followup_outcome)

### HEARTBEAT.md step 6b consistency
Current text (line 138-142):
```
- `changes_pushed`/`question_answered` -> `follow_up_round_N`
- `closed_*`/`disengaged_*` -> terminal
- `failure` -> `pending_review` (retry next cycle)
- Round 3: `disengaged`, never spawn again. Delete result file.
```
This needs updating for the new outcomes:
- `rework_in_progress` → should NOT be terminal, should be `follow_up_round_N` (continue iterating)
- `scope_adjusted` → should be `follow_up_round_N`
- `scope_rejected_terminal` → terminal
- `fix_rejected_terminal` → terminal

## Additional Issues Found

### Issue 1: Chinese text in AGENTS.md
Line added: `- **回炉重造 (rework/retry)**: Address feedback, iterate, never give up...`
The Chinese characters may cause issues with content filters or non-UTF8 systems. The parenthetical English translation makes the Chinese redundant. Suggest removing the Chinese characters.

### Issue 2: oss-submit/SKILL.md still references "5x-duplicate-on-instructor"
The comment "This prevents the 5x-duplicate-on-instructor and 3x-duplicate-on-taskcoach incidents" references the duplicate submissions I found. Good that it's documented, but this is now in an operational file — it reads as a comment/note rather than an instruction. Could be trimmed.

### Issue 3: subagent-implementation.md step 1a STILL has a basic star check
The template still has a quick star check at step 1a, but it's only a defense-in-depth check that happens AFTER cloning. For V9, the health check should run BEFORE cloning to save time and API calls. See Task #13.

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Task #3 (rate limits) | **COMPLETE** (except live config) | 1 gap: ~/.openclaw/openclaw.json |
| Task #4 (never close) | **COMPLETE** | All 6 change points + extras |
| BerriAI CLA | **PARTIAL** | Added in 3 files, missing from 6+ files |
| Scout system | **IN PROGRESS** | 3 concerns flagged |
| Cross-file consistency | **NEEDS UPDATE** | HEARTBEAT.md step 6b needs new outcome routing |
