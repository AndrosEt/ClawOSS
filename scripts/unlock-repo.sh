#!/usr/bin/env bash
# unlock-repo.sh — Remove repo lock
# Usage: unlock-repo.sh <owner/repo>
# Exit 0 always

REPO="${1:?Usage: unlock-repo.sh <owner/repo>}"
WORKSPACE_DIR="${WORKSPACE_DIR:-/Users/kevinlin/clawOSS/workspace}"
LOCK_FILE="${WORKSPACE_DIR}/memory/locks/${REPO//\//_}.lock"

if [ -f "$LOCK_FILE" ]; then
  rm -f "$LOCK_FILE"
  echo "{\"unlocked\": true, \"repo\": \"$REPO\"}"
else
  echo "{\"unlocked\": true, \"repo\": \"$REPO\", \"note\": \"was not locked\"}"
fi
exit 0
