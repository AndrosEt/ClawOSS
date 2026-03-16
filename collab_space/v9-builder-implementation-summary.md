# V9 Builder Implementation Summary

**Date**: 2026-03-17
**Author**: builder agent
**Status**: ALL TASKS COMPLETE — deployed, waiting for Kimi API quota refresh

---

## Tasks Completed (7 total)

### Task 3: Remove ALL Rate Limits
**Files changed**: 11
- HEARTBEAT.md: removed step 3-ZERO daily PR limit, "Max 3 new repos/day", "Max 2 follow-ups/cycle"
- AGENTS.md: removed "Max 10 PRs/day, max 3 per repo/day, 30-min gap"
- config/openclaw.json + ~/.openclaw/openclaw.json: heartbeat prompt updated ("No daily caps")
- wake-state.md: removed prs_today, new_repos_today fields
- oss-discover, oss-triage, safety-checker, subagent-result-schema, cron-jobs.json: all rate-limit references removed

### Task 4: Never Close PRs (Rework Policy)
**Files changed**: 12
- HEARTBEAT.md step 2b: fix_rejected -> REWORK, stale -> 14-day bump (was 7-day close)
- HEARTBEAT.md step 2f: batch cleanup kept for valid closes only (low-star, feat:, CLA, self-fork, dupes)
- HEARTBEAT.md step 6a: fix_rejected_terminal vs single fix_rejected distinction
- AGENTS.md: "out of scope" -> adjust or leave open, added rework philosophy
- subagent-followup.md: scope -> adjust, rejection -> rework with force-push, round 3 -> leave open
- oss-followup, oss-pr-review-handler, oss-submit: all close actions -> rework/leave open
- subagent-result-schema.md: new outcomes (scope_adjusted, scope_rejected_terminal, rework_in_progress, fix_rejected_terminal)

### Task 5: Always-On Scout Subagent
**Files changed**: 5
- HEARTBEAT.md step 0.5: scout management with sessions_list check, respawn on death
- subagent-scout.md: complete rewrite for persistent loop (search -> analyze -> score -> stage -> repeat)
- config/openclaw.json + ~/.openclaw/openclaw.json: maxConcurrent=6, archiveAfterMinutes=1440, maxChildrenPerAgent=10, maxSpawnDepth=2

### Task 11: Dashboard Health-Check V9
**Files changed**: 2
- health-check/route.ts: removed "SLOW DOWN" directive, added "REWORK NEEDED" directive, added closed/reworkRate stats
- action-items/route.ts: replaced spam language with dedup, added fix-rework-rate P1 action item

### Task 12: Fix Broken Dedup (Lock Files)
**Files changed**: 3
- HEARTBEAT.md step 3b: lock file write before spawn, lock file check in dedup gate
- HEARTBEAT.md step 1: stale lock cleanup (>1 hour)
- subagent-implementation.md: lock file deletion on completion, post-PR-creation dedup check

### Task 13: Mandatory Health Check in Subagents
**Files changed**: 2
- subagent-implementation.md step 1a: full repo-health-check.sh invocation (was stars-only check)
- subagent-followup.md step 1b: health gate before clone

### Task 15: restart.sh V9
**Files changed**: 1
- Preflight checks (python3, gh, jq, openclaw)
- gh auth fix (skip if already logged in)
- V9 wake state (no rate-limit fields)
- mkdir memory/locks/ and memory/subagent-inputs/
- Stale lock cleanup on restart
- V9 wake message (scout + rework + no rate limits)
- set -e safety (|| true on all optional commands)

---

## Additional Fixes (from critique/research findings)
- BerriAI added to CLA org list in ALL 8+ files
- oss-pr-review-handler outcome names updated to V9 (scope_adjusted, fix_rejected_terminal, etc.)
- oss-pr-review-handler constraints updated (allow force-push for rework, never close ourselves)
- repo-health-check.sh Python except clause fix
- All `closed_scope_concern`, `closed_rejected`, `close_withdraw` references eliminated

---

## Config Sync Verification
Both config/openclaw.json and ~/.openclaw/openclaw.json have identical:
- maxConcurrent: 6
- archiveAfterMinutes: 1440
- maxChildrenPerAgent: 10
- maxSpawnDepth: 2
- BerriAI in CLA list
- "No daily caps" in heartbeat prompt
- SUPERSESSION CHECK in heartbeat prompt

## File Size Verification
- HEARTBEAT.md: 14977 chars (limit 20000)
- AGENTS.md: 10073 chars (limit 20000)
- Both well within limits.
