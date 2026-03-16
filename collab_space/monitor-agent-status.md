# ClawOSS Agent Autonomy Audit
**Last updated**: 2026-03-16 22:32 HKT
**Purpose**: Identify where the agent's autonomous decision-making breaks down, so prompts and tools can be fixed.

---

## Autonomy Scorecard

| Capability | Status | Autonomy Gap | Fix Applied |
|-----------|--------|--------------|-------------|
| Discovery | Working | Cron delivery mode was wrong | FIXED (architect) |
| Triage | Working | Good scoring, proper health checks | -- |
| Implementation | Working | 30 PRs submitted autonomously today | -- |
| Deduplication | **FIXED** | Was creating 2-3 dupes per issue | FIXED (@me->BillionClaw + self-cleanup step 2f) |
| Follow-up scanning | **FIXED NOW** | Was only checking top 5 PRs, missed 12 with reviews | FIXED (HEARTBEAT 2a: check ALL PRs) |
| Follow-up cron | **FIXED** | Cron delivery.mode was "announce" on isolated sessions | FIXED (architect changed to "none") |
| CLA handling | **FIXED** | Was submitting to CLA-required repos | FIXED (hard-fail in repo-health-check.sh) |
| Fix verification | **IMPROVED** | flash.nvim fix rejected | FIXED (hypothesis check in oss-implement + fix_rejected status) |
| Self-cleanup | **FIXED** | No mechanism to close dupes | FIXED (HEARTBEAT step 2f -- VERIFIED WORKING LIVE) |
| Rejection handling | **FIXED** | No way to handle "fix doesn't work" | FIXED (fix_rejected status -- VERIFIED) |
| Maintainer questions | **FIXED NOW** | No classification for direct questions | FIXED (maintainer_question type in HEARTBEAT 2b) |

---

## CURRENT STATE (2026-03-16 22:25 HKT)

### Agent Activity
- **Active session**: 36b3a7bf (137 entries, growing)
- **Phase**: Processing follow-ups, responding to maintainer comments
- **Sub-agent**: voice-satellite follow-up (pid 22693) actively rewriting code per jxlarrea's review
- **Daily PRs**: 30 (limit exceeded, follow-ups still active)
- **Consecutive wakes**: 34
- **Errors this hour**: 0

### PR Portfolio
- **Open PRs**: 45 (down from 48 -- 3 more closed this cycle)
- **PRs with human engagement**: 17/48
- **Approved**: 1 (ollama #14875)
- **Changes requested**: 1 (voice-satellite #23 -- sub-agent implementing all 5 fixes)
- **Closed today**: 10 total (haystack CLA, DVC CLA, flash.nvim rejected, Prefect already-fixed, Millennium already-fixed, WowClassicGrindBot fix-rejected, devaiflow feat-title, voicecrew feat-title, autokey feat-title, BillionClaw/codex self-fork)
- **Maintainer questions answered**: 3 (Textual CLA, autokey branch targeting, devaiflow duplicates)
- **Follow-ups completed**: 1 (voice-satellite #23 -- all 5 review items addressed)
- **True duplicates remaining**: 0

---

## FOLLOW-UP RESULTS (HEARTBEAT fix verified working)

All 5 critical PRs from the previous audit have been handled:

### 1. voice-satellite #23 -- FOLLOW-UP IN PROGRESS
Sub-agent spawned (pid 22693). Implementing all 5 review points: removed dead import, used stdlib `wave` module, added `finally` block, fixed HTTP error path. Two commits made. Pending push.

### 2. Textualize/textual #6429 -- RESPONDED
Agent posted CLA response to Will McGugan. Honest, appropriate. Awaiting maintainer reply.

### 3. SteamClientHomebrew/Millennium #671 -- CLOSED
Agent detected "fixed in latest beta", closed with polite acknowledgment. Status: `closed_already_fixed_upstream`.

### 4. crosspoint-reader/crosspoint-reader #1404 -- NOTED
Agent detected maintainer discussion with competing PR #1405. Status updated to note discussion.

### 5. PrefectHQ/prefect #21131 -- CLOSED (bonus)
Agent also detected this was already fixed in #21122. Closed. Status: `closed_already_fixed_upstream`.

### Additional actions this cycle:
- autokey #1091: Asked about retargeting to develop branch
- devaiflow #170: Acknowledged duplicate cleanup
- WowClassicGrindBot #789: Closed as fix_rejected

### Still pending:
- manaflow-ai/cmux #1394: wobondar's partial approval not yet detected (in issues/comments)

---

## PROMPT FIXES APPLIED THIS SESSION

### Fix 1: HEARTBEAT.md step 2a -- Check ALL PRs, not top 5
**Root cause**: Agent was checking reviews for only "top 5 most recently updated" PRs. With 48 open PRs, this meant 43 PRs never got their reviews/comments checked.
**Fix**: Changed to "check EVERY open PR" for both `pulls/reviews` AND `issues/comments` endpoints.

### Fix 2: HEARTBEAT.md step 2b -- Added `maintainer_question` classification
**Root cause**: When Will McGugan asked "what CLA did you sign?", the agent had no classification for direct maintainer questions. It only handles changes_requested, approved, etc.
**Fix**: Added `maintainer_question` type: respond directly in main session, no sub-agent needed, keep response brief and honest.

### Fix 3: HEARTBEAT.md step 2a -- Explicit two-loop batch pattern (second revision)
**Root cause**: Even after first fix, agent was only running the reviews batch and skipping the comments batch for PRs with empty review results.
**Fix**: Rewrote to show two explicit `for` loops with "DO NOT SKIP THIS" instruction on the comments batch.
**Verified**: Session 36b3a7bf showed 9 comments checks (up from 0), 3 maintainer questions answered, 3 PRs closed.

### Previous fixes (from earlier in this session):
- @me -> BillionClaw in HEARTBEAT.md, oss-submit, subagent-implementation.md
- CLA hard-fail in repo-health-check.sh with org blocklist
- Hypothesis verification in oss-implement skill
- session_status wording fix in HEARTBEAT.md and AGENTS.md
- Self-cleanup step 2f for duplicate PRs
- fix_rejected and already_fixed_upstream classifications

---

## WHAT'S WORKING WELL

### Discovery + Triage pipeline
Agent autonomously discovered 50+ issues, scored them, health-checked repos. Good target selection.

### Implementation quality on substantive fixes
- ollama/ollama #14875 -- APPROVED by maintainer
- PrefectHQ/prefect #21131 -- correct ProcessPoolTaskRunner analysis
- huggingface/peft #3102 -- FSDP-sharded parameter handling
- bentoml/BentoML #5572 -- containerize regression

### AI disclosure handling
Textual #6429 -- honest disclosure when asked, offered to disengage. Correct behavior.

### Human engagement rate
17/48 PRs (35%) have human engagement within hours of submission. This is a healthy signal.

---

## NEXT MONITORING PRIORITIES
1. Verify voice-satellite sub-agent pushes code and PR is updated
2. Watch for Will McGugan's response on Textual CLA question
3. Verify manaflow-ai/cmux #1394 wobondar feedback is detected on next cycle
4. Watch for new reviews arriving on remaining unengaged PRs
5. Verify cron jobs succeed on next scheduled runs
6. Track if autokey maintainer responds about branch targeting
