#!/usr/bin/env bash
# batch-close-invalid.sh — Batch cleanup of invalid open PRs
# Usage: batch-close-invalid.sh [--dry-run] [--max N]
# Closes PRs that: target deleted repos, have stale branches, or reference closed/fixed issues
# Exit 0 always

PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
DRY_RUN=""
MAX=20

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN="true"; shift ;;
    --max) MAX="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ─── 1. Fetch all open PRs ───
PRS=$(gh search prs --author BillionClaw --state open --limit "$MAX" \
  --json repository,number,title,url,createdAt,updatedAt \
  2>/dev/null || echo "[]")

# ─── 2. Check each PR for invalid state ───
python3 -c "
import json, sys, subprocess

prs = json.load(sys.stdin)
closed = []
kept = []
dry_run = '$DRY_RUN' == 'true'

for pr in prs:
    repo = pr.get('repository', {})
    repo_name = repo.get('nameWithOwner', '') if isinstance(repo, dict) else ''
    number = pr.get('number', 0)
    title = pr.get('title', '')
    if not repo_name or not number:
        continue

    reason = None

    # Check if repo still exists
    try:
        r = subprocess.run(['gh', 'api', f'repos/{repo_name}', '--jq', '.archived'],
                          capture_output=True, text=True, timeout=10)
        if r.returncode != 0:
            reason = 'repo_not_found'
        elif r.stdout.strip() == 'true':
            reason = 'repo_archived'
    except:
        pass

    # Check if linked issue is closed
    if not reason:
        import re
        issue_match = re.search(r'#(\d+)', title)
        if issue_match:
            issue_num = issue_match.group(1)
            try:
                r = subprocess.run(['gh', 'api', f'repos/{repo_name}/issues/{issue_num}',
                                   '--jq', '.state'],
                                  capture_output=True, text=True, timeout=10)
                if r.returncode == 0 and r.stdout.strip() == 'closed':
                    reason = 'issue_already_closed'
            except:
                pass

    # Check if PR is stale (>14 days no activity, no reviews)
    if not reason:
        from datetime import datetime, timezone
        updated = pr.get('updatedAt', '')
        if updated:
            try:
                updated_dt = datetime.fromisoformat(updated.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                days_stale = (now - updated_dt).days
                if days_stale > 14:
                    try:
                        r = subprocess.run(['gh', 'api', f'repos/{repo_name}/pulls/{number}/reviews',
                                           '--jq', 'length'],
                                          capture_output=True, text=True, timeout=10)
                        if r.returncode == 0 and r.stdout.strip() == '0':
                            reason = f'stale_{days_stale}_days_no_reviews'
                    except:
                        pass
            except:
                pass

    if reason:
        if not dry_run:
            # Close with comment
            comment = f'Closing: {reason.replace(\"_\", \" \")}. Will resubmit if still needed.'
            subprocess.run(['gh', 'pr', 'close', str(number), '--repo', repo_name,
                           '--comment', comment],
                          capture_output=True, text=True, timeout=15)
        closed.append({'repo': repo_name, 'number': number, 'title': title, 'reason': reason})
    else:
        kept.append({'repo': repo_name, 'number': number, 'title': title})

result = {
    'closed': closed,
    'kept': kept,
    'closed_count': len(closed),
    'kept_count': len(kept),
    'dry_run': dry_run
}
print(json.dumps(result, indent=2))
" <<< "$PRS" 2>/dev/null || echo '{"closed": [], "kept": [], "error": "script failed"}'

exit 0
