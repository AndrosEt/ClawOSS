# 015: Dashboard Reporter Uses Hardcoded URL Fallback

**Status:** Fixed
**Severity:** Low
**Component:** workspace/skills/dashboard-reporter/SKILL.md

## Description

The `dashboard-reporter` skill and hooks referenced `$DASHBOARD_URL` with a fallback URL. The custom domain `clawoss-dashboard.vercel.app` has been configured and all references updated.

## Resolution

- Dashboard deployed to `clawoss-dashboard.vercel.app`
- All hooks (`audit-logger`, `dashboard-reporter`) hardcode `https://clawoss-dashboard.vercel.app`
- Skill SKILL.md references the correct URL
- `.env.example` uses the correct `DASHBOARD_URL`
- README.md and CHANGELOG.md updated to reference the correct URL

## Related Files

- `workspace/hooks/dashboard-reporter/handler.ts`
- `workspace/hooks/audit-logger/handler.ts`
- `workspace/skills/dashboard-reporter/SKILL.md`
- `.env.example`
