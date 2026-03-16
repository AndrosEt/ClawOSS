#!/usr/bin/env bash
# scan-pr-reviews.sh — Check a PR's review status, comments, CI, and mergeable state
# Usage: ./scan-pr-reviews.sh owner/repo pr_number
# Outputs JSON with classification: approved/changes_requested/comment_only/stale/ci_failing
# Exit 0 always (classification in JSON)

if [ "${1:-}" = "--help" ] || [ $# -lt 2 ]; then
  echo "Usage: scan-pr-reviews.sh <owner/repo> <pr_number>"
  echo "Outputs JSON with PR review classification"
  exit 0
fi

REPO="$1"
PR="$2"

# Date calculations
if date -v-1d +%Y-%m-%d &>/dev/null; then
  SEVEN_DAYS_AGO=$(date -v-7d +%Y-%m-%dT00:00:00Z)
else
  SEVEN_DAYS_AGO=$(date -d "7 days ago" +%Y-%m-%dT00:00:00Z)
fi

# Fetch PR data
PR_DATA=$(gh api "repos/${REPO}/pulls/${PR}" --jq '{
  state: .state,
  mergeable: .mergeable,
  mergeable_state: .mergeable_state,
  updated_at: .updated_at,
  created_at: .created_at,
  draft: .draft,
  head_ref: .head.ref,
  additions: .additions,
  deletions: .deletions,
  changed_files: .changed_files
}' 2>/dev/null || echo '{}')

# Fetch reviews
REVIEWS=$(gh api "repos/${REPO}/pulls/${PR}/reviews" \
  --jq '[.[] | {state: .state, user: .user.login, submitted_at: .submitted_at, body: (.body | .[0:200])}]' 2>/dev/null || echo '[]')

# Fetch comments (non-bot only)
COMMENTS=$(gh api "repos/${REPO}/issues/${PR}/comments" \
  --jq '[.[] | select(.user.login | test("bot$"; "i") | not) | {user: .user.login, created_at: .created_at, body: (.body | .[0:200])}]' 2>/dev/null || echo '[]')

# Fetch CI status
CI_STATUS=$(gh api "repos/${REPO}/commits/$(gh api "repos/${REPO}/pulls/${PR}" --jq '.head.sha' 2>/dev/null)/check-runs" \
  --jq '{total: .total_count, passed: ([.check_runs[] | select(.conclusion == "success")] | length), failed: ([.check_runs[] | select(.conclusion == "failure")] | length), pending: ([.check_runs[] | select(.status != "completed")] | length)}' 2>/dev/null || echo '{"total": 0, "passed": 0, "failed": 0, "pending": 0}')

# Classify the PR
CLASSIFICATION="unknown"
LATEST_REVIEW_STATE=$(echo "$REVIEWS" | python3 -c "
import json, sys
reviews = json.load(sys.stdin)
if not reviews:
    print('none')
else:
    # Get latest review per reviewer (most recent wins)
    latest = {}
    for r in reviews:
        latest[r['user']] = r['state']
    states = list(latest.values())
    if 'CHANGES_REQUESTED' in states:
        print('changes_requested')
    elif 'APPROVED' in states:
        print('approved')
    elif 'COMMENTED' in states:
        print('commented')
    else:
        print('pending')
" 2>/dev/null || echo "none")

# Check CI failures
CI_FAILED=$(echo "$CI_STATUS" | python3 -c "import json,sys; d=json.load(sys.stdin); print('yes' if d.get('failed',0) > 0 else 'no')" 2>/dev/null || echo "no")

# Check staleness
IS_STALE=$(echo "$PR_DATA" | python3 -c "
import json, sys
from datetime import datetime, timezone
data = json.load(sys.stdin)
updated = data.get('updated_at', '')
if updated:
    updated_dt = datetime.fromisoformat(updated.replace('Z', '+00:00'))
    age = (datetime.now(timezone.utc) - updated_dt).days
    print('yes' if age >= 7 else 'no')
else:
    print('no')
" 2>/dev/null || echo "no")

# Determine classification
COMMENT_COUNT=$(echo "$COMMENTS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)

if [ "$LATEST_REVIEW_STATE" = "approved" ]; then
  CLASSIFICATION="approved"
elif [ "$LATEST_REVIEW_STATE" = "changes_requested" ]; then
  CLASSIFICATION="changes_requested"
elif [ "$CI_FAILED" = "yes" ]; then
  CLASSIFICATION="ci_failing"
elif [ "$IS_STALE" = "yes" ] && [ "$COMMENT_COUNT" -eq 0 ] 2>/dev/null; then
  CLASSIFICATION="stale"
elif [ "$COMMENT_COUNT" -gt 0 ] 2>/dev/null; then
  CLASSIFICATION="comment_only"
else
  CLASSIFICATION="pending_review"
fi

# Determine urgency
URGENCY="normal"
if [ "$CLASSIFICATION" = "approved" ]; then
  URGENCY="merge_now"
elif [ "$CLASSIFICATION" = "changes_requested" ]; then
  URGENCY="urgent"
elif [ "$CLASSIFICATION" = "ci_failing" ]; then
  URGENCY="urgent"
fi

cat <<EOF
{
  "repo": "${REPO}",
  "pr": ${PR},
  "classification": "${CLASSIFICATION}",
  "urgency": "${URGENCY}",
  "latest_review_state": "${LATEST_REVIEW_STATE}",
  "ci_failed": ${CI_FAILED/yes/true},
  "is_stale": ${IS_STALE/yes/true},
  "comment_count": ${COMMENT_COUNT},
  "pr_data": ${PR_DATA},
  "ci_status": ${CI_STATUS},
  "reviews": ${REVIEWS},
  "comments": ${COMMENTS}
}
EOF
