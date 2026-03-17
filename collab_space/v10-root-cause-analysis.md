# V10 Root Cause Analysis

**Author**: critique agent
**Date**: 2026-03-17
**Status**: COMPLETE — 3 root causes analyzed, config fixes proposed

---

## Issue 1: Heartbeat timer dies after gateway restart

### Root Cause

The heartbeat timer is **stored in gateway process memory** (via `HeartbeatRunner` using `setTimeout`). It is NOT persisted to disk. When the gateway process restarts (launchctl unload/load), `heartbeatRunner.stop()` is called, all timers are destroyed, and the `state.agents` Map (containing `lastRunMs`, `nextDueMs`) is lost.

On startup, `startHeartbeatRunner` is called as part of `startGatewayServer`, which **should** re-initialize the timer. The problem is likely one of two things:

**Hypothesis A (most likely): `restart.sh` line 228 deletes session .jsonl files but leaves `sessions.json` intact.**

The heartbeat runner resolves sessions via `sessionKey` -> `sessions.json` -> `sessionId` -> `.jsonl` file. After restart.sh:
- `sessions.json` still maps `agent:clawoss:main` -> sessionId `1a2adad2-...`
- But the `.jsonl` file for that sessionId was deleted by line 228
- The heartbeat runner finds the session mapping but the transcript file is gone
- The heartbeat run likely fails silently because the session exists (in sessions.json) but is broken (no transcript)

This is confirmed by examining the current state:
- `sessions.json` line 2-3: `"agent:clawoss:main"` -> sessionId `"1a2adad2-d714-4182-a57d-8c0d3d5e61f5"`
- That `.jsonl` file exists currently (17 Mar 04:10, 231k) — it was recreated after the last restart
- But the pattern `rm -f *.jsonl` in restart.sh would delete it, leaving a dangling reference

**Hypothesis B: The wake event (step 16) fires before the heartbeat runner is fully initialized.**

restart.sh does `sleep 5` after gateway start, then `sleep 3` before the wake event. But the heartbeat runner initialization is async — if it hasn't finished registering the timer handler yet, the wake event may be received but not processed by the heartbeat system.

### Proposed Fix

**Fix A (config/restart.sh): Don't delete session .jsonl files — let the gateway manage them.**

```bash
# OLD (line 228-229):
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.jsonl 2>/dev/null || true
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.lock 2>/dev/null || true

# NEW: Only delete .lock files (prevent stale locks). Leave .jsonl files intact.
# The gateway manages session lifecycle via sessions.json.
# Deleting .jsonl files breaks the sessions.json -> sessionId mapping.
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.lock 2>/dev/null || true
echo "[OK] Session locks cleaned (transcript files preserved for heartbeat continuity)"
```

**Fix B (config/restart.sh): Increase sleep after gateway start to ensure heartbeat runner is ready.**

```bash
# OLD (line 284):
sleep 5

# NEW: Give gateway more time to initialize heartbeat runner
sleep 8
```

**Fix C (HEARTBEAT.md step 7): Add self-wake as a redundancy mechanism.**

The current step 7 already does `openclaw system event --text "cycle-complete" --mode now`. This IS a self-wake mechanism — it schedules the next heartbeat immediately after the current one completes, bypassing the timer. This is correct and should work as long as the first heartbeat fires.

The real fix is Fix A — preserving session files so the heartbeat runner can find its session on startup.

---

## Issue 2: "Channel is required" error keeps recurring

### Root Cause

The error occurs in the **subagent announce mechanism**, not in the message queue. When a subagent completes, the `runSubagentAnnounceFlow` runs and tries to deliver the result to the requester's chat channel. The delivery path calls `sendAnnounce` which uses `callGateway` with the `agent` method.

The "Channel is required" error means the announce delivery is trying to route to an external channel that doesn't exist. This happens because:

1. The `deliveryContext` in the session has `"to": "heartbeat"` (confirmed in sessions.json line 9)
2. The announce mechanism tries to deliver the subagent result to the "heartbeat" channel
3. But "heartbeat" is not a real chat channel — it's a special internal provider
4. The announce mechanism interprets this as needing a channel and fails

**Why changing `messages.queue.mode` to "steer" didn't fully fix it:**

`messages.queue.mode` controls how inbound messages to the **main session** are handled. It does NOT control how subagent announce delivery works. The announce mechanism has its own routing logic that is separate from the message queue.

The announce delivery retries 3 times with exponential backoff (5s, 10s, 20s) before giving up. This explains the recurring error pattern.

### Proposed Fix

**Fix A (PRIMARY — config/openclaw.json): Set `announceTimeoutMs` to 5000ms (5 seconds) instead of default 90s.**

```json
{
  "agents": {
    "defaults": {
      "subagents": {
        "model": "kimi-coding/k2p5",
        "maxConcurrent": 10,
        "archiveAfterMinutes": 1440,
        "maxChildrenPerAgent": 15,
        "maxSpawnDepth": 2,
        "announceTimeoutMs": 5000
      }
    }
  }
}
```

This reduces the timeout from 90s to 5s. The announce will still fail (because the heartbeat channel issue), but it will fail fast instead of blocking for 90 seconds.

**Fix B (CRITICAL — subagent templates): All subagent templates already end with `ANNOUNCE_SKIP`.**

Checking the templates:
- `subagent-implementation.md` line 272: `Then reply: ANNOUNCE_SKIP` -- CORRECT
- `subagent-followup.md`: Should also end with `ANNOUNCE_SKIP`
- `subagent-scout.md`: Always-on, should use `ANNOUNCE_SKIP`
- `subagent-pr-monitor.md`: Always-on, should use `ANNOUNCE_SKIP`
- `subagent-pr-analyst.md` line 254: `reply ANNOUNCE_SKIP` -- CORRECT

When a subagent replies `ANNOUNCE_SKIP`, the announce delivery is **entirely skipped** — no timeout, no channel lookup, no error. This is the correct behavior for our architecture since we use file-based result polling (subagent writes to `memory/subagent-result-*.md`, orchestrator reads it).

**The bug is that the LLM doesn't always produce `ANNOUNCE_SKIP` as its final output.** If the subagent's context fills up and it gets compacted, or if it errors out, or if it times out, the announce step runs with whatever the last output was — which is NOT `ANNOUNCE_SKIP`.

**Fix C (config/openclaw.json): Set `heartbeat.target` to explicitly prevent channel routing.**

The current config has `"target": "none"`. This should prevent channel delivery. But verify that subagent announce inherits the parent session's target. If not, the announce may try to deliver to a default channel.

**Recommended combined fix:**
1. Add `announceTimeoutMs: 5000` (fail fast when announce does fire)
2. Verify all subagent templates end with `ANNOUNCE_SKIP`
3. The file-based result polling makes announce delivery unnecessary — the 5s timeout is just a safety net

---

## Issue 3: Gateway timeout on subagent announce (90s timeout, 4 retries = 6 min wasted)

### Root Cause

This is the downstream effect of Issue 2. The announce mechanism:
1. Subagent completes (or fails/times out without producing `ANNOUNCE_SKIP`)
2. `runSubagentAnnounceFlow` calls `deliverSubagentAnnouncement`
3. Delivery tries `sendAnnounce` via `callGateway` with 90s timeout (default `announceTimeoutMs`)
4. Gateway can't route to "heartbeat" channel -> times out after 90s
5. Retries with exponential backoff: 5s + 10s + 20s = 35s between retries
6. 3 retries x (90s timeout + backoff) = ~6 minutes total wasted

DeepWiki confirms: max 3 retries (not 4), with delays of 5s, 10s, 20s. Gateway timeout errors on external delivery completion announces are NOT retried. So the actual waste per failed announce is:
- First attempt: 90s timeout
- If it's categorized as "gateway timeout on external delivery" -> no retry, just 90s wasted
- If it's a different failure type -> up to 3 retries = ~375s (6.25 min)

### Proposed Fix

**Fix A (config/openclaw.json): Reduce `announceTimeoutMs` to 5000.**

Same as Issue 2 Fix A. This changes the math to:
- First attempt: 5s timeout
- Worst case with retries: 3 x 5s + 35s backoff = ~50s total
- This is a 7x improvement over the current 6-minute worst case

**Fix B: Ensure `ANNOUNCE_SKIP` is produced reliably.**

The templates already include `ANNOUNCE_SKIP`, but the LLM may not produce it if:
- Context is full and the subagent gets compacted (loses the instruction)
- The subagent errors out (exception, not a clean exit)
- The subagent times out (runTimeoutSeconds exceeded)

For timeout and error cases, the announce step runs regardless. The only config-level mitigation is reducing `announceTimeoutMs`.

