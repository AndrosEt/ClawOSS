#!/usr/bin/env bash
set -euo pipefail

echo "=== ClawOSS Full Restart ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 1. Load environment
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a; source "$PROJECT_DIR/.env"; set +a
    echo "[OK] Loaded .env"
else
    echo "[WARN] No .env found — using existing env vars"
fi

# 2. Set git identity
git config --global user.name "BillionClaw"
git config --global user.email "billionclaw+clawoss@users.noreply.github.com"
echo "[OK] Git identity: BillionClaw"

# 3. Authenticate GitHub CLI
if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null
    echo "[OK] GitHub CLI authenticated"
else
    echo "[WARN] No GITHUB_TOKEN — gh commands may fail"
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

# 5. Deploy config
yes | cp -f "$PROJECT_DIR/config/openclaw.json" "$HOME/.openclaw/openclaw.json" 2>/dev/null
# Re-inject env vars (they're not in the repo config)
python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f: c = json.load(f)
c.setdefault('env', {})
c['env']['KIMI_API_KEY'] = '${KIMI_API_KEY:-}'
c['env']['OPENROUTER_API_KEY'] = '${OPENROUTER_API_KEY:-}'
c['env']['GITHUB_TOKEN'] = '${GITHUB_TOKEN:-}'
c['env']['DASHBOARD_URL'] = '${DASHBOARD_URL:-https://clawoss-dashboard.vercel.app}'
c['env']['CLAW_API_KEY'] = '${CLAW_API_KEY:-clawoss-dashboard-key-2024}'
# Remove empty values
c['env'] = {k:v for k,v in c['env'].items() if v}
with open('$HOME/.openclaw/openclaw.json', 'w') as f: json.dump(c, f, indent=2)
" 2>/dev/null
echo "[OK] Config deployed with env vars"

# 6. Clean stale sessions
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.jsonl 2>/dev/null
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.lock 2>/dev/null
echo "[OK] Sessions cleaned"

# 7. Reset wake state
cat > "$PROJECT_DIR/workspace/memory/wake-state.md" << 'WAKEEOF'
# Wake State
consecutive_wakes: 0
errors_this_hour: 0
last_error: none
last_wake: none
WAKEEOF
echo "[OK] Wake state reset"

# 8. Create required directories
# Sub-agents create their own /tmp/clawoss-<issue>-<timestamp>/ dirs
# Clean up any stale ones from previous runs
find /tmp -maxdepth 1 -name 'clawoss-*' -type d -mmin +60 -exec rm -rf {} + 2>/dev/null
mkdir -p "$HOME/.openclaw/logs"
mkdir -p "$PROJECT_DIR/workspace/memory/repos"
mkdir -p "$PROJECT_DIR/workspace/memory/issues"
echo "[OK] Directories ready"

# 9. Stop existing gateway
openclaw gateway stop 2>/dev/null || true
sleep 2
echo "[OK] Gateway stopped"

# 10. Start gateway
openclaw gateway install 2>/dev/null || openclaw gateway run &
sleep 5
if openclaw gateway status 2>/dev/null | grep -q "running\|reachable"; then
    echo "[OK] Gateway running"
else
    echo "[FAIL] Gateway failed to start"
    exit 1
fi

# 11. Kill old dashboard sync processes and start fresh
pkill -f "dashboard-sync" 2>/dev/null || true
sleep 1
if [ -f "$PROJECT_DIR/scripts/dashboard-sync.sh" ]; then
    nohup bash "$PROJECT_DIR/scripts/dashboard-sync.sh" > /tmp/dashboard-sync.log 2>&1 &
    echo "[OK] Dashboard sync started (PID $!)"
else
    echo "[WARN] No dashboard-sync.sh found"
fi

# 12. Kick the agent
sleep 3
openclaw system event --text "ClawOSS restart complete. Read HEARTBEAT.md. Fill all 5 sub-agent slots. Discover broadly. Go." --mode now 2>&1
echo "[OK] Agent kicked"

echo ""
echo "=== ClawOSS Running ==="
echo "  Model: kimi-coding/k2p5 (Kimi Code direct API)"
echo "  Dashboard: https://clawoss-dashboard.vercel.app"
echo "  Logs: openclaw logs"
echo "  PRs: gh search prs --author BillionClaw --state open"
echo "  Stop: openclaw gateway stop && pkill -f dashboard-sync"
echo ""
echo "The agent will discover issues, spawn sub-agents, and submit PRs autonomously."
echo "No Claude Code session needed — the agent runs independently via OpenClaw gateway."
