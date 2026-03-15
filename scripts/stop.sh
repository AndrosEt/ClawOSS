#!/usr/bin/env bash
set -euo pipefail

echo "=== Stopping ClawOSS ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Remove ClawOSS cron jobs (don't stop the gateway — other agents may be running)
echo "Removing ClawOSS cron jobs..."
while IFS= read -r job_id; do
    openclaw cron rm "$job_id" 2>/dev/null && echo "  Removed cron: $job_id" || true
done < <(jq -r '.[].id' "$PROJECT_DIR/config/cron-jobs.json")

echo "ClawOSS cron jobs removed."
echo "Note: Gateway left running (other agents may depend on it)."
echo "To stop the gateway entirely: openclaw gateway stop"