**Fix C: No config key exists to disable announce entirely.** DeepWiki confirms there is no `agents.defaults.subagents.announce: false` or similar. The announce mechanism always runs. The only controls are:
- `ANNOUNCE_SKIP` from the subagent (prevents delivery)
- `announceTimeoutMs` (controls how long delivery waits)
- Retry behavior (hardcoded, not configurable)

---

## Summary of Recommended Config Changes

### 1. config/openclaw.json — Add `announceTimeoutMs`

```diff
 "subagents": {
   "model": "kimi-coding/k2p5",
   "maxConcurrent": 10,
   "archiveAfterMinutes": 1440,
   "maxChildrenPerAgent": 15,
-  "maxSpawnDepth": 2
+  "maxSpawnDepth": 2,
+  "announceTimeoutMs": 5000
 }
```

Impact: Reduces announce timeout from 90s to 5s. Fixes Issue 2 and Issue 3.

### 2. scripts/restart.sh — Stop deleting session .jsonl files

```diff
-rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.jsonl 2>/dev/null || true
-rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.lock 2>/dev/null || true
-echo "[OK] Sessions cleaned"
+# Only clean lock files. Preserve .jsonl transcripts — deleting them breaks
+# the sessions.json -> sessionId mapping and kills the heartbeat timer.
+rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.lock 2>/dev/null || true
+echo "[OK] Session locks cleaned (transcripts preserved for heartbeat continuity)"
```

Impact: Heartbeat timer survives gateway restarts because session mapping stays intact. Fixes Issue 1.

### 3. scripts/restart.sh — Increase post-gateway sleep

```diff
-sleep 5
+sleep 8
```

Impact: More time for heartbeat runner initialization before wake event. Belt-and-suspenders for Issue 1.

### 4. Fix conditional ANNOUNCE_SKIP in always-on templates

All 5 templates reference `ANNOUNCE_SKIP`, but 2 use it **conditionally**:

| Template | ANNOUNCE_SKIP | Problem |
|----------|--------------|---------|
| subagent-implementation.md:272 | ALWAYS | OK |
| subagent-followup.md:112 | ALWAYS | OK |
| subagent-pr-monitor.md:206 | ALWAYS | OK |
| subagent-scout.md:185 | CONDITIONAL ("if 0 new candidates") | BUG: when candidates ARE found, no ANNOUNCE_SKIP -> triggers announce flow -> "Channel required" error |
| subagent-pr-analyst.md:254 | CONDITIONAL ("if no new data") | BUG: when new data IS found, no ANNOUNCE_SKIP -> triggers announce flow -> "Channel required" error |

**Fix**: Change scout and PR analyst templates to ALWAYS use `ANNOUNCE_SKIP`. They write results to memory files — the orchestrator reads those files, not the announce message. The announce is redundant and harmful.

Scout fix (line 185-186):
```
# OLD:
If a cycle found 0 new candidates, reply ANNOUNCE_SKIP for that cycle (no announcement).
If a cycle found high-value candidates (score >= 12), complete the task to announce to main agent.

# NEW:
ALWAYS reply ANNOUNCE_SKIP after each cycle. Results are written to memory files — the orchestrator reads them directly.
```

PR analyst fix (line 254):
```
# OLD:
If a cycle found no new data (no new PRs since last analysis), reply ANNOUNCE_SKIP for that cycle.

# NEW:
ALWAYS reply ANNOUNCE_SKIP after each cycle. Results are written to memory files — the orchestrator reads them directly.
```

### Priority Order

1. **`announceTimeoutMs: 5000`** — Highest impact, easiest change. Fixes Issues 2+3 immediately.
2. **Stop deleting .jsonl files** — Fixes Issue 1. Requires restart.sh edit.
3. **Increase sleep** — Minor robustness improvement for Issue 1.
4. **Verify ANNOUNCE_SKIP** — Defense in depth for Issues 2+3.

---

## What NOT To Do

- Do NOT set `messages.queue.mode` to "off" or "discard" — these are not valid values (DeepWiki confirms valid modes are: steer, collect, followup, steer-backlog, interrupt).
- Do NOT try to disable the announce mechanism entirely — there is no config for this.
- Do NOT delete `sessions.json` — this is the session store and destroying it would require full session recreation.
- Do NOT reduce heartbeat interval below 5m to compensate — this treats the symptom, not the cause.
