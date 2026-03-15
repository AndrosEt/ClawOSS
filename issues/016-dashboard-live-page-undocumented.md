# 016: Dashboard Live Feed Page Not Documented

**Status:** Open
**Severity:** Low
**Component:** Dashboard / Documentation

## Description

The dashboard has a **Live Feed** page (`/live`) with conversation streaming, session picker, and auto-scroll functionality. This page is not documented in the README's Dashboard section, which only lists: Overview, PR Tracker, Health, Quality, Logs, Settings.

Additionally, the dashboard has undocumented API routes:
- `/api/ingest/conversation` — conversation message ingestion
- `/api/conversation` — conversation query endpoint
- `/api/connection-status` — agent connection health check

## Impact

- Users and operators don't know the Live Feed feature exists
- The conversation ingest API is undocumented, so the agent's dashboard-reporter skill doesn't know to send conversation data

## Recommended Fix

Add "Live Feed" to the README Dashboard section:
```
- **Live Feed** — Real-time conversation stream with session picker and auto-scroll
```

## Related Files

- `dashboard/app/live/page.tsx`
- `dashboard/app/api/ingest/conversation/route.ts`
- `dashboard/app/api/conversation/route.ts`
- `dashboard/app/api/connection-status/route.ts`
- `README.md` (Dashboard section)
