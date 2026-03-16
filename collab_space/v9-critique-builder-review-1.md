# Builder Review #1 — Rate Limit Removal (Task #3 in progress)

**Date**: 2026-03-17
**Reviewer**: critique agent
**Status**: Changes incomplete — gaps found

---

## What Builder Changed (correct)

1. **config/openclaw.json** heartbeat prompt: Removed "Max 10 PRs/day", "Max 3 NEW repos per day", replaced LIMITS section with DEDUP section. Good.
2. **workspace/AGENTS.md:25**: Removed "Max 10 PRs/day, max 3 per repo/day, 30-min gap". Good.
3. **workspace/AGENTS.md:97**: Removed "Max 3 NEW repos per day" line. Good.
4. **workspace/HEARTBEAT.md:81**: Removed entire "3-ZERO. DAILY PR LIMIT" section. Good.
5. **workspace/HEARTBEAT.md:85**: Changed trust sort to "no hard cap on new repos". Good.
6. **workspace/HEARTBEAT.md:94**: Removed "Skip if repo has 3 PRs today". Good.
7. **workspace/HEARTBEAT.md:66**: Removed "Max 2 follow-ups per cycle" limit. Good.
8. **workspace/skills/oss-discover/SKILL.md:29**: Removed daily PR count check. Good.
9. **workspace/skills/oss-discover/SKILL.md:40**: Changed to "no hard cap". Good.
10. **workspace/skills/oss-discover/SKILL.md:291**: Removed triage-only reference. Good.

## GAPS — Files Not Updated Yet

### GAP 1: `~/.openclaw/openclaw.json` (LIVE CONFIG) — NOT UPDATED
The builder updated `config/openclaw.json` but the **live config at `~/.openclaw/openclaw.json`** still has the old heartbeat prompt with "Max 10 PRs/day" and "Max 3 NEW repos per day". This is the config the agent actually reads.

**Per the dual-config-sync memory: ALWAYS update both files.**

### GAP 2: `workspace/templates/subagent-result-schema.md:131` — NOT UPDATED
Still contains: `| daily_limit_reached | Hit daily PR limit (10/day) or per-repo limit (3/day) |`
This failure reason category should be removed since there are no more daily limits.

### GAP 3: `config/cron-jobs.json:10` — NOT UPDATED
The `work-queue-refill` cron payload still contains: "Max 3 NEW repos per day"
This text is sent to the isolated cron agent and will still impose the old limit.

### GAP 4: BerriAI not added to CLA lists
None of the CLA org lists have been updated to include `BerriAI`. This was flagged in the audit as a new discovery (litellm uses CLA-assistant, we have 3 blocked PRs).

## Quality Check on Builder's Edits

### ISSUE: HEARTBEAT.md step 2b lost "EXECUTE IMMEDIATELY" instruction
In the diff, line 52 changed from:
```
**2b.** Read pr-followup-state.md. **SPAWNED_PENDING GUARD:** skip if `spawned_pending`. Classify each PR and **EXECUTE the action IMMEDIATELY** — do NOT just classify and move on. The action (close, merge, comment) MUST happen in the same step as classification. Update pr-followup-state.md AFTER the action succeeds, not before:
```
to:
```
**2b.** Read pr-followup-state.md. **SPAWNED_PENDING GUARD:** skip if `spawned_pending`. Classify each PR:
```

Wait — actually reading the diff more carefully, the builder RESTORED the "EXECUTE IMMEDIATELY" text. The diff shows the old version was truncated and the new version has it. This is correct.

Actually, looking at the diff again: the `-` line shows the SHORTER text (without EXECUTE IMMEDIATELY), and the `+` line adds it back. So the builder actually ADDED back the instruction that was missing. Good catch by the builder.

### VERIFIED: heartbeat prompt in openclaw.json
The new prompt correctly replaces the LIMITS section with a DEDUP section. The new text is:
"DEDUP: Max 1 active PR per repo (check 'gh search prs --author BillionClaw --repo OWNER/REPO --state open' — NEVER use @me). Follow-ups get priority. No daily caps — ship as many quality PRs as possible."
This is correct and well-phrased.

## Dashboard Change Review

The builder added a CLA honesty detection to `dashboard/app/api/metrics/action-items/route.ts`. This is a good addition — it detects PRs flagged by CLA bots and surfaces them as P0 action items.

One minor concern: the regex `/cla.*not.*signed|sign.*cla|contributor.*license/i` might have false positives on legitimate CLA discussions. But given the use case (flagging for human review, not auto-closing), this is acceptable.

## Recommendations

1. **CRITICAL**: Update `~/.openclaw/openclaw.json` to match `config/openclaw.json`
2. Remove `daily_limit_reached` from `workspace/templates/subagent-result-schema.md`
3. Update `config/cron-jobs.json` work-queue-refill payload
4. Add `BerriAI` to CLA org lists (all files from audit)
