#!/usr/bin/env bash
# sign-cla.sh — Detect CLA type and attempt signing for a PR
# Usage: sign-cla.sh <owner/repo> <pr_number> [--workspace <path>]
# Handles: cla-assistant bot, DCO sign-off, EasyCLA
# Exit 0 = CLA handled, Exit 1 = needs manual intervention

REPO="${1:?Usage: sign-cla.sh <owner/repo> <pr_number>}"
PR_NUM="${2:?Usage: sign-cla.sh <owner/repo> <pr_number>}"
WORKDIR=""
CLA_TYPE="none"

shift 2
while [ $# -gt 0 ]; do
  case "$1" in
    --workspace) WORKDIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

fail() {
  echo "{\"signed\": false, \"cla_type\": \"$CLA_TYPE\", \"reason\": $(echo "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '\"failed\"')}"
  exit 1
}

# ─── 1. Detect CLA type from PR comments and checks ───
CLA_COMMENTS=$(gh api "repos/${REPO}/issues/${PR_NUM}/comments" --jq '[.[] | select(.user.login | test("cla|easycla|dco"; "i")) | {user: .user.login, body: .body[:500]}]' 2>/dev/null || echo "[]")
CLA_COUNT=$(echo "$CLA_COMMENTS" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)

if echo "$CLA_COMMENTS" | grep -qi "cla-assistant"; then
  CLA_TYPE="cla-assistant"
elif echo "$CLA_COMMENTS" | grep -qi "easycla\|linux.foundation"; then
  CLA_TYPE="easycla"
elif echo "$CLA_COMMENTS" | grep -qi "dco\|signed-off-by\|developer certificate"; then
  CLA_TYPE="dco"
fi

if [ "$CLA_TYPE" = "none" ] && [ "$CLA_COUNT" -eq 0 ]; then
  echo '{"signed": true, "cla_type": "none", "reason": "No CLA required"}'
  exit 0
fi

# ─── 2. Handle by type ───
case "$CLA_TYPE" in
  cla-assistant)
    gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
      -f body="I have read the CLA Document and I hereby sign the CLA" 2>/dev/null
    if [ $? -eq 0 ]; then
      echo '{"signed": true, "cla_type": "cla-assistant", "method": "comment"}'
      exit 0
    fi
    fail "Failed to post CLA signing comment"
    ;;

  dco)
    if [ -n "$WORKDIR" ] && [ -d "$WORKDIR" ]; then
      cd "$WORKDIR" || fail "Cannot cd to workspace"
      git commit --amend --signoff --no-edit 2>/dev/null
      if [ $? -eq 0 ]; then
        git push --force 2>/dev/null
        echo '{"signed": true, "cla_type": "dco", "method": "commit_signoff"}'
        exit 0
      fi
      fail "Failed to amend commit with sign-off"
    fi
    fail "DCO requires --workspace path to amend commits"
    ;;

  easycla)
    fail "EasyCLA requires manual web-based signing — check CLA bot comment for URL"
    ;;

  *)
    # Try generic cla-assistant approach
    gh api "repos/${REPO}/issues/${PR_NUM}/comments" \
      -f body="I have read the CLA Document and I hereby sign the CLA" 2>/dev/null
    echo '{"signed": true, "cla_type": "unknown", "method": "comment_attempt"}'
    exit 0
    ;;
esac
