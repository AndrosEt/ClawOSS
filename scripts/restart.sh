#!/usr/bin/env bash
# ClawOSS V9 Full Restart Script
# THE canonical way to restart ClawOSS from scratch.
# Safe to run multiple times — idempotent.
#
# DO NOT use `set -euo pipefail` — many steps use commands that may
# legitimately fail (process kills, gateway stop, launchctl unload).
# Each step handles its own errors explicitly.

echo "=== ClawOSS V9 Full Restart ==="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_DIR="$PROJECT_DIR/workspace"
DEPLOYED_CONFIG="$HOME/.openclaw/openclaw.json"
GATEWAY_PLIST="$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist"

# ── 0. Preflight checks ──────────────────────────────────────────────
MISSING=()
command -v python3 &>/dev/null || MISSING+=("python3")
command -v gh       &>/dev/null || MISSING+=("gh")
command -v jq       &>/dev/null || MISSING+=("jq")
command -v openclaw &>/dev/null || MISSING+=("openclaw")
command -v node     &>/dev/null || MISSING+=("node")

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "[FAIL] Missing required tools: ${MISSING[*]}"
    echo "       Install them and retry."
    exit 1
fi
echo "[OK] All required tools found (python3, gh, jq, openclaw, node)"

# 0b. Ensure `python` resolves to `python3` (macOS has no `python` binary)
# Subagents run target repo test suites that call `python` — this prevents failures.
if ! command -v python &>/dev/null && command -v python3 &>/dev/null; then
    mkdir -p "$HOME/.local/bin"
    ln -sf "$(which python3)" "$HOME/.local/bin/python"
    # Ensure ~/.local/bin is in PATH for this session
    export PATH="$HOME/.local/bin:$PATH"
    echo "[OK] Created python -> python3 symlink in ~/.local/bin"
elif command -v python &>/dev/null; then
    echo "[OK] python already available: $(which python)"
fi

# ── 1. Load environment ──────────────────────────────────────────────
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
    echo "[OK] Loaded .env"
else
    echo "[INFO] No .env found — using existing env vars"
fi

# ── 2. Git identity ──────────────────────────────────────────────────
GITHUB_USERNAME="${GITHUB_USERNAME:-BillionClaw}"
GITHUB_EMAIL="${GITHUB_EMAIL:-billionclaw+clawoss@users.noreply.github.com}"
git config --global user.name "$GITHUB_USERNAME"
git config --global user.email "$GITHUB_EMAIL"
echo "[OK] Git identity: $GITHUB_USERNAME <$GITHUB_EMAIL>"

# ── 3. GitHub CLI auth (skip if already authenticated) ────────────────
if gh auth status &>/dev/null; then
    echo "[OK] GitHub CLI already authenticated"
