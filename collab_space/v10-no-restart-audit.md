# V10 No-Restart Audit: Eliminating Restart Assumptions

**Author**: critique agent
**Date**: 2026-03-17
**Directive**: Agent must be always-on, self-healing, zero restarts

---

## Executive Summary

I audited every operational file for restart assumptions. Found **12 locations** across 5 files that assume restarts are part of normal workflow. The agent already has most self-healing mechanisms in place (step 0.5 respawns dead always-on agents, step 1 stall recovery, step 7 self-wake). The gaps are in documentation/config that *recommend* restarts and one script that only works during restarts.

---

## Findings: Files That Assume Restarts

### 1. CLAUDE.md (project instructions) — 3 items

**Line 22**: Lists restart.sh as a key file.
```
- `scripts/restart.sh` — Full restart for headless operation
```
CHANGE: Reframe as emergency-only. Replace with:
```
- `scripts/restart.sh` — Emergency recovery ONLY (kills all subagents, use as last resort)
```

**Lines 68-69**: "Restart agent" as a common command.
```bash
# Restart agent
cd /Users/kevinlin/clawOSS && bash scripts/restart.sh
```
CHANGE: Replace with self-healing commands:
```bash
# Wake agent (preferred — no restart needed)
openclaw system event --text "resume heartbeat" --mode now

# Check agent status
openclaw logs 2>&1 | tail -20

# Emergency restart (LAST RESORT — kills all active subagents)
# cd /Users/kevinlin/clawOSS && bash scripts/restart.sh
```

**Lines 77-79**: "Restart gateway" as a common operation.
```bash
# Restart gateway (after config changes)
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist
```
CHANGE: Config hot-reloads on file change. Gateway restart should only be needed for version upgrades. Replace with:
```bash
# Config changes hot-reload automatically. Gateway restart only for version upgrades.
# Agent self-heals via HEARTBEAT step 7 self-wake mechanism.
```

### 2. scripts/restart.sh — The restart script itself

This script is **inherently anti-always-on** — it stops the gateway, deletes sessions, kills subagents, and rebuilds from scratch. Under the new rule, it should only exist as an emergency escape hatch, not a normal workflow step.

**Line 228-229** (already addressed in root cause analysis): Deletes session .jsonl files, breaking heartbeat.
**Lines 236-241**: Resets `spawned_pending` entries, which is restart-specific cleanup.
**Line 337**: Wake event text says "ClawOSS V10 restart" — frames itself as restart-based.

CHANGE: Keep restart.sh for emergencies but add a prominent warning:
```bash
echo "WARNING: This is an EMERGENCY restart. It kills all active subagents."
echo "         Prefer 'openclaw system event --text resume --mode now' for recovery."
echo "         Only use this if the agent is completely unresponsive."
read -p "Continue? (y/N) " confirm
[[ "$confirm" == "y" ]] || exit 0
```

### 3. scripts/health-check.sh — Stale cron reference

**Line 37**: Says "expected: 5" cron jobs.
```bash
echo "[INFO] $CRON_COUNT cron jobs registered for clawoss (expected: 5)"
```
CHANGE: Update to V10 reality (0 crons):
```bash
echo "[INFO] $CRON_COUNT cron jobs registered for clawoss (expected: 0 — V10 uses heartbeat + always-on subagents)"
```

### 4. scripts/start.sh — Lines 29-48: Cron registration logic

Iterates over `cron-jobs.json` and registers cron jobs. Harmless since `cron-jobs.json` is `[]`, but it's dead code that implies cron-based architecture.

CHANGE: Remove the cron registration block (lines 29-48) or guard it:
```bash
# V10: No cron jobs — heartbeat + always-on subagents handle everything
CRON_COUNT=$(jq 'length' "$PROJECT_DIR/config/cron-jobs.json" 2>/dev/null || echo 0)
if [ "$CRON_COUNT" -gt 0 ]; then
    echo "Registering $CRON_COUNT cron jobs..."
    # ... existing logic ...
fi
```

### 5. scripts/stop.sh — Lines 9-13: Cron removal logic

Same as start.sh — iterates over empty cron-jobs.json. Dead code.

---

## Self-Healing Mechanisms Already In Place

The HEARTBEAT already has strong self-healing. Here's what currently works:

| Mechanism | Location | What It Heals |
|-----------|----------|---------------|
| Step 0.5: Always-on respawn | HEARTBEAT.md:34,42,50 | Dead scout/monitor/analyst get respawned |
| Step 1: Stall recovery | HEARTBEAT.md:59 | Stalled subagents killed and re-queued |
| Step 1: Stale lock cleanup | HEARTBEAT.md:60 | Orphaned locks cleaned (>1hr) |
| Step 1: spawned_pending reset | cleanup-stale-sessions.sh | Orphaned spawn guards cleared |
| Step 7: Self-wake | HEARTBEAT.md:158 | `openclaw system event "cycle-complete"` ensures next heartbeat fires |
| Step 0b: Circuit breakers | HEARTBEAT.md:14 | Prevents runaway after 50 consecutive wakes or 2+ errors |
| Step 0b2: API backoff | HEARTBEAT.md:18 | Backs off on API failures |
| Step 3b: Queue refill | HEARTBEAT.md:116 | Auto-discovers when queue low |

