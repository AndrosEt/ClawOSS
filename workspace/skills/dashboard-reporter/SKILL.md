---
name: dashboard-reporter
description: "Report agent metrics, heartbeat data, and events to the ClawOSS Vercel dashboard API. Called during heartbeats and after significant events (PR submission, merge, error)."
user-invocable: false
disable-model-invocation: false
---

# Dashboard Reporter

Send telemetry data to the ClawOSS monitoring dashboard at https://dashboard-plum-one-37.vercel.app.

## Identity
All payloads identify as agent_id "clawoss", GitHub username "BillionClaw".

## Configuration
- Dashboard URL: `https://dashboard-plum-one-37.vercel.app`
- Auth: Bearer token via `$CLAW_API_KEY` environment variable

## Endpoints & Curl Commands

### 1. Heartbeat (every 60min or on status change)
```bash
curl -s -X POST "https://dashboard-plum-one-37.vercel.app/api/ingest/heartbeat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLAW_API_KEY" \
  -d '{
    "agent_id": "clawoss",
    "github_username": "BillionClaw",
    "status": "alive",
    "currentTask": "Working on owner/repo#123: Fix memory leak in parser",
    "uptimeSeconds": 3600,
    "metadata": {
      "session_key": "'"$SESSION_KEY"'",
      "cron_jobs_active": 5,
      "model": "minimax/MiniMax-M1-80k",
      "gateway_url": "ws://127.0.0.1:18789"
    }
  }'
```

### 2. Token/Cost Metrics (after each agent run or tool call batch)
```bash
curl -s -X POST "https://dashboard-plum-one-37.vercel.app/api/ingest/metrics" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLAW_API_KEY" \
  -d '{
    "metrics": [
      {
        "channel": "agent",
        "provider": "openrouter",
        "model": "minimax/MiniMax-M1-80k",
        "inputTokens": 15000,
        "outputTokens": 3000,
        "costUsd": 0.0074,
        "runDurationMs": 12000,
        "contextTokens": 45000
      }
    ]
  }'
```

**Cost calculation for Minimax M2.5:** $0.25 per million input tokens, $1.20 per million output tokens.
- Formula: `costUsd = (inputTokens * 0.25 / 1000000) + (outputTokens * 1.20 / 1000000)`

### 3. Log Entries (on any significant event)
```bash
curl -s -X POST "https://dashboard-plum-one-37.vercel.app/api/ingest/logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLAW_API_KEY" \
  -d '{
    "entries": [
      {
        "level": "info",
        "source": "agent",
        "message": "PR submitted: owner/repo#42 - Fix memory leak in parser",
        "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
        "metadata": {
          "event": "pr_submitted",
          "repo": "owner/repo",
          "pr_number": 42,
          "agent_id": "clawoss"
        }
      }
    ]
  }'
```

## When to Report

| Event | Endpoint | Level | Message Pattern |
|-------|----------|-------|-----------------|
| Heartbeat cycle | `/api/ingest/heartbeat` | - | Full status |
| PR submitted | `/api/ingest/logs` | info | `PR submitted: {repo}#{number} - {title}` |
| PR merged | `/api/ingest/logs` | info | `PR merged: {repo}#{number}` |
| PR rejected/closed | `/api/ingest/logs` | warn | `PR closed: {repo}#{number} - {reason}` |
| Quality gate fail | `/api/ingest/logs` | warn | `Quality gate failed: score {score} < threshold` |
| Error/recovery | `/api/ingest/logs` | error | `Error: {description}` |
| Work discovered | `/api/ingest/logs` | info | `Work discovered: {repo}#{issue} - {title}` |
| Token usage | `/api/ingest/metrics` | - | After each agent run |
| Agent start | `/api/ingest/logs` | info | `Agent started: session {key}` |
| Agent stop | `/api/ingest/logs` | info | `Agent stopped: session {key}` |

## Error Handling
- If the dashboard is unreachable, log the error locally and continue. Never block agent work for telemetry.
- Retry failed POSTs once after 5 seconds. If still failing, skip and try on next cycle.
- All curl commands should use `-s --max-time 10` to avoid hanging.
