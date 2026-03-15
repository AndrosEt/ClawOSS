# 029: Heartbeat Not Executing Full Loop

**Status:** In Progress (system prompt fix being applied)
**Severity:** Critical
**Component:** config/openclaw.json (heartbeat.prompt), workspace/HEARTBEAT.md

## Description

After V6 deploy, the agent reads HEARTBEAT.md but replies `HEARTBEAT_OK` without executing steps 0-7. The agent treats reading the file as sufficient rather than executing the checklist.

This is related to but distinct from issue #026 (heartbeat stops after diagnostics). In #026, the agent executed some steps but stopped early. In this issue, the agent skips execution entirely — it reads HEARTBEAT.md and immediately replies HEARTBEAT_OK.

## Root Cause

The heartbeat system prompt is not forceful enough to override the agent's tendency to treat "read and follow" as "read and acknowledge." Even the current prompt ("You are autonomous. Read HEARTBEAT.md and execute EVERY step 0-7...") is not sufficient with Kimi K2.5.

## Fix

Architect is updating the system prompt to be more explicit and directive. The prompt must make it impossible for the agent to interpret HEARTBEAT_OK as a valid response when work exists.

## Related Issues

- #026 — Heartbeat stops after diagnostics (Fixed, but this is a recurrence pattern)

## Related Files

- `config/openclaw.json` (heartbeat.prompt)
- `workspace/HEARTBEAT.md` (CRITICAL section at top)
