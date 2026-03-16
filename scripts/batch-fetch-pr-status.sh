#!/usr/bin/env bash
# batch-fetch-pr-status.sh — Fetch all BillionClaw PRs with reviews, comments, CI status
# Usage: batch-fetch-pr-status.sh [--open] [--closed] [--merged]
# Default: --open only
# Outputs JSON array with full status for each PR (classification, urgency, reviews, comments, CI)

if [ "${1:-}" = "--help" ]; then
  echo "Usage: batch-fetch-pr-status.sh [--open] [--closed] [--merged]"
  echo "Fetches all BillionClaw PRs with reviews, comments, and CI status."
  exit 0
fi

PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
SCRIPTS="$PROJECT_DIR/scripts"
FETCH_OPEN=false
FETCH_CLOSED=false
FETCH_MERGED=false

# Parse args — default to --open if none specified
if [ $# -eq 0 ]; then
  FETCH_OPEN=true
else
  while [ $# -gt 0 ]; do
    case "$1" in
      --open) FETCH_OPEN=true; shift ;;
      --closed) FETCH_CLOSED=true; shift ;;
      --merged) FETCH_MERGED=true; shift ;;
      *) shift ;;
    esac
  done
fi

# ─── 1. Fetch PR list ───
PRS="[]"
if [ "$FETCH_OPEN" = true ]; then
  OPEN_PRS=$(gh search prs --author BillionClaw --state open --limit 50 \
    --json repository,number,title,url,updatedAt,createdAt 2>/dev/null || echo '[]')
  PRS=$(echo "$PRS $OPEN_PRS" | python3 -c "
import json, sys
parts = sys.stdin.read().split(']')
result = []
for p in parts:
    p = p.strip().lstrip('[').strip()
    if p:
        try: result.extend(json.loads('[' + p + ']'))
        except: pass
print(json.dumps(result))
" 2>/dev/null || echo '[]')
fi

if [ "$FETCH_CLOSED" = true ]; then
  CLOSED_PRS=$(gh search prs --author BillionClaw --state closed --limit 50 \
    --json repository,number,title,url,updatedAt,createdAt 2>/dev/null || echo '[]')
  PRS=$(python3 -c "
import json
a = json.loads('$PRS')
b = json.loads('''$CLOSED_PRS''')
print(json.dumps(a + b))
" 2>/dev/null || echo "$PRS")
fi

if [ "$FETCH_MERGED" = true ]; then
  MERGED_PRS=$(gh search prs --author BillionClaw --merged --limit 50 \
    --json repository,number,title,url,updatedAt,createdAt 2>/dev/null || echo '[]')
  PRS=$(python3 -c "
import json
a = json.loads('$PRS')
b = json.loads('''$MERGED_PRS''')
print(json.dumps(a + b))
" 2>/dev/null || echo "$PRS")
fi

# ─── 2. For each PR, get full status via scan-pr-reviews.sh ───
PR_COUNT=$(echo "$PRS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)

if [ "$PR_COUNT" -eq 0 ]; then
  echo '[]'
  exit 0
fi

# Process each PR — extract repo and number, call scan script
echo "$PRS" | python3 -c "
import json, sys, subprocess, os

prs = json.load(sys.stdin)
scripts_dir = os.environ.get('PROJECT_DIR', '/Users/kevinlin/clawOSS') + '/scripts'
results = []

for pr in prs:
    repo = pr.get('repository', {})
    repo_name = repo.get('nameWithOwner', '') if isinstance(repo, dict) else str(repo)
    number = pr.get('number', 0)

    if not repo_name or not number:
        continue

    try:
        result = subprocess.run(
            ['bash', f'{scripts_dir}/scan-pr-reviews.sh', repo_name, str(number)],
            capture_output=True, text=True, timeout=30
        )
        scan = json.loads(result.stdout) if result.stdout.strip() else {}
    except Exception as e:
        scan = {'error': str(e)}

    scan['title'] = pr.get('title', '')
    scan['url'] = pr.get('url', '')
    scan['created_at'] = pr.get('createdAt', '')
    scan['updated_at'] = pr.get('updatedAt', '')
    results.append(scan)

print(json.dumps(results, indent=2))
" 2>/dev/null || echo '[]'

exit 0
