# Dashboard Deploy Log

## Deployment: 2026-03-16

**Status**: SUCCESS (12 deploys total)
**URL**: https://clawoss-dashboard.vercel.app
**Vercel Project**: clawoss-dashboard (prj_HH2luutCm2Lr8xfpwaXNaBNDzsfx)

## What was deployed

Next.js 16.1.6 dashboard with all panels:
- Overview (merge rate hero metric, live stats)
- **Autonomy Health** (NEW - automated prompt gap detection)
- Live Feed (agent state, conversation feed)
- Pull Requests (filterable PR table)
- Repo Health (per-repo health scores, engagement classification)
- Health (cost tracking, token usage, session states)
- Quality (PR quality scoring)
- Logs (audit trail)
- Repos page

## Deploy 1: Initial deploy + pr_type bug fix

**Issue**: `/api/github/prs` and `/api/metrics/pr-types` returning HTTP 500
**Root cause**: Drizzle schema defines `pullRequests.prType` mapped to column `pr_type`, but the `CREATE TABLE IF NOT EXISTS` in `lib/db.ts` didn't include it.
**Fix**: Added `pr_type TEXT` to CREATE TABLE + safe `ALTER TABLE` migration.
**File**: `dashboard/lib/db.ts`

## Deploy 2: Autonomy Health Panel (the main deliverable)

**Purpose**: Build visibility so we can SEE where the agent's autonomous decisions fail, so we fix PROMPTS instead of manually auditing PRs.

**What it answers**: "Where is ClawOSS making bad autonomous decisions?"

### New files created:
- `dashboard/app/api/metrics/autonomy/route.ts` — API that computes autonomy score
- `dashboard/lib/hooks/use-autonomy.ts` — SWR hook for frontend
- `dashboard/components/overview/autonomy-health-panel.tsx` — Visual panel on overview page

### What the autonomy panel detects automatically:

| Detection | How | Why it matters for autonomy |
|---|---|---|
| **Duplicate PRs** | Groups by repo, checks title similarity | Agent spamming = prompt gap in dedup guard |
| **Oversized PRs** | Flags PRs >200 lines | Agent ignoring scope constraint = prompt gap |
| **Wasted cycles** | PRs closed without review | Agent targeting bad repos = triage prompt gap |
| **Quick rejections** | PRs closed within 1 hour | CLA/CI/anti-bot failures = tool gap |
| **Dead repo targeting** | Repos with 3+ PRs, 0 merges | Agent not learning from feedback = loop gap |

### Autonomy score formula:
```
score = 40 (base)
      + merge_rate_bonus (up to +40)
      + review_rate_bonus (up to +20)
      - duplicate_penalty (up to -25)
      - oversized_penalty (up to -15)
      - wasted_penalty (up to -20)
```

### Current results (live data):
- **Autonomy score: 0** (maximum penalties hit)
- 5 prompt gaps detected automatically:
  1. CRITICAL: No PR de-duplication guard (19 duplicates across 9 repos)
  2. CRITICAL: No diff size enforcement (25 PRs >200 lines)
  3. HIGH: Bad repo targeting (19 PRs closed without review)
  4. HIGH: Auto-rejected submissions (7 PRs closed within 1 hour)
  5. MEDIUM: Targeting unresponsive repos (2 repos with 3+ PRs, 0 merges)

These match exactly what problem-finder found manually — but now they're computed automatically on every page load.

## How this makes ClawOSS more autonomous

The autonomy panel replaces manual PR auditing. Instead of a human reading every PR to find prompt gaps, the dashboard:
1. Detects the same patterns automatically
2. Quantifies them with a score that trends over time
3. Shows exactly which prompt/tool to fix
4. Updates every 2 minutes via the sync cron

**When architect fixes a prompt gap, the autonomy score will improve automatically.** This is the feedback loop that lets us iterate on prompts without manual auditing.

## Deploy 3: Metric Cards Enhancement

- Added 32.7% AI benchmark line to merge rate chart
- Added Tok/Merge metric card
- Grid expanded from 5 to 6 columns
- **Files**: `dashboard/components/overview/metric-cards.tsx`

## Deploy 4-5: Autonomy Score Improvements

- MAST-inspired failure category classification (cla_blocked, no_review, quick_reject, changes_requested, scope_reject, duplicate)
- CLA bot detection from review comments
- Hourly-throttled snapshot persistence for trend tracking
- SVG sparkline for inline trend visualization
- **Files**: `dashboard/app/api/metrics/autonomy/route.ts`, `dashboard/lib/schema.ts`, `dashboard/lib/db.ts`

## Deploy 6: Post-Merge Health Monitoring

- New API: `/api/metrics/post-merge` — tracks regression signals for merged PRs
- Checks GitHub for issues referencing PR number, revert commits, and related changes
- 3-day minimum monitoring window before marking PRs "healthy"
- **Current data**: 2 merged PRs being monitored (both in monitoring window)
- **Files**: `dashboard/app/api/metrics/post-merge/route.ts`

## Deploy 7: Post-Merge Health Panel (Frontend)

- New component: `PostMergeHealthPanel` — shows merged PR regression status
- Summary bar (healthy/monitoring/regressed ratio)
- Per-PR detail rows with health status, signals, age, diff size
- Placed side-by-side with Autonomy Health panel in 2-col grid
- **Files**: `dashboard/components/overview/post-merge-health-panel.tsx`, `dashboard/lib/hooks/use-post-merge.ts`

## Deploy 8: PR Velocity Timeline

