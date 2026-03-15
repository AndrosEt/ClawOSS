#!/usr/bin/env bash
set -euo pipefail

echo "=== ClawOSS Setup ==="

# Check prerequisites
command -v openclaw >/dev/null 2>&1 || { echo "Error: openclaw CLI not found. Install from https://github.com/openclaw/openclaw"; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "Error: gh CLI not found. Install from https://cli.github.com"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Configure git identity for BillionClaw
git config --global user.name "BillionClaw"
git config --global user.email "drsparrowhawk@proton.me"
echo "Git identity set to BillionClaw <drsparrowhawk@proton.me>"

# Load .env for GITHUB_TOKEN if available
if [ -f "$PROJECT_DIR/.env" ]; then
    export GITHUB_TOKEN=$(grep '^GITHUB_TOKEN=' "$PROJECT_DIR/.env" | cut -d= -f2)
fi

# Authenticate gh CLI
if gh auth status 2>/dev/null; then
    echo "GitHub CLI already authenticated"
elif [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token
    echo "GitHub CLI authenticated with PAT from .env"
else
    echo "GitHub CLI not authenticated. Run: gh auth login"
    echo "Or add GITHUB_TOKEN to .env"
    exit 1
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

# Create working directories
mkdir -p /tmp/clawoss-workdir
mkdir -p "$HOME/.openclaw/logs"

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Edit ~/.openclaw/openclaw.json with your API keys"
echo "  2. Run: npm run start"
