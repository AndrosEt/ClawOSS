# 026: Heartbeat Stops After Diagnostics — Agent Doesn't Pick Work

**Status:** Fixed (heartbeat prompt rewritten with autonomous drive)
**Severity:** High
**Component:** config/openclaw.json (heartbeat prompt), workspace/HEARTBEAT.md

## Description

During the first live autonomous cycle, the agent correctly executed the heartbeat checklist diagnostics (context check, circuit breakers, PR follow-ups) but then replied `HEARTBEAT_OK` and stopped — without checking the work queue or spawning a sub-agent for available work.

The agent ran steps 0a-0b and step 2 (PR follow-ups) but skipped steps 3-7 (merge staging, pick work, triage, spawn sub-agent, report).

## Root Cause

The heartbeat prompt in `openclaw.json` was not explicit enough. The original prompt said:
```
"Read HEARTBEAT.md. Follow it strictly."
```

This allowed the agent to interpret "follow it strictly" loosely — completing the diagnostic steps and concluding there was nothing urgent, without proceeding to the work queue.

## Fix Applied

The heartbeat prompt was rewritten multiple times to be progressively more directive:

1. First fix (commit `748422c`): "Execute ALL steps 0 through 6 in order. Do NOT stop after checking PRs."
2. Second fix (commit `13d0aa3`): Updated to "steps 0 through 7" after stall recovery was added.
3. Final fix (commit `becee7a`): "You are autonomous. Read HEARTBEAT.md and execute EVERY step 0-7. Do NOT just reply HEARTBEAT_OK. You MUST: check work queue, pick a task, spawn a sub-agent, and self-wake after completion. HEARTBEAT_OK is ONLY valid when there is literally zero work available."

Additionally, HEARTBEAT.md now has a "CRITICAL: DO NOT JUST REPLY HEARTBEAT_OK" section at the top, and AGENTS.md has an "Autonomous Drive" section reinforcing that idle is failure.

## Related Files

- `config/openclaw.json` (heartbeat.prompt)
- `workspace/HEARTBEAT.md` (CRITICAL section at top)
- `workspace/AGENTS.md` (Autonomous Drive section)
- Commits: `748422c`, `13d0aa3`, `becee7a`
