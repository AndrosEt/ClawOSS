#!/usr/bin/env bash
# respond-to-review.sh — Handle simple PR follow-up actions
# Usage: respond-to-review.sh <owner/repo> <pr_number> <action>
# Actions: merge, bump, acknowledge, identity, close-invalid, close-fixed
# Exit 0 = action taken, Exit 1 = action failed

if [ "${1:-}" = "--help" ] || [ $# -lt 3 ]; then
  echo "Usage: respond-to-review.sh <owner/repo> <pr_number> <action>"
  echo "Actions: merge, bump, acknowledge, identity, close-invalid, close-fixed"
  exit 0
fi

REPO="${1:?Usage: respond-to-review.sh <owner/repo> <pr_number> <action>}"
PR="${2:?}"
ACTION="${3:?}"

fail() {
  echo "{\"success\": false, \"repo\": \"$REPO\", \"pr\": $PR, \"action\": \"$ACTION\", \"reason\": $(echo "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '\"failed\"')}"
  exit 1
}

case "$ACTION" in
  merge)
    # Try squash merge first
    if gh pr merge "$PR" --repo "$REPO" --squash 2>/dev/null; then
      echo "{\"success\": true, \"repo\": \"$REPO\", \"pr\": $PR, \"action\": \"merged\", \"method\": \"squash\"}"
      exit 0
    fi
    # Fallback: try regular merge
    if gh pr merge "$PR" --repo "$REPO" --merge 2>/dev/null; then
      echo "{\"success\": true, \"repo\": \"$REPO\", \"pr\": $PR, \"action\": \"merged\", \"method\": \"merge\"}"
      exit 0
    fi
    # Can't merge — comment asking maintainer
    gh pr comment "$PR" --repo "$REPO" \
      --body "Thanks for the approval! Could you merge this when you get a chance?" 2>/dev/null
    echo "{\"success\": true, \"repo\": \"$REPO\", \"pr\": $PR, \"action\": \"merge_requested\", \"reason\": \"auto-merge failed, commented\"}"
    exit 0
    ;;

  bump)
    # Check if we already bumped recently (prevent spam)
    RECENT_BUMP=$(gh api "repos/${REPO}/issues/${PR}/comments" \
      --jq '[.[] | select(.user.login == "BillionClaw" and (.body | test("checking in|anything.*needed"; "i")))] | length' 2>/dev/null || echo 0)
    if [ "$RECENT_BUMP" -gt 0 ]; then
      echo "{\"success\": true, \"repo\": \"$REPO\", \"pr\": $PR, \"action\": \"bump_skipped\", \"reason\": \"already bumped\"}"
      exit 0
    fi
    gh pr comment "$PR" --repo "$REPO" \
      --body "Just checking in — is there anything else needed for this PR to move forward? Happy to make adjustments." 2>/dev/null
    echo "{\"success\": true, \"repo\": \"$REPO\", \"pr\": $PR, \"action\": \"bumped\"}"
    exit 0
    ;;

  acknowledge|close-fixed)
    gh pr close "$PR" --repo "$REPO" \
      --comment "Thanks for confirming — glad this is resolved. Closing as it's already fixed upstream." 2>/dev/null
    echo "{\"success\": true, \"repo\": \"$REPO\", \"pr\": $PR, \"action\": \"closed_fixed\"}"
    exit 0
    ;;

  identity)
    gh pr comment "$PR" --repo "$REPO" \
      --body "I'm ClawOSS, an autonomous codebase helper. Here's the project: https://github.com/kevinlin/clawOSS

Happy to discuss the fix itself — let me know if there are any concerns with the approach." 2>/dev/null
    echo "{\"success\": true, \"repo\": \"$REPO\", \"pr\": $PR, \"action\": \"identity_response\"}"
    exit 0
    ;;

  close-invalid)
    gh pr close "$PR" --repo "$REPO" \
      --comment "Closing — this was submitted as a feature rather than a bug fix. Apologies for the noise." 2>/dev/null
    echo "{\"success\": true, \"repo\": \"$REPO\", \"pr\": $PR, \"action\": \"closed_invalid\"}"
    exit 0
    ;;

  *)
    fail "Unknown action: $ACTION. Valid: merge, bump, acknowledge, identity, close-invalid, close-fixed"
    ;;
esac
