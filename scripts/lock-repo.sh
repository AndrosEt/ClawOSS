#!/usr/bin/env bash
# lock-repo.sh — Atomic lock for dedup system
# Usage: lock-repo.sh <owner/repo> <issue_url>
# Exit 0 = lock acquired, Exit 1 = already locked

REPO="${1:?Usage: lock-repo.sh <owner/repo> <issue_url>}"
ISSUE_URL="${2:?Usage: lock-repo.sh <owner/repo> <issue_url>}"
WORKSPACE_DIR="${WORKSPACE_DIR:-/Users/kevinlin/clawOSS/workspace}"
LOCK_DIR="${WORKSPACE_DIR}/memory/locks"
LOCK_FILE="${LOCK_DIR}/${REPO//\//_}.lock"

# Ensure lock directory exists
mkdir -p "$LOCK_DIR"

# Check for existing lock
if [ -f "$LOCK_FILE" ]; then
  # Check if stale (> 1 hour old)
  if [ "$(uname)" = "Darwin" ]; then
    LOCK_AGE=$(( $(date +%s) - $(stat -f %m "$LOCK_FILE") ))
  else
    LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE") ))
  fi

  if [ "$LOCK_AGE" -gt 3600 ]; then
    # Stale lock — remove and re-acquire
    rm -f "$LOCK_FILE"
  else
    EXISTING=$(cat "$LOCK_FILE" 2>/dev/null || echo "unknown")
    echo "{\"locked\": false, \"repo\": \"$REPO\", \"reason\": \"already locked\", \"existing_lock\": \"$EXISTING\", \"age_seconds\": $LOCK_AGE}"
    exit 1
  fi
fi

# Acquire lock
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ${ISSUE_URL}" > "$LOCK_FILE"
echo "{\"locked\": true, \"repo\": \"$REPO\", \"issue\": \"$ISSUE_URL\"}"
exit 0
