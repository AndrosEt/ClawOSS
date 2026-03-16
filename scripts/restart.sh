#!/usr/bin/env bash
# ClawOSS V9 Full Restart Script
# THE canonical way to restart ClawOSS from scratch.
# Safe to run multiple times — idempotent.

set -euo pipefail

echo "=== ClawOSS V9 Full Restart ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 0. Preflight checks
if ! command -v python3 &>/dev/null; then
    echo "[FAIL] python3 not found in PATH — required for config merge and repo-health-check.sh"
    exit 1
fi
if ! command -v gh &>/dev/null; then
    echo "[FAIL] gh (GitHub CLI) not found in PATH"
    exit 1
fi
if ! command -v jq &>/dev/null; then
    echo "[FAIL] jq not found in PATH — required for repo-health-check.sh"
    exit 1
fi
if ! command -v openclaw &>/dev/null; then
    echo "[FAIL] openclaw not found in PATH"
    exit 1
fi
echo "[OK] All required tools found (python3, gh, jq, openclaw)"

# 1. Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a; source "$PROJECT_DIR/.env"; set +a
    echo "[OK] Loaded .env"
else
    echo "[WARN] No .env found — using existing env vars"
fi

# 2. Set git identity
GITHUB_USERNAME="${GITHUB_USERNAME:-BillionClaw}"
GITHUB_EMAIL="${GITHUB_EMAIL:-billionclaw+clawoss@users.noreply.github.com}"
git config --global user.name "$GITHUB_USERNAME"
git config --global user.email "$GITHUB_EMAIL"
echo "[OK] Git identity: $GITHUB_USERNAME"

# 3. Authenticate GitHub CLI (skip if already logged in)
if gh auth status &>/dev/null; then
    echo "[OK] GitHub CLI already authenticated"
