# V9 Dashboard Audit

**Date**: 2026-03-17
**Reviewer**: critique agent
**Scope**: All dashboard API endpoints checked for V9 compatibility

---

## V9-INCOMPATIBLE ENDPOINTS (need changes)

### 1. `/api/metrics/stale-prs/route.ts` — CLOSE recommendations conflict with V9 policy

**Lines 103-118**: The recommendation logic defaults to `"close"` for stale PRs:
- No human review after 7+ days → `close`
- 14+ days with only bot reviews → `close`
- 21+ days even with human review → `close`

**V9 policy**: Never close PRs. Stale PRs get a polite bump comment, not closure.

**Fix**: Change recommendations:
- Replace `"close"` with `"bump"` for stale PRs without human review
- Keep `"followup"` for changes_requested
- Add `"rework"` for PRs that were rejected but can be reworked
- Only recommend `"close"` for CLA-blocked, self-fork, or true duplicate PRs

Also update line 13 comment: "so we can close PRs" → "so we can bump stale PRs and prioritize follow-ups"

### 2. `/api/metrics/alerts/route.ts:162-172` — "Consider throttling" contradicts V9

The high-volume alert says:
```
"High volume often correlates with lower quality. Consider throttling."
```

V9 removed all rate limits. The alert should focus on quality, not volume.

**Fix**: Change detail to:
```
"${todayCount} PRs submitted today. Verify quality gates are holding — check dedup, health checks, and triage scores."
```

### 3. `/api/metrics/autonomy/route.ts` — Close-based metrics still useful but framing needs update

Lines 133-155 track:
- "PRs closed without review = bad targeting" — still valid
- "PRs closed within 1 hour = auto-rejected (CLA, CI, anti-bot)" — still valid

These are READ-ONLY metrics (they don't drive agent behavior), so they don't need V9 changes. The closed PR data is historical and useful for understanding past performance.

**No change needed** — these are observational metrics, not directives.

---

## V9-COMPATIBLE ENDPOINTS (no changes needed)

### `/api/agent/health-check/route.ts` — ALREADY UPDATED
- "SLOW DOWN" directive removed (task #11 complete)
- "REWORK NEEDED" directive correctly tells agent to rework instead of abandon
- `avoidRepos` and `reposWithOpenPRs` lists are compatible with V9

### `/api/metrics/action-items/route.ts` — ALREADY UPDATED
- CLA honesty detection added (P0 action item)
- No rate-limit references
- Correctly surfaces quality issues

### `/api/metrics/health/route.ts` — OK
- Pure health/uptime tracking, no behavioral directives

### `/api/metrics/velocity/route.ts` — OK
- Tracks daily submissions/merges/closes as observational data
- No behavioral directives

### `/api/metrics/overview/route.ts` — OK
- Aggregates PR counts by status, no close recommendations

### `/api/metrics/repos/route.ts` — OK
- Per-repo performance tracking, no behavioral directives

### `/api/metrics/alerts/route.ts` — PARTIALLY needs update (see #2 above)
- Merge rate alerts: OK (quality-focused)
- Review rate alerts: OK
- Duplicate detection alerts: OK
- Autonomy score alerts: OK
- High volume alert: NEEDS UPDATE (see #2)

### `/api/github/prs/route.ts` — OK
- Simple CRUD for PR data

### `/api/metrics/quality/route.ts` — OK (not checked in detail, likely observational)
### `/api/metrics/correlations/route.ts` — OK (not checked in detail, likely analytical)
### `/api/metrics/pr-types/route.ts` — OK
### `/api/metrics/pr-sizes/route.ts` — OK
### `/api/metrics/response-times/route.ts` — OK
### `/api/metrics/followups/route.ts` — OK
### `/api/metrics/post-merge/route.ts` — OK

---

## Summary

| Endpoint | Status | Priority |
|----------|--------|----------|
| stale-prs | **NEEDS UPDATE** — close→bump recommendations | P1 |
| alerts | **NEEDS UPDATE** — remove "throttling" language | P2 |
| health-check | Already V9 compatible | Done |
| action-items | Already V9 compatible | Done |
| All others | Compatible (observational only) | No change |

## Note on Dashboard as Agent Input

The dashboard's health-check endpoint (step 0c in HEARTBEAT.md) is the ONLY endpoint that drives agent behavior. The `directives`, `avoidRepos`, and `reposWithOpenPRs` fields are read by the agent and obeyed. All other endpoints are purely for human monitoring and don't affect agent behavior.

This means the stale-prs and alerts changes are lower priority — they affect the human dashboard view, not agent behavior. The health-check endpoint (already V9-compatible) is the only one that matters for agent autonomy.
