# 008: Cron Jobs Need Isolated Sessions for Non-Default Agents

**Status:** Fixed
**Severity:** Medium
**Component:** OpenClaw Cron / Session Management

## Description

Cron jobs initially targeted the main agent session or used default session routing. For the ClawOSS agent (a non-default agent configuration), this caused cron jobs to either fail to find the correct session or to interfere with the main orchestrator's work queue by injecting messages at unexpected times.

Some cron jobs (like work-queue-refill) need isolated sessions to avoid polluting the main session's context with discovery data.

## Root Cause

OpenClaw's cron system routes messages to sessions based on `sessionTarget`. When set to `"main"`, the message goes to the agent's primary session. When set to `"isolated"`, it spawns a fresh session. The original configuration used inconsistent session targeting, causing some jobs to compete with the orchestrator for the main session.

## Impact

- Cron-triggered discovery could interrupt in-progress implementation
- Main session context polluted with discovery results
- Race conditions between cron writes and orchestrator reads of work queue files
- Some cron jobs failed to execute when main session was busy

## Fix Applied

Updated `config/cron-jobs.json` with correct session targeting:
- `work-queue-refill`: `"sessionTarget": "isolated"` — runs discovery in a fresh session, writes to staging file
- `pr-followup-scan`: `"sessionTarget": "main"` — runs in main session since it needs pipeline state
- `daily-report`, `weekly-retrospective`, `memory-cleanup`: `"sessionTarget": "isolated"` — all use isolated sessions

Added staging file pattern (`work-queue-staging.md`, `followup-staging.md`) to prevent race conditions between cron writes and main session reads.

## Related Files

- `config/cron-jobs.json` (session targeting for all 5 jobs)
- `workspace/HEARTBEAT.md` (step 2, merge staging files)
- Commit: `3198231` — "feat: apply v5 cron jobs with validated OpenClaw schema"
