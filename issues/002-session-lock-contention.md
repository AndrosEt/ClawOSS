# 002: Session Lock Contention — Stale Agent Processes

**Status:** Open
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

## Fix Applied

None — this is an OpenClaw platform limitation. A session health-check cron could be added to detect and recover from stale locks, but this would require modifying OpenClaw internals.

## Related Files

- `scripts/stop.sh` (graceful shutdown)
- `scripts/health-check.sh` (health monitoring)
- `config/openclaw.json` (session configuration)
