#!/usr/bin/env bash
# check-supersession.sh — Check if someone else is already working on an issue
# Usage: check-supersession.sh <owner/repo> <issue_number>
# Exit 0 = clear, Exit 1 = superseded

REPO="${1:?Usage: check-supersession.sh <owner/repo> <issue_number>}"
ISSUE="${2:?Usage: check-supersession.sh <owner/repo> <issue_number>}"

# 1. Linked open PRs
LINKED=$(gh api "repos/${REPO}/issues/${ISSUE}/timeline" --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null and .state == "open")] | length' 2>/dev/null || echo 0)
if [ "$LINKED" -gt 0 ]; then
  echo "{\"superseded\": true, \"repo\": \"$REPO\", \"issue\": $ISSUE, \"reason\": \"${LINKED} open PR(s) already linked\"}"
  exit 1
fi

# 2. Assignees
ASSIGNEES=$(gh api "repos/${REPO}/issues/${ISSUE}" --jq '.assignees[].login' 2>/dev/null || echo "")
if [ -n "$ASSIGNEES" ]; then
  echo "{\"superseded\": true, \"repo\": \"$REPO\", \"issue\": $ISSUE, \"reason\": \"assigned to: $ASSIGNEES\"}"
  exit 1
fi

# 3. Someone claimed it
CLAIMED=$(gh api "repos/${REPO}/issues/${ISSUE}/comments" --jq '[.[] | select(.body | test("I.ll take|I.m working|I will fix|working on a fix"; "i"))] | length' 2>/dev/null || echo 0)
if [ "$CLAIMED" -gt 0 ]; then
  echo "{\"superseded\": true, \"repo\": \"$REPO\", \"issue\": $ISSUE, \"reason\": \"someone claimed this in comments\"}"
  exit 1
fi

# 4. Competing open PRs
COMPETING=$(gh pr list --repo "$REPO" --state open --search "$ISSUE" --json number,author --jq '[.[] | select(.author.login != "BillionClaw")] | length' 2>/dev/null || echo 0)
if [ "$COMPETING" -gt 0 ]; then
  echo "{\"superseded\": true, \"repo\": \"$REPO\", \"issue\": $ISSUE, \"reason\": \"${COMPETING} competing PR(s)\"}"
  exit 1
fi

echo "{\"superseded\": false, \"repo\": \"$REPO\", \"issue\": $ISSUE}"
exit 0
