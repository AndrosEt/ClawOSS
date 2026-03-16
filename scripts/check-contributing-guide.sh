#!/usr/bin/env bash
# check-contributing-guide.sh — Parse CONTRIBUTING.md for repo metadata
# Usage: check-contributing-guide.sh <owner/repo>
# Outputs JSON with commit conventions, PR requirements, AI policy, CLA, branch targets

REPO="${1:?Usage: check-contributing-guide.sh <owner/repo>}"

# Fetch CONTRIBUTING.md
CONTENT=$(gh api "repos/${REPO}/contents/CONTRIBUTING.md" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null || echo "")

if [ -z "$CONTENT" ]; then
  # Try .github/CONTRIBUTING.md
  CONTENT=$(gh api "repos/${REPO}/contents/.github/CONTRIBUTING.md" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null || echo "")
fi

# Default branch
DEFAULT_BRANCH=$(gh api "repos/${REPO}" --jq '.default_branch' 2>/dev/null || echo "main")

# Detect commit conventions
COMMIT_CONVENTION="unknown"
if echo "$CONTENT" | grep -qi "conventional commit\|feat:\|fix:\|chore:"; then
  COMMIT_CONVENTION="conventional"
elif echo "$CONTENT" | grep -qi "angular.*commit\|type(scope)"; then
  COMMIT_CONVENTION="angular"
fi

# Detect PR template requirements
HAS_PR_TEMPLATE=false
PR_TEMPLATE=$(gh api "repos/${REPO}/contents/.github/pull_request_template.md" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null || echo "")
if [ -n "$PR_TEMPLATE" ]; then
  HAS_PR_TEMPLATE=true
fi

# Detect AI disclosure policy
AI_DISCLOSURE="none"
if echo "$CONTENT" | grep -qi "AI.*disclos\|disclose.*AI\|AI.*generat\|machine.*generat\|LLM.*generat"; then
  AI_DISCLOSURE="required"
fi

# Detect anti-bot/anti-AI policy
ANTI_AI=false
if echo "$CONTENT" | grep -qi "no bot\|no ai generated\|human only\|no automated PR\|no LLM\|prohibit.*AI\|ban.*bot"; then
  ANTI_AI=true
fi

# Detect CLA requirements
CLA_TYPE="none"
if echo "$CONTENT" | grep -qi "CLA\|Contributor License Agreement"; then
  if echo "$CONTENT" | grep -qi "cla-assistant\|GitHub.*OAuth\|sign.*GitHub"; then
    CLA_TYPE="cla-assistant"
  elif echo "$CONTENT" | grep -qi "ICLA\|Individual Contributor"; then
    CLA_TYPE="icla"
  else
    CLA_TYPE="unknown"
  fi
elif echo "$CONTENT" | grep -qi "DCO\|Developer Certificate\|Signed-off-by\|git commit -s"; then
  CLA_TYPE="dco"
fi

# Detect branch target
TARGET_BRANCH="$DEFAULT_BRANCH"
if echo "$CONTENT" | grep -qi "target.*dev\|branch.*dev\|PR.*dev\b"; then
  TARGET_BRANCH="dev"
elif echo "$CONTENT" | grep -qi "target.*develop\|branch.*develop"; then
  TARGET_BRANCH="develop"
elif echo "$CONTENT" | grep -qi "target.*devel\b\|branch.*devel\b"; then
  TARGET_BRANCH="devel"
fi

# Detect test requirements
TESTS_REQUIRED=false
if echo "$CONTENT" | grep -qi "tests.*required\|must.*include.*test\|add.*test\|test.*coverage"; then
  TESTS_REQUIRED=true
fi

# Detect issue linking requirements
ISSUE_LINK_REQUIRED=false
if echo "$CONTENT" | grep -qi "link.*issue\|reference.*issue\|must.*have.*issue\|require.*issue"; then
  ISSUE_LINK_REQUIRED=true
fi

HAS_CONTRIBUTING=true
if [ -z "$CONTENT" ]; then
  HAS_CONTRIBUTING=false
fi

cat <<ENDJSON
{
  "repo": "$REPO",
  "has_contributing": $HAS_CONTRIBUTING,
  "default_branch": "$DEFAULT_BRANCH",
  "target_branch": "$TARGET_BRANCH",
  "commit_convention": "$COMMIT_CONVENTION",
  "has_pr_template": $HAS_PR_TEMPLATE,
  "ai_disclosure": "$AI_DISCLOSURE",
  "anti_ai_policy": $ANTI_AI,
  "cla_type": "$CLA_TYPE",
  "tests_required": $TESTS_REQUIRED,
  "issue_link_required": $ISSUE_LINK_REQUIRED
}
ENDJSON
