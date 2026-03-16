#!/usr/bin/env bash
# heartbeat-status.sh — Quick status dump for the agent
# Usage: heartbeat-status.sh
# Outputs JSON with sessions, PRs, queue depth, locks, wake state

PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"

# Wake state
WAKE_STATE=$(cat "$PROJECT_DIR/workspace/memory/wake-state.md" 2>/dev/null || echo "unavailable")
CONSECUTIVE=$(echo "$WAKE_STATE" | grep -oP 'consecutive_wakes: \K[0-9]+' || echo 0)
ERRORS=$(echo "$WAKE_STATE" | grep -oP 'errors_this_hour: \K[0-9]+' || echo 0)

# Lock files
LOCK_COUNT=$(ls "$PROJECT_DIR/workspace/memory/locks/"*.lock 2>/dev/null | wc -l | xargs)

# Queue depth
QUEUE_DEPTH=$(wc -l < "$PROJECT_DIR/workspace/memory/work-queue.md" 2>/dev/null || echo 0)

# Open PRs
OPEN_PRS=$(gh search prs --author BillionClaw --state open --json number --jq 'length' 2>/dev/null || echo 0)

cat <<ENDJSON
{
  "consecutive_wakes": $CONSECUTIVE,
  "errors_this_hour": $ERRORS,
  "lock_files": $LOCK_COUNT,
  "queue_depth": $QUEUE_DEPTH,
  "open_prs": $OPEN_PRS,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON
