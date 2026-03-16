#!/usr/bin/env bash
# rework-pr.sh — Full PR rework pipeline after fix_rejected feedback
# Usage: rework-pr.sh <workspace_path> <owner/repo> <pr_number> <feedback_summary>
# Reads review comments, comments on PR with rework notice, sets up workspace for new approach
# Exit 0 = rework setup complete, Exit 1 = cannot rework

if [ "${1:-}" = "--help" ] || [ $# -lt 4 ]; then
  echo "Usage: rework-pr.sh <workspace_path> <owner/repo> <pr_number> <feedback_summary>"
  echo "Sets up workspace for PR rework after rejection."
  exit 0
fi

WORKDIR="${1:?Usage: rework-pr.sh <workspace_path> <owner/repo> <pr_number> <feedback_summary>}"
REPO="${2:?}"
PR="${3:?}"
FEEDBACK="${4:?}"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"

cd "$WORKDIR" || { echo '{"ready": false, "error": "workspace not found"}'; exit 1; }

# ─── 1. Fetch all review comments for context ───
REVIEWS=$(gh api "repos/${REPO}/pulls/${PR}/reviews" \
  --jq '[.[] | select(.state == "CHANGES_REQUESTED" or .state == "COMMENTED") | {user: .user.login, state: .state, body: .body}]' 2>/dev/null || echo '[]')

INLINE_COMMENTS=$(gh api "repos/${REPO}/pulls/${PR}/comments" \
  --jq '[.[] | {user: .user.login, path: .path, line: .line, body: (.body | .[0:300])}]' 2>/dev/null || echo '[]')

ISSUE_COMMENTS=$(gh api "repos/${REPO}/issues/${PR}/comments" \
  --jq '[.[-5:] | .[] | select(.user.login != "BillionClaw") | {user: .user.login, body: (.body | .[0:300])}]' 2>/dev/null || echo '[]')

# ─── 2. Get PR branch ───
PR_BRANCH=$(gh api "repos/${REPO}/pulls/${PR}" --jq '.head.ref' 2>/dev/null || echo "")
if [ -z "$PR_BRANCH" ]; then
  echo '{"ready": false, "error": "cannot determine PR branch"}'
  exit 1
fi

# ─── 3. Ensure we're on the right branch ───
git checkout "$PR_BRANCH" 2>/dev/null || {
  echo '{"ready": false, "error": "cannot checkout branch '"$PR_BRANCH"'"}'
  exit 1
}

# ─── 4. Comment on PR about rework ───
gh pr comment "$PR" --repo "$REPO" \
  --body "Thanks for the feedback — reworking with a different approach." 2>/dev/null || true

# ─── 5. Get the files changed in current PR ───
CHANGED_FILES=$(gh api "repos/${REPO}/pulls/${PR}/files" \
  --jq '[.[] | {filename: .filename, status: .status, additions: .additions, deletions: .deletions}]' 2>/dev/null || echo '[]')

# ─── 6. Write rework context file ───
CONTEXT_FILE="$WORKDIR/.rework-context.json"
python3 -c "
import json
context = {
    'repo': '$REPO',
    'pr': $PR,
    'branch': '$PR_BRANCH',
    'feedback_summary': $(echo "$FEEDBACK" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),
    'reviews': json.loads('''$REVIEWS'''),
    'inline_comments': json.loads('''$INLINE_COMMENTS'''),
    'issue_comments': json.loads('''$ISSUE_COMMENTS'''),
    'changed_files': json.loads('''$CHANGED_FILES'''),
}
with open('$CONTEXT_FILE', 'w') as f:
    json.dump(context, f, indent=2)
print(json.dumps({
    'ready': True,
    'repo': '$REPO',
    'pr': $PR,
    'branch': '$PR_BRANCH',
    'context_file': '$CONTEXT_FILE',
    'review_count': len(context['reviews']),
    'inline_comment_count': len(context['inline_comments']),
    'files_changed': len(context['changed_files']),
}, indent=2))
" 2>/dev/null || echo '{"ready": false, "error": "context generation failed"}'

exit 0
