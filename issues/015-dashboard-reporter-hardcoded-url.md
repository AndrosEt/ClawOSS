# 015: Dashboard Reporter Uses Hardcoded URL Fallback

**Status:** Fixed (canonical domain `clawoss-dashboard.vercel.app` configured)
**Severity:** Low
**Component:** workspace/hooks, workspace/skills/dashboard-reporter

## Description

The hooks originally hardcoded the dashboard URL without using environment variables. This was inflexible and required code changes to update the URL.

## Fix Applied

Both hooks (`dashboard-reporter` and `audit-logger`) now use:
```typescript
const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://clawoss-dashboard.vercel.app";
```

The canonical domain `clawoss-dashboard.vercel.app` now points to the dashboard. All references updated.

## Current State

| Location | URL |
|----------|-----|
| Hooks (handler.ts) | `process.env.DASHBOARD_URL \|\| "https://clawoss-dashboard.vercel.app"` |
| Skill (SKILL.md) | `$DASHBOARD_URL` (default: `https://clawoss-dashboard.vercel.app`) |
| README.md | `https://clawoss-dashboard.vercel.app` |
| .env.example | `DASHBOARD_URL=https://clawoss-dashboard.vercel.app` |

## Related Files

- `workspace/hooks/dashboard-reporter/handler.ts`
- `workspace/hooks/audit-logger/handler.ts`
- `workspace/skills/dashboard-reporter/SKILL.md`
- `.env.example`
