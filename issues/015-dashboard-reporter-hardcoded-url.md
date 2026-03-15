# 015: Dashboard Reporter Uses Hardcoded URL Fallback

**Status:** Fixed (all references updated to dashboard-plum-one-37.vercel.app)
**Severity:** Low
**Component:** workspace/hooks, workspace/skills/dashboard-reporter

## Description

The hooks originally hardcoded the dashboard URL without using environment variables. This was inflexible and required code changes to update the URL. The dashboard was also redeployed from `clawoss-dashboard.vercel.app` to `dashboard-plum-one-37.vercel.app`.

## Fix Applied

Both hooks (`dashboard-reporter` and `audit-logger`) now use:
```typescript
const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://dashboard-plum-one-37.vercel.app";
```

All references (README, SKILL.md, HOOK.md, .env.example) updated to the canonical URL.

## Current State

| Location | URL |
|----------|-----|
| Hooks (handler.ts) | `process.env.DASHBOARD_URL \|\| "https://dashboard-plum-one-37.vercel.app"` |
| Skill (SKILL.md) | `$DASHBOARD_URL` (default: `https://dashboard-plum-one-37.vercel.app`) |
| README.md | `https://dashboard-plum-one-37.vercel.app` |
| .env.example | `DASHBOARD_URL=https://dashboard-plum-one-37.vercel.app` |

## Related Files

- `workspace/hooks/dashboard-reporter/handler.ts`
- `workspace/hooks/audit-logger/handler.ts`
- `workspace/skills/dashboard-reporter/SKILL.md`
- `.env.example`
