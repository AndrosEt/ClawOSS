# Issue #30: Security: Update `hono` to resolve Prototype Pollution vulnerability

## What
Update `hono` dependency to fix security vulnerability.

## Details
- **File:** `package-lock.json`
- **Vulnerability:** Prototype pollution via `parseBody({ dot: true })`
- ** Advisory:** [GHSA-v8w9-8mx6-g223](https://github.com/advisories/GHSA-v8w9-8mx6-g223)
- **Affected:** `hono` < 4.12.7
- **Fix:** Update to `hono` >= 4.12.7

## Impact
Prototype pollution can lead to application crashes, logic bypasses, or RCE.

## Suggested Fix
Run `npm audit fix` to update `hono` and commit the updated `package-lock.json`.

## Done When
- `npm audit` shows no high/critical vulnerabilities for `hono`
- `package-lock.json` is updated
- Application still works (tests pass if available)
