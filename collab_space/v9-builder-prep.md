# V9 Builder Preparation Summary

## Status
All files read and analyzed. Tasks 3, 4, 5 are blocked by tasks 1 (critique) and 2 (researcher). Ready to implement as soon as unblocked.

## Task 3: Remove ALL Rate Limits

### workspace/HEARTBEAT.md
- **Line 80-81 (Step 3-ZERO)**: DELETE entire "DAILY PR LIMIT" section (`prs_today >= 10` gate)
- **Line 85 (Step 3a)**: REMOVE "Max 3 new repos per day — if new_repos_today >= 3, only pick from trusted repos" constraint
- **Line 66 (Step 2d)**: REMOVE "Max 2 follow-ups per cycle" cap

### workspace/AGENTS.md
- **Line 25**: REMOVE "Max 10 PRs/day, max 3 per repo/day, 30-min gap between same-repo PRs"
- **Line 97**: REMOVE "Max 3 NEW repos per day" from trust-building section
- **Line 102**: REMOVE "max 3/day" reference from work discovery priority order

### config/openclaw.json (heartbeat prompt, line 52)
- REMOVE "Max 10 PRs/day" from LIMITS section
- REMOVE "Max 1 active PR per repo" — keep dedup check but remove as a stated limit
- REMOVE "Max 3 NEW repos per day" from TRUST-BUILDING section
- KEEP: "Max 5 concurrent sub-agents" (resource constraint), "Max 3 follow-up rounds" (quality)

### workspace/skills/oss-discover/SKILL.md
- **Line 29**: REMOVE "daily PR count — if at limit (10), triage-only mode"
- **Line 291**: REMOVE "At daily limit (10 PRs)? Triage-only."
- **Line 41**: REMOVE "Max 3 NEW repos per day" from trust-building section

### workspace/skills/oss-triage/SKILL.md
- **Line 73-74 (Step 0d)**: Keep dedup check but remove "max 1 active PR per repo" framing — it's a dedup check, not a rate limit

### wake-state.md
- REMOVE `prs_today` tracking field
- REMOVE `new_repos_today` tracking field
- KEEP: `consecutive_wakes`, `errors_this_hour`, `last_wake`

## Task 4: Never Close PRs — Rework Instead (回炉重造)

### workspace/HEARTBEAT.md
- **Step 2b (lines 52-63)**: Replace ALL close actions:
  - `fix_rejected` -> spawn rework subagent with different approach, force-push to same branch
  - `already_fixed_upstream` -> leave open, add acknowledging comment, let maintainer close
  - `stale` -> add polite bump comment instead of closing
  - `invalid_contribution` -> leave open (should not happen with better triage)
  - `low_star_repo` -> leave open (already submitted, closing looks bad)
  - `close_withdraw` -> leave open, add polite note, let maintainer decide
