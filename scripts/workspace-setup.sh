#!/usr/bin/env bash
# workspace-setup.sh — One-liner workspace creation for ClawOSS subagents
# Usage: workspace-setup.sh <owner/repo> <issue_number>
# Returns JSON with workspace_path + repo metadata + all gate results
# Exit 0 = proceed, Exit 1 = abort (with failure reason in JSON output)

REPO="${1:?Usage: workspace-setup.sh <owner/repo> <issue_number>}"
ISSUE="${2:?Usage: workspace-setup.sh <owner/repo> <issue_number>}"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
PROJECT_DIR="${PROJECT_DIR:-/Users/kevinlin/clawOSS}"
WORKDIR="/tmp/clawoss-${ISSUE}-$(date +%s)"

fail() {
  cat <<ENDJSON
{"pass": false, "workspace_path": "", "reason": $(echo "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), "repo": "$REPO", "issue": $ISSUE}
ENDJSON
  exit 1
}

# ─── 1. Blocklist check (fastest, no API calls) ───
TRUST_FILE="$PROJECT_DIR/workspace/memory/trust-repos.md"
if [ -f "$TRUST_FILE" ]; then
  # Check deprioritized section — handle backtick-wrapped names and plain names
  IN_DEPRIORITIZED=$(awk '/^## Deprioritized/,/^$/' "$TRUST_FILE" | grep -i "${REPO}\|${OWNER}/${REPO_NAME}" || true)
  if [ -n "$IN_DEPRIORITIZED" ]; then
    # Check if skip date has expired
    SKIP_DATE=$(echo "$IN_DEPRIORITIZED" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | tail -1 || echo "")
    IS_PERMANENT=$(echo "$IN_DEPRIORITIZED" | grep -ic "permanent" || echo 0)
    if [ "$IS_PERMANENT" -gt 0 ]; then
      fail "Repo ${REPO} is permanently blocklisted"
    elif [ -n "$SKIP_DATE" ]; then
      TODAY=$(date +%Y-%m-%d)
      if [[ "$TODAY" < "$SKIP_DATE" ]]; then
        fail "Repo ${REPO} is blocklisted until ${SKIP_DATE}"
      fi
      # Skip date expired — repo is no longer blocked
    else
      fail "Repo ${REPO} is in blocklist (deprioritized in trust-repos.md)"
    fi
  fi
fi

# ─── 2. Repo health check ───
HEALTH_RESULT='{"pass":true,"score":0,"metrics":{"stars":0}}'  # Default — overwritten below
HEALTH_SCRIPT="$PROJECT_DIR/scripts/repo-health-check.sh"
if [ -x "$HEALTH_SCRIPT" ]; then
  HEALTH_RESULT=$(bash "$HEALTH_SCRIPT" "$REPO" 2>/dev/null || echo '{"pass":false,"reason":"script error"}')
  HEALTH_PASS=$(echo "$HEALTH_RESULT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("pass",False))' 2>/dev/null || echo "False")
  if [ "$HEALTH_PASS" != "True" ]; then
    HEALTH_REASON=$(echo "$HEALTH_RESULT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("reason","health check failed"))' 2>/dev/null || echo "health check failed")
    fail "Health check failed: $HEALTH_REASON"
  fi
else
  # Fallback: quick star check (script not found/executable)
  STARS=$(gh api "repos/${REPO}" --jq '.stargazers_count' 2>/dev/null || echo 0)
  [ "$STARS" -lt 200 ] && fail "Stars ${STARS} below 200 minimum"
  HEALTH_RESULT="{\"pass\":true,\"score\":5,\"metrics\":{\"stars\":${STARS}}}"
fi

# ─── 3. Already-fixed check ───
# 3a. Is the issue closed?
ISSUE_STATE=$(gh api "repos/${REPO}/issues/${ISSUE}" --jq '.state' 2>/dev/null || echo "open")
if [ "$ISSUE_STATE" = "closed" ]; then
  fail "Issue #${ISSUE} is already closed"
fi

# 3b. Recently merged PRs referencing this issue
MERGED_REFS=$(gh pr list --repo "$REPO" --state merged --limit 10 --json title,body,number --jq "[.[] | select(.title + (.body // \"\") | test(\"#${ISSUE}|${ISSUE}\"; \"i\"))] | length" 2>/dev/null || echo 0)
if [ "$MERGED_REFS" -gt 0 ]; then
  fail "Issue #${ISSUE} appears to be fixed in a recently merged PR"
fi

# ─── 4. Supersession check ───
# 4a. Linked open PRs
LINKED_OPEN=$(gh api "repos/${REPO}/issues/${ISSUE}/timeline" --jq '[.[] | select(.event=="cross-referenced") | .source.issue | select(.pull_request != null and .state == "open")] | length' 2>/dev/null || echo 0)
if [ "$LINKED_OPEN" -gt 0 ]; then
  fail "Issue #${ISSUE} already has ${LINKED_OPEN} open linked PR(s)"
fi

# 4b. Issue assignees
ASSIGNEES=$(gh api "repos/${REPO}/issues/${ISSUE}" --jq '.assignees | length' 2>/dev/null || echo 0)
if [ "$ASSIGNEES" -gt 0 ]; then
  fail "Issue #${ISSUE} is assigned to someone"
fi

# ─── 5. Lock file (dedup) ───
LOCK_DIR="$PROJECT_DIR/workspace/memory/locks"
LOCK_FILE="$LOCK_DIR/${OWNER}_${REPO_NAME}.lock"
if [ -f "$LOCK_FILE" ]; then
  # Check if stale (>1 hour)
  if find "$LOCK_FILE" -mmin +60 -print | grep -q .; then
    rm -f "$LOCK_FILE"
  else
    fail "Repo ${REPO} is locked by another subagent (lock file exists)"
  fi
fi

# Create lock
mkdir -p "$LOCK_DIR"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | ${REPO}#${ISSUE} | workspace-setup" > "$LOCK_FILE"

# ─── 6. Existing open PR check ───
EXISTING_OPEN=$(gh search prs --author BillionClaw --repo "$REPO" --state open --json number --jq 'length' 2>/dev/null || echo 0)
if [ "$EXISTING_OPEN" -gt 0 ]; then
  rm -f "$LOCK_FILE"
  fail "BillionClaw already has ${EXISTING_OPEN} open PR(s) in ${REPO}"
fi

# ─── 7. Create workspace and clone ───
mkdir -p "$WORKDIR"
gh repo clone "$REPO" "$WORKDIR" -- --depth=50 2>/dev/null
if [ $? -ne 0 ]; then
  rm -f "$LOCK_FILE"
  rm -rf "$WORKDIR"
  fail "Failed to clone ${REPO}"
fi

# ─── 8. Read CONTRIBUTING.md ───
CONTRIBUTING=""
DEFAULT_BRANCH=$(gh api "repos/${REPO}" --jq '.default_branch' 2>/dev/null || echo "main")
for f in CONTRIBUTING.md .github/CONTRIBUTING.md docs/CONTRIBUTING.md; do
  if [ -f "$WORKDIR/$f" ]; then
    CONTRIBUTING=$(head -200 "$WORKDIR/$f")
    break
  fi
done

# Check for AI disclosure policy
AI_POLICY=""
if [ -n "$CONTRIBUTING" ]; then
  AI_POLICY=$(echo "$CONTRIBUTING" | grep -i "AI\|bot\|automated\|disclosure\|machine.generated" | head -5 || true)
fi

# Check for anti-bot policy
if echo "$CONTRIBUTING" | grep -qiE "no (bot|ai[- ]generated|automated)|human[- ]only|not accept.*(bot|ai)"; then
  rm -f "$LOCK_FILE"
  rm -rf "$WORKDIR"
  fail "Anti-bot/anti-AI policy detected in CONTRIBUTING.md"
fi

# ─── 9. Detect CLA requirements ───
HAS_CLA="false"
CLA_TYPE="none"
if echo "$CONTRIBUTING" | grep -qiE "contributor license agreement|sign.*(cla|contributor)|developer certificate of origin|dco.*sign|signed-off-by.*required"; then
  HAS_CLA="true"
  if echo "$CONTRIBUTING" | grep -qiE "developer certificate of origin|dco|signed-off-by"; then
    CLA_TYPE="dco"
  else
    CLA_TYPE="cla-assistant"
  fi
fi

# ─── 10. Output success JSON ───
cat <<ENDJSON
{
  "pass": true,
  "workspace_path": "$WORKDIR",
  "repo": "$REPO",
  "issue": $ISSUE,
  "owner": "$OWNER",
  "repo_name": "$REPO_NAME",
  "default_branch": "$DEFAULT_BRANCH",
  "lock_file": "$LOCK_FILE",
  "has_contributing": $([ -n "$CONTRIBUTING" ] && echo true || echo false),
  "has_cla": $HAS_CLA,
  "cla_type": "$CLA_TYPE",
  "ai_disclosure_policy": $(echo "$AI_POLICY" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '""'),
  "stars": $(echo "$HEALTH_RESULT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("metrics",{}).get("stars",0))' 2>/dev/null || echo 0)
}
ENDJSON
exit 0
