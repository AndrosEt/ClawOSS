#!/usr/bin/env bash
set -euo pipefail

echo "=== ClawOSS Setup ==="

# Check prerequisites
command -v openclaw >/dev/null 2>&1 || { echo "Error: openclaw CLI not found. Install from https://github.com/openclaw/openclaw"; exit 1; }
command -v gh >/dev/null 2>&1 || { echo "Error: gh CLI not found. Install from https://cli.github.com"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found"; exit 1; }

# Configure git identity for BillionClaw
git config --global user.name "BillionClaw"
git config --global user.email "drsparrowhawk@proton.me"
echo "Git identity set to BillionClaw <drsparrowhawk@proton.me>"

# Check gh auth — must be logged in as BillionClaw
if gh auth status 2>&1 | grep -q "BillionClaw"; then
    echo "GitHub CLI authenticated as BillionClaw"
else
    echo "Warning: gh CLI not authenticated as BillionClaw."
    echo "Run: gh auth login"
    echo "Log in with the BillionClaw account."
    exit 1
fi

# Create workspace symlink
WORKSPACE_DIR="$HOME/.openclaw/workspace"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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