elif [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
    if gh auth status &>/dev/null; then
        echo "[OK] GitHub CLI authenticated via token"
    else
        echo "[WARN] GitHub CLI auth failed — gh commands may fail"
    fi
else
    echo "[WARN] No GITHUB_TOKEN and gh not authenticated — gh commands may fail"
fi

# ── 4. Link workspace ────────────────────────────────────────────────
OC_WORKSPACE="$HOME/.openclaw/workspace"
if [ ! -L "$OC_WORKSPACE" ] || [ "$(readlink "$OC_WORKSPACE" 2>/dev/null)" != "$WORKSPACE_DIR" ]; then
    if [ -d "$OC_WORKSPACE" ] && [ ! -L "$OC_WORKSPACE" ]; then
        mv "$OC_WORKSPACE" "${OC_WORKSPACE}.backup.$(date +%s)"
    fi
    rm -f "$OC_WORKSPACE" 2>/dev/null || true
    ln -sf "$WORKSPACE_DIR" "$OC_WORKSPACE"
    echo "[OK] Workspace linked: $WORKSPACE_DIR"
else
    echo "[OK] Workspace already linked"
fi

# ── 5. Deploy config (deep-merge repo config into deployed config) ────
# Preserves gateway-managed sections (meta, commands, plugins, gateway.auth)
# while overlaying all agent/tool/skill settings from the repo config.

REPO_CONFIG_RESOLVED=$(sed \
    -e "s|__WORKSPACE_PATH__|$WORKSPACE_DIR|g" \
    -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__HOME_DIR__|$HOME|g" \
    "$PROJECT_DIR/config/openclaw.json")

_REPO_CONFIG="$REPO_CONFIG_RESOLVED" \
_DEPLOYED="$DEPLOYED_CONFIG" \
_KIMI_KEY="${KIMI_API_KEY:-}" \
_GH_TOKEN="${GITHUB_TOKEN:-}" \
_DASH_URL="${DASHBOARD_URL:-https://clawoss-dashboard.vercel.app}" \
_CLAW_KEY="${CLAW_API_KEY:-}" \
_OPENROUTER_KEY="${OPENROUTER_API_KEY:-}" \
python3 -c "
import json, os

def deep_merge(base, override):
    result = dict(base)
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge(result[k], v)
        else:
            result[k] = v
    return result

repo_config = json.loads(os.environ['_REPO_CONFIG'])
deployed_path = os.environ['_DEPLOYED']

try:
    with open(deployed_path) as f:
        deployed = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    deployed = {}

merged = deep_merge(deployed, repo_config)

# Inject env vars (non-empty only)
merged.setdefault('env', {})
env_map = {
    'KIMI_API_KEY': os.environ.get('_KIMI_KEY', ''),
    'GITHUB_TOKEN': os.environ.get('_GH_TOKEN', ''),
    'DASHBOARD_URL': os.environ.get('_DASH_URL', ''),
    'CLAW_API_KEY': os.environ.get('_CLAW_KEY', ''),
    'OPENROUTER_API_KEY': os.environ.get('_OPENROUTER_KEY', ''),
}
for k, v in env_map.items():
    if v:
        merged['env'][k] = v
merged['env'] = {k: v for k, v in merged['env'].items() if v}

with open(deployed_path, 'w') as f:
    json.dump(merged, f, indent=2)
    f.write('\n')
"

if [ $? -eq 0 ]; then
    echo "[OK] Config deployed (deep-merged with env vars)"
else
    echo "[FAIL] Config merge failed — check python3 output above"
    exit 1
fi

# ── 5b. Deploy cron jobs ──────────────────────────────────────────────
# OpenClaw reads crons from ~/.openclaw/cron/jobs.json (not our repo config).
# We sync our repo's cron-jobs.json into the deployed store, preserving
# job IDs and state from the existing store so run history isn't lost.
CRON_STORE="$HOME/.openclaw/cron/jobs.json"
REPO_CRONS="$PROJECT_DIR/config/cron-jobs.json"

if [ -f "$REPO_CRONS" ]; then
    mkdir -p "$HOME/.openclaw/cron"
    _REPO_CRONS="$REPO_CRONS" _CRON_STORE="$CRON_STORE" _PROJECT_DIR="$PROJECT_DIR" \
    python3 -c "
import json, os

repo_crons_path = os.environ['_REPO_CRONS']
store_path = os.environ['_CRON_STORE']
project_dir = os.environ['_PROJECT_DIR']

with open(repo_crons_path) as f:
    repo_crons = json.load(f)

# Load existing store (preserves job IDs, state, timestamps)
try:
    with open(store_path) as f:
        store = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    store = {'version': 1, 'jobs': []}

# Index existing jobs by name for matching
existing = {j.get('name', j.get('id', '')): j for j in store.get('jobs', [])}

# Merge: update messages/schedules from repo config, preserve state
for rc in repo_crons:
    name = rc.get('name', rc.get('id', ''))
    if name in existing:
        ej = existing[name]
        # Update payload, schedule, sessionTarget, wakeMode from repo
        ej['payload'] = rc['payload']
        ej['schedule'] = rc['schedule']
        ej['sessionTarget'] = rc.get('sessionTarget', 'isolated')
        ej['wakeMode'] = rc.get('wakeMode', 'next-heartbeat')
        # Fix delivery: mode=none should NOT have channel
        ej['delivery'] = {'mode': rc.get('delivery', {}).get('mode', 'none')}
        # Clear error state for retry
        if 'state' in ej:
            ej['state'].pop('lastError', None)
            ej['state'].pop('lastErrorReason', None)
            ej['state']['consecutiveErrors'] = 0
    # else: new cron job — would need openclaw cron add (skip for now)

store['jobs'] = list(existing.values())
with open(store_path, 'w') as f:
    json.dump(store, f, indent=2)
    f.write('\n')
print('Cron store synced')
" 2>&1
    if [ $? -eq 0 ]; then
        echo "[OK] Cron jobs synced to ~/.openclaw/cron/jobs.json"
    else
        echo "[WARN] Cron sync failed — crons may use stale config"
    fi
else
    echo "[INFO] No config/cron-jobs.json found — skipping cron sync"
fi

# ── 6. Update gateway plist PATH (ensure python3, gh, jq are reachable) ─
# The gateway spawns subagents that need these tools. launchd has a minimal
# PATH so we inject the paths we need.
if [ -f "$GATEWAY_PLIST" ]; then
    # Get current PATH from plist
    PLIST_PATH=$(/usr/libexec/PlistBuddy -c "Print :EnvironmentVariables:PATH" "$GATEWAY_PLIST" 2>/dev/null || echo "")
    NEEDS_UPDATE=false

    # Directories that must be in the plist PATH
    REQUIRED_DIRS=()
    for dir in "/opt/homebrew/bin" "/usr/local/bin" "/usr/bin" "/bin" "/usr/sbin" "/sbin"; do
        if [ -d "$dir" ] && [[ ":$PLIST_PATH:" != *":$dir:"* ]]; then
            REQUIRED_DIRS+=("$dir")
            NEEDS_UPDATE=true
        fi
    done

    # Also add nvm node path if present
    NVM_NODE_DIR="$(dirname "$(which node)" 2>/dev/null || echo "")"
    if [ -n "$NVM_NODE_DIR" ] && [[ ":$PLIST_PATH:" != *":$NVM_NODE_DIR:"* ]]; then
        REQUIRED_DIRS+=("$NVM_NODE_DIR")
        NEEDS_UPDATE=true
    fi

    # Add gh path if not already included
    GH_DIR="$(dirname "$(which gh)" 2>/dev/null || echo "")"
    if [ -n "$GH_DIR" ] && [[ ":$PLIST_PATH:" != *":$GH_DIR:"* ]]; then
        REQUIRED_DIRS+=("$GH_DIR")
        NEEDS_UPDATE=true
    fi

    # Add ~/.local/bin (python -> python3 symlink lives here)
    LOCAL_BIN="$HOME/.local/bin"
    if [ -d "$LOCAL_BIN" ] && [[ ":$PLIST_PATH:" != *":$LOCAL_BIN:"* ]]; then
        REQUIRED_DIRS+=("$LOCAL_BIN")
        NEEDS_UPDATE=true
    fi

    if [ "$NEEDS_UPDATE" = true ] && [ -n "$PLIST_PATH" ]; then
        NEW_PATH="$PLIST_PATH"
        for dir in "${REQUIRED_DIRS[@]}"; do
            NEW_PATH="$NEW_PATH:$dir"
        done
        /usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:PATH $NEW_PATH" "$GATEWAY_PLIST" 2>/dev/null || true
        echo "[OK] Gateway plist PATH updated (added: ${REQUIRED_DIRS[*]})"
    else
        echo "[OK] Gateway plist PATH already includes required dirs"
    fi
else
    echo "[INFO] No gateway plist found at $GATEWAY_PLIST — gateway install will create it"
fi

# ── 7. Clean stale sessions ──────────────────────────────────────────
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.jsonl 2>/dev/null || true
rm -f "$HOME/.openclaw/agents/clawoss/sessions/"*.lock 2>/dev/null || true
echo "[OK] Sessions cleaned"

# ── 8. Reset wake state (V9: no rate-limit fields) ───────────────────
cat > "$WORKSPACE_DIR/memory/wake-state.md" << 'WAKEEOF'
consecutive_wakes: 0
errors_this_hour: 0
last_error: none
last_wake: none
WAKEEOF
echo "[OK] Wake state reset (V9 — no rate-limit fields)"

# ── 9. Create required directories ───────────────────────────────────
mkdir -p "$HOME/.openclaw/logs"
mkdir -p "$WORKSPACE_DIR/memory/repos"
mkdir -p "$WORKSPACE_DIR/memory/issues"
mkdir -p "$WORKSPACE_DIR/memory/locks"
mkdir -p "$WORKSPACE_DIR/memory/subagent-inputs"
echo "[OK] Directories ready (including memory/locks/ for dedup)"

# ── 10. Clean stale lock files (dirty shutdown leftovers) ─────────────
STALE_LOCKS=$(find "$WORKSPACE_DIR/memory/locks/" -name "*.lock" -mmin +60 2>/dev/null | wc -l | tr -d ' ')
find "$WORKSPACE_DIR/memory/locks/" -name "*.lock" -mmin +60 -delete 2>/dev/null || true
echo "[OK] Stale lock files cleaned ($STALE_LOCKS removed)"

# ── 11. Clean orphaned /tmp workspaces ────────────────────────────────
ORPHANED=$(find /tmp -maxdepth 1 -name "clawoss-*" -type d -mmin +120 2>/dev/null | wc -l | tr -d ' ')
find /tmp -maxdepth 1 -name "clawoss-*" -type d -mmin +120 -exec rm -rf {} + 2>/dev/null || true
echo "[OK] Orphaned workspaces cleaned ($ORPHANED removed)"

# ── 12. Stop existing gateway ─────────────────────────────────────────
openclaw gateway stop 2>/dev/null || true
sleep 2
echo "[OK] Gateway stopped"

# ── 13. Start gateway (prefer install for launchd, fallback to run) ───
# `gateway install` creates/updates the launchd plist and loads it.
# The plist has all env vars baked in (KIMI_API_KEY, GITHUB_TOKEN, etc.)
# `gateway run &` is a fallback that inherits the current shell env.
if openclaw gateway install 2>/dev/null; then
    echo "[OK] Gateway installed via launchd"
else
    echo "[WARN] gateway install failed — falling back to gateway run"
    openclaw gateway run &
    echo "[OK] Gateway started in background (PID $!)"
fi

sleep 5

# Verify gateway is running
if openclaw gateway status 2>/dev/null | grep -qi "running\|reachable\|ok"; then
    echo "[OK] Gateway verified running"
else
    echo "[FAIL] Gateway not running after startup"
    echo "       Try: openclaw gateway status"
    echo "       Try: openclaw gateway run"
    echo "       Logs: cat ~/.openclaw/logs/gateway.err.log"
    exit 1
fi

# ── 14. Dashboard sync ───────────────────────────────────────────────
pkill -f "dashboard-sync" 2>/dev/null || true
sleep 1

if [ -f "$PROJECT_DIR/scripts/dashboard-sync.sh" ]; then
    if [ -z "${CLAW_API_KEY:-}" ]; then
        echo "[WARN] CLAW_API_KEY not set — dashboard-sync will not start"
    else
        nohup bash "$PROJECT_DIR/scripts/dashboard-sync.sh" > /tmp/dashboard-sync.log 2>&1 &
        echo "[OK] Dashboard sync started (PID $!)"
    fi
else
    echo "[INFO] No dashboard-sync.sh found — skipping"
fi

# ── 15. PR ledger sync (launchd, runs every 60s) ─────────────────────
LEDGER_PLIST="$HOME/Library/LaunchAgents/com.clawoss.pr-ledger-sync.plist"
launchctl unload "$LEDGER_PLIST" 2>/dev/null || true

if [ -f "$PROJECT_DIR/config/com.clawoss.pr-ledger-sync.plist" ]; then
    sed \
        -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
        -e "s|__HOME_DIR__|$HOME|g" \
        "$PROJECT_DIR/config/com.clawoss.pr-ledger-sync.plist" > "$LEDGER_PLIST"
    launchctl load "$LEDGER_PLIST" 2>/dev/null || true
    echo "[OK] PR ledger sync installed (launchd, 60s interval)"
elif [ -f "$LEDGER_PLIST" ]; then
    launchctl load "$LEDGER_PLIST" 2>/dev/null || true
    echo "[OK] PR ledger sync loaded (existing plist)"
else
    echo "[INFO] No pr-ledger-sync plist found — skipping"
fi

# ── 16. Kick the agent ───────────────────────────────────────────────
sleep 3
if openclaw system event \
    --text "ClawOSS V9 restart complete. Execute HEARTBEAT.md steps 0-7. Scout + 5 impl/followup slots. Follow-ups FIRST, then trusted repos, then discovery. No rate limits — ship quality PRs. Rework rejected PRs, never close. Sign CLAs when prompted. Go." \
    --mode now 2>&1; then
    echo "[OK] Agent kicked (V9)"
else
    echo "[WARN] Agent wake event failed — agent will wake on next heartbeat timer"
fi

# ── Summary ───────────────────────────────────────────────────────────
echo ""
echo "=== ClawOSS V9 Running ==="
echo "  Model: kimi-coding/k2p5 (Kimi Code direct API)"
echo "  Dashboard: https://clawoss-dashboard.vercel.app"
echo "  Slots: 1 scout (always-on) + 5 implementation/follow-up"
echo "  Logs: openclaw logs"
echo "  PRs: gh search prs --author BillionClaw --state open"
echo "  Stop: openclaw gateway stop && pkill -f dashboard-sync"
echo ""
echo "V9 features: no rate limits, rework-not-close, always-on scout,"
echo "lock-file dedup, mandatory health checks, CLA auto-signing."
echo ""
echo "The agent runs independently via OpenClaw gateway — no manual intervention needed."