- **Step 2f (lines 69-76)**: Replace batch cleanup closures with rework queue:
  - Low-star: leave open instead of closing
  - feat: title: leave open, add comment explaining scope
  - CLA org: leave open (can't do anything, but closing looks bad)
  - Self-fork: still close (these are errors)
  - True duplicates: still close older ones (keep newest)

### workspace/AGENTS.md
- **Lines 137-146 (PR Follow-up Lifecycle / Reviewer Communication)**: Update to reflect never-close policy
  - "Not appropriate" / "out of scope": leave open, politely note, let maintainer close
  - After round 3: leave open for maintainer, never close ourselves

### workspace/templates/subagent-followup.md
- **Line 50 (step 10)**: Replace close with "leave open, add note"
- **Line 52-53 (step 10b)**: fix_rejected -> spawn rework instead of close
- **Line 57-58 (step 10c)**: already_fixed_upstream -> leave open, acknowledge
- **Line 65 (step 11)**: Round 3 -> leave open (already correct), make explicit "NEVER close"

### workspace/skills/oss-followup/SKILL.md
- **Lines 89-96 (stale)**: Replace close action with bump comment
- **Lines 98-106 (fix_rejected)**: Replace close with rework spawn
- **Lines 108-115 (already_fixed_upstream)**: Replace close with acknowledge comment
- **Lines 117-125 (invalid_contribution)**: Replace close with leave-open note
- **Lines 127-134 (low_star_repo)**: Replace close with leave open
- **Lines 136-143 (close_withdraw)**: Replace close with polite note, leave open

## Task 5: Always-On Scout Subagent System

### workspace/HEARTBEAT.md
- Add new **Step 0.5: Scout Management** between health checks (step 0) and stall recovery (step 1):
  - Check if scout subagent is running (via sessions_list)
  - If not running, spawn scout using templates/subagent-scout.md
  - Scout uses 1 of the subagent slots (or expand pool to 6: 1 scout + 5 impl/followup)
  - Read scout reports from memory/scout-report-*.md and merge into work-queue-staging.md

### workspace/templates/subagent-scout.md (major enhancement)
- Make scout persistent: it should run continuously, not just one search cycle
  - Loop: search -> score -> write staging -> sleep 5min -> repeat
  - Add codebase DIRECTION/INTENT analysis before approving issues:
    - Read recent commits, merged PRs, open discussions
    - Understand maintainer priorities and project roadmap
    - Only greenlight issues that align with where the codebase is heading
  - Write to memory/work-queue-staging.md (not direct to work-queue.md)
  - Include health gate integration
  - Add self-monitoring: if context > 70%, write state and exit (orchestrator re-spawns)

### config/openclaw.json
- Consider expanding maxConcurrent from 5 to 6 to accommodate dedicated scout slot
- Or keep at 5 and let scout share the pool (simpler)

## Full File Change Manifest (consolidated)

### Task 3 — Files to edit (rate limits):
1. **workspace/HEARTBEAT.md**: step 3-ZERO (delete), step 3a (remove new_repos cap), step 2d (remove 2 follow-up cap), step 3b line 94 (remove "3 PRs today" per-repo cap)
2. **workspace/AGENTS.md**: line 25 (10/day, 3/repo/day, 30-min gap), line 97 (3 NEW repos/day), line 102 (max 3/day)
3. **config/openclaw.json**: heartbeat prompt LIMITS section (10/day, 1 active/repo, 3 NEW repos/day)
4. **~/.openclaw/openclaw.json**: MUST sync with config/openclaw.json
5. **workspace/skills/oss-discover/SKILL.md**: lines 29, 40, 291 (daily PR limit, new repos cap, triage-only)
6. **workspace/skills/oss-triage/SKILL.md**: line 73-74 reframe (keep dedup, remove "max 1" framing)
7. **workspace/skills/safety-checker/SKILL.md**: lines 57-61 (anti-spam limits: 10/day, 3/repo/day, 30-min gap)
8. **config/cron-jobs.json**: line 10 (remove "Max 3 NEW repos per day" from cron message)
9. **workspace/templates/subagent-result-schema.md**: line 131 (remove `daily_limit_reached` failure reason)
10. **workspace/skills/oss-submit/SKILL.md**: lines 31-38 (remove recently-closed 7-day cooldown)
11. **wake-state.md**: remove prs_today, new_repos_today fields

### Task 4 — Files to edit (never close PRs):
1. **workspace/HEARTBEAT.md**: step 2b (6 close actions -> rework/acknowledge/bump), step 2f (batch cleanup closures -> leave open or rework)
2. **workspace/AGENTS.md**: line 143 (close PR -> leave open)
3. **workspace/templates/subagent-followup.md**: steps 10, 10b, 10c, CLA close (-> rework/acknowledge/leave open)
4. **workspace/skills/oss-followup/SKILL.md**: 7 close action sections (stale, fix_rejected, already_fixed, invalid, low_star, close_withdraw, CLA)
5. **workspace/skills/oss-pr-review-handler/SKILL.md**: lines 130-143 (scope concern, rejection -> leave open), line 203 (remove "never close without comment" since we never close)
6. **workspace/skills/oss-submit/SKILL.md**: line 96 ("close PR" -> "leave open")
7. **workspace/templates/subagent-implementation.md**: lines 255-256 (remove recently-closed abort since we never close)

### Task 5 — Files to edit (scout system):
1. **workspace/HEARTBEAT.md**: add Step 0.5 (scout management)
2. **workspace/templates/subagent-scout.md**: major rewrite for persistent loop + direction analysis
3. **config/openclaw.json**: possibly expand maxConcurrent to 6

## KEEP (not changing)
- Max 5 concurrent sub-agents (resource constraint, not artificial limit)
- Max 3 follow-up rounds per PR (quality constraint)
- All safety rules (no force-push, no secrets, etc.)
- All supersession checks
- All CLA org blocks
- All health gates
- All dedup checks (these prevent duplicate work, not rate limiting)

## Additional Files Found (from deep grep)

### Task 3 — Additional rate limit locations:
- **config/cron-jobs.json** (line 10): "Max 3 NEW repos per day" in work-queue-refill cron message
- **workspace/skills/safety-checker/SKILL.md** (lines 57-61): "Anti-Spam Limits" section with `< 10 PRs today`, `< 3 PRs this repo`, `> 30 min gap` — ALL need removal
- **workspace/templates/subagent-result-schema.md** (line 131): `daily_limit_reached` failure reason — remove from taxonomy
- **workspace/skills/oss-submit/SKILL.md** (lines 31-38): Recently-closed-PR 7-day cooldown check — this is a rate limit disguised as dedup
- **HEARTBEAT.md line 94**: "Skip if repo has 3 PRs today" — per-repo daily cap

### Task 4 — Additional close locations:
- **workspace/skills/oss-pr-review-handler/SKILL.md** (lines 130-143): close actions for scope concern and rejection
- **workspace/skills/oss-submit/SKILL.md** (line 96): "close PR, learn from it"
- **HEARTBEAT.md step 2b lines 60-63**: `stale`, `invalid_contribution`, `low_star_repo`, `close_withdraw` close actions
- **HEARTBEAT.md step 2f lines 69-76**: batch cleanup closures
- **subagent-implementation.md line 255-256**: recently-closed PR abort check (remove since we never close)

## Character Budget Awareness
- HEARTBEAT.md currently: need to measure, must stay < 20000 chars
- AGENTS.md currently: need to measure, must stay < 20000 chars
- Removing rate limits (task 3) will free up chars
- Adding scout management (task 5) will add chars
- Net should be manageable

## Waiting For
- **Task 1 (critique)**: Bug reports, gaps, inconsistencies to fix alongside these changes
- **Task 2 (researcher)**: OpenClaw session persistence details for scout design, merge rate best practices