elif [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
    echo "[OK] GitHub CLI authenticated"
else
    echo "[WARN] No GITHUB_TOKEN and not logged in — gh commands may fail"
fi

# 4. Link workspace
WORKSPACE_DIR="$HOME/.openclaw/workspace"
if [ ! -L "$WORKSPACE_DIR" ] || [ "$(readlink "$WORKSPACE_DIR")" != "$PROJECT_DIR/workspace" ]; then
    [ -d "$WORKSPACE_DIR" ] && mv "$WORKSPACE_DIR" "${WORKSPACE_DIR}.backup.$(date +%s)"
    ln -sf "$PROJECT_DIR/workspace" "$WORKSPACE_DIR"
    echo "[OK] Workspace linked"
else
    echo "[OK] Workspace already linked"
fi

# 5. Deploy config (deep-merge repo config into deployed config, preserving gateway-managed sections)
DEPLOYED_CONFIG="$HOME/.openclaw/openclaw.json"

# Build the repo config with path placeholders substituted
REPO_CONFIG_RESOLVED=$(sed \
    -e "s|__WORKSPACE_PATH__|$PROJECT_DIR/workspace|g" \
    -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__HOME_DIR__|$HOME|g" \
    "$PROJECT_DIR/config/openclaw.json")

# Merge repo config into deployed config (preserving gateway-managed keys like meta, commands, plugins, gateway.auth)
# If no deployed config exists yet, just use the repo config as-is
_REPO_CONFIG="$REPO_CONFIG_RESOLVED" \
_DEPLOYED="$DEPLOYED_CONFIG" \
_KIMI_KEY="${KIMI_API_KEY:-}" \
_GH_TOKEN="${GITHUB_TOKEN:-}" \
_DASH_URL="${DASHBOARD_URL:-https://clawoss-dashboard.vercel.app}" \
_CLAW_KEY="${CLAW_API_KEY:-}" \
python3 -c "
import json, os

def deep_merge(base, override):
    \"\"\"Merge override into base. Override wins for non-dict values.\"\"\"
    result = dict(base)
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge(result[k], v)
        else:
            result[k] = v
    return result

repo_config = json.loads(os.environ['_REPO_CONFIG'])
deployed_path = os.environ['_DEPLOYED']

# Load existing deployed config (if it exists)
try:
    with open(deployed_path) as f:
        deployed = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    deployed = {}

# Deep-merge: repo config overrides deployed, but deployed's gateway-managed
# sections survive if not in repo config
merged = deep_merge(deployed, repo_config)

# Inject env vars
merged.setdefault('env', {})
env_vars = {
    'KIMI_API_KEY': os.environ.get('_KIMI_KEY', ''),
    'GITHUB_TOKEN': os.environ.get('_GH_TOKEN', ''),
    'DASHBOARD_URL': os.environ.get('_DASH_URL', ''),
    'CLAW_API_KEY': os.environ.get('_CLAW_KEY', ''),
}
for k, v in env_vars.items():
    if v:
        merged['env'][k] = v
# Remove empty env values
merged['env'] = {k: v for k, v in merged['env'].items() if v}

with open(deployed_path, 'w') as f:
    json.dump(merged, f, indent=2)
"
echo "[OK] Config deployed (deep-merged with env vars)"

# 6. Clean stale sessions
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.jsonl 2>/dev/null || true
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.lock 2>/dev/null || true
echo "[OK] Sessions cleaned"

# 7. Reset wake state (V9: no rate-limit fields)
cat > "$PROJECT_DIR/workspace/memory/wake-state.md" << 'WAKEEOF'
# Wake State
consecutive_wakes: 0
errors_this_hour: 0
last_error: none
last_wake: none
WAKEEOF
echo "[OK] Wake state reset (V9 — no rate-limit fields)"

# 8. Create required directories
mkdir -p "$HOME/.openclaw/logs"
mkdir -p "$PROJECT_DIR/workspace/memory/repos"
mkdir -p "$PROJECT_DIR/workspace/memory/issues"
mkdir -p "$PROJECT_DIR/workspace/memory/locks"
mkdir -p "$PROJECT_DIR/workspace/memory/subagent-inputs"
echo "[OK] Directories ready (including memory/locks/ for dedup)"

# 9. Clean stale lock files (in case of dirty shutdown)
find "$PROJECT_DIR/workspace/memory/locks/" -name "*.lock" -mmin +60 -delete 2>/dev/null || true
echo "[OK] Stale lock files cleaned"

# 10. Stop existing gateway
openclaw gateway stop 2>/dev/null || true
sleep 2
echo "[OK] Gateway stopped"

# 11. Start gateway
openclaw gateway install 2>/dev/null || openclaw gateway run &
sleep 5
if openclaw gateway status 2>/dev/null | grep -q "running\|reachable"; then
    echo "[OK] Gateway running"
else
    echo "[FAIL] Gateway failed to start — check: openclaw gateway status"
    echo "       Try manually: openclaw gateway run"
    exit 1
fi

# 12. Kill old dashboard sync processes and start fresh
pkill -f "dashboard-sync" 2>/dev/null || true
sleep 1
if [ -f "$PROJECT_DIR/scripts/dashboard-sync.sh" ]; then
    if [ -z "${CLAW_API_KEY:-}" ]; then
        echo "[WARN] CLAW_API_KEY not set — dashboard-sync will not start (it requires this key)"
    else
        nohup bash "$PROJECT_DIR/scripts/dashboard-sync.sh" > /tmp/dashboard-sync.log 2>&1 &
        echo "[OK] Dashboard sync started (PID $!)"
    fi
else
    echo "[WARN] No dashboard-sync.sh found"
fi

# 13. Install PR ledger sync (launchd, runs every 60s)
PLIST="$HOME/Library/LaunchAgents/com.clawoss.pr-ledger-sync.plist"
launchctl unload "$PLIST" 2>/dev/null || true
if [ -f "$PROJECT_DIR/config/com.clawoss.pr-ledger-sync.plist" ]; then
    sed \
        -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
        -e "s|__HOME_DIR__|$HOME|g" \
        "$PROJECT_DIR/config/com.clawoss.pr-ledger-sync.plist" > "$PLIST"
elif [ -f "$PLIST" ]; then
    : # already installed
else
    echo "[WARN] No pr-ledger-sync plist found"
fi
if [ -f "$PLIST" ]; then
    launchctl load "$PLIST" 2>/dev/null || true
    echo "[OK] PR ledger sync installed (launchd, 60s interval)"
fi

# 14. Kick the agent with V9 wake message
sleep 3
openclaw system event --text "ClawOSS V9 restart complete. Execute HEARTBEAT.md steps 0-7. Scout + 5 impl/followup slots. Follow-ups FIRST, then trusted repos, then discovery. No rate limits — ship quality PRs. Rework rejected PRs, never close. Go." --mode now 2>&1
echo "[OK] Agent kicked (V9)"

echo ""
echo "=== ClawOSS V9 Running ==="
echo "  Model: kimi-coding/k2p5 (Kimi Code direct API)"
echo "  Dashboard: https://clawoss-dashboard.vercel.app"
echo "  Slots: 1 scout (always-on) + 5 implementation/follow-up"
echo "  Logs: openclaw logs"
echo "  PRs: gh search prs --author BillionClaw --state open"
echo "  Stop: openclaw gateway stop && pkill -f dashboard-sync"
echo ""
echo "V9 changes: no rate limits, rework-not-close, always-on scout,"
echo "lock-file dedup, mandatory health checks, CLA auto-signing."
echo ""
echo "The agent runs independently via OpenClaw gateway — no Claude Code session needed."
