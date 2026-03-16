#!/usr/bin/env bash
# workspace-cleanup.sh — Full cleanup after subagent completes or aborts
# Usage: workspace-cleanup.sh <workspace_path> [--keep-on-failure]
# Removes workspace, lock file, updates state. Always succeeds (exit 0).

WORKDIR="${1:?Usage: workspace-cleanup.sh <workspace_path> [--keep-on-failure]}"
KEEP_ON_FAILURE="${2:-}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"

# ─── 1. Remove lock file ───
# Extract repo from workspace name: /tmp/clawoss-{issue}-{timestamp}
# Lock files are named {owner}_{repo}.lock — we need to find the matching one
if [ -d "$PROJECT_DIR/workspace/memory/locks" ]; then
  # Find lock files that reference this workspace or were created recently
  for lockfile in "$PROJECT_DIR/workspace/memory/locks/"*.lock; do
    [ -f "$lockfile" ] || continue
    # Check if lock file content mentions this workspace
    if grep -q "$(basename "$WORKDIR")" "$lockfile" 2>/dev/null; then
      rm -f "$lockfile"
      break
    fi
  done
fi

# ─── 2. Remove workspace ───
if [ -d "$WORKDIR" ]; then
  if [ "$KEEP_ON_FAILURE" = "--keep-on-failure" ]; then
    echo '{"action": "kept", "workspace": "'"$WORKDIR"'", "reason": "keep-on-failure flag"}'
  else
    rm -rf "$WORKDIR"
    echo '{"action": "removed", "workspace": "'"$WORKDIR"'"}'
  fi
else
  echo '{"action": "already_gone", "workspace": "'"$WORKDIR"'"}'
fi

exit 0
