# V9 Final Pre-Launch Critique

**Date**: 2026-03-17
**Reviewer**: critique agent
**Scope**: Post-builder-completion audit of all V9 changes

---

## Overall Status: 97% READY — 2 blocking issues remain

All major tasks (#3, #4, #5, #6, #11, #12, #13) are marked complete. Step 6b outcome routing is now correct. Most gaps from my earlier reviews have been addressed.

---

## BLOCKING ISSUE 1: Scout consumes a maxConcurrent slot (HEARTBEAT.md line 32)

**Current text** (line 32):
> Scout does NOT count toward the 5 implementation/follow-up slots — it's a dedicated discovery agent.

**DeepWiki confirms this is WRONG.** `maxConcurrent` is a **hard platform limit** applied at the gateway level to ALL subagent sessions. There is no mechanism to exclude specific sessions from the count. If `maxConcurrent` is 5, the scout takes 1 slot, leaving only 4 for implementation/follow-up.

**Impact**: The HEARTBEAT loop says "keep all 5 sub-agent slots filled" (line 7). If the scout takes 1 slot, the orchestrator will try to spawn 5 implementation/follow-up agents + 1 scout = 6 total, exceeding `maxConcurrent: 5`. The 6th `sessions_spawn` call will be **rejected by the gateway**.

**Fix options**:
1. **Increase `maxConcurrent` to 6** (5 impl/followup + 1 scout) — simplest
2. **Change HEARTBEAT to say "4 impl/followup slots + 1 scout slot"** — more accurate but reduces throughput
3. **Don't use an always-on scout; run scout as a periodic task** — avoids consuming a permanent slot

**Recommendation**: Option 1. Set `maxConcurrent: 6` in both config files and update HEARTBEAT.md line 32 to say "Scout uses 1 of 6 total subagent slots. Keep the remaining 5 filled with implementation/follow-up work."

## BLOCKING ISSUE 2: `runTimeoutSeconds: 0` for scout (HEARTBEAT.md line 28)

**Current text**:
```
sessions_spawn(task: ..., runTimeoutSeconds: 0)
```

A timeout of 0 means the scout runs **indefinitely**. If the scout stalls, enters an infinite loop, or hits an error state, it will never be killed — permanently consuming 1 of our subagent slots with no useful output.

**Fix**: Set `runTimeoutSeconds: 3600` (1 hour). The heartbeat respawns the scout every cycle anyway (step 0.5 checks for "Scout dead or missing"), so a 1-hour timeout is more than enough. If the scout dies, the next heartbeat cycle will respawn it.

---

## NON-BLOCKING ISSUES (minor, fix after launch)

### Issue 3: BerriAI missing from 2 inline CLA org lists
- **oss-discover/SKILL.md:205** — CLA org list says `(deepset-ai, iterative, Aider-AI, milvus-io, apache, microsoft, google, meta-llama)` — missing BerriAI
- **HEARTBEAT.md:122** (step 4b triage) — Same list, missing BerriAI

BerriAI IS correctly in: HEARTBEAT.md:84 (batch cleanup), AGENTS.md, repo-health-check.sh, subagent-implementation.md, subagent-scout.md, cron-jobs.json. Low impact since repo-health-check.sh catches it anyway.

### Issue 4: Chinese text in AGENTS.md:147
`回炉重造 (rework/retry)` — The Chinese characters are redundant given the English translation in parentheses. Minor risk of content filter issues with some LLM providers. Low priority.

### Issue 5: Scout template framing as "always-on"
The HEARTBEAT says the scout "runs continuously" (line 30) but step 0.5 checks for it every cycle and respawns if dead. This is a respawn-on-death model, not truly always-on. The framing is slightly misleading but functionally fine since the heartbeat loop handles it.

---

## VERIFIED COMPLETE (no remaining gaps)

| Task | Status |
|------|--------|
| #3 Rate limits removed | COMPLETE — all files updated including live config |
| #4 Never close PRs | COMPLETE — rework policy in all 12+ files |
| #5 Scout system | MOSTLY COMPLETE — 2 blocking issues above |
| #6 Prompt optimization | COMPLETE |
| #11 Dashboard health-check | COMPLETE |
| #12 Dedup fix | COMPLETE — lock files + pre-push + post-PR layers |
| #13 Health check mandatory | COMPLETE — gate in subagent-implementation.md step 1a |
| BerriAI CLA addition | COMPLETE in major files (repo-health-check.sh, AGENTS.md, HEARTBEAT.md, cron-jobs.json, subagent-scout.md, subagent-implementation.md) |
| Step 6b outcome routing | COMPLETE — correct routing for all new outcome states |

---

## Launch Readiness Checklist

- [x] Rate limits removed from all prompt files
- [x] Never-close policy implemented across all skills and templates
- [x] Dedup layers (lock file + pre-push + post-PR + heartbeat sweep) in place
- [x] repo-health-check.sh mandatory at subagent level (not just orchestrator)
- [x] BerriAI in CLA org lists (all critical files)
- [x] followup_outcome enum updated with new states
- [x] Step 6b routes new outcomes correctly
- [x] Dashboard health-check endpoint updated for V9
- [x] Live config (~/.openclaw/openclaw.json) synced with config/openclaw.json
- [x] **maxConcurrent increased to 6** — both config files updated, HEARTBEAT.md:32 corrected (FIXED by builder)
- [x] **Scout timeout set to 3600** — HEARTBEAT.md:28 updated (FIXED by builder)
- [ ] HEARTBEAT.md:137 still says `maxConcurrent: 5` (minor text inconsistency)
- [ ] BerriAI missing from HEARTBEAT.md:122 and oss-discover/SKILL.md:205 CLA lists (script catches it)
- [ ] AI self-identification policy (SOUL.md:27) — strategic decision needed (see monitor report)
- [ ] Cron jobs `daily-discovery` and `weekly-retrospective` failing — need `delivery.channel` config
