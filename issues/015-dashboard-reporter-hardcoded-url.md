# 015: Dashboard Reporter Uses Hardcoded URL Fallback

**Status:** Fixed (hooks now use process.env.DASHBOARD_URL with correct fallback)
**Severity:** Low
**Component:** workspace/hooks, workspace/skills/dashboard-reporter

## Description

The hooks originally hardcoded the dashboard URL without using environment variables. This was inflexible and required code changes to update the URL.

## Fix Applied

Both hooks (`dashboard-reporter` and `audit-logger`) now use:
```typescript
const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://clawoss-dashboard.vercel.app";
```

This allows the URL to be configured via environment variable while falling back to the correct custom domain.

## Current State

| Location | URL |
|----------|-----|
| Hooks (handler.ts) | `process.env.DASHBOARD_URL \|\| "https://clawoss-dashboard.vercel.app"` |
| Skill (SKILL.md) | `$DASHBOARD_URL` (default: `https://clawoss-dashboard.vercel.app`) |
| README.md | `https://clawoss-dashboard.vercel.app` |
| .env.example | `DASHBOARD_URL=https://clawoss-dashboard.vercel.app` |

All references are consistent and point to the same canonical URL.

## Related Files

- `workspace/hooks/dashboard-reporter/handler.ts`
- `workspace/hooks/audit-logger/handler.ts`
- `workspace/skills/dashboard-reporter/SKILL.md`
- `.env.example`
