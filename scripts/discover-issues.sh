#!/usr/bin/env bash
# discover-issues.sh — Search GitHub for issues matching criteria
# Usage: discover-issues.sh <search_query> [--tier 0|1|2] [--limit 30] [--label bug] [--lang python]
# Wraps gh api /search/issues with error handling, pagination, rate limit awareness
# Outputs clean JSON array of issues with metadata

if [ "${1:-}" = "--help" ] || [ $# -lt 1 ]; then
  echo "Usage: discover-issues.sh <search_query> [--tier 0|1|2] [--limit 30] [--label bug] [--lang python]"
  echo "Tiers: 0=trusted repos, 1=agentic AI niche, 2=general high-star"
  echo "Example: discover-issues.sh 'is:issue is:open label:bug' --tier 1 --limit 20"
  exit 0
fi

QUERY="$1"
TIER=""
LIMIT=30
LABEL=""
LANG=""

shift 1
while [ $# -gt 0 ]; do
  case "$1" in
    --tier) TIER="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --label) LABEL="$2"; shift 2 ;;
    --lang) LANG="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Date calculations
if date -v-1d +%Y-%m-%d &>/dev/null; then
  THREE_DAYS_AGO=$(date -v-3d +%Y-%m-%d)
  TWO_WEEKS_AGO=$(date -v-14d +%Y-%m-%d)
else
  THREE_DAYS_AGO=$(date -d "3 days ago" +%Y-%m-%d)
  TWO_WEEKS_AGO=$(date -d "14 days ago" +%Y-%m-%d)
fi

# Build query based on tier
SEARCH_Q="$QUERY"
case "$TIER" in
  0)
    # Tier 0: Trusted repos — caller provides repo list in query
    SEARCH_Q="$QUERY+created:>$THREE_DAYS_AGO"
    ;;
  1)
    # Tier 1: Agentic AI niche — high value
    SEARCH_Q="is:issue+is:open+stars:>200+created:>$THREE_DAYS_AGO"
    [ -n "$LABEL" ] && SEARCH_Q="${SEARCH_Q}+label:${LABEL}" || SEARCH_Q="${SEARCH_Q}+label:bug"
    [ -n "$LANG" ] && SEARCH_Q="${SEARCH_Q}+language:${LANG}"
    ;;
  2)
    # Tier 2: General high-star
    SEARCH_Q="is:issue+is:open+stars:>200+created:>$THREE_DAYS_AGO"
    [ -n "$LABEL" ] && SEARCH_Q="${SEARCH_Q}+label:${LABEL}" || SEARCH_Q="${SEARCH_Q}+label:bug"
    [ -n "$LANG" ] && SEARCH_Q="${SEARCH_Q}+language:${LANG}"
    ;;
  "")
    # No tier — use query as-is with freshness filter
    if ! echo "$QUERY" | grep -q "created:"; then
      SEARCH_Q="${QUERY}+created:>$TWO_WEEKS_AGO"
    fi
    ;;
esac

# ─── Execute search with rate limit awareness ───
RESULT=$(gh api "/search/issues?q=${SEARCH_Q}&sort=created&order=desc&per_page=${LIMIT}" 2>/dev/null)

if [ $? -ne 0 ]; then
  # Rate limit or error — check headers
  RATE_REMAINING=$(gh api /rate_limit --jq '.resources.search.remaining' 2>/dev/null || echo 0)
  if [ "$RATE_REMAINING" -eq 0 ]; then
    RESET_TIME=$(gh api /rate_limit --jq '.resources.search.reset' 2>/dev/null || echo 0)
    echo '{"error": "rate_limited", "search_remaining": 0, "reset_unix": '"$RESET_TIME"'}'
    exit 1
  fi
  echo '{"error": "search_failed", "query": "'"$SEARCH_Q"'"}'
  exit 1
fi

# ─── Parse results into clean format ───
echo "$RESULT" | python3 -c "
import json, sys

data = json.load(sys.stdin)
total = data.get('total_count', 0)
items = data.get('items', [])
results = []

for item in items:
    # Extract repo from repository_url
    repo_url = item.get('repository_url', '')
    repo = '/'.join(repo_url.split('/')[-2:]) if repo_url else ''

    results.append({
        'repo': repo,
        'number': item.get('number', 0),
        'title': item.get('title', ''),
        'html_url': item.get('html_url', ''),
        'created_at': item.get('created_at', ''),
        'labels': [l.get('name', '') for l in item.get('labels', [])],
        'comments': item.get('comments', 0),
        'state': item.get('state', ''),
    })

print(json.dumps({
    'total_count': total,
    'returned': len(results),
    'query': '$SEARCH_Q',
    'tier': '$TIER' or None,
    'issues': results
}, indent=2))
" 2>/dev/null || echo '{"error": "parse_failed"}'

exit 0
