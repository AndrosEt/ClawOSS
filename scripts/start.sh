#!/usr/bin/env bash
set -euo pipefail

echo "=== Starting ClawOSS ==="

# Verify setup
if [ ! -L "$HOME/.openclaw/workspace" ]; then
    echo "Error: workspace not linked. Run 'npm run setup' first."
    exit 1
fi

# Register cron jobs
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Registering cron jobs..."
while IFS= read -r job; do
    name=$(echo "$job" | jq -r '.id')
    schedule=$(echo "$job" | jq -r '.schedule')
    session=$(echo "$job" | jq -r '.session')
    payload=$(echo "$job" | jq -r '.payload')
    model=$(echo "$job" | jq -r '.model // empty')

    model_flag=""
    if [ -n "$model" ]; then
        model_flag="--model $model"
    fi

    openclaw cron add \
        --name "$name" \
        --cron "$schedule" \
        --session "$session" \
        --message "$payload" \
        $model_flag \
        2>/dev/null || echo "  Cron job '$name' may already exist"
done < <(jq -c '.[]' "$PROJECT_DIR/config/cron-jobs.json")

# Start OpenClaw gateway
echo "Starting OpenClaw gateway..."
openclaw start --daemon

echo ""
echo "=== ClawOSS Running ==="
echo "Dashboard: check your Vercel deployment"
echo "Logs: tail -f $HOME/.openclaw/logs/openclaw-$(date +%Y-%m-%d).log"
echo "Stop: npm run stop"
