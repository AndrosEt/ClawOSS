#!/usr/bin/env bash
set -euo pipefail

echo "=== ClawOSS Setup ==="

# Check prerequisites
command -v openclaw >/dev/null 2>&1 || { echo "Error: openclaw CLI not found. Install from https://github.com/openclaw/openclaw"; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "Error: gh CLI not found. Install from https://cli.github.com"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env for API keys
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
    echo "Loaded .env"
else
    echo "Warning: .env not found. Copy .env.example to .env and fill in values."
    exit 1
fi

# Verify OpenRouter API key
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
    echo "Error: OPENROUTER_API_KEY not set in .env"
    exit 1
fi
echo "OpenRouter API key configured"

# Configure git identity for BillionClaw
git config --global user.name "BillionClaw"
git config --global user.email "billionclaw+clawoss@users.noreply.github.com"
echo "Git identity set to BillionClaw <billionclaw+clawoss@users.noreply.github.com>"

# Check gh auth — prompt interactive login if not authenticated
if gh auth status 2>/dev/null; then
    echo "GitHub CLI already authenticated"
else
    echo "GitHub CLI not authenticated. Starting interactive login..."
    echo "Log in as BillionClaw (https://github.com/BillionClaw)"
    gh auth login
fi

# Verify gh auth
if gh auth status 2>/dev/null; then
    echo "GitHub CLI authenticated"
else
    echo "Error: gh CLI authentication failed. Run 'gh auth login' manually."
    exit 1
fi

# Create workspace symlink
WORKSPACE_DIR="$HOME/.openclaw/workspace"

if [ -L "$WORKSPACE_DIR" ]; then
    echo "Workspace symlink already exists"
elif [ -d "$WORKSPACE_DIR" ]; then
    echo "Warning: $WORKSPACE_DIR exists and is a directory. Backing up..."
    mv "$WORKSPACE_DIR" "${WORKSPACE_DIR}.backup.$(date +%Y%m%d%H%M%S)"
fi

ln -sf "$PROJECT_DIR/workspace" "$WORKSPACE_DIR"
echo "Linked workspace: $WORKSPACE_DIR -> $PROJECT_DIR/workspace"

# Copy config (don't symlink — needs local customization)
mkdir -p "$HOME/.openclaw"
if [ ! -f "$HOME/.openclaw/openclaw.json" ]; then
    cp "$PROJECT_DIR/config/openclaw.json" "$HOME/.openclaw/openclaw.json"
    echo "Copied openclaw.json to $HOME/.openclaw/"
else
    echo "openclaw.json already exists — skipping (check config/openclaw.json for updates)"
fi

# Register the clawoss agent
if openclaw agents list 2>/dev/null | grep -q "^- clawoss "; then
    echo "Agent 'clawoss' already registered"
else
    echo "Registering agent 'clawoss'..."
    openclaw agents add clawoss \
        --workspace "$PROJECT_DIR/workspace" \
        --model "openrouter/minimax/minimax-m2.5" \
        --non-interactive
    echo "Agent 'clawoss' registered"
fi

# Create working directories
mkdir -p /tmp/clawoss-workdir
mkdir -p "$HOME/.openclaw/logs"

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Edit ~/.openclaw/openclaw.json with your API keys"
echo "  2. Run: npm run start"
