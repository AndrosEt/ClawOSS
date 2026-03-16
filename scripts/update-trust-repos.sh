#!/usr/bin/env bash
# update-trust-repos.sh — Atomically update trust-repos.md
# Usage: update-trust-repos.sh <owner/repo> <action> [reason]
# Actions: promote (move to higher tier), deprioritize (add to blocklist), remove (clean from all)
# Exit 0 = updated, Exit 1 = error

if [ "${1:-}" = "--help" ] || [ $# -lt 2 ]; then
  echo "Usage: update-trust-repos.sh <owner/repo> <action> [reason]"
  echo "Actions: promote, deprioritize, remove"
  echo "Example: update-trust-repos.sh facebook/react deprioritize 'hostile maintainer, ban threat'"
  exit 0
fi

REPO="${1:?Usage: update-trust-repos.sh <owner/repo> <action> [reason]}"
ACTION="${2:?}"
REASON="${3:-}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
TRUST_FILE="$PROJECT_DIR/workspace/memory/trust-repos.md"
TODAY=$(date +%Y-%m-%d)

# Ensure file exists with basic structure
if [ ! -f "$TRUST_FILE" ]; then
  mkdir -p "$(dirname "$TRUST_FILE")"
  cat > "$TRUST_FILE" <<'INIT_EOF'
# Trust Repos

## Tier 1 (Merged PRs — highest trust)

## Tier 2 (Positive engagement)

## New (No history)

## Deprioritized (Skip)

INIT_EOF
fi

# Helper: remove repo from all sections
remove_from_all() {
  local repo="$1"
  local escaped=$(echo "$repo" | sed 's/\//\\\//g')
  # Remove lines containing the repo (case-insensitive)
  python3 -c "
import re, sys
content = open('$TRUST_FILE').read()
# Remove lines containing the repo (any section)
lines = content.split('\n')
filtered = [l for l in lines if not re.search(r'$escaped', l, re.IGNORECASE)]
# Clean up double blank lines
cleaned = re.sub(r'\n{3,}', '\n\n', '\n'.join(filtered))
open('$TRUST_FILE', 'w').write(cleaned)
" 2>/dev/null
}

case "$ACTION" in
  promote)
    # Remove from current location, add to Tier 1
    remove_from_all "$REPO"
    python3 -c "
content = open('$TRUST_FILE').read()
# Find Tier 1 section and append
marker = '## Tier 1'
if marker in content:
    idx = content.index(marker) + len(marker)
    # Find the end of the header line
    newline = content.index('\n', idx)
    # Find the next section or end
    next_section = content.find('\n## ', newline + 1)
    if next_section == -1:
        next_section = len(content)
    # Insert before next section
    entry = '| \`$REPO\` | Merged PR | $TODAY |\n'
    content = content[:next_section] + entry + content[next_section:]
else:
    content += '\n## Tier 1 (Merged PRs — highest trust)\n| \`$REPO\` | Merged PR | $TODAY |\n'
open('$TRUST_FILE', 'w').write(content)
" 2>/dev/null
    echo "{\"updated\": true, \"repo\": \"$REPO\", \"action\": \"promoted\", \"tier\": \"tier1\"}"
    ;;

  deprioritize)
    SKIP_UNTIL=""
    IS_PERMANENT=false
    if [ -z "$REASON" ]; then
      REASON="deprioritized"
    fi
    # Check if reason says permanent
    if echo "$REASON" | grep -qi "permanent\|ban\|hostile"; then
      SKIP_UNTIL="permanent"
      IS_PERMANENT=true
    else
      # Default: 30 days
      if date -v+30d +%Y-%m-%d &>/dev/null; then
        SKIP_UNTIL=$(date -v+30d +%Y-%m-%d)
      else
        SKIP_UNTIL=$(date -d "+30 days" +%Y-%m-%d)
      fi
    fi

    remove_from_all "$REPO"
    python3 -c "
content = open('$TRUST_FILE').read()
marker = '## Deprioritized'
entry = '| \`$REPO\` | $REASON | Skip Until: $SKIP_UNTIL |\n'
if marker in content:
    idx = content.index(marker)
    newline = content.index('\n', idx)
    content = content[:newline+1] + entry + content[newline+1:]
else:
    content += '\n## Deprioritized (Skip)\n' + entry
open('$TRUST_FILE', 'w').write(content)
" 2>/dev/null
    echo "{\"updated\": true, \"repo\": \"$REPO\", \"action\": \"deprioritized\", \"reason\": $(echo "$REASON" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), \"skip_until\": \"$SKIP_UNTIL\"}"
    ;;

  remove)
    remove_from_all "$REPO"
    echo "{\"updated\": true, \"repo\": \"$REPO\", \"action\": \"removed\"}"
    ;;

  *)
    echo "{\"updated\": false, \"repo\": \"$REPO\", \"error\": \"unknown action: $ACTION\"}"
    exit 1
    ;;
esac

exit 0
