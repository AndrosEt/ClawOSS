#!/usr/bin/env bash
# sign-cla.sh — Detect CLA type and attempt to sign
# Usage: sign-cla.sh <owner/repo> [pr_number]
# Exit 0 = signed/not needed, Exit 1 = cannot sign (non-automatable)
# For DCO: amends commits with Signed-off-by
# For CLA-assistant: outputs the signing URL

REPO="${1:?Usage: sign-cla.sh <owner/repo> [pr_number]}"
PR="${2:-}"
OWNER="${REPO%%/*}"

# Non-automatable CLA orgs — hard skip
NON_AUTO_ORGS="apache microsoft google meta-llama"
for ORG in $NON_AUTO_ORGS; do
  if [ "$OWNER" = "$ORG" ]; then
    echo "{\"signed\": false, \"repo\": \"$REPO\", \"cla_type\": \"non_automatable\", \"reason\": \"${OWNER} requires manual identity verification\"}"
    exit 1
  fi
done

# Check for CLA bot status on the PR (if PR number provided)
CLA_STATUS="unknown"
if [ -n "$PR" ]; then
  # Check for CLA-assistant bot comment
  CLA_COMMENT=$(gh api "repos/${REPO}/issues/${PR}/comments" \
    --jq '[.[] | select(.user.login | test("cla-assistant|CLAassistant|cla-bot"; "i")) | .body][0] // ""' 2>/dev/null || echo "")

  if [ -n "$CLA_COMMENT" ]; then
    CLA_STATUS="cla-assistant"
    # Check if already signed
    if echo "$CLA_COMMENT" | grep -qi "has signed the CLA\|All committers have signed"; then
      echo "{\"signed\": true, \"repo\": \"$REPO\", \"cla_type\": \"cla-assistant\", \"status\": \"already_signed\"}"
      exit 0
    fi
    # Extract signing URL
    SIGN_URL=$(echo "$CLA_COMMENT" | grep -oE 'https://cla-assistant\.io/[^ )\]"]+' | head -1 || true)
    echo "{\"signed\": false, \"repo\": \"$REPO\", \"cla_type\": \"cla-assistant\", \"action\": \"visit_url\", \"url\": \"${SIGN_URL:-unknown}\"}"
    exit 0
  fi

  # Check for DCO bot
  DCO_COMMENT=$(gh api "repos/${REPO}/issues/${PR}/comments" \
    --jq '[.[] | select(.user.login | test("dco-bot|DCO"; "i")) | .body][0] // ""' 2>/dev/null || echo "")

  if [ -n "$DCO_COMMENT" ]; then
    CLA_STATUS="dco"
    if echo "$DCO_COMMENT" | grep -qi "All commits are signed off"; then
      echo "{\"signed\": true, \"repo\": \"$REPO\", \"cla_type\": \"dco\", \"status\": \"already_signed\"}"
      exit 0
    fi
    # DCO needs git commit -s (Signed-off-by line)
    echo "{\"signed\": false, \"repo\": \"$REPO\", \"cla_type\": \"dco\", \"action\": \"amend_commits\", \"command\": \"git commit --amend -s --no-edit && git push --force-with-lease\"}"
    exit 0
  fi

  # Check CI check runs for CLA status
  HEAD_SHA=$(gh api "repos/${REPO}/pulls/${PR}" --jq '.head.sha' 2>/dev/null || echo "")
  if [ -n "$HEAD_SHA" ]; then
    CLA_CHECK=$(gh api "repos/${REPO}/commits/${HEAD_SHA}/check-runs" \
      --jq '[.check_runs[] | select(.name | test("cla|dco|license"; "i")) | {name: .name, conclusion: .conclusion}]' 2>/dev/null || echo "[]")
    if [ "$CLA_CHECK" != "[]" ]; then
      echo "{\"signed\": false, \"repo\": \"$REPO\", \"cla_type\": \"check_run\", \"checks\": ${CLA_CHECK}}"
      exit 0
    fi
  fi
fi

# Check CONTRIBUTING.md for CLA mentions
CONTRIBUTING=$(gh api "repos/${REPO}/contents/CONTRIBUTING.md" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null || echo "")
if echo "$CONTRIBUTING" | grep -qi "CLA\|Contributor License Agreement\|DCO\|Developer Certificate"; then
  if echo "$CONTRIBUTING" | grep -qi "cla-assistant\|GitHub.*sign\|OAuth"; then
    echo "{\"signed\": false, \"repo\": \"$REPO\", \"cla_type\": \"cla-assistant\", \"source\": \"CONTRIBUTING.md\", \"action\": \"sign_on_pr\"}"
    exit 0
  elif echo "$CONTRIBUTING" | grep -qi "DCO\|Signed-off-by\|git commit -s"; then
    echo "{\"signed\": false, \"repo\": \"$REPO\", \"cla_type\": \"dco\", \"action\": \"use_git_commit_s\"}"
    exit 0
  else
    echo "{\"signed\": false, \"repo\": \"$REPO\", \"cla_type\": \"unknown_cla\", \"action\": \"check_manually\"}"
    exit 0
  fi
fi

# No CLA detected
echo "{\"signed\": true, \"repo\": \"$REPO\", \"cla_type\": \"none\", \"status\": \"no_cla_required\"}"
exit 0
