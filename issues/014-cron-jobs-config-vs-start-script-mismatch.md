# 014: Cron Jobs Config sessionTarget vs start.sh Session Routing

**Status:** Open
**Severity:** Medium
**Component:** config/cron-jobs.json, scripts/start.sh

## Description

The `config/cron-jobs.json` specifies `sessionTarget` for each cron job (e.g., `"sessionTarget": "isolated"` or `"sessionTarget": "main"`), but the `scripts/start.sh` script ignores this field entirely. Instead, start.sh hardcodes `--session isolated --session-key "agent:${AGENT_ID}:${name}"` for ALL cron jobs.

This means the `pr-followup-scan` job, which is designed to run in the main session (`"sessionTarget": "main"`) to access pipeline state, actually runs in an isolated session where it cannot see the main session's context.

## Root Cause

The start.sh script was simplified to use a single session strategy for all cron jobs to ensure non-default agents get their own session keys. The nuance of main vs isolated session targeting was lost.

## Impact

- `pr-followup-scan` cannot access the main session's work queue or pipeline state
- Follow-up results must go through staging files (which is the current workaround via HEARTBEAT.md)
- The `sessionTarget` field in cron-jobs.json is effectively dead configuration

## Recommended Fix

Either:
1. Update start.sh to read and honor `sessionTarget` from cron-jobs.json
2. Or accept that all cron jobs use isolated sessions and remove `sessionTarget` from the config to avoid confusion

Option 2 is simpler since the HEARTBEAT.md staging file pattern already handles cross-session communication.

## Related Files

- `config/cron-jobs.json` (sessionTarget field)
- `scripts/start.sh` (lines 42-47, cron registration)
- `workspace/HEARTBEAT.md` (step 2, staging file merge)
- Issue #008 (cron session type — original fix)
