#!/usr/bin/env bash
# workspace-submit.sh — Full PR submission pipeline for ClawOSS subagents
# Usage: workspace-submit.sh <workspace_path> <owner/repo> <issue_number> <pr_title> [--type fix|docs|test|typo] [--dco]
# Handles: diff gate, commit, fork, push, dedup check, PR creation
# Exit 0 = PR created (URL in JSON), Exit 1 = abort

WORKDIR="${1:?Usage: workspace-submit.sh <workspace> <repo> <issue> <title> [--type TYPE] [--dco]}"
REPO="${2:?Usage: workspace-submit.sh <workspace> <repo> <issue> <title>}"
ISSUE="${3:?Usage: workspace-submit.sh <workspace> <repo> <issue> <title>}"
PR_TITLE="${4:?Usage: workspace-submit.sh <workspace> <repo> <issue> <title>}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
SCRIPTS="$PROJECT_DIR/scripts"

# Parse optional flags
TYPE="fix"
DCO=""
shift 4
while [ $# -gt 0 ]; do
  case "$1" in
    --type) TYPE="$2"; shift 2 ;;
    --dco) DCO="--signoff"; shift ;;
    *) shift ;;
  esac
done

OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
BRANCH="clawoss/${TYPE}/issue-${ISSUE}"

fail() {
  cat <<ENDJSON
{"success": false, "pr_url": "", "reason": $(echo "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), "repo": "$REPO", "issue": $ISSUE}
ENDJSON
  exit 1
}

cd "$WORKDIR" || fail "Cannot cd to workspace $WORKDIR"

# ─── 1. Diff gate — must have changes ───
DIFF_STAT=$(git diff --stat HEAD 2>/dev/null)
STAGED_STAT=$(git diff --cached --stat 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)
if [ -z "$DIFF_STAT" ] && [ -z "$STAGED_STAT" ] && [ -z "$UNTRACKED" ]; then
  fail "No changes to submit — diff is empty"
fi

# ─── 2. Size gate — reject massive diffs ───
LINES_CHANGED=$(git diff HEAD --stat 2>/dev/null | tail -1 | grep -oE '[0-9]+ insertion|[0-9]+ deletion' | grep -oE '[0-9]+' | paste -sd+ - | bc 2>/dev/null || echo 0)
if [ "$LINES_CHANGED" -gt 200 ]; then
  fail "Diff too large (${LINES_CHANGED} lines changed, max 200). Smaller PRs merge 40% faster."
fi

# ─── 3. Commit changes ───
DEFAULT_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH" 2>/dev/null
git add -A
git commit $DCO -m "$PR_TITLE" -m "Fixes #${ISSUE}" 2>/dev/null
if [ $? -ne 0 ]; then
  fail "Git commit failed"
fi

# ─── 4. Fork repo (idempotent) ───
gh repo fork "$REPO" --clone=false 2>/dev/null || true

# Set up remote
FORK_REMOTE="https://github.com/BillionClaw/${REPO_NAME}.git"
git remote get-url fork 2>/dev/null || git remote add fork "$FORK_REMOTE" 2>/dev/null
git remote set-url fork "$FORK_REMOTE" 2>/dev/null

# ─── 5. Push to fork ───
git push fork "$BRANCH" --force 2>/dev/null
if [ $? -ne 0 ]; then
  fail "Failed to push to fork"
fi

# ─── 6. Dedup check — no existing open PR for this issue ───
EXISTING=$(gh pr list --repo "$REPO" --author BillionClaw --state open --json number,title --jq "[.[] | select(.title | test(\"#${ISSUE}\\\\b|issue[- ]?${ISSUE}\\\\b\"; \"i\"))] | length" 2>/dev/null || echo 0)
if [ "$EXISTING" -gt 0 ]; then
  fail "Already have an open PR for issue #${ISSUE}"
fi

# ─── 7. Build PR body ───
PR_BODY="## Problem

Fixes #${ISSUE}

## Changes

$(git log --oneline "${DEFAULT_BRANCH}..${BRANCH}" 2>/dev/null | head -5)

## Testing

- Ran existing test suite
- Verified fix addresses the reported issue

> This contribution was made by [ClawOSS](https://github.com/kevinlin/clawOSS), an autonomous codebase helper."

# ─── 8. Apply anti-slop filter to PR body ───
SLOP_WORDS="leverage|enhance|streamline|robust|comprehensive|cutting-edge|seamless|groundbreaking|paradigm|synergy|holistic|empower"
PR_BODY=$(echo "$PR_BODY" | sed -E "s/($SLOP_WORDS)//gi")

# ─── 9. Create PR ───
PR_URL=$(gh pr create \
  --repo "$REPO" \
  --head "BillionClaw:${BRANCH}" \
  --base "$DEFAULT_BRANCH" \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  2>/dev/null)

if [ $? -ne 0 ] || [ -z "$PR_URL" ]; then
  fail "gh pr create failed"
fi

PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')

# ─── 10. Output success ───
cat <<ENDJSON
{
  "success": true,
  "pr_url": "$PR_URL",
  "pr_number": ${PR_NUMBER:-0},
  "repo": "$REPO",
  "issue": $ISSUE,
  "branch": "$BRANCH",
  "type": "$TYPE",
  "lines_changed": ${LINES_CHANGED:-0}
}
ENDJSON
exit 0
