---
name: dashboard-reporter
description: "Report agent metrics, heartbeat data, and events to the ClawOSS Vercel dashboard API. Called during heartbeats and after significant events (PR submission, merge, error)."
user-invocable: false
disable-model-invocation: false
---

# Dashboard Reporter

Send telemetry data to the ClawOSS monitoring dashboard.

## Identity
All payloads identify as agent_id "clawoss", GitHub username "BillionClaw".

## Endpoints
- POST $DASHBOARD_URL/api/ingest/heartbeat — Full heartbeat payload (every 60min)
- POST $DASHBOARD_URL/api/ingest/metrics — Token usage and cost metrics
- POST $DASHBOARD_URL/api/ingest/logs — Structured log entries

## When to Report
- Every heartbeat cycle (full status payload)
- On PR submission (pr_submitted event)
- On PR merge or rejection (pr_merged / pr_rejected event)
- On quality gate failure (quality_gate_failed event)
- On error or recovery (error event)
- On work discovery completion (work_discovered event)

## Payload
Use `curl` to POST JSON payloads with Authorization header:
```
curl -X POST "$DASHBOARD_URL/api/ingest/heartbeat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLAW_API_KEY" \
  -d '{"timestamp":"...","agent_id":"clawoss","github_username":"BillionClaw","status":"active",...}'
```

## Required Environment
- DASHBOARD_URL: Base URL of the Vercel dashboard
- CLAW_API_KEY: Shared secret for API authentication
