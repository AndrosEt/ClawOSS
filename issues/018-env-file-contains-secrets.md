# 018: .env File Contains Real API Keys — Security Risk

**Status:** Open
**Severity:** CRITICAL
**Component:** .env / Security

## Description

The `.env` file contains what appear to be real API keys:
- `OPENROUTER_API_KEY=sk-or-v1-...` (OpenRouter API key)
- `GITHUB_TOKEN=ghp_...` (GitHub Personal Access Token)

While `.env` is listed in `.gitignore` and should not be committed, the file exists on disk with these credentials. If the repo is ever cloned with the `.env` file present (e.g., from a backup or shared working directory), these keys would be exposed.

## Additional Issues in .env

1. **GITHUB_EMAIL still uses old format**: `drsparrowhawk@proton.me` instead of `billionclaw+clawoss@users.noreply.github.com` (fixed in setup.sh and .env.example but not in the actual .env)
2. **Missing DASHBOARD_URL**: The `.env` lacks `DASHBOARD_URL` which the dashboard-reporter skill needs
3. **Missing CLAW_API_KEY**: The `.env` lacks `CLAW_API_KEY` which the dashboard API requires for authentication

## Impact

- If keys are real, they could be used for unauthorized API access
- Cost exposure on OpenRouter account
- Unauthorized GitHub actions on BillionClaw account
- Agent cannot communicate with dashboard without DASHBOARD_URL and CLAW_API_KEY

## Recommended Fix

1. Rotate both keys immediately if they are real
2. Update `.env` to match `.env.example` format with all required variables
3. Add `DASHBOARD_URL=https://dashboard-plum-one-37.vercel.app`
4. Add `CLAW_API_KEY=<generated-secret>`
5. Fix `GITHUB_EMAIL` to noreply format

## Related Files

- `.env` (actual secrets)
- `.env.example` (template)
- `.gitignore` (should exclude .env)
- Issue #007 (email format)
- Issue #015 (dashboard URL)
