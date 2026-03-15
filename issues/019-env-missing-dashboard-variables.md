# 019: .env Missing Required Dashboard Variables

**Status:** Open
**Severity:** Medium
**Component:** .env / Dashboard Integration

## Description

The actual `.env` file is missing several variables that are required for the full system to function:

Present in `.env.example` but missing from `.env`:
- `DASHBOARD_URL` — needed by dashboard-reporter skill
- `CLAW_API_KEY` — needed for authenticated dashboard API calls

Present in `.env` but with wrong value:
- `GITHUB_EMAIL` — uses `drsparrowhawk@proton.me` instead of `billionclaw+clawoss@users.noreply.github.com`

## Impact

- Dashboard-reporter skill cannot send telemetry (no URL or auth key)
- Dashboard shows no data from agent (heartbeats, metrics, logs all fail)
- Git commits may still use old email that triggers content filter

## Recommended Fix

Update `.env` to include:
```
DASHBOARD_URL=https://dashboard-plum-one-37.vercel.app
CLAW_API_KEY=<shared-secret>
GITHUB_EMAIL=billionclaw+clawoss@users.noreply.github.com
```

## Related Files

- `.env` (actual environment)
- `.env.example` (template with correct variables)
- `workspace/skills/dashboard-reporter/SKILL.md`
- Issue #015 (dashboard URL)
- Issue #018 (env security)