- New API: `/api/metrics/velocity` — daily PR submissions with merge/close outcomes over 30 days
- 7-day rolling average line overlay
- Pure SVG stacked bar chart (merged/closed/open segments)
- Summary: 94 submitted, 2 merged, 44 closed over 4 active days, peak 50 PRs on 2026-03-16
- Merge ratio vs 32.7% AI benchmark comparison
- **Files**: `dashboard/app/api/metrics/velocity/route.ts`, `dashboard/lib/hooks/use-velocity.ts`, `dashboard/components/overview/velocity-timeline.tsx`

## Deploy 9: Response Time Panel

- New API: `/api/metrics/response-times` — time-to-first-review distribution
- Bucketed distribution chart (<1h, 1-4h, 4-12h, 12-24h, 1-3d, 3-7d, >7d)
- Per-repo response time ranking with review rates
- Industry benchmark: "AI PRs wait 4.6x longer"
- **Current data**: 16% review rate, 79 unreviewed PRs, median response <1h for those that do get reviewed
- **Files**: `dashboard/app/api/metrics/response-times/route.ts`, `dashboard/lib/hooks/use-response-times.ts`, `dashboard/components/overview/response-time-panel.tsx`

## Deploy 10: Alerts Banner

- New API: `/api/metrics/alerts` — real-time alerts computed from all metrics
- Thresholds: merge rate <5% (critical), review rate <20% (critical), duplicate spam, high volume, autonomy drops
- Expandable alert rows with detail on click
- Placed at top of overview page, before metric cards
- **Current alerts**: 2 critical (low merge rate 2.1%, low review rate 16%), 2 warnings (9 repos with spam, 50 PRs today)
- **Files**: `dashboard/app/api/metrics/alerts/route.ts`, `dashboard/lib/hooks/use-alerts.ts`, `dashboard/components/overview/alerts-banner.tsx`

## Deploy 11: Action Items Panel

- New API: `/api/metrics/action-items` — synthesizes ALL metrics into prioritized prompt fixes
- Each item has: priority (P0/P1/P2), category, problem description, suggested fix, impact estimate, data point
- Expandable cards showing full analysis on click
- **Current items**: 2 P0 (targeting, merge rate), 3 P1 (dedup, size, dead repos), 1 P2 (followup)
- **Files**: `dashboard/app/api/metrics/action-items/route.ts`, `dashboard/lib/hooks/use-action-items.ts`, `dashboard/components/overview/action-items-panel.tsx`

## Deploy 12: Merge Correlation Analysis

- New API: `/api/metrics/correlations` — analyzes which factors correlate with merge success
- 4 factors analyzed: diff size, PR type, files changed, day of week
- Auto-generated insights with lift calculations
- **Key findings**:
  - 1-25 line PRs merge at 4.3% (2x overall rate)
  - Test PRs have 0% merge rate across 13 attempts
  - 24% of PRs are oversized (>200 lines)
  - No Sunday/Monday merges in the dataset
- **Files**: `dashboard/app/api/metrics/correlations/route.ts`, `dashboard/lib/hooks/use-correlations.ts`, `dashboard/components/overview/correlation-panel.tsx`

## Endpoint verification (updated)

| Endpoint | Status |
|---|---|
| `/` (home page) | OK |
| `/api/metrics/overview` | OK - 94 total PRs, 2.2% merge rate |
| `/api/metrics/autonomy` | OK - score 0, 5 gaps detected |
| `/api/metrics/post-merge` | OK (NEW) - 2 merged PRs monitored |
| `/api/metrics/velocity` | OK - 30d timeline, 94 submitted |
| `/api/metrics/response-times` | OK - 16% review rate, median <1h |
| `/api/metrics/alerts` | OK - 2 critical, 2 warnings |
| `/api/metrics/action-items` | OK - 6 items (2 P0, 3 P1, 1 P2) |
| `/api/metrics/correlations` | OK - 4 factors, 4 insights generated |
| `/api/github/prs` | OK (was 500, fixed) |
| `/api/metrics/pr-types` | OK |
| `/api/metrics/pr-sizes` | OK |
| `/api/metrics/repo-health` | OK - 53 repos scored |
| `/api/metrics/stale-prs` | OK |
| `/api/metrics/followups` | OK |

## Overview page layout (top to bottom)

1. System identity bar (CLAWOSS / kimi-k2.5 / status)
2. Agent status card
3. **Alerts Banner** (critical/warning alerts from all metrics)
4. Metric cards (6 cols: PRs, Merge Rate, Tokens, Cost, Cost/Merge, Tok/Merge)
5. **Autonomy Health + Post-Merge Health** (2-col grid)
6. **Action Items Panel** (prioritized prompt fixes for architect)
7. **PR Velocity Timeline** (30-day stacked bar chart)
8. Repo Health (53 repos ranked)
9. PR Type Breakdown + Stale PRs (2-col grid)
10. **Merge Correlation Analysis** (what factors predict merge success)
11. **PR Size Distribution + Response Times** (2-col grid)
12. Pipeline telemetry bar
13. Activity timeline + Current task + Follow-ups + Recent PRs (3-col layout)
14. Art sidebar (Game of Life, DNA helix, Matrix rain)

## Environment variables confirmed

- TURSO_DATABASE_URL - set
- TURSO_AUTH_TOKEN - set
- CLAW_API_KEY - set

## Vercel cron

- `/api/github/sync` runs every 2 minutes (per `vercel.json`)

## Key insights from live data (actionable for prompt-architect)

1. **16% review rate** — 79/94 PRs got zero reviews. We're targeting repos that ignore us.
2. **2.2% merge rate** — well below 32.7% AI average. Prompt quality or targeting is the bottleneck.
3. **Autonomy score: 0** — every penalty maxed out (duplicates, oversized, wasted cycles).
4. **50 PRs in one day** — volume too high, not enough quality control.
5. **Median response <1h for reviewed PRs** — repos that engage, engage fast. Focus on them.
