# Architect 2 — Current Work

## Status: COMPLETE — all assigned tasks done

## Completed (committed in 2280da0 by architect-1)
1. Fix quality score heuristic — checks actual PR files for test/spec patterns
2. Fix htmlUrl field population in GitHub sync
3. Fix cost formula in dashboard-reporter skill
4. Add oss-pr-review-handler to validate-config.mjs
5. Add CLAW_API_KEY validation in restart.sh
6. Fix BOOTSTRAP.md stale claim
7. pr-ledger-sync.sh shell interpolation (already fixed by architect-1)

## Completed (uncommitted — needs commit)
8. **subagent_runs table** — `dashboard/lib/schema.ts` + `dashboard/lib/db.ts`
9. **Sub-agent run ingest API** — `dashboard/app/api/ingest/subagent-run/route.ts` (NEW)
10. **Data retention cleanup API** — `dashboard/app/api/maintenance/cleanup/route.ts` (NEW)
11. **Per-repo success rate API** — `dashboard/app/api/metrics/repos/route.ts` (NEW)
12. **Follow-up metrics API** — `dashboard/app/api/metrics/followups/route.ts` (NEW)
13. **Hero merge rate + funnel** — `dashboard/components/overview/metric-cards.tsx` (modified)
14. **Config deep-merge** — `scripts/restart.sh` (modified)

## No Conflicts
- All TypeScript compiles clean
- No overlap with architect-1's files (HEARTBEAT.md, AGENTS.md, spawn templates)
