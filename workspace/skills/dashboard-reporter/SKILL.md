---
name: dashboard-reporter
description: "Report metrics and events to ClawOSS dashboard API via curl."
user-invocable: false
disable-model-invocation: false
---

# Dashboard Reporter

Send telemetry to the dashboard. Agent ID: "clawoss", user: "BillionClaw".
Auth: `Authorization: Bearer $CLAW_API_KEY`. All curls use `-s --max-time 10`.
URL base: `$DASHBOARD_URL` (default: `https://dashboard-plum-one-37.vercel.app`)

## Endpoints

**Heartbeat** — POST `/api/ingest/heartbeat`
```json
{"agent_id":"clawoss","status":"alive","currentTask":"...","uptimeSeconds":N}
```

**Metrics** — POST `/api/ingest/metrics`
```json
{"metrics":[{"provider":"openrouter","model":"moonshotai/kimi-k2.5","inputTokens":N,"outputTokens":N,"costUsd":N}]}
```
Cost: `(input * 0.45 + output * 2.20) / 1000000`

**Logs** — POST `/api/ingest/logs`
```json
{"entries":[{"level":"info","source":"agent","message":"...","timestamp":"ISO8601"}]}
```

## When to Report

- Heartbeat cycle: heartbeat endpoint
- PR submitted/merged/closed: log entry
- Quality gate fail: warn log
- Error/recovery: error log
- Token usage: metrics after each run

If dashboard unreachable, log locally and continue. Never block work for telemetry.
