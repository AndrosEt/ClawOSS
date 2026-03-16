# V10 Critique: Three Systemic Design Flaws

**Author**: critique agent
**Date**: 2026-03-17
**Source**: monitor findings + independent verification

---

## Flaw 1: Scripts PATH Bug (CRITICAL — ALL gate checks silently skipped)

### Root Cause
The agent's workspace (working directory) is `/Users/kevinlin/clawoss/workspace` (confirmed in deployed `~/.openclaw/openclaw.json` line 57). HEARTBEAT.md uses relative paths like `bash scripts/foo.sh`, which resolve to `/Users/kevinlin/clawoss/workspace/scripts/foo.sh` — a path that does NOT exist. Scripts live at `/Users/kevinlin/clawOSS/scripts/`.

### Impact
**Every gate check script called from the orchestrator silently fails.** The agent submits PRs without running:
- Health gate (star count, activity, merge velocity)
- Blocklist check
- Supersession check
- Already-fixed check
- Stale session cleanup
- Heartbeat status snapshot

### All Affected References

**HEARTBEAT.md** (4 occurrences — CRITICAL, these are the orchestrator loop):
1. Line 11: `bash scripts/heartbeat-status.sh` — status snapshot
2. Line 59: `bash scripts/cleanup-stale-sessions.sh` — stale lock cleanup
3. Line 100: `bash scripts/repo-health-check.sh {owner}/{repo}` — health gate
4. Line 119: `bash scripts/repo-health-check.sh` — health gate (step 4)

**AGENTS.md** (1 occurrence):
5. Line 72: `scripts/repo-health-check.sh` — health gate reference

**Skills** (6 occurrences — these run in orchestrator context too):
6. `oss-triage/SKILL.md` line 42: `scripts/repo-health-check.sh`
7. `oss-triage/SKILL.md` line 62: `scripts/repo-health-check.sh`
8. `oss-discover/SKILL.md` line 47: `scripts/repo-health-check.sh`
9. `oss-discover/SKILL.md` line 66: `scripts/repo-health-check.sh`
10. `oss-discover/SKILL.md` line 203: `scripts/repo-health-check.sh`
11. `oss-discover/SKILL.md` line 204: `scripts/repo-health-check.sh`
12. `repo-analyzer/SKILL.md` line 15: `scripts/repo-health-check.sh`

**Templates** (ALREADY FIXED — use absolute paths):
- `subagent-followup.md` correctly uses `/Users/kevinlin/clawOSS/scripts/...` (6 references, all absolute)

### Fix
Change all relative `scripts/` references to absolute `/Users/kevinlin/clawOSS/scripts/` in:
- HEARTBEAT.md (4 changes)
- AGENTS.md (1 change)
- oss-triage/SKILL.md (2 changes)
- oss-discover/SKILL.md (4 changes)
- repo-analyzer/SKILL.md (1 change)

Total: **12 path fixes** across 5 files.

Note: Using `$PROJECT_DIR` won't work in markdown prompt files — the agent reads them as text, not shell scripts. Must use literal absolute paths.

---

## Flaw 2: Capacity Tracking Footer/Table Desync

### Root Cause
`impl-spawn-state.md` has two independent data sources:
1. **Table rows** with per-entry `status` field (running/completed/killed_avoidlist)
2. **Footer line** with aggregate count (`Active: 4/10 (2 impl + 2 always-on)`)

These are updated independently. The footer says "2 impl" but the table shows 3 "running" entries (DioCrafts/OxiCloud, thinkst/canarytokens-docker, mastra-ai/mastra).

### Impact
- Agent may think it has more/fewer slots than reality
- Combined with the capacity illusion bug (dead sessions counted as active), this creates a compounding error in slot management

### Fix
Two options:
- **Option A**: Remove the footer entirely. The agent should count active sessions from the table rows at read time, not from a cached counter.
- **Option B**: Make the footer a derived value — regenerate it every time the table is updated.

Option A is simpler and eliminates the desync class entirely. The HEARTBEAT should say: "Count rows with status=running in impl-spawn-state.md table" rather than reading the footer.

---

## Flaw 3: Error Tracking Never Increments

### Root Cause
`wake-state.md` shows `errors_this_hour: 0` despite 10+ real errors. The error counter is supposed to be incremented by the agent when it detects stalled sub-agents (HEARTBEAT step 2), but:

1. The heartbeat-status.sh script (which reads errors_this_hour) never runs due to **Flaw 1** (PATH bug)
2. Even if it did run, it uses `grep -oP` (HEARTBEAT.md line 43 reference in script review P1-3) which doesn't work on macOS
3. The agent has no other mechanism to increment the counter — it relies on manually editing wake-state.md, which it apparently never does
4. Gateway errors, script ENOENT errors, and file read failures are NOT captured at all

### Impact
The circuit breaker (`errors_this_hour >= 2` = HEARTBEAT_OK) never fires. The agent runs indefinitely regardless of error rate. This is a safety mechanism that is completely non-functional.

### Fix
1. Fix PATH bug (Flaw 1) so heartbeat-status.sh actually runs
2. Fix `grep -oP` to `sed -n` or similar macOS-compatible pattern in heartbeat-status.sh (already in P1-3 from script review)
3. Add explicit error increment instructions in HEARTBEAT.md: "After any failed script call, failed spawn, or failed API call, increment errors_this_hour in wake-state.md"
4. Consider making error tracking automatic via a wrapper function rather than relying on the agent to remember

---

## Priority Order
1. **Flaw 1 (PATH bug)** — P0, every gate check is bypassed. Fix immediately.
2. **Flaw 3 (Error tracking)** — P1, safety circuit breaker is dead. Fix after PATH.
3. **Flaw 2 (Footer desync)** — P2, causes slot miscounting. Fix by removing footer.

## Cascade Analysis
These three flaws compound:
- PATH bug -> scripts don't run -> errors not detected -> error counter stays 0 -> circuit breaker never fires -> agent keeps running broken -> spawns PRs without gates -> ban risk increases

Fixing Flaw 1 alone will restore gate checks AND allow error detection to start working (partially fixing Flaw 3).
