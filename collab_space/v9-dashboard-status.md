# V9 Dashboard Status Report

**Date**: 2026-03-17
**Agent**: web_dashboard
**Dashboard URL**: https://clawoss-dashboard.vercel.app

## CRITICAL: Deployed Dashboard is Running V8 Code

The Vercel deployment is from the `main` branch, but all V9 dashboard changes are on `v6-release` (uncommitted or in 5 unmerged commits). The deployed dashboard is actively harming the agent with stale V8 directives.

### What the Agent Sees (DEPLOYED - WRONG)

```json
{
  "directives": [
    "SLOW DOWN: Already submitted 57 PRs today. Quality over quantity.",
    "MERGE RATE CRITICAL: Only 3.0%. Submit smaller PRs (under 50 lines)...",
    "TOO MANY DEAD REPOS: 17 repos with 0 merges...",
    "FOLLOW UP FIRST: 41 repos have open PRs..."
  ]
}
```

The `"SLOW DOWN"` directive is a V8 rate limiter that V9 explicitly removes. It triggers at 20+ PRs/day and tells the agent to stop submitting. This directly contradicts V9's "no rate limits" philosophy.

### What the Agent SHOULD See (LOCAL - CORRECT)

```json
{
  "directives": [
    "MERGE RATE CRITICAL: Only 3.0%. Target trusted repos, keep PRs under 50 lines...",
    "TOO MANY DEAD REPOS: 17 repos...",
    "FOLLOW UP FIRST: 41 repos...",
    "REWORK NEEDED: X closed PRs (Y%). Rework rejected PRs instead of abandoning..."
  ]
}
```

No rate limit directives. New rework tracking (`closed` count, `reworkRate`).

## Issues Fixed (Local, Not Yet Deployed)

### 1. Removed "SLOW DOWN" rate limit from health-check
- **File**: `dashboard/app/api/agent/health-check/route.ts`
- **Change**: Removed `if (todayPRs >= 20)` directive entirely
- **Impact**: Agent will no longer be told to stop submitting PRs

### 2. Added rework tracking to health-check
- **File**: `dashboard/app/api/agent/health-check/route.ts`
- **Change**: Added `closed` count, `reworkRate` stat, and "REWORK NEEDED" directive
- **Impact**: Agent now tracks close rate and gets rework directives

### 3. Fixed broken template literal in action-items
- **File**: `dashboard/app/api/metrics/action-items/route.ts`
- **Change**: Fixed `${total * 0.1}` -> `${Math.round(total * 0.1)}`
- **Impact**: Impact estimates now render correctly instead of showing literal `${total * 0.1}`

### 4. Added rework rate action item
- **File**: `dashboard/app/api/metrics/action-items/route.ts`
- **Change**: Added P1 rework rate tracking action item
- **Impact**: Dashboard now surfaces high close rates as actionable items

### 5. Removed dailyLimit/repoLimit from overview API
- **File**: `dashboard/app/api/metrics/overview/route.ts`
- **Change**: Removed `dailyLimit: 10` and `repoLimit: 3` from `dailyBudget`
- **Impact**: No more V8 rate limit data in API responses

### 6. Downgraded high-volume alert severity
- **File**: `dashboard/app/api/metrics/alerts/route.ts`
- **Change**: Changed from `"warning"` to `"info"`, removed "throttling" language
- **Impact**: High PR volume no longer flagged as a warning

### 7. Stale PR panel: "close" -> "rework" (V9 never-close policy)
- **Files**: `dashboard/app/api/metrics/stale-prs/route.ts`, `dashboard/components/overview/stale-pr-panel.tsx`, `dashboard/lib/hooks/use-stale-prs.ts`
- **Change**: Replaced all `"close"` recommendations with `"rework"`. Panel renamed from "Stale PR Cleanup" to "Stale PR Rework". Badge color changed from red to orange.
- **Impact**: Dashboard no longer recommends closing PRs -- aligns with V9 "never close, always rework" policy

### 8. Removed maxPRsPerDay/maxPRsPerRepoPerDay from settings
- **Files**: `dashboard/app/api/settings/route.ts`, `dashboard/lib/types.ts`
- **Change**: Removed `maxPRsPerDay: 10` and `maxPRsPerRepoPerDay: 3` from default settings and types
- **Impact**: No more per-day or per-repo rate limits in settings

### 9. Removed CLA-as-failure across all dashboard endpoints (CLA policy change)
- **Files**: `dashboard/app/api/metrics/action-items/route.ts`, `dashboard/app/api/metrics/autonomy/route.ts`, `dashboard/components/overview/autonomy-health-panel.tsx`
- **Change**: Agent now signs CLAs instead of skipping CLA repos. Removed:
  - P0 "CLA honesty" action item from action-items endpoint
  - `cla_blocked` failure category from autonomy endpoint
  - CLA prompt gap from autonomy endpoint
  - `cla_required` closure reason from `inferClosureReason()`
  - "CLA Not Signed" label from autonomy health panel UI
  - CLA bot detection kept as informational-only (no longer flags as failure)
  - "CLA required" exception text from rework suggestedFix
- **Impact**: CLA repos are no longer flagged/avoided. Dashboard tracks CLA bot interactions as informational only.

## Current Live Stats

| Metric | Value |
|--------|-------|
| Total PRs | 101 |
| Merged | 3 (3.0%) |
| Open | 46 |
| Closed | 52 |
| Today's PRs | 57 |
| Avoid repos | 17 |
| Repos with open PRs | 41 |
| Connection | connected |
| Heartbeats/hr | 213 |
| Errors/hr | 0 |

## Deployment Blocker

The `v6-release` branch has NOT been merged to `main`. Vercel deploys from `main`. To get V9 dashboard changes live:

1. Merge `v6-release` -> `main` (or push directly to main)
2. Or: reconfigure Vercel to deploy from `v6-release`

Until this is done, the agent continues receiving the wrong "SLOW DOWN" directive every heartbeat cycle.

## Dashboard Architecture Assessment

The dashboard architecture is solid:
- **GitHub sync**: Works via Vercel cron (every 2 min), searches PRs by BillionClaw username
- **Health-check**: Agent calls `/api/agent/health-check` every heartbeat cycle
- **Data pipeline**: Heartbeat ingest, metrics, state, conversation, subagent runs
- **Quality scoring**: Automatic quality scoring on PR sync
- **Autonomy metrics**: Comprehensive penalty/bonus system with snapshot history
- **Data retention**: Auto-prune for high-volume tables (7-30 days retention)
- **Auth**: Bearer token via `CLAW_API_KEY` for ingest endpoints

No code bugs found. The only issue is the deployment gap.
