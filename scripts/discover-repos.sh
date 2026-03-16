#!/usr/bin/env bash
# discover-repos.sh — Find repos by topic, run profiles, score and rank
# Usage: discover-repos.sh <topic> [--min-stars 200] [--limit 20] [--write]
# Outputs ranked JSON array of repo profiles

if [ "${1:-}" = "--help" ] || [ $# -lt 1 ]; then
  echo "Usage: discover-repos.sh <topic> [--min-stars 200] [--limit 20] [--write]"
  echo "Finds repos by topic, profiles each, returns ranked list."
  exit 0
fi

TOPIC="$1"
MIN_STARS=200
LIMIT=20
WRITE_FLAG=""
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
SCRIPTS="$PROJECT_DIR/scripts"

shift 1
while [ $# -gt 0 ]; do
  case "$1" in
    --min-stars) MIN_STARS="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --write) WRITE_FLAG="--write"; shift ;;
    *) shift ;;
  esac
done

# ─── 1. Search repos by topic ───
REPOS=$(gh api "/search/repositories?q=topic:${TOPIC}+stars:>${MIN_STARS}&sort=updated&per_page=${LIMIT}" \
  --jq '.items[] | .full_name' 2>/dev/null || echo "")

if [ -z "$REPOS" ]; then
  # Fallback: search by keyword in description
  REPOS=$(gh api "/search/repositories?q=${TOPIC}+in:description+stars:>${MIN_STARS}&sort=updated&per_page=${LIMIT}" \
    --jq '.items[] | .full_name' 2>/dev/null || echo "")
fi

if [ -z "$REPOS" ]; then
  echo '{"topic": "'"$TOPIC"'", "repos_found": 0, "profiles": []}'
  exit 0
fi

REPO_COUNT=$(echo "$REPOS" | wc -l | xargs)

# ─── 2. Profile each repo ───
PROFILES="["
FIRST=true
HEALTHY=0
UNHEALTHY=0

while IFS= read -r repo; do
  [ -z "$repo" ] && continue

  PROFILE=$(bash "$SCRIPTS/repo-profile.sh" "$repo" $WRITE_FLAG 2>/dev/null)
  PROFILE_EXIT=$?

  if [ $PROFILE_EXIT -eq 0 ]; then
    HEALTHY=$((HEALTHY + 1))
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      PROFILES="${PROFILES},"
    fi
    PROFILES="${PROFILES}${PROFILE}"
  else
    UNHEALTHY=$((UNHEALTHY + 1))
  fi
done <<< "$REPOS"

PROFILES="${PROFILES}]"

# ─── 3. Sort by health score descending ───
SORTED=$(echo "$PROFILES" | python3 -c "
import json, sys
profiles = json.load(sys.stdin)
# Sort by health_score descending, then trust_score descending
profiles.sort(key=lambda x: (x.get('health_score', 0), x.get('trust_score', 0)), reverse=True)
print(json.dumps({
    'topic': '$TOPIC',
    'repos_found': $REPO_COUNT,
    'healthy': $HEALTHY,
    'unhealthy': $UNHEALTHY,
    'profiles': profiles
}, indent=2))
" 2>/dev/null || echo '{"topic": "'"$TOPIC"'", "error": "sort failed"}')

echo "$SORTED"
exit 0
