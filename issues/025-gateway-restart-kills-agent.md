# 025: Gateway Restart Interrupts Active Agent Turns

**Status:** Known (no fix — minimize restarts during active work)
**Severity:** Medium
**Component:** OpenClaw Gateway

## Description

When the OpenClaw gateway configuration is hot-reloaded or restarted (e.g., after config changes), it sends SIGTERM to active agent processes. This kills any in-progress agent turns, potentially mid-implementation or mid-PR submission.

## Impact

- Agent loses in-progress work (code changes, test runs, PR drafts)
- Memory files may not be flushed before termination
- Sub-agents are also killed, losing their isolated context
- Can leave stale session locks (see issue #002)

## Workaround

- Minimize gateway restarts during active work
- Schedule config changes during idle periods (between heartbeat cycles)
- The agent's circuit breaker in `wake-state.md` will detect the error on next heartbeat
- Lost work is re-queued on next cycle via stall recovery (HEARTBEAT.md step 1)

## Related Files

- `scripts/start.sh` (gateway restart logic)
- `workspace/HEARTBEAT.md` (stall recovery at step 1)
- `workspace/memory/wake-state.md` (error tracking)
