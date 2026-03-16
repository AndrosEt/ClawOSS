#!/usr/bin/env bash
# batch-fetch-pr-status.sh — Fetch status of all open BillionClaw PRs
# Usage: batch-fetch-pr-status.sh [--limit N] [--repo owner/repo]
# Outputs JSON array with review state, comments, CI status for each PR
# Exit 0 always

PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
LIMIT=50
FILTER_REPO=""

while [ $# -gt 0 ]; do
  case "$1" in
    --limit) LIMIT="$2"; shift 2 ;;
    --repo) FILTER_REPO="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ─── 1. Fetch all open PRs ───
if [ -n "$FILTER_REPO" ]; then
  PRS=$(gh pr list --repo "$FILTER_REPO" --author BillionClaw --state open --limit "$LIMIT" \
    --json number,title,url,createdAt,updatedAt,headRefName,baseRefName,reviewDecision,isDraft,labels \
    2>/dev/null || echo "[]")
else
  PRS=$(gh search prs --author BillionClaw --state open --limit "$LIMIT" \
    --json repository,number,title,url,createdAt,updatedAt \
    2>/dev/null || echo "[]")
fi

PR_COUNT=$(echo "$PRS" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)

if [ "$PR_COUNT" -eq 0 ]; then
  echo '{"prs": [], "count": 0, "needs_action": []}'
  exit 0
fi

# ─── 2. Enrich each PR with review/comment data ───
ENRICHED=$(python3 << 'PYEOF'
import json, sys, subprocess

prs_raw = sys.stdin.read()
prs = json.loads(prs_raw)
results = []
needs_action = []
filter_repo = "$FILTER_REPO" if "$FILTER_REPO" else ""

for pr in prs:
    repo = pr.get('repository', {})
    if isinstance(repo, dict):
        repo_name = repo.get('nameWithOwner', '')
    else:
        repo_name = filter_repo

    number = pr.get('number', 0)
    if not repo_name or not number:
        continue

    # Fetch reviews
    try:
        rev_out = subprocess.run(
            ['gh', 'api', f'repos/{repo_name}/pulls/{number}/reviews', '--jq',
             '[.[] | {state: .state, user: .user.login, submitted_at: .submitted_at}]'],
            capture_output=True, text=True, timeout=15
        )
        reviews = json.loads(rev_out.stdout) if rev_out.returncode == 0 else []
    except:
        reviews = []

    # Fetch latest comments
    try:
        com_out = subprocess.run(
            ['gh', 'api', f'repos/{repo_name}/issues/{number}/comments',
             '--jq', '[.[-5:] | .[] | {user: .user.login, created_at: .created_at, body: .body[:200]}]'],
            capture_output=True, text=True, timeout=15
        )
        comments = json.loads(com_out.stdout) if com_out.returncode == 0 else []
    except:
        comments = []

    # Classify action needed
    action = 'none'
    review_states = [r['state'] for r in reviews]
    if 'CHANGES_REQUESTED' in review_states:
        action = 'address_review'
    elif 'APPROVED' in review_states:
        action = 'ready_to_merge'
    elif comments and comments[-1].get('user', '') != 'BillionClaw':
        action = 'respond_to_comment'

    entry = {
        'repo': repo_name,
        'number': number,
        'title': pr.get('title', ''),
        'url': pr.get('url', ''),
        'created_at': pr.get('createdAt', ''),
        'reviews': reviews[-3:],
        'latest_comments': comments[-3:],
        'action_needed': action
    }
    results.append(entry)
    if action != 'none':
        needs_action.append({'repo': repo_name, 'number': number, 'action': action})

print(json.dumps({'prs': results, 'count': len(results), 'needs_action': needs_action}, indent=2))
PYEOF
 <<< "$PRS" 2>/dev/null)

if [ -z "$ENRICHED" ]; then
  echo '{"prs": [], "count": 0, "needs_action": [], "error": "enrichment failed"}'
  exit 0
fi

echo "$ENRICHED"
exit 0
