# 002: Session Lock Contention — Stale Agent Processes

**Status:** Open (self-resolving — locks auto-clear after process termination)
**Severity:** Medium
**Component:** OpenClaw Gateway / Session Management

## Description

When an agent process crashes or is killed ungracefully, it can leave a stale session lock behind. Subsequent heartbeat or cron attempts to use the same session fail with lock contention errors, effectively blocking the agent until manual intervention.

This manifests as the gateway reporting that a session is "in use" even though no active agent process is running against it.

## Root Cause

OpenClaw uses file-based session locking (JSONL persistence). If the agent process exits without releasing the lock (e.g., OOM kill, SIGKILL, host reboot), the lock file remains and blocks new session access.

## Impact

- Agent becomes stuck and cannot process heartbeats or cron jobs
- Requires manual intervention to clear stale locks
- Lost work from the interrupted session is unrecoverable
- Dashboard shows agent as "offline" with no automatic recovery

## Workaround

- Use `openclaw sessions list` to identify stale sessions
- Manually kill orphaned processes and clear session lock files
- The `stop.sh` script attempts graceful shutdown but cannot handle all crash scenarios

## Observed During v5 Launch

- **Time:** 2026-03-16 17:49-17:50 UTC
- **Error:** `session file locked (timeout 10000ms): pid=57572 ...9741f803...jsonl.lock`
- Stale lock from previous gateway process (pid 57572) not cleaned up on restart
- Cascaded to fallback failure (issue #005)
- Self-resolved after process termination (~17:51 UTC)

## Fix Applied

None needed — locks auto-clear after process termination. This is transient. Ensure clean gateway shutdown with SIGTERM to minimize occurrence.

## Related Files

- `scripts/stop.sh` (graceful shutdown)
- `scripts/health-check.sh` (health monitoring)
- `config/openclaw.json` (session configuration)
