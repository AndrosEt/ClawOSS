# 015: Dashboard Reporter Uses Hardcoded URL Fallback

**Status:** Open
**Severity:** Low
**Component:** workspace/skills/dashboard-reporter/SKILL.md

## Description

The `dashboard-reporter` skill references `$DASHBOARD_URL` with a fallback to `https://clawoss-dashboard.vercel.app`, but the actual deployed dashboard is at `https://dashboard-plum-one-37.vercel.app`. The custom domain `clawoss-dashboard.vercel.app` is pending configuration.

If `$DASHBOARD_URL` is not set in the environment (which is likely since it's in `.env` but `.env` is only loaded by `setup.sh`), the agent will send telemetry to the wrong URL.

## Root Cause

The `.env.example` shows `DASHBOARD_URL=https://clawoss-dashboard.vercel.app` as the default, which is the intended custom domain but not the current actual URL. The actual Vercel deployment got an auto-assigned URL.

## Impact

- Dashboard telemetry (heartbeats, metrics, logs) may fail silently
- Agent continues operating but monitoring is blind
- The "never block work for telemetry" instruction in the skill means failures go unnoticed

## Recommended Fix

1. Update `.env.example` to use the actual deployed URL: `https://dashboard-plum-one-37.vercel.app`
2. Update the skill's fallback URL to match
3. Once custom domain is configured, update both

## Related Files

- `workspace/skills/dashboard-reporter/SKILL.md`
- `.env.example` (DASHBOARD_URL)
- `.env` (actual environment)
