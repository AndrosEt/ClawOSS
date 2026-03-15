# 032: Telemetry Gap — 403 Content Filter Failures Not Reported to Dashboard

**Status:** Open
**Severity:** Medium
**Component:** Dashboard Reporter Hook / OpenClaw Gateway
**Reported by:** throughput-critic V6 bug audit (2026-03-16)

## Description

When a 403 content filter error kills an agent run, the `dashboard-reporter` hook never fires because the hook runs at `agent_end` and `after_tool_call` — but the 403 kills the API call before the agent produces any tool calls or reaches its end event.

Result: the dashboard has no record of the failure. It looks like the agent simply didn't run during that heartbeat cycle, creating a blind spot in monitoring.

## Impact

- Dashboard shows gaps in activity timeline instead of error events
- No way to track content filter failure frequency from the dashboard
- Cannot correlate 403 failures with specific repos or work queue items
- Makes it harder to detect the work queue trap described in issue #031

## Potential Fix

A gateway-level error hook that fires on non-200 API responses could report failures to the dashboard independently of the agent's hooks. This would require OpenClaw to support an `api_error` or `agent_error` hook event, or a separate monitoring process that watches gateway logs.

Alternatively, a lightweight cron job could compare expected heartbeat frequency (every 10 minutes) against actual dashboard heartbeat records and flag gaps as suspected failures.

## Related Issues

- #031 — Work queue trap on 403 (the failure that goes undetected)
- #001 — OpenRouter content filter poisoning (root cause of 403s)
- #030 — PII sanitizer plugin (reduces 403 frequency)

## Related Files

- `workspace/hooks/dashboard-reporter/handler.ts`
- `workspace/hooks/dashboard-reporter/HOOK.md`
- `config/cron-jobs.json` (could add a gap-detection job)
