# 028: Sub-Agent Stall Recovery

**Status:** Implemented (commit `13d0aa3`, expanded in `6d85a5a`)
**Severity:** High
**Component:** workspace/HEARTBEAT.md (step 1), workspace/AGENTS.md (Stall Recovery section)

## Description

Sub-agents can stall during implementation — hanging indefinitely with no new messages. Without detection, a stalled sub-agent blocks the entire heartbeat loop since the orchestrator waits for a result that never comes.

## Feature: Automatic Stall Detection and Recovery

The orchestrator now detects and recovers from stalled sub-agents at the START of each heartbeat cycle (HEARTBEAT.md step 1):

### Detection
- Check if a sub-agent session is active from a previous cycle
- If the sub-agent has no new messages for >5 minutes, it's classified as stalled

### Recovery Process
1. Kill the stalled session (send cancel/abort, or ignore it)
2. Flush any partial state to memory
3. Re-queue the task at the TOP of `memory/work-queue.md` with note "retry - previous attempt stalled"
4. Increment `errors_this_hour` in `memory/wake-state.md`
5. Spawn a FRESH sub-agent for the same task on the next cycle

### Safety Limits
- **Max 2 consecutive stalls** on the same task — after 2, SKIP it and move to the next queue item
- Stall detection runs at heartbeat START, before any new work is picked
- Stale sessions (>30 min old) are ignored entirely — they're dead weight

### Circuit Breaker Integration
- Each stall increments `errors_this_hour` in wake-state
- If `errors_this_hour >= 2`, the circuit breaker in step 0b triggers HEARTBEAT_OK (cooldown)
- This prevents cascading failures from repeatedly stalling tasks

## Related Files

- `workspace/HEARTBEAT.md` — Step 1 (Stall Recovery), Step 0b (Circuit Breakers)
- `workspace/AGENTS.md` — "Stall Recovery" section
- `memory/wake-state.md` — `errors_this_hour` counter
- `memory/work-queue.md` — Re-queued tasks with "retry" notes
- Commits: `13d0aa3`, `6d85a5a`
