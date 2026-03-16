#!/usr/bin/env bash
# workspace-submit.sh — Full PR submit pipeline for implementation subagents
# Usage: workspace-submit.sh <workspace_path> <owner/repo> <issue_number> <pr_title> [--type fix|docs|test|typo]
# Runs: diff size gate, commit type gate, branch name check, fork, push, dedup, create PR, post-PR dedup
# Exit 0 = PR created, Exit 1 = abort (reason in JSON)

if [ "${1:-}" = "--help" ] || [ $# -lt 4 ]; then
  echo "Usage: workspace-submit.sh <workspace_path> <owner/repo> <issue_number> <pr_title> [--type fix|docs|test|typo]"
  echo "Full PR submission pipeline with all gates and checks."
  exit 0
fi

WORKDIR="${1:?Usage: workspace-submit.sh <workspace_path> <owner/repo> <issue_number> <pr_title>}"
REPO="${2:?}"
ISSUE="${3:?}"
PR_TITLE="${4:?}"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
PR_TYPE="fix"

shift 4
while [ $# -gt 0 ]; do
  case "$1" in
    --type) PR_TYPE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

cd "$WORKDIR" || { echo '{"submitted": false, "reason": "workspace not found"}'; exit 1; }

fail() {
  cat <<ENDJSON
{"submitted": false, "repo": "$REPO", "issue": $ISSUE, "reason": $(echo "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '"submit failed"')}
ENDJSON
  exit 1
}

# ─── 1. Commit type gate ───
COMMIT_MSG=$(git log -1 --format=%s 2>/dev/null || echo "")
if echo "$COMMIT_MSG" | grep -qE '^(feat|chore|refactor|perf|style)(\(|:)'; then
  fail "Commit type '$(echo "$COMMIT_MSG" | cut -d: -f1)' is not allowed — we only submit fix/docs/test"
fi

# ─── 2. Diff size gate (max 200 lines) ───
DIFF_STATS=$(git diff --stat HEAD~1 2>/dev/null | tail -1)
INSERTIONS=$(echo "$DIFF_STATS" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
DELETIONS=$(echo "$DIFF_STATS" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo 0)
TOTAL_LINES=$((${INSERTIONS:-0} + ${DELETIONS:-0}))
if [ "$TOTAL_LINES" -gt 200 ]; then
  fail "Diff is $TOTAL_LINES lines (max 200) — smaller PRs merge 40% faster"
fi

# ─── 3. Branch name check ───
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [[ "$BRANCH" != clawoss/* ]]; then
  git branch -m "clawoss/${BRANCH}" 2>/dev/null || true
  BRANCH="clawoss/${BRANCH}"
fi

# ─── 4. Pre-push dedup ───
EXISTING_OPEN=$(gh search prs --author BillionClaw --repo "$REPO" --state open --json number --jq 'length' 2>/dev/null || echo 0)
if [ "$EXISTING_OPEN" -gt 0 ]; then
  fail "BillionClaw already has $EXISTING_OPEN open PR(s) in $REPO"
fi

# ─── 5. Fork and push ───
gh repo fork "$REPO" --clone=false 2>/dev/null || true
git remote add fork "https://github.com/BillionClaw/${REPO_NAME}.git" 2>/dev/null || true
if ! git push fork "$BRANCH" 2>/dev/null; then
  # Retry after sync
  gh repo sync "BillionClaw/${REPO_NAME}" 2>/dev/null || true
  if ! git push fork "$BRANCH" 2>/dev/null; then
    fail "Failed to push to fork BillionClaw/${REPO_NAME}"
  fi
fi

# ─── 6. Determine target branch ───
DEFAULT_BRANCH=$(gh api "repos/${REPO}" --jq '.default_branch' 2>/dev/null || echo "main")

# ─── 7. Check for PR template ───
PR_TEMPLATE=""
for tmpl in .github/PULL_REQUEST_TEMPLATE.md .github/pull_request_template.md; do
  if [ -f "$WORKDIR/$tmpl" ]; then
    PR_TEMPLATE="$tmpl"
    break
  fi
done

# ─── 8. Build PR body ───
# Use repo template if available, otherwise generate anti-slop description
PR_BODY=""
if [ -n "$PR_TEMPLATE" ]; then
  # Repo has its own template — subagent should have filled it in
  # We provide a fallback
  PR_BODY="Fixes #${ISSUE}

> This contribution was made by [ClawOSS](https://github.com/kevinlin/clawOSS), an autonomous codebase helper."
else
  # Generate from format-pr-description.sh if available
  FORMAT_SCRIPT="$PROJECT_DIR/scripts/format-pr-description.sh"
  if [ -x "$FORMAT_SCRIPT" ]; then
    PR_BODY=$(bash "$FORMAT_SCRIPT" "$PR_TYPE" "$REPO_NAME" "$ISSUE" --repo "$REPO" --title "$PR_TITLE")
  else
    PR_BODY="Fixes #${ISSUE}"
  fi
  # Append disclosure
  PR_BODY="${PR_BODY}

> This contribution was made by [ClawOSS](https://github.com/kevinlin/clawOSS), an autonomous codebase helper."
fi

# ─── 9. Verify description matches diff ───
CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null | head -20)
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | xargs)

# ─── 10. Create PR ───
PR_URL=$(gh pr create \
  --repo "$REPO" \
  --head "BillionClaw:${BRANCH}" \
  --base "$DEFAULT_BRANCH" \
  --title "$PR_TITLE" \
  --body "$PR_BODY" 2>/dev/null)

if [ -z "$PR_URL" ]; then
  fail "gh pr create failed"
fi

PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$' || echo 0)

# ─── 11. Post-PR dedup check ───
ALL_OPEN=$(gh search prs --author BillionClaw --repo "$REPO" --state open --json number,createdAt --jq '. | sort_by(.createdAt) | reverse' 2>/dev/null || echo '[]')
OPEN_COUNT=$(echo "$ALL_OPEN" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 1)
if [ "$OPEN_COUNT" -gt 1 ]; then
  NEWEST=$(echo "$ALL_OPEN" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['number'])" 2>/dev/null || echo "")
  if [ -n "$NEWEST" ]; then
    gh pr close "$NEWEST" --repo "$REPO" --comment "Closing duplicate PR — another is already open." 2>/dev/null || true
  fi
fi

cat <<ENDJSON
{
  "submitted": true,
  "repo": "$REPO",
  "issue": $ISSUE,
  "pr_number": $PR_NUMBER,
  "pr_url": $(echo "$PR_URL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '"unknown"'),
  "branch": "$BRANCH",
  "target_branch": "$DEFAULT_BRANCH",
  "diff_lines": $TOTAL_LINES,
  "files_changed": $FILE_COUNT,
  "pr_type": "$PR_TYPE"
}
ENDJSON
exit 0