## Self-Healing Gaps (need to be fixed)

### Gap 1: No gateway health check in HEARTBEAT

The heartbeat has no way to detect or recover from gateway-level issues. If the gateway has a transient error, the heartbeat just fails silently. The heartbeat should:
- Detect if its own API calls are failing consistently (it does this with circuit breakers)
- But it CANNOT restart the gateway (and shouldn't — that's what launchd `KeepAlive: true` does)

**Assessment**: The gateway plist already has `<key>KeepAlive</key><true/>` (line 13 of ai.openclaw.gateway.plist). launchd will automatically restart the gateway if it crashes. This IS the self-healing mechanism for the gateway. No HEARTBEAT change needed.

### Gap 2: Session corruption has no recovery path

If `sessions.json` gets corrupted or the session .jsonl file is truncated, there's no self-healing. The heartbeat would silently fail. But now that we're NOT deleting session files in restart.sh, this is much less likely.

**Assessment**: Low risk. The gateway manages sessions robustly. Don't add complexity here.

### Gap 3: The self-wake (step 7) only fires if the heartbeat COMPLETES

If the heartbeat stalls mid-execution (e.g., an API call hangs indefinitely), the self-wake never fires. The next heartbeat relies on the 5-minute timer. But if the timer is broken (Issue 1 from root cause analysis), no heartbeat ever fires again.

**Assessment**: This is the core vulnerability. The `announceTimeoutMs: 5000` fix from the root cause analysis prevents the 90s hang. The step 0b2 max-cycle-time guardrail (>5 min skip) prevents infinite hangs. The timer itself is managed by the gateway's `HeartbeatRunner` — if the gateway is alive (launchd keeps it alive), the timer fires every 5 minutes regardless of self-wake.

### Gap 4: cleanup-stale-sessions.sh resets ALL spawned_pending, not just stale ones

The script (lines 24-39) uses `sed 's/spawned_pending/stale_reset/g'` which resets ALL spawned_pending entries, even ones that belong to actively running subagents. This is correct for restart cleanup but WRONG for always-on operation.

**CHANGE**: The script should only reset entries that have been pending longer than a threshold (e.g., >60 minutes, matching the lock file cleanup).

Currently there's no timestamp in the spawned_pending entries in impl-spawn-state.md. The fix is:
1. When marking `spawned_pending`, include a timestamp: `spawned_pending (2026-03-17T04:00:00Z)`
2. `cleanup-stale-sessions.sh` only resets entries where the timestamp is >60 min old
3. This is a prompt change (HEARTBEAT.md line 130) + script change

This is the **only real self-healing gap** that needs fixing. Everything else is already handled.

---

## Summary of Changes Needed

### Priority 1: Config changes (no restart, hot-reload)

| File | Change | Impact |
|------|--------|--------|
| `config/openclaw.json` | Add `announceTimeoutMs: 5000` under subagents | Fixes announce timeout waste |
| `subagent-scout.md` | ANNOUNCE_SKIP always, not conditional | Prevents "Channel required" on success |
| `subagent-pr-analyst.md` | ANNOUNCE_SKIP always, not conditional | Same |

### Priority 2: Documentation changes (reframe restart as emergency)

| File | Change | Impact |
|------|--------|--------|
| `CLAUDE.md` lines 22, 68-69, 77-79 | Reframe restart as emergency, promote wake event | Stops restart culture |
| `scripts/health-check.sh` line 37 | Fix "expected: 5" cron count to 0 | Cosmetic |

### Priority 3: Self-healing improvements

| File | Change | Impact |
|------|--------|--------|
| `cleanup-stale-sessions.sh` | Only reset spawned_pending entries older than 60 min | Prevents clearing active subagent guards |
| `HEARTBEAT.md` line 130 | Include timestamp in spawned_pending marks | Enables age-based cleanup |

### NOT changing (leave as-is)

| File | Reason |
|------|--------|
| `restart.sh` | Keep as emergency escape hatch — but reframe documentation |
| `start.sh` cron logic | Dead code (empty JSON), harmless |
| `stop.sh` cron logic | Dead code, harmless |
| Gateway plist | Already has `KeepAlive: true` — self-heals on crash |
| HEARTBEAT.md self-wake | Already correct — fires every cycle completion |
| HEARTBEAT.md step 0.5 | Already respawns dead always-on agents |
| HEARTBEAT.md step 1 | Already handles stalled subagents |
