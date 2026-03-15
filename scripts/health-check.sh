#!/usr/bin/env bash
set -euo pipefail

echo "=== ClawOSS Health Check ==="

# Check gateway
if openclaw status 2>/dev/null | grep -q "running"; then
    echo "[OK] Gateway is running"
else
    echo "[FAIL] Gateway is not running"
    exit 1
fi

# Check gh auth
if gh auth status 2>/dev/null; then
    echo "[OK] GitHub CLI authenticated"
else
    echo "[FAIL] GitHub CLI not authenticated"
fi

# Check workspace
if [ -L "$HOME/.openclaw/workspace" ]; then
    echo "[OK] Workspace linked"
else
    echo "[FAIL] Workspace not linked"
fi

# Check cron jobs
CRON_COUNT=$(openclaw cron list 2>/dev/null | wc -l)
echo "[INFO] $CRON_COUNT cron jobs registered"

echo ""
echo "=== Health Check Complete ==="
